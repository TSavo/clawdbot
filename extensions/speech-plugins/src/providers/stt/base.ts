/**
 * Base STT Plugin Wrapper
 *
 * Provides common functionality for wrapping STT executor implementations
 * and adapting them to the STTProvider interface.
 */

import type {
  STTProvider,
  STTProviderMetadata,
  STTCapabilities,
  STTTranscriptSegment,
  STTStreamCallback,
  STTStreamEvent,
} from '../../interfaces/stt-provider.js';
import type {
  VoiceProviderExecutor,
  AudioBuffer as ExecutorAudioBuffer,
  TranscriptionResult,
  TranscriptionChunk,
  ProviderCapabilities,
} from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
import type { SystemModeConfig } from './system-mode.js';
import {
  initializeSystemMode,
  validateSystemModeConfig,
  getProviderDependencies,
} from './system-mode.js';

/**
 * Base class for STT plugin wrappers
 *
 * Bridges the gap between executor implementations and the STTProvider interface.
 * Supports system mode initialization with automatic dependency detection and installation.
 */
export abstract class BaseSTTPlugin implements STTProvider {
  abstract readonly metadata: STTProviderMetadata;
  protected executor: VoiceProviderExecutor | null = null;
  protected deploymentConfig?: DeploymentConfig;
  protected systemModeConfig?: SystemModeConfig;
  protected initialized = false;

  constructor(deploymentConfig?: DeploymentConfig) {
    this.deploymentConfig = deploymentConfig;
  }

  /**
   * Get the provider name for system mode initialization
   * Subclasses should override this to provide their provider name
   */
  protected getSystemModeProviderName(): string {
    return this.metadata.id.replace('-stt', '');
  }

  /**
   * Create the underlying executor instance
   * Subclasses must implement this to instantiate their specific executor.
   */
  protected abstract createExecutor(): VoiceProviderExecutor;

  /**
   * Map executor capabilities to STTCapabilities
   */
  protected mapCapabilities(
    executorCaps: ProviderCapabilities,
  ): STTCapabilities {
    return {
      formats: executorCaps.supportedFormats.map((f) => f.toString()),
      sampleRates: executorCaps.supportedSampleRates,
      supportsStreaming: executorCaps.supportsStreaming,
      supportsPartialTranscripts: executorCaps.supportsStreaming,
      languages: executorCaps.supportedLanguages,
      maxDurationSeconds: null, // Unlimited by default
    };
  }

  /**
   * Initialize system mode for the provider
   * Automatically detects and installs dependencies, sets up model cache
   */
  async initializeSystemMode(
    config?: SystemModeConfig,
    verbose = false,
  ): Promise<{ success: boolean; config: SystemModeConfig; error?: string }> {
    const providerName = this.getSystemModeProviderName();

    const result = await initializeSystemMode(providerName, config, verbose);

    if (result.success) {
      this.systemModeConfig = result.config;
      // Merge system mode config with deployment config
      if (!this.deploymentConfig) {
        this.deploymentConfig = { mode: 'system', ...result.config } as any;
      } else {
        this.deploymentConfig = {
          ...this.deploymentConfig,
          ...result.config,
        };
      }
    }

    return {
      success: result.success,
      config: result.config,
      error: result.error,
    };
  }

  /**
   * Validate system mode configuration
   */
  validateSystemModeConfig(config: SystemModeConfig): { valid: boolean; errors: string[] } {
    return validateSystemModeConfig(config);
  }

  /**
   * Get system mode dependencies for this provider
   */
  getSystemModeDependencies(): { binaries: string[]; packages: Record<string, string[]>; pipPackages?: string[] } | null {
    const providerName = this.getSystemModeProviderName();
    const deps = getProviderDependencies(providerName);
    return deps
      ? {
          binaries: deps.binaries,
          packages: deps.packages,
          pipPackages: deps.pipPackages,
        }
      : null;
  }

  /**
   * Initialize the provider with configuration
   */
  async initialize(config?: Record<string, unknown>): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create executor instance
    this.executor = this.createExecutor();

    // Initialize executor with deployment config if available
    if (this.executor && typeof this.executor.initialize === 'function') {
      await this.executor.initialize();
    }

    this.initialized = true;
  }

  /**
   * Transcribe audio from buffer
   */
  async transcribe(
    audioBuffer: Buffer,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    },
  ): Promise<STTTranscriptSegment[]> {
    if (!this.executor) {
      throw new Error('Executor not initialized. Call initialize() first.');
    }

    // Convert Buffer to AudioBuffer format expected by executor
    const executorAudio: ExecutorAudioBuffer = {
      data: new Uint8Array(audioBuffer),
      format: this.parseAudioFormat(options?.format),
      sampleRate: options?.sampleRate ?? 16000,
      duration: this.estimateDuration(audioBuffer.length, options?.sampleRate ?? 16000),
      channels: 1,
    };

    // Execute transcription
    const result: TranscriptionResult = await this.executor.transcribe(
      executorAudio,
      {
        language: options?.language,
        format: this.parseAudioFormat(options?.format),
      },
    );

    // Convert to STTTranscriptSegment format
    return [
      {
        text: result.text,
        confidence: result.confidence ?? 0.0,
        startMs: 0,
        endMs: result.duration,
        isFinal: true,
        language: result.language,
      },
    ];
  }

  /**
   * Transcribe audio from stream with callbacks
   */
  async transcribeStream(
    stream: NodeJS.ReadableStream,
    callbacks: STTStreamCallback,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    },
  ): Promise<void> {
    if (!this.executor) {
      throw new Error('Executor not initialized. Call initialize() first.');
    }

    try {
      // Convert NodeJS.ReadableStream to ReadableStream<AudioBuffer>
      const audioStream = this.convertToAudioStream(
        stream,
        options?.format,
        options?.sampleRate,
      );

      // Process stream chunks
      const iterator = this.executor.transcribeStream(audioStream, {
        language: options?.language,
        format: this.parseAudioFormat(options?.format),
      });

      const segments: STTTranscriptSegment[] = [];

      for await (const chunk of iterator) {
        const segment = this.convertChunkToSegment(chunk);
        segments.push(segment);

        // Trigger callbacks
        if (chunk.partial && callbacks.onPartial) {
          callbacks.onPartial(chunk.text);
        }

        if (callbacks.onTranscript) {
          const event: STTStreamEvent = {
            type: 'transcript',
            segments: [segment],
          };
          callbacks.onTranscript(event);
        }
      }

      // Trigger completion callback
      if (callbacks.onComplete) {
        callbacks.onComplete(segments);
      }

      // Send final completion event
      if (callbacks.onTranscript) {
        const event: STTStreamEvent = {
          type: 'complete',
          segments,
        };
        callbacks.onTranscript(event);
      }
    } catch (error) {
      const errorEvent: STTStreamEvent = {
        type: 'error',
        error: {
          code: 'TRANSCRIPTION_FAILED',
          message: error instanceof Error ? error.message : String(error),
        },
      };

      if (callbacks.onError) {
        callbacks.onError(errorEvent.error!);
      }

      if (callbacks.onTranscript) {
        callbacks.onTranscript(errorEvent);
      }

      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    if (this.executor && typeof this.executor.shutdown === 'function') {
      await this.executor.shutdown();
    }
    this.initialized = false;
    this.executor = null;
  }

  /**
   * Convert string format to AudioFormat enum
   */
  protected parseAudioFormat(format?: string): any {
    // Import AudioFormat enum from executor
    const { AudioFormat } = require('../../../../../src/media/voice-providers/executor.js');

    if (!format) return AudioFormat.PCM_16;

    switch (format.toLowerCase()) {
      case 'wav':
      case 'pcm16':
      case 'pcm_16':
        return AudioFormat.PCM_16;
      case 'opus':
        return AudioFormat.OPUS;
      case 'aac':
        return AudioFormat.AAC;
      case 'mp3':
        return AudioFormat.MP3;
      case 'ogg':
      case 'vorbis':
        return AudioFormat.VORBIS;
      default:
        return AudioFormat.PCM_16;
    }
  }

  /**
   * Estimate audio duration from buffer length and sample rate
   */
  protected estimateDuration(bufferLength: number, sampleRate: number): number {
    // Assume PCM_16 format (2 bytes per sample)
    const sampleCount = bufferLength / 2;
    return (sampleCount / sampleRate) * 1000; // Return in milliseconds
  }

  /**
   * Convert NodeJS.ReadableStream to ReadableStream<AudioBuffer>
   */
  protected convertToAudioStream(
    nodeStream: NodeJS.ReadableStream,
    format?: string,
    sampleRate?: number,
  ): ReadableStream<ExecutorAudioBuffer> {
    const audioFormat = this.parseAudioFormat(format);
    const rate = sampleRate ?? 16000;

    return new ReadableStream<ExecutorAudioBuffer>({
      start: async (controller) => {
        nodeStream.on('data', (chunk: Buffer) => {
          const audioBuffer: ExecutorAudioBuffer = {
            data: new Uint8Array(chunk),
            format: audioFormat,
            sampleRate: rate,
            duration: this.estimateDuration(chunk.length, rate),
            channels: 1,
          };
          controller.enqueue(audioBuffer);
        });

        nodeStream.on('end', () => {
          controller.close();
        });

        nodeStream.on('error', (error) => {
          controller.error(error);
        });
      },
    });
  }

  /**
   * Convert TranscriptionChunk to STTTranscriptSegment
   */
  protected convertChunkToSegment(
    chunk: TranscriptionChunk,
  ): STTTranscriptSegment {
    return {
      text: chunk.text,
      confidence: 0.0, // Not available in chunk
      startMs: chunk.timestamp,
      endMs: chunk.timestamp,
      isFinal: !chunk.partial,
    };
  }
}
