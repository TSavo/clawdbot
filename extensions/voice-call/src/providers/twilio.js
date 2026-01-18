import crypto from "node:crypto";
import { escapeXml, mapVoiceToPolly } from "../voice-mapping.js";
import { chunkAudio } from "./tts-openai.js";
import { twilioApiRequest } from "./twilio/api.js";
import { verifyTwilioProviderWebhook } from "./twilio/webhook.js";
export class TwilioProvider {
    name = "twilio";
    accountSid;
    authToken;
    baseUrl;
    callWebhookUrls = new Map();
    options;
    /** Current public webhook URL (set when tunnel starts or from config) */
    currentPublicUrl = null;
    /** Optional OpenAI TTS provider for streaming TTS */
    ttsProvider = null;
    /** Optional media stream handler for sending audio */
    mediaStreamHandler = null;
    /** Map of call SID to stream SID for media streams */
    callStreamMap = new Map();
    constructor(config, options = {}) {
        if (!config.accountSid) {
            throw new Error("Twilio Account SID is required");
        }
        if (!config.authToken) {
            throw new Error("Twilio Auth Token is required");
        }
        this.accountSid = config.accountSid;
        this.authToken = config.authToken;
        this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}`;
        this.options = options;
        if (options.publicUrl) {
            this.currentPublicUrl = options.publicUrl;
        }
    }
    setPublicUrl(url) {
        this.currentPublicUrl = url;
    }
    getPublicUrl() {
        return this.currentPublicUrl;
    }
    setTTSProvider(provider) {
        this.ttsProvider = provider;
    }
    setMediaStreamHandler(handler) {
        this.mediaStreamHandler = handler;
    }
    registerCallStream(callSid, streamSid) {
        this.callStreamMap.set(callSid, streamSid);
    }
    unregisterCallStream(callSid) {
        this.callStreamMap.delete(callSid);
    }
    /**
     * Make an authenticated request to the Twilio API.
     */
    async apiRequest(endpoint, params, options) {
        return await twilioApiRequest({
            baseUrl: this.baseUrl,
            accountSid: this.accountSid,
            authToken: this.authToken,
            endpoint,
            body: params,
            allowNotFound: options?.allowNotFound,
        });
    }
    /**
     * Verify Twilio webhook signature using HMAC-SHA1.
     *
     * Handles reverse proxy scenarios (Tailscale, nginx, ngrok) by reconstructing
     * the public URL from forwarding headers.
     *
     * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
     */
    verifyWebhook(ctx) {
        return verifyTwilioProviderWebhook({
            ctx,
            authToken: this.authToken,
            currentPublicUrl: this.currentPublicUrl,
            options: this.options,
        });
    }
    /**
     * Parse Twilio webhook event into normalized format.
     */
    parseWebhookEvent(ctx) {
        try {
            const params = new URLSearchParams(ctx.rawBody);
            const callIdFromQuery = typeof ctx.query?.callId === "string" && ctx.query.callId.trim()
                ? ctx.query.callId.trim()
                : undefined;
            const event = this.normalizeEvent(params, callIdFromQuery);
            // For Twilio, we must return TwiML. Most actions are driven by Calls API updates,
            // so the webhook response is typically a pause to keep the call alive.
            const twiml = this.generateTwimlResponse(ctx);
            return {
                events: event ? [event] : [],
                providerResponseBody: twiml,
                providerResponseHeaders: { "Content-Type": "application/xml" },
                statusCode: 200,
            };
        }
        catch {
            return { events: [], statusCode: 400 };
        }
    }
    /**
     * Parse Twilio direction to normalized format.
     */
    static parseDirection(direction) {
        if (direction === "inbound")
            return "inbound";
        if (direction === "outbound-api" || direction === "outbound-dial")
            return "outbound";
        return undefined;
    }
    /**
     * Convert Twilio webhook params to normalized event format.
     */
    normalizeEvent(params, callIdOverride) {
        const callSid = params.get("CallSid") || "";
        const baseEvent = {
            id: crypto.randomUUID(),
            callId: callIdOverride || callSid,
            providerCallId: callSid,
            timestamp: Date.now(),
            direction: TwilioProvider.parseDirection(params.get("Direction")),
            from: params.get("From") || undefined,
            to: params.get("To") || undefined,
        };
        // Handle speech result (from <Gather>)
        const speechResult = params.get("SpeechResult");
        if (speechResult) {
            return {
                ...baseEvent,
                type: "call.speech",
                transcript: speechResult,
                isFinal: true,
                confidence: parseFloat(params.get("Confidence") || "0.9"),
            };
        }
        // Handle DTMF
        const digits = params.get("Digits");
        if (digits) {
            return { ...baseEvent, type: "call.dtmf", digits };
        }
        // Handle call status changes
        const callStatus = params.get("CallStatus");
        switch (callStatus) {
            case "initiated":
                return { ...baseEvent, type: "call.initiated" };
            case "ringing":
                return { ...baseEvent, type: "call.ringing" };
            case "in-progress":
                return { ...baseEvent, type: "call.answered" };
            case "completed":
            case "busy":
            case "no-answer":
            case "failed":
                return { ...baseEvent, type: "call.ended", reason: callStatus };
            case "canceled":
                return { ...baseEvent, type: "call.ended", reason: "hangup-bot" };
            default:
                return null;
        }
    }
    static EMPTY_TWIML = '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
    static PAUSE_TWIML = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="30"/>
</Response>`;
    /**
     * Generate TwiML response for webhook.
     * When a call is answered, connects to media stream for bidirectional audio.
     */
    generateTwimlResponse(ctx) {
        if (!ctx)
            return TwilioProvider.EMPTY_TWIML;
        const params = new URLSearchParams(ctx.rawBody);
        const callStatus = params.get("CallStatus");
        const direction = params.get("Direction");
        console.log(`[voice-call] generateTwimlResponse: status=${callStatus} direction=${direction}`);
        // For inbound calls, answer immediately with stream
        if (direction === "inbound") {
            const streamUrl = this.getStreamUrl();
            return streamUrl
                ? this.getStreamConnectXml(streamUrl)
                : TwilioProvider.PAUSE_TWIML;
        }
        // For outbound calls, only connect to stream when call is in-progress
        if (callStatus !== "in-progress") {
            return TwilioProvider.EMPTY_TWIML;
        }
        const streamUrl = this.getStreamUrl();
        return streamUrl
            ? this.getStreamConnectXml(streamUrl)
            : TwilioProvider.PAUSE_TWIML;
    }
    /**
     * Get the WebSocket URL for media streaming.
     * Derives from the public URL origin + stream path.
     */
    getStreamUrl() {
        if (!this.currentPublicUrl || !this.options.streamPath) {
            return null;
        }
        // Extract just the origin (host) from the public URL, ignoring any path
        const url = new URL(this.currentPublicUrl);
        const origin = url.origin;
        // Convert https:// to wss:// for WebSocket
        const wsOrigin = origin
            .replace(/^https:\/\//, "wss://")
            .replace(/^http:\/\//, "ws://");
        // Append the stream path
        const path = this.options.streamPath.startsWith("/")
            ? this.options.streamPath
            : `/${this.options.streamPath}`;
        return `${wsOrigin}${path}`;
    }
    /**
     * Generate TwiML to connect a call to a WebSocket media stream.
     * This enables bidirectional audio streaming for real-time STT/TTS.
     *
     * @param streamUrl - WebSocket URL (wss://...) for the media stream
     */
    getStreamConnectXml(streamUrl) {
        return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${escapeXml(streamUrl)}" />
  </Connect>
</Response>`;
    }
    /**
     * Initiate an outbound call via Twilio API.
     * If inlineTwiml is provided, uses that directly (for notify mode).
     * Otherwise, uses webhook URL for dynamic TwiML.
     */
    async initiateCall(input) {
        const url = new URL(input.webhookUrl);
        url.searchParams.set("callId", input.callId);
        // Build request params
        const params = {
            To: input.to,
            From: input.from,
            StatusCallback: url.toString(),
            StatusCallbackEvent: "initiated ringing answered completed",
            Timeout: "30",
        };
        // Use inline TwiML for notify mode (simpler, no webhook needed)
        if (input.inlineTwiml) {
            params.Twiml = input.inlineTwiml;
        }
        else {
            params.Url = url.toString();
        }
        const result = await this.apiRequest("/Calls.json", params);
        this.callWebhookUrls.set(result.sid, url.toString());
        return {
            providerCallId: result.sid,
            status: result.status === "queued" ? "queued" : "initiated",
        };
    }
    /**
     * Hang up a call via Twilio API.
     */
    async hangupCall(input) {
        this.callWebhookUrls.delete(input.providerCallId);
        await this.apiRequest(`/Calls/${input.providerCallId}.json`, { Status: "completed" }, { allowNotFound: true });
    }
    /**
     * Play TTS audio via Twilio.
     *
     * Two modes:
     * 1. OpenAI TTS + Media Streams: If TTS provider and media stream are available,
     *    generates audio via OpenAI and streams it through WebSocket (preferred).
     * 2. TwiML <Say>: Falls back to Twilio's native TTS with Polly voices.
     *    Note: This may not work on all Twilio accounts.
     */
    async playTts(input) {
        // Try OpenAI TTS via media stream first (if configured)
        const streamSid = this.callStreamMap.get(input.providerCallId);
        if (this.ttsProvider && this.mediaStreamHandler && streamSid) {
            try {
                await this.playTtsViaStream(input.text, streamSid);
                return;
            }
            catch (err) {
                console.warn(`[voice-call] OpenAI TTS failed, falling back to Twilio <Say>:`, err instanceof Error ? err.message : err);
                // Fall through to TwiML <Say> fallback
            }
        }
        // Fall back to TwiML <Say> (may not work on all accounts)
        const webhookUrl = this.callWebhookUrls.get(input.providerCallId);
        if (!webhookUrl) {
            throw new Error("Missing webhook URL for this call (provider state not initialized)");
        }
        console.warn("[voice-call] Using TwiML <Say> fallback - OpenAI TTS not configured or media stream not active");
        const pollyVoice = mapVoiceToPolly(input.voice);
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${pollyVoice}" language="${input.locale || "en-US"}">${escapeXml(input.text)}</Say>
  <Gather input="speech" speechTimeout="auto" action="${escapeXml(webhookUrl)}" method="POST">
    <Say>.</Say>
  </Gather>
</Response>`;
        await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
            Twiml: twiml,
        });
    }
    /**
     * Play TTS via OpenAI and Twilio Media Streams.
     * Generates audio with OpenAI TTS, converts to mu-law, and streams via WebSocket.
     * Uses a jitter buffer to smooth out timing variations.
     */
    async playTtsViaStream(text, streamSid) {
        if (!this.ttsProvider || !this.mediaStreamHandler) {
            throw new Error("TTS provider and media stream handler required");
        }
        // Generate audio with OpenAI TTS (returns mu-law at 8kHz)
        const muLawAudio = await this.ttsProvider.synthesizeForTwilio(text);
        // Stream audio in 20ms chunks (160 bytes at 8kHz mu-law)
        const CHUNK_SIZE = 160;
        const CHUNK_DELAY_MS = 20;
        for (const chunk of chunkAudio(muLawAudio, CHUNK_SIZE)) {
            this.mediaStreamHandler.sendAudio(streamSid, chunk);
            // Pace the audio to match real-time playback
            await new Promise((resolve) => setTimeout(resolve, CHUNK_DELAY_MS));
        }
        // Send a mark to track when audio finishes
        this.mediaStreamHandler.sendMark(streamSid, `tts-${Date.now()}`);
    }
    /**
     * Start listening for speech via Twilio <Gather>.
     */
    async startListening(input) {
        const webhookUrl = this.callWebhookUrls.get(input.providerCallId);
        if (!webhookUrl) {
            throw new Error("Missing webhook URL for this call (provider state not initialized)");
        }
        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" speechTimeout="auto" language="${input.language || "en-US"}" action="${escapeXml(webhookUrl)}" method="POST">
  </Gather>
</Response>`;
        await this.apiRequest(`/Calls/${input.providerCallId}.json`, {
            Twiml: twiml,
        });
    }
    /**
     * Stop listening - for Twilio this is a no-op as <Gather> auto-ends.
     */
    async stopListening(_input) {
        // Twilio's <Gather> automatically stops on speech end
        // No explicit action needed
    }
}
