/**
 * Faster-Whisper STT Plugin Wrapper
 *
 * Wraps the FasterWhisperExecutor to conform to the STTProvider interface.
 * Optimized Whisper implementation with GPU support and compute type selection.
 */
import { BaseSTTPlugin } from './base.js';
import type { STTProviderMetadata } from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
/**
 * Faster-Whisper STT Plugin
 *
 * High-performance Whisper implementation with:
 * - GPU acceleration (CUDA, MPS, ROCm)
 * - Compute type optimization (int8, float16, float32)
 * - CPU thread configuration
 * - Beam search tuning
 */
export declare class FasterWhisperSTTPlugin extends BaseSTTPlugin {
    readonly metadata: STTProviderMetadata;
    constructor(deploymentConfig?: DeploymentConfig);
    /**
     * Create FasterWhisperExecutor instance
     */
    protected createExecutor(): VoiceProviderExecutor;
    /**
     * Build Faster-Whisper configuration from deployment config
     */
    private buildFasterWhisperConfig;
    /**
     * Get Faster-Whisper-specific capabilities
     */
    private getFasterWhisperCapabilities;
}
//# sourceMappingURL=faster-whisper.d.ts.map