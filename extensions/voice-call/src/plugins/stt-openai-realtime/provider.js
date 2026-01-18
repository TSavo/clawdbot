/**
 * OpenAI Realtime STT Provider Plugin
 *
 * Uses the OpenAI Realtime API for streaming transcription with:
 * - Direct mu-law audio support (no conversion needed)
 * - Built-in server-side VAD for turn detection
 * - Low-latency streaming transcription
 * - Partial transcript callbacks for real-time UI updates
 */
import { randomUUID } from "crypto";
import { OpenAIRealtimeSTTSession } from "./session.js";
/**
 * Plugin metadata for OpenAI Realtime STT.
 */
const METADATA = {
    name: "openai-realtime",
    version: "1.0.0",
    type: "stt",
    description: "OpenAI Realtime API for streaming speech-to-text with server-side VAD",
    capabilities: ["streaming", "realtime", "vad", "mu-law"],
    authors: ["Clawdbot Contributors"],
    license: "MIT",
};
/**
 * OpenAI Realtime STT Provider Plugin.
 *
 * Provides speech-to-text capabilities using OpenAI's Realtime API.
 * Handles WebSocket connections, VAD, and streaming transcription.
 */
export class OpenAIRealtimeSTTProvider {
    metadata = METADATA;
    apiKey;
    model;
    silenceDurationMs;
    vadThreshold;
    constructor(config) {
        if (!config.apiKey) {
            throw new Error("OpenAI API key required for Realtime STT");
        }
        this.apiKey = config.apiKey;
        this.model = config.model || "gpt-4o-transcribe";
        this.silenceDurationMs = config.silenceDurationMs || 800;
        this.vadThreshold = config.vadThreshold || 0.5;
    }
    validateConfig() {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is required");
        }
        if (this.vadThreshold < 0 || this.vadThreshold > 1) {
            throw new Error("VAD threshold must be between 0 and 1");
        }
        if (this.silenceDurationMs < 100) {
            throw new Error("Silence duration must be at least 100ms");
        }
    }
    /**
     * Create a new realtime transcription session.
     */
    createSession(config) {
        const sessionId = config?.instanceId || randomUUID();
        return new OpenAIRealtimeSTTSession(sessionId, this.apiKey, this.model, this.silenceDurationMs, this.vadThreshold);
    }
}
