/**
 * OpenAI TTS Provider Plugin
 *
 * Generates speech audio using OpenAI's text-to-speech API.
 * Handles audio format conversion for telephony (mu-law 8kHz).
 *
 * Best practices from OpenAI docs:
 * - Use gpt-4o-mini-tts for intelligent realtime applications (supports instructions)
 * - Use tts-1 for lower latency, tts-1-hd for higher quality
 * - Use marin or cedar voices for best quality
 * - Use pcm or wav format for fastest response times
 *
 * @see https://platform.openai.com/docs/guides/text-to-speech
 */
import { chunkAudio, mulawToLinear, pcmToMulaw, resample24kTo8k, } from "./audio-utils.js";
/**
 * Supported OpenAI TTS voices (all 13 built-in voices).
 * For best quality, use marin or cedar.
 * Note: tts-1 and tts-1-hd support a smaller set.
 */
export const OPENAI_TTS_VOICES = [
    "alloy",
    "ash",
    "ballad",
    "coral",
    "echo",
    "fable",
    "nova",
    "onyx",
    "sage",
    "shimmer",
    "verse",
    "marin",
    "cedar",
];
/**
 * Plugin metadata for OpenAI TTS.
 */
const METADATA = {
    name: "openai-tts",
    version: "1.0.0",
    type: "tts",
    description: "OpenAI Text-to-Speech API for generating high-quality speech audio",
    capabilities: ["streaming", "voice-selection", "speed-control", "instructions"],
    authors: ["Clawdbot Contributors"],
    license: "MIT",
};
/**
 * OpenAI TTS Provider Plugin.
 *
 * Provides text-to-speech capabilities using OpenAI's TTS API.
 * Handles audio generation and format conversion for Twilio compatibility.
 */
export class OpenAITTSProvider {
    metadata = METADATA;
    apiKey;
    model;
    voice;
    speed;
    instructions;
    constructor(config = {}) {
        this.apiKey = config.apiKey || process.env.OPENAI_API_KEY || "";
        // Default to gpt-4o-mini-tts for intelligent realtime applications
        this.model = config.model || "gpt-4o-mini-tts";
        // Default to coral - good balance of quality and natural tone
        this.voice = config.voice || "coral";
        this.speed = config.speed || 1.0;
        this.instructions = config.instructions;
    }
    validateConfig() {
        if (!this.apiKey) {
            throw new Error("OpenAI API key is required (set OPENAI_API_KEY or pass apiKey)");
        }
        if (this.speed < 0.25 || this.speed > 4.0) {
            throw new Error("Speed must be between 0.25 and 4.0");
        }
        if (!OPENAI_TTS_VOICES.includes(this.voice)) {
            throw new Error(`Invalid voice: ${this.voice}`);
        }
    }
    /**
     * Generate speech audio from text.
     * Returns raw PCM audio data (24kHz, mono, 16-bit).
     */
    async synthesize(text, options) {
        // Build request body
        const body = {
            model: this.model,
            input: text,
            voice: options?.voice || this.voice,
            response_format: "pcm", // Raw PCM audio (24kHz, mono, 16-bit signed LE)
            speed: options?.speed || this.speed,
        };
        // Add instructions if using gpt-4o-mini-tts model
        const effectiveInstructions = options?.instructions || this.instructions;
        if (effectiveInstructions && this.model.includes("gpt-4o-mini-tts")) {
            body.instructions = effectiveInstructions;
        }
        const response = await fetch("https://api.openai.com/v1/audio/speech", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${this.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        if (!response.ok) {
            const error = await response.text();
            throw new Error(`OpenAI TTS failed: ${response.status} - ${error}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    /**
     * Generate speech and convert to mu-law format for Twilio.
     * Twilio Media Streams expect 8kHz mono mu-law audio.
     */
    async synthesizeForTwilio(text) {
        // Get raw PCM from OpenAI (24kHz, 16-bit signed LE, mono)
        const pcm24k = await this.synthesize(text);
        // Resample from 24kHz to 8kHz
        const pcm8k = resample24kTo8k(pcm24k);
        // Encode to mu-law
        return pcmToMulaw(pcm8k);
    }
}
// Re-export audio utilities for backwards compatibility
export { chunkAudio, mulawToLinear, pcmToMulaw, resample24kTo8k };
