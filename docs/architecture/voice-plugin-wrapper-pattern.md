# Voice Provider Plugin Wrapper Pattern

**Architecture Design Document**
**Version**: 1.0.0
**Date**: 2026-01-16
**Author**: System Architecture Designer

## Executive Summary

This document defines the plugin wrapper pattern for integrating voice provider executors (Kokoro, Whisper, Faster-Whisper, Deepgram, CartesiaAI, ElevenLabs, Chatterbox) with the plugin registry system. The pattern bridges the existing executor-based voice providers in `src/media/voice-providers/` to the STTProvider/TTSProvider interfaces defined in `extensions/speech-plugins/src/interfaces/`.

## Problem Statement

Current state:
- **Voice provider executors** exist in `src/media/voice-providers/` implementing `VoiceProviderExecutor`
- **Plugin interfaces** exist in `extensions/speech-plugins/src/interfaces/` defining `STTProvider` and `TTSProvider`
- **Plugin registry** expects `ProviderConfig` with metadata, module paths, and configuration
- **Deployment system** supports docker/system/cloud modes via `DeploymentConfig`
- **No bridge** currently connects executors to plugin interfaces

Requirements:
1. Wrap executors to implement STTProvider/TTSProvider interfaces
2. Support deployment mode selection (docker/system/cloud) via ProviderConfig
3. Expose provider capabilities (languages, formats, sample rates, streaming)
4. Handle provider initialization and configuration passthrough
5. Support error handling and health checks
6. Provide reusable base wrapper for all providers

## Architecture Overview

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Plugin Registry                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ ProviderConfig[]                                          │  │
│  │  - id, type, module, config, enabled, priority            │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ STTProvider / TTSProvider Interface                       │  │
│  │  - metadata, initialize(), transcribe(), synthesize()     │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           AbstractProviderPluginWrapper (Base Class)             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ - Deployment mode resolution (docker/system/cloud)        │  │
│  │ - Capability mapping (executor → plugin interface)        │  │
│  │ - Health check coordination                               │  │
│  │ - Error translation                                       │  │
│  │ - Configuration passthrough                               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              Concrete Provider Wrappers                          │
│  ┌────────────┬────────────┬────────────┬────────────┐          │
│  │ Whisper    │ Kokoro     │ Deepgram   │ Cartesia   │          │
│  │ Plugin     │ Plugin     │ Plugin     │ Plugin     │          │
│  └────────────┴────────────┴────────────┴────────────┘          │
│  ┌────────────┬────────────┬────────────┐                       │
│  │ ElevenLabs │ Faster-    │ Chatterbox │                       │
│  │ Plugin     │ Whisper    │ Plugin     │                       │
│  └────────────┴────────────┴────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│             VoiceProviderExecutor (Existing)                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ - transcribe(), synthesize(), streaming methods           │  │
│  │ - initialize(), shutdown(), health checks                 │  │
│  │ - Deployment handlers (Docker/System/Cloud)               │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Mode Flow

```
ProviderConfig.config.mode
         │
         ▼
┌──────────────────┐
│ Deployment Bridge│
└──────────────────┘
         │
         ├─── mode: "docker" ──→ DockerDeploymentConfig
         │                       (image, ports, volumes, etc.)
         │
         ├─── mode: "system" ──→ SystemDeploymentConfig
         │                       (binary, packageManager, paths, etc.)
         │
         └─── mode: "cloud" ───→ CloudDeploymentConfig
                                 (endpoint, auth, rateLimit, etc.)

         All flow to:
         VoiceProviderExecutor.initialize(deploymentConfig)
```

## Interface Definitions

### 1. Base Wrapper Abstract Class

**File**: `extensions/speech-plugins/src/wrappers/base-provider-wrapper.ts`

```typescript
/**
 * AbstractProviderPluginWrapper
 *
 * Base class for all voice provider plugin wrappers.
 * Bridges VoiceProviderExecutor to STTProvider/TTSProvider interfaces.
 */

import type {
  STTProvider,
  STTProviderMetadata,
  STTTranscriptSegment,
  STTStreamCallback
} from '../interfaces/stt-provider.js';
import type {
  TTSProvider,
  TTSProviderMetadata,
  TTSVoice,
  TTSSynthesisOptions,
  TTSStreamCallback
} from '../interfaces/tts-provider.js';
import type { VoiceProviderExecutor } from '../../../src/media/voice-providers/executor.js';
import type {
  DeploymentConfig,
  DockerDeploymentConfig,
  SystemDeploymentConfig,
  CloudDeploymentConfig
} from '../../../src/config/deployment-config.types.js';

/**
 * Deployment bridge configuration
 * Maps ProviderConfig.config to DeploymentConfig
 */
export interface DeploymentBridgeConfig {
  /** Deployment mode */
  mode: 'docker' | 'system' | 'cloud';

  /** Docker-specific settings */
  docker?: {
    image: string;
    tag?: string;
    ports?: Record<number, number>;
    volumes?: Record<string, string>;
    env?: Record<string, string>;
    pullPolicy?: 'always' | 'ifNotPresent' | 'never';
  };

  /** System-specific settings */
  system?: {
    binary: string;
    packageManager?: ('npm' | 'pip' | 'brew' | 'apt')[];
    searchPaths?: string[];
    installCommand?: string;
  };

  /** Cloud-specific settings */
  cloud?: {
    endpoint: string;
    apiKey?: string;
    provider: string;
    auth?: {
      type: 'apiKey' | 'oauth2' | 'bearer';
      keyField?: string;
    };
    rateLimit?: {
      requestsPerMinute?: number;
      maxConcurrent?: number;
    };
  };

  /** Health check configuration */
  healthCheck?: {
    enabled: boolean;
    endpoint?: string;
    intervalMs?: number;
    timeoutMs?: number;
  };

  /** Provider-specific overrides */
  providerConfig?: Record<string, unknown>;
}

/**
 * Capability mapping result
 * Translates executor capabilities to plugin interface capabilities
 */
export interface CapabilityMapping {
  /** Audio formats supported */
  formats: string[];
  /** Sample rates supported */
  sampleRates: number[];
  /** Languages supported (ISO 639-1) */
  languages: string[];
  /** Streaming support */
  supportsStreaming: boolean;
  /** Partial transcripts (STT only) */
  supportsPartialTranscripts?: boolean;
  /** Available voices (TTS only) */
  voices?: TTSVoice[];
}

/**
 * Abstract base wrapper class
 */
export abstract class AbstractProviderPluginWrapper {
  protected executor: VoiceProviderExecutor;
  protected deploymentConfig: DeploymentConfig;
  protected initialized = false;

  constructor(
    protected config: DeploymentBridgeConfig,
    protected providerType: 'stt' | 'tts'
  ) {
    // Convert bridge config to full DeploymentConfig
    this.deploymentConfig = this.buildDeploymentConfig(config);
  }

  /**
   * Build full DeploymentConfig from bridge config
   */
  protected buildDeploymentConfig(
    config: DeploymentBridgeConfig
  ): DeploymentConfig {
    const baseConfig = {
      id: this.getProviderId(),
      name: this.getProviderName(),
      type: this.getProviderType(),
      mode: config.mode,
      enabled: true,
      timeoutMs: 30000,
      healthCheck: config.healthCheck || {
        enabled: true,
        intervalMs: 60000,
        timeoutMs: 5000,
      },
    };

    switch (config.mode) {
      case 'docker':
        return {
          ...baseConfig,
          mode: 'docker',
          image: config.docker!.image,
          tag: config.docker?.tag,
          ports: config.docker?.ports || { 8000: 8000 },
          volumes: config.docker?.volumes,
          env: config.docker?.env,
          pullPolicy: config.docker?.pullPolicy || 'ifNotPresent',
        } as DockerDeploymentConfig;

      case 'system':
        return {
          ...baseConfig,
          mode: 'system',
          binary: config.system!.binary,
          packageManager: config.system?.packageManager,
          searchPaths: config.system?.searchPaths,
        } as SystemDeploymentConfig;

      case 'cloud':
        return {
          ...baseConfig,
          mode: 'cloud',
          provider: config.cloud!.provider,
          endpoint: config.cloud!.endpoint,
          auth: config.cloud?.auth,
          rateLimit: config.cloud?.rateLimit,
        } as CloudDeploymentConfig;

      default:
        throw new Error(`Unsupported deployment mode: ${config.mode}`);
    }
  }

  /**
   * Initialize the executor with deployment config
   */
  async initialize(pluginConfig?: Record<string, unknown>): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Create executor instance (implemented by concrete wrapper)
    this.executor = await this.createExecutor(this.deploymentConfig);

    // Initialize executor
    await this.executor.initialize();

    // Verify health
    const healthy = await this.executor.isHealthy();
    if (!healthy) {
      throw new Error(`Provider ${this.getProviderId()} failed health check`);
    }

    this.initialized = true;
  }

  /**
   * Shutdown executor and cleanup resources
   */
  async shutdown(): Promise<void> {
    if (this.executor) {
      await this.executor.shutdown();
    }
    this.initialized = false;
  }

  /**
   * Map executor capabilities to plugin interface capabilities
   */
  protected mapCapabilities(): CapabilityMapping {
    const executorCaps = this.executor.getCapabilities();

    return {
      formats: executorCaps.supportedFormats.map(f => f.toString()),
      sampleRates: executorCaps.supportedSampleRates,
      languages: executorCaps.supportedLanguages,
      supportsStreaming: executorCaps.supportsStreaming,
      supportsPartialTranscripts: executorCaps.supportsStreaming,
      voices: this.providerType === 'tts' ? this.extractVoices() : undefined,
    };
  }

  /**
   * Extract voices from TTS provider (override in TTS wrappers)
   */
  protected extractVoices(): TTSVoice[] {
    return [];
  }

  /**
   * Health check wrapper
   */
  async isHealthy(): Promise<boolean> {
    if (!this.initialized || !this.executor) {
      return false;
    }
    return this.executor.isHealthy();
  }

  // Abstract methods to be implemented by concrete wrappers

  /**
   * Get provider identifier (e.g., "whisper-docker", "kokoro-system")
   */
  abstract getProviderId(): string;

  /**
   * Get human-readable provider name
   */
  abstract getProviderName(): string;

  /**
   * Get provider type string (e.g., "whisper", "kokoro")
   */
  abstract getProviderType(): string;

  /**
   * Create executor instance with deployment config
   */
  abstract createExecutor(
    deploymentConfig: DeploymentConfig
  ): Promise<VoiceProviderExecutor>;
}
```

### 2. STT Provider Wrapper

**File**: `extensions/speech-plugins/src/wrappers/stt-provider-wrapper.ts`

```typescript
/**
 * STTProviderWrapper
 *
 * Extends AbstractProviderPluginWrapper to implement STTProvider interface.
 * Used for STT providers like Whisper, Faster-Whisper, Deepgram.
 */

import type {
  STTProvider,
  STTProviderMetadata,
  STTTranscriptSegment,
  STTStreamCallback
} from '../interfaces/stt-provider.js';
import { AbstractProviderPluginWrapper } from './base-provider-wrapper.js';
import type { AudioBuffer, TranscribeOptions } from '../../../src/media/voice-providers/executor.js';

export abstract class STTProviderWrapper
  extends AbstractProviderPluginWrapper
  implements STTProvider {

  constructor(config: DeploymentBridgeConfig) {
    super(config, 'stt');
  }

  /**
   * STTProvider metadata
   */
  get metadata(): STTProviderMetadata {
    const caps = this.mapCapabilities();

    return {
      id: this.getProviderId(),
      name: this.getProviderName(),
      description: this.getProviderDescription(),
      version: this.getProviderVersion(),
      capabilities: {
        formats: caps.formats,
        sampleRates: caps.sampleRates,
        supportsStreaming: caps.supportsStreaming,
        supportsPartialTranscripts: caps.supportsPartialTranscripts || false,
        languages: caps.languages,
        maxDurationSeconds: this.getMaxDuration(),
      },
    };
  }

  /**
   * Transcribe audio buffer
   */
  async transcribe(
    audioBuffer: Buffer,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    }
  ): Promise<STTTranscriptSegment[]> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    // Convert Node Buffer to AudioBuffer
    const audio: AudioBuffer = {
      data: new Uint8Array(audioBuffer),
      format: this.parseFormat(options?.format || 'wav'),
      sampleRate: options?.sampleRate || 16000,
      duration: this.estimateDuration(audioBuffer, options?.sampleRate),
      channels: 1,
    };

    // Call executor
    const result = await this.executor.transcribe(audio, {
      language: options?.language,
      format: this.parseFormat(options?.format || 'wav'),
    });

    // Convert TranscriptionResult to STTTranscriptSegment[]
    return [{
      text: result.text,
      confidence: result.confidence || 1.0,
      startMs: 0,
      endMs: result.duration,
      isFinal: true,
      language: result.language,
    }];
  }

  /**
   * Transcribe audio stream
   */
  async transcribeStream(
    stream: NodeJS.ReadableStream,
    callbacks: STTStreamCallback,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    }
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    // Convert Node stream to ReadableStream<AudioBuffer>
    const audioStream = this.convertToAudioStream(stream, options);

    // Call executor streaming
    const chunks = this.executor.transcribeStream(audioStream, {
      language: options?.language,
      format: this.parseFormat(options?.format || 'wav'),
    });

    // Process chunks and invoke callbacks
    try {
      for await (const chunk of chunks) {
        const segment: STTTranscriptSegment = {
          text: chunk.text,
          confidence: 1.0,
          startMs: chunk.timestamp,
          endMs: chunk.timestamp,
          isFinal: !chunk.partial,
        };

        if (chunk.partial && callbacks.onPartial) {
          callbacks.onPartial(chunk.text);
        }

        if (callbacks.onTranscript) {
          callbacks.onTranscript({
            type: 'transcript',
            segments: [segment],
          });
        }
      }

      if (callbacks.onComplete) {
        callbacks.onComplete([]);
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError({
          code: 'TRANSCRIPTION_ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // Helper methods

  protected parseFormat(format: string): AudioFormat {
    // Map string format to AudioFormat enum
    const formatMap: Record<string, AudioFormat> = {
      'wav': AudioFormat.PCM_16,
      'pcm': AudioFormat.PCM_16,
      'pcm16': AudioFormat.PCM_16,
      'opus': AudioFormat.OPUS,
      'mp3': AudioFormat.MP3,
      'aac': AudioFormat.AAC,
    };
    return formatMap[format.toLowerCase()] || AudioFormat.PCM_16;
  }

  protected estimateDuration(buffer: Buffer, sampleRate?: number): number {
    const rate = sampleRate || 16000;
    const bytesPerSample = 2; // PCM16
    const samples = buffer.length / bytesPerSample;
    return (samples / rate) * 1000; // milliseconds
  }

  protected convertToAudioStream(
    stream: NodeJS.ReadableStream,
    options?: { format?: string; sampleRate?: number }
  ): ReadableStream<AudioBuffer> {
    const format = this.parseFormat(options?.format || 'wav');
    const sampleRate = options?.sampleRate || 16000;

    return new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          controller.enqueue({
            data: new Uint8Array(chunk),
            format,
            sampleRate,
            duration: 0,
            channels: 1,
          });
        });

        stream.on('end', () => {
          controller.close();
        });

        stream.on('error', (err) => {
          controller.error(err);
        });
      },
    });
  }

  // Abstract methods for concrete implementations

  abstract getProviderDescription(): string;
  abstract getProviderVersion(): string;
  abstract getMaxDuration(): number | null;
}
```

### 3. TTS Provider Wrapper

**File**: `extensions/speech-plugins/src/wrappers/tts-provider-wrapper.ts`

```typescript
/**
 * TTSProviderWrapper
 *
 * Extends AbstractProviderPluginWrapper to implement TTSProvider interface.
 * Used for TTS providers like Kokoro, ElevenLabs, CartesiaAI, Chatterbox.
 */

import type {
  TTSProvider,
  TTSProviderMetadata,
  TTSVoice,
  TTSSynthesisOptions,
  TTSStreamCallback
} from '../interfaces/tts-provider.js';
import { AbstractProviderPluginWrapper } from './base-provider-wrapper.js';
import type { AudioBuffer, SynthesisOptions } from '../../../src/media/voice-providers/executor.js';

export abstract class TTSProviderWrapper
  extends AbstractProviderPluginWrapper
  implements TTSProvider {

  constructor(config: DeploymentBridgeConfig) {
    super(config, 'tts');
  }

  /**
   * TTSProvider metadata
   */
  get metadata(): TTSProviderMetadata {
    const caps = this.mapCapabilities();

    return {
      id: this.getProviderId(),
      name: this.getProviderName(),
      description: this.getProviderDescription(),
      version: this.getProviderVersion(),
      capabilities: {
        formats: caps.formats as ("wav" | "mp3" | "pcm" | "ulaw")[],
        sampleRates: caps.sampleRates,
        voices: caps.voices || [],
        supportsStreaming: caps.supportsStreaming,
        languages: caps.languages,
      },
    };
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<TTSVoice[]> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }
    return this.extractVoices();
  }

  /**
   * Synthesize text to audio buffer
   */
  async synthesize(
    text: string,
    options: TTSSynthesisOptions
  ): Promise<Buffer> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    // Convert TTSSynthesisOptions to executor SynthesisOptions
    const executorOptions: SynthesisOptions = {
      voice: options.voiceId,
      speed: options.speechRate,
      pitch: options.pitch,
      format: this.parseFormat(options.format),
      sampleRate: options.sampleRate,
    };

    // Call executor
    const audioBuffer = await this.executor.synthesize(text, executorOptions);

    // Convert AudioBuffer to Node Buffer
    return Buffer.from(audioBuffer.data);
  }

  /**
   * Synthesize text to audio stream
   */
  async synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('Provider not initialized');
    }

    // Convert text to ReadableStream
    const textStream = new ReadableStream({
      start(controller) {
        controller.enqueue(text);
        controller.close();
      },
    });

    // Convert options
    const executorOptions: SynthesisOptions = {
      voice: options.voiceId,
      speed: options.speechRate,
      pitch: options.pitch,
      format: this.parseFormat(options.format),
      sampleRate: options.sampleRate,
    };

    // Call executor streaming
    const chunks = this.executor.synthesizeStream(textStream, executorOptions);

    // Process chunks and invoke callbacks
    try {
      for await (const chunk of chunks) {
        if (callbacks.onAudio) {
          callbacks.onAudio(Buffer.from(chunk.data));
        }
      }

      if (callbacks.onComplete) {
        callbacks.onComplete();
      }
    } catch (error) {
      if (callbacks.onError) {
        callbacks.onError({
          code: 'SYNTHESIS_ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Resample audio (passthrough to executor if supported)
   */
  async resample(
    audioBuffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number,
    format?: string
  ): Promise<Buffer> {
    // For now, just return as-is (implement resampling in base executor)
    return audioBuffer;
  }

  // Helper methods

  protected parseFormat(format: "wav" | "mp3" | "pcm" | "ulaw"): AudioFormat {
    const formatMap: Record<string, AudioFormat> = {
      'wav': AudioFormat.PCM_16,
      'pcm': AudioFormat.PCM_16,
      'mp3': AudioFormat.MP3,
      'ulaw': AudioFormat.PCM_16, // TODO: proper ulaw support
    };
    return formatMap[format] || AudioFormat.PCM_16;
  }

  // Abstract methods for concrete implementations

  abstract getProviderDescription(): string;
  abstract getProviderVersion(): string;

  /**
   * Extract voices from provider-specific implementation
   * Override in concrete wrappers to return actual voices
   */
  protected abstract extractVoices(): TTSVoice[];
}
```

### 4. Concrete Provider Wrapper Example: Whisper

**File**: `extensions/speech-plugins/src/wrappers/providers/whisper-plugin.ts`

```typescript
/**
 * WhisperPlugin
 *
 * Concrete STT provider wrapper for Whisper.
 * Supports docker, system, and cloud deployment modes.
 */

import { STTProviderWrapper, DeploymentBridgeConfig } from '../stt-provider-wrapper.js';
import type { VoiceProviderExecutor } from '../../../../src/media/voice-providers/executor.js';
import type { DeploymentConfig } from '../../../../src/config/deployment-config.types.js';
import { WhisperExecutor } from '../../../../src/media/voice-providers/whisper.js';

export class WhisperPlugin extends STTProviderWrapper {
  private modelSize: 'tiny' | 'small' | 'base' | 'medium' | 'large';

  constructor(config: DeploymentBridgeConfig & { modelSize?: string }) {
    super(config);
    this.modelSize = (config.providerConfig?.modelSize as string) || 'base';
  }

  getProviderId(): string {
    return `whisper-${this.config.mode}-${this.modelSize}`;
  }

  getProviderName(): string {
    return `Whisper (${this.config.mode}, ${this.modelSize})`;
  }

  getProviderType(): string {
    return 'whisper';
  }

  getProviderDescription(): string {
    return 'OpenAI Whisper speech-to-text with multi-deployment support';
  }

  getProviderVersion(): string {
    return '1.0.0';
  }

  getMaxDuration(): number | null {
    return null; // Whisper has no hard limit
  }

  async createExecutor(deploymentConfig: DeploymentConfig): Promise<VoiceProviderExecutor> {
    // Import and instantiate WhisperExecutor with deployment config
    const whisperConfig = {
      deploymentMode: deploymentConfig.mode,
      modelSize: this.modelSize,
      dockerPort: (deploymentConfig as any).ports?.[8000],
      dockerImage: (deploymentConfig as any).image,
      pythonPath: (deploymentConfig as any).searchPaths?.[0],
    };

    const executor = new WhisperExecutor(whisperConfig);
    return executor;
  }
}
```

### 5. Concrete Provider Wrapper Example: Kokoro

**File**: `extensions/speech-plugins/src/wrappers/providers/kokoro-plugin.ts`

```typescript
/**
 * KokoroPlugin
 *
 * Concrete TTS provider wrapper for Kokoro.
 * Supports docker, system, and cloud deployment modes.
 */

import { TTSProviderWrapper, DeploymentBridgeConfig } from '../tts-provider-wrapper.js';
import type { VoiceProviderExecutor } from '../../../../src/media/voice-providers/executor.js';
import type { DeploymentConfig } from '../../../../src/config/deployment-config.types.js';
import type { TTSVoice } from '../../interfaces/tts-provider.js';
import { KokoroExecutor } from '../../../../src/media/voice-providers/kokoro.js';

export class KokoroPlugin extends TTSProviderWrapper {
  private availableVoices: TTSVoice[] = [
    {
      id: 'en-us-female-1',
      name: 'English US Female 1',
      language: 'en',
      gender: 'female',
      characteristics: ['clear', 'natural'],
    },
    {
      id: 'en-us-male-1',
      name: 'English US Male 1',
      language: 'en',
      gender: 'male',
      characteristics: ['deep', 'authoritative'],
    },
  ];

  constructor(config: DeploymentBridgeConfig) {
    super(config);
  }

  getProviderId(): string {
    return `kokoro-${this.config.mode}`;
  }

  getProviderName(): string {
    return `Kokoro TTS (${this.config.mode})`;
  }

  getProviderType(): string {
    return 'kokoro';
  }

  getProviderDescription(): string {
    return 'Local TTS engine with natural voice synthesis';
  }

  getProviderVersion(): string {
    return '1.0.0';
  }

  protected extractVoices(): TTSVoice[] {
    return this.availableVoices;
  }

  async createExecutor(deploymentConfig: DeploymentConfig): Promise<VoiceProviderExecutor> {
    // Convert DeploymentConfig to KokoroExecutor config
    const kokoroConfig = {
      mode: deploymentConfig.mode,
      docker: deploymentConfig.mode === 'docker' ? {
        image: (deploymentConfig as any).image,
        port: Object.values((deploymentConfig as any).ports || {})[0] || 8080,
        volumes: (deploymentConfig as any).volumes,
        env: (deploymentConfig as any).env,
      } : undefined,
      system: deploymentConfig.mode === 'system' ? {
        pythonPath: (deploymentConfig as any).searchPaths?.[0],
      } : undefined,
      cloud: deploymentConfig.mode === 'cloud' ? {
        endpoint: (deploymentConfig as any).endpoint,
        apiKey: process.env.KOKORO_API_KEY,
      } : undefined,
      healthCheck: deploymentConfig.healthCheck,
    };

    const executor = new KokoroExecutor(kokoroConfig);
    return executor;
  }
}
```

## File Structure

```
extensions/speech-plugins/
├── src/
│   ├── interfaces/
│   │   ├── stt-provider.ts          (existing)
│   │   ├── tts-provider.ts          (existing)
│   │   └── plugin-registry.ts       (existing)
│   │
│   ├── wrappers/                     (NEW)
│   │   ├── base-provider-wrapper.ts (base abstract class)
│   │   ├── stt-provider-wrapper.ts  (STT-specific wrapper)
│   │   ├── tts-provider-wrapper.ts  (TTS-specific wrapper)
│   │   ├── deployment-bridge.ts     (config mapping utilities)
│   │   │
│   │   └── providers/               (concrete implementations)
│   │       ├── whisper-plugin.ts
│   │       ├── faster-whisper-plugin.ts
│   │       ├── kokoro-plugin.ts
│   │       ├── deepgram-plugin.ts
│   │       ├── cartesia-plugin.ts
│   │       ├── elevenlabs-plugin.ts
│   │       └── chatterbox-plugin.ts
│   │
│   ├── registry/
│   │   └── plugin-registry.ts       (existing)
│   │
│   └── index.ts                     (barrel exports)
│
└── package.json
```

## Configuration Flow

### ProviderConfig Example (Plugin Registry)

```typescript
const providerConfig: ProviderConfig = {
  id: 'whisper-docker-base',
  type: 'stt',
  module: '@clawdbot/speech-plugins/wrappers/providers/whisper-plugin',
  enabled: true,
  priority: 10,
  config: {
    mode: 'docker',
    docker: {
      image: 'openai/whisper',
      tag: 'latest',
      ports: { 8000: 8000 },
      pullPolicy: 'ifNotPresent',
    },
    providerConfig: {
      modelSize: 'base',
    },
    healthCheck: {
      enabled: true,
      intervalMs: 60000,
    },
  },
};
```

### Deployment Mode Selection

The wrapper pattern supports three deployment modes via `ProviderConfig.config.mode`:

1. **Docker Mode**
   - Container-based deployment
   - Automatic port management
   - Volume mounts for model caching
   - Health checks via HTTP endpoints

2. **System Mode**
   - Local binary/package installation
   - Automatic dependency detection
   - Multi-platform support (npm, pip, brew, apt)
   - Binary path resolution

3. **Cloud Mode**
   - API-based remote service
   - Authentication handling
   - Rate limiting and quota management
   - Regional endpoint selection

## Error Handling

### Error Translation

The wrapper translates executor errors to plugin interface errors:

```typescript
// Executor error
throw new VoiceProviderError(
  'Transcription failed',
  'whisper',
  'TRANSCRIPTION_ERROR'
);

// Plugin interface error
callbacks.onError({
  code: 'TRANSCRIPTION_ERROR',
  message: 'Transcription failed',
});
```

### Health Check Coordination

```typescript
// Wrapper health check
async isHealthy(): Promise<boolean> {
  if (!this.initialized || !this.executor) {
    return false;
  }

  // Delegate to executor
  const healthy = await this.executor.isHealthy();

  // Log health status
  if (!healthy) {
    console.warn(`Provider ${this.getProviderId()} is unhealthy`);
  }

  return healthy;
}
```

## Capability Exposure

### Capability Mapping

The wrapper exposes provider capabilities through the plugin interface:

```typescript
// Executor capabilities
const executorCaps = {
  supportedFormats: [AudioFormat.PCM_16, AudioFormat.OPUS],
  supportedSampleRates: [8000, 16000, 24000, 48000],
  supportedLanguages: ['en', 'es', 'fr', 'de', 'it'],
  supportsStreaming: true,
  maxConcurrentSessions: 4,
  estimatedLatencyMs: 500,
  requiresNetworkConnection: false,
};

// Plugin interface capabilities (STT)
const pluginCaps = {
  formats: ['pcm16', 'opus'],
  sampleRates: [8000, 16000, 24000, 48000],
  languages: ['en', 'es', 'fr', 'de', 'it'],
  supportsStreaming: true,
  supportsPartialTranscripts: true,
  maxDurationSeconds: null,
};

// Plugin interface capabilities (TTS)
const pluginCaps = {
  formats: ['wav', 'pcm'],
  sampleRates: [16000, 24000],
  voices: [
    { id: 'voice-1', name: 'Voice 1', language: 'en', gender: 'female' },
  ],
  supportsStreaming: true,
  languages: ['en', 'es'],
};
```

## Usage Examples

### Registering a Provider

```typescript
import { PluginRegistry } from '@clawdbot/speech-plugins';
import { WhisperPlugin } from '@clawdbot/speech-plugins/wrappers/providers/whisper-plugin';

// Create registry
const registry = new PluginRegistry();

// Create provider instance with deployment config
const whisperPlugin = new WhisperPlugin({
  mode: 'docker',
  docker: {
    image: 'openai/whisper',
    tag: 'latest',
    ports: { 8000: 8000 },
  },
  providerConfig: {
    modelSize: 'base',
  },
});

// Initialize and register
await whisperPlugin.initialize();
await registry.registerSTTProvider(whisperPlugin);

// Use provider
const defaultSTT = registry.getDefaultSTTProvider();
const segments = await defaultSTT.transcribe(audioBuffer, {
  format: 'wav',
  sampleRate: 16000,
  language: 'en',
});
```

### Loading from Configuration File

```typescript
// config.json
{
  "providers": [
    {
      "id": "whisper-docker-base",
      "type": "stt",
      "module": "@clawdbot/speech-plugins/wrappers/providers/whisper-plugin",
      "enabled": true,
      "priority": 10,
      "config": {
        "mode": "docker",
        "docker": {
          "image": "openai/whisper",
          "tag": "latest",
          "ports": { "8000": 8000 }
        },
        "providerConfig": {
          "modelSize": "base"
        }
      }
    },
    {
      "id": "kokoro-system",
      "type": "tts",
      "module": "@clawdbot/speech-plugins/wrappers/providers/kokoro-plugin",
      "enabled": true,
      "priority": 5,
      "config": {
        "mode": "system",
        "system": {
          "binary": "kokoro",
          "packageManager": ["pip"],
          "searchPaths": ["/usr/local/bin", "~/.local/bin"]
        }
      }
    }
  ]
}

// Load and initialize
await registry.loadFromConfig('./config.json');
await registry.initializeAll();
```

## Implementation Checklist

- [ ] Create base wrapper classes
  - [ ] `AbstractProviderPluginWrapper` (base)
  - [ ] `STTProviderWrapper` (STT-specific)
  - [ ] `TTSProviderWrapper` (TTS-specific)
  - [ ] `DeploymentBridge` utilities

- [ ] Implement concrete wrappers
  - [ ] `WhisperPlugin` (STT, docker/system/cloud)
  - [ ] `FasterWhisperPlugin` (STT, docker/system)
  - [ ] `KokoroPlugin` (TTS, docker/system/cloud)
  - [ ] `DeepgramPlugin` (STT, cloud)
  - [ ] `CartesiaPlugin` (TTS, cloud)
  - [ ] `ElevenLabsPlugin` (TTS, cloud)
  - [ ] `ChatterboxPlugin` (TTS, system)

- [ ] Add tests
  - [ ] Unit tests for base wrappers
  - [ ] Integration tests for concrete wrappers
  - [ ] Deployment mode tests (docker/system/cloud)
  - [ ] Capability mapping tests

- [ ] Documentation
  - [ ] API documentation for wrappers
  - [ ] Deployment mode configuration guide
  - [ ] Migration guide from executors to plugins

## Non-Goals

- **No breaking changes** to existing `VoiceProviderExecutor` interface
- **No modification** of existing executor implementations
- **No runtime overhead** beyond thin wrapper layer
- **No dual maintenance** of executor and plugin logic

## Success Criteria

1. All voice providers can be registered via plugin registry
2. Deployment mode selection works for docker/system/cloud
3. Capabilities are correctly exposed through plugin interfaces
4. Health checks function correctly
5. Error handling provides clear diagnostics
6. Configuration is intuitive and type-safe
7. Existing executor tests continue to pass
8. New wrapper tests achieve 80%+ coverage

## Future Enhancements

1. **Auto-discovery**: Scan available providers and auto-configure
2. **Fallback chaining**: Automatic fallback to next provider on failure
3. **Load balancing**: Distribute requests across multiple instances
4. **Metrics collection**: Track latency, throughput, error rates
5. **Hot-reload**: Update provider config without restart
6. **Provider marketplace**: Discover and install new providers dynamically

---

**End of Architecture Design Document**
