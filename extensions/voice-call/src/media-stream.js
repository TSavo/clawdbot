/**
 * Media Stream Handler
 *
 * Handles bidirectional audio streaming between Twilio and the AI services.
 * - Receives mu-law audio from Twilio via WebSocket
 * - Forwards to OpenAI Realtime STT for transcription
 * - Sends TTS audio back to Twilio
 */
import { WebSocket, WebSocketServer } from "ws";
/**
 * Manages WebSocket connections for Twilio media streams.
 */
export class MediaStreamHandler {
    wss = null;
    sessions = new Map();
    config;
    constructor(config) {
        this.config = config;
    }
    /**
     * Handle WebSocket upgrade for media stream connections.
     */
    handleUpgrade(request, socket, head) {
        if (!this.wss) {
            this.wss = new WebSocketServer({ noServer: true });
            this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
        }
        this.wss.handleUpgrade(request, socket, head, (ws) => {
            this.wss?.emit("connection", ws, request);
        });
    }
    /**
     * Handle new WebSocket connection from Twilio.
     */
    async handleConnection(ws, _request) {
        let session = null;
        ws.on("message", async (data) => {
            try {
                const message = JSON.parse(data.toString());
                switch (message.event) {
                    case "connected":
                        console.log("[MediaStream] Twilio connected");
                        break;
                    case "start":
                        session = await this.handleStart(ws, message);
                        break;
                    case "media":
                        if (session && message.media?.payload) {
                            // Forward audio to STT
                            const audioBuffer = Buffer.from(message.media.payload, "base64");
                            session.sttSession.sendAudio(audioBuffer);
                        }
                        break;
                    case "stop":
                        if (session) {
                            this.handleStop(session);
                            session = null;
                        }
                        break;
                }
            }
            catch (error) {
                console.error("[MediaStream] Error processing message:", error);
            }
        });
        ws.on("close", () => {
            if (session) {
                this.handleStop(session);
            }
        });
        ws.on("error", (error) => {
            console.error("[MediaStream] WebSocket error:", error);
        });
    }
    /**
     * Handle stream start event.
     */
    async handleStart(ws, message) {
        const streamSid = message.streamSid || "";
        const callSid = message.start?.callSid || "";
        console.log(`[MediaStream] Stream started: ${streamSid} (call: ${callSid})`);
        // Create STT session
        const sttSession = this.config.sttProvider.createSession();
        // Set up transcript callbacks
        sttSession.onPartial((partial) => {
            this.config.onPartialTranscript?.(callSid, partial);
        });
        sttSession.onTranscript((transcript) => {
            this.config.onTranscript?.(callSid, transcript);
        });
        const session = {
            callId: callSid,
            streamSid,
            ws,
            sttSession,
        };
        this.sessions.set(streamSid, session);
        // Notify connection BEFORE STT connect so TTS can work even if STT fails
        this.config.onConnect?.(callSid, streamSid);
        // Connect to OpenAI STT (non-blocking, log errors but don't fail the call)
        sttSession.connect().catch((err) => {
            console.warn(`[MediaStream] STT connection failed (TTS still works):`, err.message);
        });
        return session;
    }
    /**
     * Handle stream stop event.
     */
    handleStop(session) {
        console.log(`[MediaStream] Stream stopped: ${session.streamSid}`);
        session.sttSession.close();
        this.sessions.delete(session.streamSid);
        this.config.onDisconnect?.(session.callId);
    }
    /**
     * Get an active session with an open WebSocket, or undefined if unavailable.
     */
    getOpenSession(streamSid) {
        const session = this.sessions.get(streamSid);
        return session?.ws.readyState === WebSocket.OPEN ? session : undefined;
    }
    /**
     * Send a message to a stream's WebSocket if available.
     */
    sendToStream(streamSid, message) {
        const session = this.getOpenSession(streamSid);
        session?.ws.send(JSON.stringify(message));
    }
    /**
     * Send audio to a specific stream (for TTS playback).
     * Audio should be mu-law encoded at 8kHz mono.
     */
    sendAudio(streamSid, muLawAudio) {
        this.sendToStream(streamSid, {
            event: "media",
            streamSid,
            media: { payload: muLawAudio.toString("base64") },
        });
    }
    /**
     * Send a mark event to track audio playback position.
     */
    sendMark(streamSid, name) {
        this.sendToStream(streamSid, {
            event: "mark",
            streamSid,
            mark: { name },
        });
    }
    /**
     * Clear audio buffer (interrupt playback).
     */
    clearAudio(streamSid) {
        this.sendToStream(streamSid, { event: "clear", streamSid });
    }
    /**
     * Get active session by call ID.
     */
    getSessionByCallId(callId) {
        return [...this.sessions.values()].find((session) => session.callId === callId);
    }
    /**
     * Close all sessions.
     */
    closeAll() {
        for (const session of this.sessions.values()) {
            session.sttSession.close();
            session.ws.close();
        }
        this.sessions.clear();
    }
}
