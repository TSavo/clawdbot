/**
 * Whisper STT Plugin Wrapper
 *
 * Wraps the WhisperExecutor to conform to the STTProvider interface.
 * Supports Docker and System deployment modes.
 */
import { BaseSTTPlugin } from './base.js';
import type { STTProviderMetadata } from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
/**
 * Whisper STT Plugin
 *
 * Provides speech-to-text using OpenAI's Whisper model.
 * Supports both Docker and local system deployment.
 */
export declare class WhisperSTTPlugin extends BaseSTTPlugin {
    readonly metadata: STTProviderMetadata;
    constructor(deploymentConfig?: DeploymentConfig);
    /**
     * Create WhisperExecutor instance
     */
    protected createExecutor(): VoiceProviderExecutor;
    /**
     * Build Whisper configuration from deployment config
     */
    private buildWhisperConfig;
    /**
     * Get Whisper-specific capabilities
     */
    private getWhisperCapabilities;
}
//# sourceMappingURL=whisper.d.ts.map