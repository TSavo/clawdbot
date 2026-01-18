/**
 * ElevenLabs TTS Plugin Wrapper
 *
 * Wraps the ElevenLabs executor for use as a TTSProvider plugin.
 * Supports premium voice synthesis with extensive voice library.
 */
import { BaseTTSPlugin } from './base.js';
import { ElevenLabsExecutor } from '@media/voice-providers/tts-elevenlabs.js';
/**
 * ElevenLabs TTS Plugin
 */
export class ElevenLabsTTSPlugin extends BaseTTSPlugin {
    constructor(config) {
        super();
        this.config = config;
        // Build metadata from config
        this.metadata = {
            id: 'elevenlabs-tts',
            name: 'ElevenLabs TTS',
            description: 'Premium voice synthesis with extensive voice library',
            version: '1.0.0',
            capabilities: this.buildCapabilities(),
            configSchema: {
                validate: (config) => {
                    const cfg = config;
                    const errors = [];
                    if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
                        errors.push('apiKey is required and must be a string');
                    }
                    if (cfg.stability !== undefined && (cfg.stability < 0 || cfg.stability > 1)) {
                        errors.push('stability must be between 0 and 1');
                    }
                    if (cfg.similarityBoost !== undefined && (cfg.similarityBoost < 0 || cfg.similarityBoost > 1)) {
                        errors.push('similarityBoost must be between 0 and 1');
                    }
                    return { ok: errors.length === 0, errors };
                },
                properties: {
                    apiKey: { type: 'string', description: 'ElevenLabs API key' },
                    model: { type: 'string', description: 'Model ID (e.g., eleven_monolingual_v1)' },
                    voiceId: { type: 'string', description: 'Default voice ID' },
                    stability: { type: 'number', description: 'Voice stability (0-1)' },
                    similarityBoost: { type: 'number', description: 'Similarity boost (0-1)' },
                },
            },
        };
    }
    /**
     * Create ElevenLabs executor instance
     */
    createExecutor(config) {
        // Merge provided config with constructor config
        const finalConfig = { ...this.config, ...(config || {}) };
        return new ElevenLabsExecutor(finalConfig);
    }
    /**
     * Build capabilities from executor
     */
    buildCapabilities() {
        return {
            formats: ['mp3', 'pcm'],
            sampleRates: [16000, 22050, 24000, 44100],
            voices: this.getDefaultVoices(),
            supportsStreaming: true,
            languages: [
                'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'uk', 'ja', 'ko',
                'zh', 'ar', 'hi', 'tr', 'sv', 'no', 'da', 'fi', 'cs', 'hu', 'ro',
            ],
        };
    }
    /**
     * Get default voices (will be populated dynamically after initialization)
     */
    getDefaultVoices() {
        return [
            {
                id: 'rachel',
                name: 'Rachel',
                language: 'en',
                gender: 'female',
                characteristics: ['calm', 'professional'],
            },
            {
                id: 'adam',
                name: 'Adam',
                language: 'en',
                gender: 'male',
                characteristics: ['deep', 'authoritative'],
            },
        ];
    }
    /**
     * List available voices (dynamically populated from API)
     */
    async listVoices() {
        this.ensureInitialized();
        // If executor has loaded voices, use them
        if (this.executor && 'availableVoices' in this.executor) {
            const executorVoices = this.executor.availableVoices;
            if (executorVoices && executorVoices.size > 0) {
                const voices = [];
                for (const [id, voice] of executorVoices.entries()) {
                    voices.push({
                        id,
                        name: voice.name || id,
                        language: voice.language || 'en',
                        gender: voice.gender,
                        characteristics: voice.labels ? Object.keys(voice.labels) : undefined,
                    });
                }
                return voices;
            }
        }
        return this.metadata.capabilities.voices;
    }
}
//# sourceMappingURL=elevenlabs.js.map