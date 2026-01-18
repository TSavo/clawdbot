/**
 * Chatterbox TTS Plugin Wrapper
 *
 * Wraps the Chatterbox executor for use as a TTSProvider plugin.
 * Supports Cloud, Docker, and System deployment modes.
 */
import { BaseTTSPlugin } from './base.js';
import { ChatterboxExecutor } from '@media/voice-providers/chatterbox.js';
/**
 * Chatterbox TTS Plugin
 */
export class ChatterboxTTSPlugin extends BaseTTSPlugin {
    constructor(config) {
        super();
        this.config = config;
        // Build metadata from config
        this.metadata = {
            id: 'chatterbox-tts',
            name: 'Chatterbox TTS',
            description: `Advanced voice synthesis in ${config.deploymentMode} mode`,
            version: '1.0.0',
            capabilities: this.buildCapabilities(),
            configSchema: {
                validate: (config) => {
                    const cfg = config;
                    const errors = [];
                    const validModes = ['cloud', 'docker', 'system'];
                    if (!validModes.includes(cfg.deploymentMode)) {
                        errors.push('deploymentMode must be cloud, docker, or system');
                    }
                    if (cfg.exaggeration !== undefined && (cfg.exaggeration < 0.25 || cfg.exaggeration > 2.0)) {
                        errors.push('exaggeration must be between 0.25 and 2.0');
                    }
                    if (cfg.temperature !== undefined && (cfg.temperature < 0.05 || cfg.temperature > 5.0)) {
                        errors.push('temperature must be between 0.05 and 5.0');
                    }
                    return { ok: errors.length === 0, errors };
                },
                properties: {
                    deploymentMode: { type: 'string', description: 'Deployment mode: cloud, docker, or system' },
                    cloudEndpoint: { type: 'string', description: 'Cloud API endpoint' },
                    apiKey: { type: 'string', description: 'API key for authentication' },
                    exaggeration: { type: 'number', description: 'Emotion intensity (0.25-2.0)' },
                    temperature: { type: 'number', description: 'Voice variability (0.05-5.0)' },
                },
            },
        };
    }
    /**
     * Create Chatterbox executor instance
     */
    createExecutor(config) {
        // Merge provided config with constructor config
        const finalConfig = { ...this.config, ...(config || {}) };
        return new ChatterboxExecutor(finalConfig);
    }
    /**
     * Build capabilities from executor
     */
    buildCapabilities() {
        return {
            formats: ['pcm', 'mp3'],
            sampleRates: [16000, 24000, 44100, 48000],
            voices: this.getDefaultVoices(),
            supportsStreaming: true,
            languages: [
                'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'uk', 'ja', 'ko',
                'zh', 'ar', 'hi', 'tr', 'vi', 'th', 'id', 'fi', 'sv', 'no', 'da',
            ],
        };
    }
    /**
     * Get default voices
     */
    getDefaultVoices() {
        return [
            {
                id: 'default',
                name: 'Default Voice',
                language: 'en',
                gender: 'neutral',
                characteristics: ['expressive', 'natural'],
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
                        characteristics: voice.description ? [voice.description] : undefined,
                    });
                }
                return voices;
            }
        }
        return this.metadata.capabilities.voices;
    }
}
//# sourceMappingURL=chatterbox.js.map