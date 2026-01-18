/**
 * Base TTS Plugin Wrapper
 *
 * Provides shared utilities and patterns for wrapping TTS provider executors
 * into the speech-plugins TTSProvider interface.
 *
 * This base class handles:
 * - Common capability mapping from executor to plugin interface
 * - Audio resampling delegation
 * - Error handling and provider health checks
 * - Metadata generation from executor configuration
 */
import type { TTSProvider, TTSProviderMetadata, TTSVoice, TTSSynthesisOptions, TTSStreamCallback } from '../../interfaces/tts-provider.js';
import type { VoiceProviderExecutor, SynthesisOptions } from '@media/voice-providers/executor.js';
/**
 * Base TTS plugin wrapper class
 * Subclasses should override createExecutor() and buildMetadata()
 */
export declare abstract class BaseTTSPlugin implements TTSProvider {
    protected executor: VoiceProviderExecutor | null;
    protected isReady: boolean;
    /**
     * Provider metadata - must be implemented by subclass
     */
    abstract readonly metadata: TTSProviderMetadata;
    /**
     * Create the underlying executor instance
     * Subclasses implement this to instantiate their specific executor
     */
    protected abstract createExecutor(config?: Record<string, unknown>): VoiceProviderExecutor;
    /**
     * Initialize provider with configuration
     */
    initialize(config?: Record<string, unknown>): Promise<void>;
    /**
     * List available voices
     */
    listVoices(): Promise<TTSVoice[]>;
    /**
     * Synthesize text to audio buffer
     */
    synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer>;
    /**
     * Synthesize text to audio stream
     */
    synthesizeStream(text: string, callbacks: TTSStreamCallback, options: TTSSynthesisOptions): Promise<void>;
    /**
     * Resample audio to target sample rate
     */
    resample(audioBuffer: Buffer, fromSampleRate: number, toSampleRate: number, format?: string): Promise<Buffer>;
    /**
     * Clean up resources
     */
    shutdown?(): Promise<void>;
    /**
     * Map TTSSynthesisOptions to executor SynthesisOptions
     */
    protected mapToExecutorOptions(options: TTSSynthesisOptions): SynthesisOptions;
    /**
     * Ensure provider is initialized before operations
     */
    protected ensureInitialized(): void;
    /**
     * Map executor audio formats to TTSProvider formats
     */
    protected mapAudioFormat(executorFormat: string): 'wav' | 'mp3' | 'pcm' | 'ulaw';
    /**
     * Extract voices from executor capabilities
     */
    protected extractVoices(executorCapabilities: any): TTSVoice[];
}
//# sourceMappingURL=base.d.ts.map