/**
 * ElevenLabs TTS Plugin Wrapper
 *
 * Wraps the ElevenLabs executor for use as a TTSProvider plugin.
 * Supports premium voice synthesis with extensive voice library.
 */
import type { TTSProviderMetadata, TTSVoice } from '../../interfaces/tts-provider.js';
import { BaseTTSPlugin } from './base.js';
import { ElevenLabsExecutor } from '@media/voice-providers/tts-elevenlabs.js';
/**
 * ElevenLabs TTS configuration
 */
export interface ElevenLabsTTSConfig {
    apiKey: string;
    model?: string;
    voiceId?: string;
    stability?: number;
    similarityBoost?: number;
    timeout?: number;
}
/**
 * ElevenLabs TTS Plugin
 */
export declare class ElevenLabsTTSPlugin extends BaseTTSPlugin {
    private config;
    readonly metadata: TTSProviderMetadata;
    constructor(config: ElevenLabsTTSConfig);
    /**
     * Create ElevenLabs executor instance
     */
    protected createExecutor(config?: Record<string, unknown>): ElevenLabsExecutor;
    /**
     * Build capabilities from executor
     */
    private buildCapabilities;
    /**
     * Get default voices (will be populated dynamically after initialization)
     */
    private getDefaultVoices;
    /**
     * List available voices (dynamically populated from API)
     */
    listVoices(): Promise<TTSVoice[]>;
}
//# sourceMappingURL=elevenlabs.d.ts.map