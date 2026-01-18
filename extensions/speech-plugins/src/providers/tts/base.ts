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

import type {
  TTSProvider,
  TTSProviderMetadata,
  TTSCapabilities,
  TTSVoice,
  TTSSynthesisOptions,
  TTSStreamCallback,
} from '../../interfaces/tts-provider.js';

import type {
  VoiceProviderExecutor,
  AudioBuffer,
  SynthesisOptions,
} from '@media/voice-providers/executor.js';

/**
 * Base TTS plugin wrapper class
 * Subclasses should override createExecutor() and buildMetadata()
 */
export abstract class BaseTTSPlugin implements TTSProvider {
  protected executor: VoiceProviderExecutor | null = null;
  protected isReady = false;

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
  async initialize(config?: Record<string, unknown>): Promise<void> {
    if (this.isReady) {
      return;
    }

    try {
      this.executor = this.createExecutor(config);
      await this.executor.initialize();
      this.isReady = true;
    } catch (error) {
      throw new Error(
        `Failed to initialize TTS provider: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<TTSVoice[]> {
    this.ensureInitialized();
    return this.metadata.capabilities.voices;
  }

  /**
   * Synthesize text to audio buffer
   */
  async synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer> {
    this.ensureInitialized();

    const executorOptions = this.mapToExecutorOptions(options);
    const audioBuffer = await this.executor!.synthesize(text, executorOptions);

    return Buffer.from(audioBuffer.data);
  }

  /**
   * Synthesize text to audio stream
   */
  async synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions,
  ): Promise<void> {
    this.ensureInitialized();

    const executorOptions = this.mapToExecutorOptions(options);

    // Create a text stream from the input text
    const textStream = new ReadableStream<string>({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    });

    try {
      // Stream audio chunks from executor
      for await (const audioBuffer of this.executor!.synthesizeStream(textStream, executorOptions)) {
        if (callbacks.onAudio) {
          callbacks.onAudio(Buffer.from(audioBuffer.data));
        }
      }

      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError({
          code: 'SYNTHESIS_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
      }
      throw error;
    }
  }

  /**
   * Resample audio to target sample rate
   */
  async resample(
    audioBuffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number,
    format?: string,
  ): Promise<Buffer> {
    this.ensureInitialized();

    // Delegate to executor if it supports resampling
    if (this.executor && 'resample' in this.executor && typeof this.executor.resample === 'function') {
      const resampled = await this.executor.resample(
        audioBuffer,
        fromSampleRate,
        toSampleRate,
        format,
      );
      return Buffer.from(resampled);
    }

    // Fallback: return original buffer (no resampling)
    console.warn(
      `[${this.metadata.id}] Resampling not supported by executor, returning original audio`,
    );
    return audioBuffer;
  }

  /**
   * Clean up resources
   */
  async shutdown?(): Promise<void> {
    if (this.executor) {
      await this.executor.shutdown();
      this.executor = null;
      this.isReady = false;
    }
  }

  /**
   * Map TTSSynthesisOptions to executor SynthesisOptions
   */
  protected mapToExecutorOptions(options: TTSSynthesisOptions): SynthesisOptions {
    return {
      voice: options.voiceId,
      sampleRate: options.sampleRate,
      speed: options.speechRate,
      pitch: options.pitch,
      // Format mapping handled by executor
    };
  }

  /**
   * Ensure provider is initialized before operations
   */
  protected ensureInitialized(): void {
    if (!this.isReady || !this.executor) {
      throw new Error('Provider not initialized. Call initialize() first.');
    }
  }

  /**
   * Map executor audio formats to TTSProvider formats
   */
  protected mapAudioFormat(executorFormat: string): 'wav' | 'mp3' | 'pcm' | 'ulaw' {
    const formatMap: Record<string, 'wav' | 'mp3' | 'pcm' | 'ulaw'> = {
      PCM_16: 'pcm',
      WAV: 'wav',
      MP3: 'mp3',
      ULAW: 'ulaw',
    };

    return formatMap[executorFormat] || 'pcm';
  }

  /**
   * Extract voices from executor capabilities
   */
  protected extractVoices(executorCapabilities: any): TTSVoice[] {
    // Default implementation - subclasses can override
    return [
      {
        id: 'default',
        name: 'Default Voice',
        language: 'en',
        gender: 'neutral',
      },
    ];
  }
}
