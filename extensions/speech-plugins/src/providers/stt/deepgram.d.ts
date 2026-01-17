/**
 * Deepgram STT Plugin Wrapper
 *
 * Wraps the DeepgramExecutor to conform to the STTProvider interface.
 * Cloud-based speech-to-text with real-time streaming and turn detection.
 */
import { BaseSTTPlugin } from './base.js';
import type { STTProviderMetadata } from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
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
export declare class DeepgramSTTPlugin extends BaseSTTPlugin {
    readonly metadata: STTProviderMetadata;
    constructor(deploymentConfig?: DeploymentConfig);
    /**
     * Create DeepgramExecutor instance
     */
    protected createExecutor(): VoiceProviderExecutor;
    /**
     * Build Deepgram configuration from deployment config
     */
    private buildDeepgramConfig;
    /**
     * Get Deepgram-specific capabilities
     */
    private getDeepgramCapabilities;
}
//# sourceMappingURL=deepgram.d.ts.map