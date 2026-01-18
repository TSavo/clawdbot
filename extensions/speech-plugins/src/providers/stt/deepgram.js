/**
 * Deepgram STT Plugin Wrapper
 *
 * Wraps the DeepgramExecutor to conform to the STTProvider interface.
 * Cloud-based speech-to-text with real-time streaming and turn detection.
 */
import { BaseSTTPlugin } from './base.js';
/**
 * Deepgram STT Plugin
 *
 * Cloud-based STT provider with:
 * - Real-time streaming with <300ms latency
 * - Built-in turn detection
 * - 36+ languages
 * - Speaker identification (diarization)
 * - Smart formatting
 */
export class DeepgramSTTPlugin extends BaseSTTPlugin {
    constructor(deploymentConfig) {
        super(deploymentConfig);
        // Define provider metadata
        this.metadata = {
            id: 'deepgram-stt',
            name: 'Deepgram',
            description: 'Cloud-based STT with real-time streaming, turn detection, and diarization',
            version: '1.0.0',
            capabilities: this.getDeepgramCapabilities(),
            configSchema: {
                validate: (config) => {
                    if (!config || typeof config !== 'object') {
                        return { ok: false, errors: ['Config must be an object'] };
                    }
                    const cfg = config;
                    if (cfg.mode && cfg.mode !== 'cloud') {
                        return {
                            ok: false,
                            errors: ['Deepgram only supports "cloud" mode'],
                        };
                    }
                    if (!cfg.apiKey && !process.env.DEEPGRAM_API_KEY) {
                        return {
                            ok: false,
                            errors: ['apiKey is required (or set DEEPGRAM_API_KEY environment variable)'],
                        };
                    }
                    if (cfg.model && !['nova-v3', 'flux'].includes(cfg.model)) {
                        return {
                            ok: false,
                            errors: ['model must be "nova-v3" or "flux"'],
                        };
                    }
                    return { ok: true };
                },
                properties: {
                    mode: {
                        type: 'string',
                        description: 'Deployment mode (must be "cloud")',
                    },
                    apiKey: {
                        type: 'string',
                        description: 'Deepgram API key',
                    },
                    model: {
                        type: 'string',
                        description: 'Deepgram model: nova-v3 or flux',
                    },
                    language: {
                        type: 'string',
                        description: 'Default language for transcription (e.g., en-US, es-ES)',
                    },
                    enableTurnDetection: {
                        type: 'boolean',
                        description: 'Enable built-in turn detection',
                    },
                    detectLanguage: {
                        type: 'boolean',
                        description: 'Auto-detect language',
                    },
                    smartFormat: {
                        type: 'boolean',
                        description: 'Enable smart formatting (punctuation, capitalization)',
                    },
                    diarize: {
                        type: 'boolean',
                        description: 'Enable speaker identification',
                    },
                    numSpeakers: {
                        type: 'number',
                        description: 'Expected number of speakers (for diarization)',
                    },
                },
            },
        };
    }
    /**
     * Create DeepgramExecutor instance
     */
    createExecutor() {
        // Import DeepgramExecutor
        const { DeepgramExecutor } = require('../../../../../src/media/voice-providers/deepgram.js');
        // Build configuration from deployment config
        const config = this.buildDeepgramConfig();
        // Create executor
        return new DeepgramExecutor('deepgram-stt', config);
    }
    /**
     * Build Deepgram configuration from deployment config
     */
    buildDeepgramConfig() {
        const config = {
            apiKey: process.env.DEEPGRAM_API_KEY || '',
            model: 'flux',
            language: 'en-US',
            enableTurnDetection: true,
            smartFormat: true,
            diarize: false,
        };
        if (!this.deploymentConfig) {
            return config;
        }
        // Map deployment config to Deepgram config
        if (this.deploymentConfig.mode === 'cloud') {
            const cloudConfig = this.deploymentConfig;
            // API configuration
            if (cloudConfig.endpoint) {
                config.apiUrl = cloudConfig.endpoint;
            }
            // Authentication
            if (cloudConfig.auth?.headers?.['Authorization']) {
                // Extract API key from "Token <key>" format
                const authHeader = cloudConfig.auth.headers['Authorization'];
                const match = /Token (.+)/.exec(authHeader);
                if (match) {
                    config.apiKey = match[1];
                }
            }
            // Model selection
            if (cloudConfig.availableModels?.length) {
                config.model = cloudConfig.availableModels[0];
            }
        }
        // Apply environment variables and tags
        if (this.deploymentConfig.env) {
            if (this.deploymentConfig.env.DEEPGRAM_API_KEY) {
                config.apiKey = this.deploymentConfig.env.DEEPGRAM_API_KEY;
            }
            Object.assign(config, this.deploymentConfig.env);
        }
        if (this.deploymentConfig.tags) {
            if (this.deploymentConfig.tags.model) {
                config.model = this.deploymentConfig.tags.model;
            }
            if (this.deploymentConfig.tags.language) {
                config.language = this.deploymentConfig.tags.language;
            }
            if (this.deploymentConfig.tags.enableTurnDetection !== undefined) {
                config.enableTurnDetection = this.deploymentConfig.tags.enableTurnDetection === 'true';
            }
            if (this.deploymentConfig.tags.diarize !== undefined) {
                config.diarize = this.deploymentConfig.tags.diarize === 'true';
            }
        }
        return config;
    }
    /**
     * Get Deepgram-specific capabilities
     */
    getDeepgramCapabilities() {
        return {
            formats: ['wav', 'mp3', 'opus', 'aac', 'ogg'],
            sampleRates: [8000, 16000, 48000],
            supportsStreaming: true,
            supportsPartialTranscripts: true,
            languages: [
                'en-US', 'en-GB', 'en-AU', 'en-IN',
                'es-ES', 'es-MX',
                'fr-FR',
                'de-DE',
                'it-IT',
                'ja-JP',
                'zh-CN', 'zh-TW',
                'ko-KR',
                'ru-RU',
                'pt-BR', 'pt-PT',
                'nl-NL',
                'tr-TR',
                'ar-SA',
                'hi-IN',
            ],
            maxDurationSeconds: null,
        };
    }
}
//# sourceMappingURL=deepgram.js.map