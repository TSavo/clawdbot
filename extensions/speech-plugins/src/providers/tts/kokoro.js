/**
 * Kokoro TTS Plugin Wrapper
 *
 * Wraps the Kokoro executor for use as a TTSProvider plugin.
 * Supports Docker, System, and Cloud deployment modes.
 */
import { BaseTTSPlugin } from './base.js';
import { KokoroExecutor } from '@media/voice-providers/kokoro.js';
/**
 * Kokoro TTS Plugin
 */
export class KokoroTTSPlugin extends BaseTTSPlugin {
    constructor(config) {
        super();
        this.config = config;
        // Build metadata from config
        this.metadata = {
            id: 'kokoro-tts',
            name: 'Kokoro TTS',
            description: 'High-quality neural TTS with multi-language support',
            version: '1.0.0',
            capabilities: this.buildCapabilities(),
        };
    }
    /**
     * Create Kokoro executor instance
     */
    createExecutor(config) {
        // Merge provided config with constructor config
        const finalConfig = { ...this.config, ...(config || {}) };
        return new KokoroExecutor(finalConfig);
    }
    /**
     * Build capabilities from executor
     */
    buildCapabilities() {
        return {
            formats: ['pcm', 'wav'],
            sampleRates: [16000],
            voices: [
                {
                    id: 'af',
                    name: 'American Female',
                    language: 'en',
                    gender: 'female',
                    characteristics: ['natural', 'expressive'],
                },
                {
                    id: 'am',
                    name: 'American Male',
                    language: 'en',
                    gender: 'male',
                    characteristics: ['natural', 'expressive'],
                },
                {
                    id: 'bf',
                    name: 'British Female',
                    language: 'en',
                    gender: 'female',
                    characteristics: ['natural', 'british'],
                },
                {
                    id: 'bm',
                    name: 'British Male',
                    language: 'en',
                    gender: 'male',
                    characteristics: ['natural', 'british'],
                },
            ],
            supportsStreaming: true,
            languages: ['en', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ko'],
        };
    }
    /**
     * List available voices
     */
    async listVoices() {
        return this.metadata.capabilities.voices;
    }
}
//# sourceMappingURL=kokoro.js.map