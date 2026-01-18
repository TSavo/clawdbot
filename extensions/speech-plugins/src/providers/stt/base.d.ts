/**
 * Base STT Plugin Wrapper
 *
 * Provides common functionality for wrapping STT executor implementations
 * and adapting them to the STTProvider interface.
 */
import type { STTProvider, STTProviderMetadata, STTCapabilities, STTTranscriptSegment, STTStreamCallback } from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor, AudioBuffer as ExecutorAudioBuffer, TranscriptionChunk, ProviderCapabilities } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
/**
 * Base class for STT plugin wrappers
 *
 * Bridges the gap between executor implementations and the STTProvider interface.
 */
export declare abstract class BaseSTTPlugin implements STTProvider {
    abstract readonly metadata: STTProviderMetadata;
    protected executor: VoiceProviderExecutor | null;
    protected deploymentConfig?: DeploymentConfig;
    protected initialized: boolean;
    constructor(deploymentConfig?: DeploymentConfig);
    /**
     * Create the underlying executor instance
     * Subclasses must implement this to instantiate their specific executor.
     */
    protected abstract createExecutor(): VoiceProviderExecutor;
    /**
     * Map executor capabilities to STTCapabilities
     */
    protected mapCapabilities(executorCaps: ProviderCapabilities): STTCapabilities;
    /**
     * Initialize the provider with configuration
     */
    initialize(config?: Record<string, unknown>): Promise<void>;
    /**
     * Transcribe audio from buffer
     */
    transcribe(audioBuffer: Buffer, options?: {
        format?: string;
        sampleRate?: number;
        language?: string;
        prompt?: string;
    }): Promise<STTTranscriptSegment[]>;
    /**
     * Transcribe audio from stream with callbacks
     */
    transcribeStream(stream: NodeJS.ReadableStream, callbacks: STTStreamCallback, options?: {
        format?: string;
        sampleRate?: number;
        language?: string;
        prompt?: string;
    }): Promise<void>;
    /**
     * Clean up resources
     */
    shutdown(): Promise<void>;
    /**
     * Convert string format to AudioFormat enum
     */
    protected parseAudioFormat(format?: string): any;
    /**
     * Estimate audio duration from buffer length and sample rate
     */
    protected estimateDuration(bufferLength: number, sampleRate: number): number;
    /**
     * Convert NodeJS.ReadableStream to ReadableStream<AudioBuffer>
     */
    protected convertToAudioStream(nodeStream: NodeJS.ReadableStream, format?: string, sampleRate?: number): ReadableStream<ExecutorAudioBuffer>;
    /**
     * Convert TranscriptionChunk to STTTranscriptSegment
     */
    protected convertChunkToSegment(chunk: TranscriptionChunk): STTTranscriptSegment;
}
//# sourceMappingURL=base.d.ts.map