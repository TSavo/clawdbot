/**
 * Chatterbox TTS Plugin Wrapper
 *
 * Wraps the Chatterbox executor for use as a TTSProvider plugin.
 * Supports Cloud, Docker, and System deployment modes.
 */
import type { TTSProviderMetadata, TTSVoice } from '../../interfaces/tts-provider.js';
import { BaseTTSPlugin } from './base.js';
import { ChatterboxExecutor } from '@media/voice-providers/chatterbox.js';
import type { ChatterboxConfig } from '@media/voice-providers/chatterbox.js';
/**
 * Chatterbox TTS Plugin
 */
export declare class ChatterboxTTSPlugin extends BaseTTSPlugin {
    private config;
    readonly metadata: TTSProviderMetadata;
    constructor(config: ChatterboxConfig);
    /**
     * Create Chatterbox executor instance
     */
    protected createExecutor(config?: Record<string, unknown>): ChatterboxExecutor;
    /**
     * Build capabilities from executor
     */
    private buildCapabilities;
    /**
     * Get default voices
     */
    private getDefaultVoices;
    /**
     * List available voices (dynamically populated from API)
     */
    listVoices(): Promise<TTSVoice[]>;
}
//# sourceMappingURL=chatterbox.d.ts.map