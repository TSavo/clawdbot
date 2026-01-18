/**
 * Voice Provider Execution Layer
 *
 * Defines the unified interface for STT/TTS providers and
 * establishes the contract that all implementations must follow.
 */
export var AudioFormat;
(function (AudioFormat) {
    AudioFormat["PCM_16"] = "pcm16";
    AudioFormat["OPUS"] = "opus";
    AudioFormat["AAC"] = "aac";
    AudioFormat["MP3"] = "mp3";
    AudioFormat["VORBIS"] = "vorbis";
})(AudioFormat || (AudioFormat = {}));
/**
 * Base executor class for common functionality
 */
export class BaseVoiceProviderExecutor {
    async initialize() {
        // Override in subclass if needed
    }
    async shutdown() {
        // Override in subclass if needed
    }
    /**
     * Helper to create empty/silence audio buffer
     */
    createSilence(duration, sampleRate = 16000) {
        const samples = Math.floor((duration * sampleRate) / 1000);
        return {
            data: new Uint8Array(samples * 2),
            format: AudioFormat.PCM_16,
            sampleRate,
            duration,
            channels: 1,
        };
    }
    /**
     * Helper to normalize audio to standard format
     */
    normalizeAudioBuffer(audio, targetFormat = AudioFormat.PCM_16, targetSampleRate = 16000) {
        // TODO: Implement format conversion and resampling
        // For now, just return as-is (assume already normalized)
        return audio;
    }
}
/**
 * Error class for provider-specific errors
 */
export class VoiceProviderError extends Error {
    constructor(message, provider, code) {
        super(`${provider}: ${message}`);
        this.provider = provider;
        this.code = code;
        this.name = 'VoiceProviderError';
    }
}
//# sourceMappingURL=executor.js.map