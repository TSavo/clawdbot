/**
 * CartesiaAI TTS Plugin Wrapper
 *
 * Wraps the CartesiaAI executor for use as a TTSProvider plugin.
 * Supports ultra-fast voice synthesis with model selection.
 */
import type { TTSProviderMetadata, TTSVoice } from '../../interfaces/tts-provider.js';
import { BaseTTSPlugin } from './base.js';
import { CartesiaExecutor } from '@media/voice-providers/cartesia.js';
import type { CartesiaConfig } from '@media/voice-providers/cartesia.js';
/**
 * CartesiaAI TTS Plugin
 */
export declare class CartesiaTTSPlugin extends BaseTTSPlugin {
    private config;
    readonly metadata: TTSProviderMetadata;
    constructor(config: CartesiaConfig);
    /**
     * Create CartesiaAI executor instance
     */
    protected createExecutor(config?: Record<string, unknown>): CartesiaExecutor;
    /**
     * Build capabilities from executor
     */
    private buildCapabilities;
    /**
     * Get available voices
     */
    private getVoices;
    /**
     * List available voices (dynamically populated)
     */
    listVoices(): Promise<TTSVoice[]>;
}
//# sourceMappingURL=cartesia.d.ts.map