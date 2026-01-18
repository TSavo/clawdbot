/**
 * Kokoro TTS Plugin Wrapper
 *
 * Wraps the Kokoro executor for use as a TTSProvider plugin.
 * Supports Docker, System, and Cloud deployment modes.
 */
import type { TTSProviderMetadata, TTSVoice } from '../../interfaces/tts-provider.js';
import { BaseTTSPlugin } from './base.js';
import { KokoroExecutor } from '@media/voice-providers/kokoro.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
/**
 * Kokoro TTS plugin configuration
 */
export interface KokoroTTSConfig extends DeploymentConfig {
    mode: 'docker' | 'system' | 'cloud';
    docker?: {
        image: string;
        port: number;
        volumes?: Record<string, string>;
        env?: Record<string, string>;
    };
    system?: {
        pythonPath?: string;
        installCmd?: string;
    };
    cloud?: {
        endpoint: string;
        apiKey?: string;
    };
    healthCheck?: {
        endpoint: string;
        interval: number;
    };
}
/**
 * Kokoro TTS Plugin
 */
export declare class KokoroTTSPlugin extends BaseTTSPlugin {
    private config;
    readonly metadata: TTSProviderMetadata;
    constructor(config: KokoroTTSConfig);
    /**
     * Create Kokoro executor instance
     */
    protected createExecutor(config?: Record<string, unknown>): KokoroExecutor;
    /**
     * Build capabilities from executor
     */
    private buildCapabilities;
    /**
     * List available voices
     */
    listVoices(): Promise<TTSVoice[]>;
}
//# sourceMappingURL=kokoro.d.ts.map