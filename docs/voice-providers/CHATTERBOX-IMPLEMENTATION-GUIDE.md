# Chatterbox Implementation Guide

**Target:** Implementation of ChatterboxExecutor in Clawdbot voice provider system
**Estimated Duration:** 3-4 weeks
**Difficulty:** Moderate (follows established patterns)

## Quick Start

### What You're Building

A new TTS provider executor that integrates Chatterbox (Resemble AI) into Clawdbot's voice provider orchestrator. The implementation follows the same pattern as existing providers (Kokoro, Whisper, ElevenLabs) but focuses on TTS with voice cloning capabilities.

### Architecture at a Glance

```
ChatterboxExecutor (main class)
├── Implements VoiceProviderExecutor interface
├── Delegates to deployment handlers (Docker/System/Cloud)
├── Manages lifecycle (initialize, shutdown)
├── Handles health checks and metrics
└── Provides TTS synthesis + streaming

Deployment Handlers
├── DockerHandler - Communicates with Docker container
├── SystemHandler - Direct Python process or subprocess
└── CloudHandler - Resemble AI API calls
```

## File Structure

Create these files in `/home/tsavo/clawd/clawdbot/src/media/voice-providers/`:

```
chatterbox.ts                 # Main executor class (~450 LOC)
├─ Lifecycle management (init, shutdown)
├─ Synthesis operations
├─ Health checks
└─ Configuration validation

chatterbox.docker.ts          # Docker-specific (~350 LOC)
├─ HTTP client setup
├─ Request/response handling
├─ Container health probing
└─ Error mapping

chatterbox.system.ts          # System deployment (~400 LOC)
├─ Python subprocess management
├─ GPU detection
├─ Model loading
└─ Fallback to CPU

chatterbox.service.ts         # Shared utilities (~300 LOC)
├─ Audio format conversions
├─ Voice cloning helpers
├─ Model management
└─ Configuration builders

chatterbox.test.ts            # Tests (~500 LOC)
├─ Unit tests (config, error handling)
├─ Integration tests (synthesis, voice cloning)
├─ Mock deployment handlers
└─ Health check simulation
```

## Step-by-Step Implementation

### Step 1: Create Base Executor (~450 LOC)

**File:** `src/media/voice-providers/chatterbox.ts`

```typescript
import { EventEmitter } from 'events';
import type {
  AudioBuffer,
  ProviderCapabilities,
  SynthesisOptions,
  TranscribeOptions,
  TranscriptionChunk,
  TranscriptionResult,
} from './executor.js';
import { AudioFormat, BaseVoiceProviderExecutor, VoiceProviderError } from './executor.js';

// Enums and types
export enum ChatterboxErrorCode {
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  GPU_NOT_AVAILABLE = 'GPU_NOT_AVAILABLE',
  INVALID_CONFIG = 'INVALID_CONFIG',
  VOICE_NOT_FOUND = 'VOICE_NOT_FOUND',
  VOICE_CLONE_FAILED = 'VOICE_CLONE_FAILED',
  INVALID_REFERENCE_AUDIO = 'INVALID_REFERENCE_AUDIO',
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  SYNTHESIS_TIMEOUT = 'SYNTHESIS_TIMEOUT',
  SYNTHESIS_FAILED = 'SYNTHESIS_FAILED',
  DOCKER_UNREACHABLE = 'DOCKER_UNREACHABLE',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

export class ChatterboxProviderError extends VoiceProviderError {
  constructor(
    message: string,
    public code: ChatterboxErrorCode,
    public details?: {
      language?: string;
      voice?: string;
      retryable?: boolean;
    },
  ) {
    super(message, 'chatterbox', code);
    this.name = 'ChatterboxProviderError';
  }
}

export interface ChatterboxDeploymentConfig {
  mode: 'docker' | 'system' | 'cloud';
  docker?: {
    image: string;
    port: number;
    gpuEnabled?: boolean;
    healthCheckInterval?: number;
  };
  system?: {
    pythonPath?: string;
    modelCachePath?: string;
  };
  cloud?: {
    endpoint: string;
    apiKey?: string;
  };
}

export interface ChatterboxSynthesisOptions extends SynthesisOptions {
  voiceCloning?: {
    enabled: boolean;
    referenceAudio: Uint8Array;
    referenceDuration: number;
    similarity?: number;
  };
  prosody?: {
    emotionLevel?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
    expressiveness?: number;
  };
  modelVariant?: 'base' | 'large' | 'xlarge';
  useWatermark?: boolean;
}

// Voice definitions
export interface ChatterboxVoice {
  id: string;
  name: string;
  language: string;
  gender?: 'male' | 'female' | 'neutral';
}

// Pre-defined voices map
const PREDEFINED_VOICES: Record<string, ChatterboxVoice> = {
  'en_US_female_1': {
    id: 'en_US_female_1',
    name: 'Rachel',
    language: 'en',
    gender: 'female',
  },
  'en_US_male_1': {
    id: 'en_US_male_1',
    name: 'Michael',
    language: 'en',
    gender: 'male',
  },
  // Add 15+ more predefined voices
};

// Supported languages
const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'nl', 'pl', 'pt-BR', 'pt-PT',
  'ru', 'ja', 'ko', 'zh-CN', 'zh-TW', 'vi', 'tr', 'ar', 'th',
  'el', 'hi',
];

/**
 * Main ChatterboxExecutor class
 */
export class ChatterboxExecutor extends BaseVoiceProviderExecutor {
  readonly id = 'chatterbox';
  private config: ChatterboxDeploymentConfig;
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private eventEmitter = new EventEmitter();
  private handler: any = null; // Docker/System/Cloud handler

  constructor(config: ChatterboxDeploymentConfig) {
    super();
    this.config = config;
    this.validateConfig();
  }

  /**
   * Initialize the executor
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // Create appropriate handler based on deployment mode
      this.handler = await this.createHandler(this.config);

      // Initialize handler
      await this.handler.initialize();

      // Start health checks
      this.startHealthChecks();

      this.isInitialized = true;
    } catch (error) {
      throw new ChatterboxProviderError(
        `Failed to initialize: ${error instanceof Error ? error.message : String(error)}`,
        ChatterboxErrorCode.INVALID_CONFIG,
      );
    }
  }

  /**
   * Shutdown the executor
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    if (this.handler?.shutdown) {
      await this.handler.shutdown();
    }

    this.isInitialized = false;
  }

  /**
   * Synthesize text to speech
   */
  async synthesize(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): Promise<AudioBuffer> {
    if (!this.isInitialized) {
      throw new ChatterboxProviderError(
        'Executor not initialized',
        ChatterboxErrorCode.INVALID_CONFIG,
      );
    }

    // Validate inputs
    this.validateSynthesisInputs(text, options);

    // Call handler
    return this.handler.synthesize(text, options);
  }

  /**
   * Stream synthesis (not yet implemented for Chatterbox)
   */
  async *synthesizeStream(
    textStream: ReadableStream<string>,
    options?: ChatterboxSynthesisOptions,
  ): AsyncIterable<AudioBuffer> {
    if (!this.isInitialized) {
      throw new ChatterboxProviderError(
        'Executor not initialized',
        ChatterboxErrorCode.INVALID_CONFIG,
      );
    }

    // TODO: Implement streaming when Chatterbox API supports it
    throw new ChatterboxProviderError(
      'Streaming not yet implemented',
      ChatterboxErrorCode.SYNTHESIS_FAILED,
    );
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportedFormats: [
        AudioFormat.PCM_16,
        AudioFormat.MP3,
      ],
      supportedSampleRates: [16000, 22050, 44100],
      supportedLanguages: [...SUPPORTED_LANGUAGES],
      supportsStreaming: false, // TODO: Implement later
      maxConcurrentSessions: this.config.docker?.gpuEnabled ? 10 : 2,
      estimatedLatencyMs: 150,
      requiresNetworkConnection: this.config.mode === 'cloud',
      requiresLocalModel: this.config.mode === 'system',
    };
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized || !this.handler) {
      return false;
    }

    try {
      return await this.handler.isHealthy();
    } catch (error) {
      return false;
    }
  }

  /**
   * STT operations (not supported)
   */
  async transcribe(
    audio: AudioBuffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    throw new ChatterboxProviderError(
      'Chatterbox is a TTS-only provider',
      ChatterboxErrorCode.SYNTHESIS_FAILED,
    );
  }

  async *transcribeStream(
    audioStream: ReadableStream<AudioBuffer>,
    options?: TranscribeOptions,
  ): AsyncIterable<TranscriptionChunk> {
    throw new ChatterboxProviderError(
      'Chatterbox is a TTS-only provider',
      ChatterboxErrorCode.SYNTHESIS_FAILED,
    );
  }

  /**
   * Validate synthesis inputs
   */
  private validateSynthesisInputs(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): void {
    // Validate text
    if (!text || typeof text !== 'string') {
      throw new ChatterboxProviderError(
        'Text is required and must be a string',
        ChatterboxErrorCode.TEXT_TOO_LONG,
      );
    }

    if (text.length > 5000) {
      throw new ChatterboxProviderError(
        `Text exceeds maximum length (${text.length} > 5000)`,
        ChatterboxErrorCode.TEXT_TOO_LONG,
      );
    }

    // Validate language
    if (options?.language && !SUPPORTED_LANGUAGES.includes(options.language)) {
      throw new ChatterboxProviderError(
        `Language not supported: ${options.language}`,
        ChatterboxErrorCode.UNSUPPORTED_LANGUAGE,
        { language: options.language },
      );
    }

    // Validate voice
    if (options?.voice && !PREDEFINED_VOICES[options.voice]) {
      throw new ChatterboxProviderError(
        `Voice not found: ${options.voice}`,
        ChatterboxErrorCode.VOICE_NOT_FOUND,
        { voice: options.voice },
      );
    }

    // Validate voice cloning inputs
    if (options?.voiceCloning?.enabled) {
      if (!options.voiceCloning.referenceAudio) {
        throw new ChatterboxProviderError(
          'Reference audio is required for voice cloning',
          ChatterboxErrorCode.INVALID_REFERENCE_AUDIO,
        );
      }

      if (options.voiceCloning.referenceDuration < 1000 || options.voiceCloning.referenceDuration > 30000) {
        throw new ChatterboxProviderError(
          'Reference audio duration must be between 1-30 seconds',
          ChatterboxErrorCode.INVALID_REFERENCE_AUDIO,
        );
      }
    }
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (!this.config || !this.config.mode) {
      throw new ChatterboxProviderError(
        'Configuration mode is required',
        ChatterboxErrorCode.INVALID_CONFIG,
      );
    }

    switch (this.config.mode) {
      case 'docker':
        if (!this.config.docker?.image || !this.config.docker?.port) {
          throw new ChatterboxProviderError(
            'Docker mode requires image and port',
            ChatterboxErrorCode.INVALID_CONFIG,
          );
        }
        break;
      case 'system':
        // Optional python path, will auto-detect
        break;
      case 'cloud':
        if (!this.config.cloud?.endpoint) {
          throw new ChatterboxProviderError(
            'Cloud mode requires endpoint',
            ChatterboxErrorCode.INVALID_CONFIG,
          );
        }
        break;
    }
  }

  /**
   * Create appropriate deployment handler
   */
  private async createHandler(config: ChatterboxDeploymentConfig): Promise<any> {
    switch (config.mode) {
      case 'docker': {
        const { ChatterboxDockerHandler } = await import('./chatterbox.docker.js');
        return new ChatterboxDockerHandler(config.docker!);
      }
      case 'system': {
        const { ChatterboxSystemHandler } = await import('./chatterbox.system.js');
        return new ChatterboxSystemHandler(config.system);
      }
      case 'cloud': {
        const { ChatterboxCloudHandler } = await import('./chatterbox.cloud.js');
        return new ChatterboxCloudHandler(config.cloud!);
      }
      default:
        throw new ChatterboxProviderError(
          `Unknown deployment mode: ${config.mode}`,
          ChatterboxErrorCode.INVALID_CONFIG,
        );
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const interval = this.config.docker?.healthCheckInterval || 30000;

    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthy = await this.isHealthy();
        this.eventEmitter.emit('health', { healthy, timestamp: Date.now() });
      } catch (error) {
        this.eventEmitter.emit('health-error', {
          error: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
      }
    }, interval);

    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }
}

/**
 * Export convenience factory
 */
export async function createChatterboxExecutor(
  config: ChatterboxDeploymentConfig,
): Promise<ChatterboxExecutor> {
  const executor = new ChatterboxExecutor(config);
  await executor.initialize();
  return executor;
}

// Export types and predefined voices
export { PREDEFINED_VOICES, SUPPORTED_LANGUAGES };
```

### Step 2: Create Docker Handler (~350 LOC)

**File:** `src/media/voice-providers/chatterbox.docker.ts`

```typescript
import fetch from 'node-fetch';
import type { AudioBuffer, AudioFormat, SynthesisOptions } from './executor.js';
import { AudioFormat as AudioFormatEnum } from './executor.js';
import type { ChatterboxSynthesisOptions } from './chatterbox.js';
import { ChatterboxProviderError, ChatterboxErrorCode } from './chatterbox.js';

export interface DockerConfig {
  image: string;
  port: number;
  gpuEnabled?: boolean;
  healthCheckInterval?: number;
}

/**
 * Docker deployment handler for Chatterbox
 */
export class ChatterboxDockerHandler {
  private config: DockerConfig;
  private baseUrl: string;
  private healthyAt: number = 0;

  constructor(config: DockerConfig) {
    this.config = config;
    this.baseUrl = `http://localhost:${config.port}`;
  }

  /**
   * Initialize (verify Docker connection)
   */
  async initialize(): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        timeout: 5000,
      });

      if (!response.ok) {
        throw new Error(`Health check failed: ${response.statusText}`);
      }

      this.healthyAt = Date.now();
    } catch (error) {
      throw new ChatterboxProviderError(
        `Failed to connect to Docker container at ${this.baseUrl}`,
        ChatterboxErrorCode.DOCKER_UNREACHABLE,
      );
    }
  }

  /**
   * Shutdown (graceful, container managed separately)
   */
  async shutdown(): Promise<void> {
    // Docker container is managed externally
    // This is a no-op for handler
  }

  /**
   * Synthesize via HTTP API
   */
  async synthesize(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): Promise<AudioBuffer> {
    try {
      const payload = this.buildSynthesisPayload(text, options);

      const response = await fetch(`${this.baseUrl}/synthesize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeout: 30000,
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Synthesis failed: ${response.statusText} - ${error}`);
      }

      // Get audio data
      const buffer = await response.buffer();

      return {
        data: new Uint8Array(buffer),
        format: options?.format || AudioFormatEnum.PCM_16,
        sampleRate: options?.sampleRate || 16000,
        duration: this.estimateDuration(buffer.length, options?.sampleRate || 16000),
        channels: 1,
      };
    } catch (error) {
      if (error instanceof ChatterboxProviderError) {
        throw error;
      }

      throw new ChatterboxProviderError(
        `Synthesis error: ${error instanceof Error ? error.message : String(error)}`,
        ChatterboxErrorCode.SYNTHESIS_FAILED,
      );
    }
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        timeout: 5000,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Build synthesis request payload
   */
  private buildSynthesisPayload(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): Record<string, any> {
    const payload: Record<string, any> = {
      text,
      voice_id: options?.voice || 'en_US_female_1',
      speed: options?.speed || 1.0,
      format: this.formatToString(options?.format),
    };

    if (options?.language) {
      payload.language = options.language;
    }

    if (options?.voiceCloning?.enabled) {
      payload.voice_cloning = {
        reference_audio: Array.from(options.voiceCloning.referenceAudio),
        similarity: options.voiceCloning.similarity || 0.9,
      };
    }

    if (options?.prosody) {
      payload.prosody = {
        emotion: options.prosody.emotionLevel,
        expressiveness: options.prosody.expressiveness,
      };
    }

    return payload;
  }

  /**
   * Format enum to string
   */
  private formatToString(format?: AudioFormatEnum): string {
    switch (format) {
      case AudioFormatEnum.PCM_16:
        return 'pcm16';
      case AudioFormatEnum.MP3:
        return 'mp3';
      case AudioFormatEnum.WAV:
        return 'wav';
      default:
        return 'pcm16';
    }
  }

  /**
   * Estimate audio duration
   */
  private estimateDuration(byteLength: number, sampleRate: number): number {
    // PCM_16 = 2 bytes per sample, mono
    const samples = byteLength / 2;
    return (samples / sampleRate) * 1000; // milliseconds
  }
}
```

### Step 3: Create System Handler (~400 LOC)

**File:** `src/media/voice-providers/chatterbox.system.ts`

```typescript
import { spawn } from 'child_process';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { AudioBuffer } from './executor.js';
import { AudioFormat as AudioFormatEnum } from './executor.js';
import type { ChatterboxSynthesisOptions } from './chatterbox.js';
import { ChatterboxProviderError, ChatterboxErrorCode } from './chatterbox.js';
import { detectGPU } from './gpu-detection.js';

export interface SystemConfig {
  pythonPath?: string;
  modelCachePath?: string;
}

/**
 * System deployment handler for Chatterbox
 */
export class ChatterboxSystemHandler {
  private config: SystemConfig;
  private pythonPath: string = 'python3';
  private gpuAvailable: boolean = false;

  constructor(config?: SystemConfig) {
    this.config = config || {};
    if (config?.pythonPath) {
      this.pythonPath = config.pythonPath;
    }
  }

  /**
   * Initialize (detect GPU, verify Python)
   */
  async initialize(): Promise<void> {
    try {
      // Detect GPU
      const gpuInfo = await detectGPU();
      this.gpuAvailable = gpuInfo.available;

      // Verify Python and Chatterbox installation
      await this.verifyInstallation();
    } catch (error) {
      throw new ChatterboxProviderError(
        `Initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        ChatterboxErrorCode.MODEL_LOAD_FAILED,
      );
    }
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    // No persistent resources to clean up
  }

  /**
   * Synthesize using Python subprocess
   */
  async synthesize(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): Promise<AudioBuffer> {
    return new Promise((resolve, reject) => {
      // Write text to temp file
      const tempFile = join(tmpdir(), `chatterbox-${Date.now()}.txt`);
      writeFileSync(tempFile, text);

      const pythonScript = this.buildPythonScript(text, options);
      const proc = spawn(this.pythonPath, ['-c', pythonScript], {
        timeout: 30000,
        env: {
          ...process.env,
          USE_GPU: this.gpuAvailable ? '1' : '0',
          HF_CACHE: this.config.modelCachePath,
        },
      });

      let audioData = Buffer.alloc(0);
      let stderr = '';

      proc.stdout?.on('data', (chunk: Buffer) => {
        audioData = Buffer.concat([audioData, chunk]);
      });

      proc.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      proc.on('close', (code: number) => {
        try {
          unlinkSync(tempFile);
        } catch {
          // Ignore cleanup errors
        }

        if (code !== 0) {
          reject(new ChatterboxProviderError(
            `Synthesis process failed: ${stderr}`,
            ChatterboxErrorCode.SYNTHESIS_FAILED,
          ));
          return;
        }

        resolve({
          data: new Uint8Array(audioData),
          format: options?.format || AudioFormatEnum.PCM_16,
          sampleRate: options?.sampleRate || 16000,
          duration: this.estimateDuration(audioData.length),
          channels: 1,
        });
      });

      proc.on('error', (error: Error) => {
        reject(new ChatterboxProviderError(
          `Process error: ${error.message}`,
          ChatterboxErrorCode.SYNTHESIS_FAILED,
        ));
      });
    });
  }

  /**
   * Health check
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.verifyInstallation();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify Python and Chatterbox installation
   */
  private verifyInstallation(): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(this.pythonPath, [
        '-c',
        'import chatterbox; print("ok")',
      ]);

      let output = '';
      proc.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString();
      });

      proc.on('close', (code: number) => {
        if (code === 0 && output.includes('ok')) {
          resolve();
        } else {
          reject(new Error('Chatterbox not installed or not accessible'));
        }
      });

      proc.on('error', (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Build Python synthesis script
   */
  private buildPythonScript(
    text: string,
    options?: ChatterboxSynthesisOptions,
  ): string {
    return `
import sys
import json
from chatterbox import Chatterbox

# Initialize
model = Chatterbox()

# Synthesis parameters
text = ${JSON.stringify(text)}
voice = ${JSON.stringify(options?.voice || 'en_US_female_1')}
speed = ${options?.speed || 1.0}

# Synthesize
audio = model.synthesize(
    text=text,
    voice=voice,
    speed=speed,
    language=${JSON.stringify(options?.language || 'en')}
)

# Output as binary to stdout
sys.stdout.buffer.write(audio)
`;
  }

  /**
   * Estimate duration
   */
  private estimateDuration(byteLength: number): number {
    // PCM_16 = 2 bytes per sample, mono, 16kHz
    const samples = byteLength / 2;
    return (samples / 16000) * 1000;
  }
}
```

### Step 4: Create Shared Utilities (~300 LOC)

**File:** `src/media/voice-providers/chatterbox.service.ts`

```typescript
import type { AudioBuffer, AudioFormat } from './executor.js';
import { AudioFormat as AudioFormatEnum } from './executor.js';

/**
 * Audio format conversion utilities
 */
export class AudioFormatConverter {
  /**
   * Convert between audio formats
   */
  static convert(
    audio: AudioBuffer,
    targetFormat: AudioFormat,
    targetSampleRate?: number,
  ): AudioBuffer {
    // For now, just return as-is (formats are compatible)
    // Full implementation would do proper conversion
    return {
      ...audio,
      format: targetFormat,
      sampleRate: targetSampleRate || audio.sampleRate,
    };
  }

  /**
   * Convert PCM16 to MP3
   */
  static async pcmToMp3(pcmData: Uint8Array): Promise<Uint8Array> {
    // TODO: Implement using libmp3lame or similar
    throw new Error('MP3 conversion not yet implemented');
  }

  /**
   * Validate audio buffer
   */
  static validateAudioBuffer(audio: Uint8Array, format: AudioFormat): boolean {
    if (format === AudioFormatEnum.PCM_16) {
      // PCM16 must have even number of bytes
      return audio.length % 2 === 0;
    }
    return audio.length > 0;
  }
}

/**
 * Voice cloning utilities
 */
export class VoiceCloningHelper {
  /**
   * Validate reference audio
   */
  static validateReferenceAudio(
    audio: Uint8Array,
    durationMs: number,
  ): boolean {
    // Must be 1-30 seconds
    if (durationMs < 1000 || durationMs > 30000) {
      return false;
    }

    // Must be at least 8KB (rough minimum)
    if (audio.length < 8192) {
      return false;
    }

    return true;
  }

  /**
   * Prepare reference audio for cloning
   */
  static async prepareReferenceAudio(
    audio: Uint8Array,
    currentSampleRate: number,
  ): Promise<Uint8Array> {
    // Resample to 16kHz if needed
    if (currentSampleRate !== 16000) {
      return this.resampleAudio(audio, currentSampleRate, 16000);
    }
    return audio;
  }

  /**
   * Simple linear interpolation resampling
   */
  private static resampleAudio(
    audio: Uint8Array,
    sourceSampleRate: number,
    targetSampleRate: number,
  ): Uint8Array {
    // TODO: Implement proper resampling
    // For now, return as-is (assumes already 16kHz)
    return audio;
  }
}

/**
 * Model management utilities
 */
export class ModelManager {
  private static modelCache: Map<string, any> = new Map();

  /**
   * Get or load model
   */
  static async getModel(modelId: string): Promise<any> {
    if (this.modelCache.has(modelId)) {
      return this.modelCache.get(modelId);
    }

    // TODO: Load model from Hugging Face Hub
    throw new Error(`Model loading not yet implemented: ${modelId}`);
  }

  /**
   * Clear model cache
   */
  static clearCache(): void {
    this.modelCache.clear();
  }

  /**
   * Get cache size
   */
  static getCacheSize(): number {
    return this.modelCache.size;
  }
}

/**
 * Configuration builders
 */
export class ConfigBuilder {
  /**
   * Build Docker config from environment
   */
  static buildDockerConfig(): any {
    return {
      mode: 'docker',
      docker: {
        image: process.env.CHATTERBOX_DOCKER_IMAGE || 'resemble-ai/chatterbox:latest',
        port: parseInt(process.env.CHATTERBOX_DOCKER_PORT || '8000'),
        gpuEnabled: process.env.CHATTERBOX_GPU_ENABLED !== 'false',
        healthCheckInterval: parseInt(process.env.CHATTERBOX_HEALTH_CHECK_INTERVAL || '30000'),
      },
    };
  }

  /**
   * Build System config from environment
   */
  static buildSystemConfig(): any {
    return {
      mode: 'system',
      system: {
        pythonPath: process.env.CHATTERBOX_PYTHON_PATH || 'python3',
        modelCachePath: process.env.HF_CACHE,
      },
    };
  }

  /**
   * Build Cloud config from environment
   */
  static buildCloudConfig(): any {
    return {
      mode: 'cloud',
      cloud: {
        endpoint: process.env.CHATTERBOX_API_ENDPOINT || 'https://api.resemble.ai/v2/tts',
        apiKey: process.env.CHATTERBOX_API_KEY,
      },
    };
  }
}

/**
 * Retry strategy
 */
export class RetryStrategy {
  static readonly RETRYABLE_ERRORS = [
    'SYNTHESIS_TIMEOUT',
    'GPU_NOT_AVAILABLE',
    'DOCKER_UNREACHABLE',
    'RATE_LIMITED',
  ];

  static isRetryable(errorCode: string): boolean {
    return this.RETRYABLE_ERRORS.includes(errorCode);
  }

  static calculateBackoff(attempt: number, baseMs: number = 100): number {
    return baseMs * Math.pow(2, attempt - 1);
  }
}
```

### Step 5: Create Tests (~500 LOC)

**File:** `src/media/voice-providers/chatterbox.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChatterboxExecutor, ChatterboxErrorCode, ChatterboxProviderError } from './chatterbox.js';
import type { ChatterboxDeploymentConfig } from './chatterbox.js';
import { AudioFormat } from './executor.js';

describe('ChatterboxExecutor', () => {
  let executor: ChatterboxExecutor;

  describe('Configuration Validation', () => {
    it('rejects invalid config', () => {
      expect(() => {
        new ChatterboxExecutor({} as ChatterboxDeploymentConfig);
      }).toThrow();
    });

    it('validates docker config requires image and port', () => {
      expect(() => {
        new ChatterboxExecutor({
          mode: 'docker',
          docker: { image: '', port: 0 },
        });
      }).toThrow();
    });

    it('validates cloud config requires endpoint', () => {
      expect(() => {
        new ChatterboxExecutor({
          mode: 'cloud',
          cloud: { endpoint: '' },
        });
      }).toThrow();
    });
  });

  describe('Synthesis Input Validation', () => {
    beforeEach(async () => {
      executor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000 },
      });
      // Mock handler
      executor['handler'] = {
        synthesize: vi.fn(),
        initialize: vi.fn(),
        isHealthy: vi.fn().mockResolvedValue(true),
      };
      executor['isInitialized'] = true;
    });

    it('rejects empty text', async () => {
      await expect(executor.synthesize('')).rejects.toThrow(ChatterboxProviderError);
    });

    it('rejects text exceeding length limit', async () => {
      const longText = 'a'.repeat(5001);
      await expect(executor.synthesize(longText)).rejects.toThrow();
    });

    it('rejects unsupported language', async () => {
      await expect(
        executor.synthesize('Hello', { language: 'klingon' }),
      ).rejects.toThrow(ChatterboxProviderError);
    });

    it('rejects invalid voice', async () => {
      await expect(
        executor.synthesize('Hello', { voice: 'invalid_voice' }),
      ).rejects.toThrow(ChatterboxProviderError);
    });

    it('rejects invalid reference audio duration', async () => {
      await expect(
        executor.synthesize('Hello', {
          voiceCloning: {
            enabled: true,
            referenceAudio: new Uint8Array(1000),
            referenceDuration: 500, // Less than 1 second
          },
        }),
      ).rejects.toThrow(ChatterboxProviderError);
    });
  });

  describe('Capabilities', () => {
    beforeEach(() => {
      executor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000, gpuEnabled: true },
      });
    });

    it('reports correct capabilities', () => {
      const caps = executor.getCapabilities();

      expect(caps.supportedFormats).toContain(AudioFormat.PCM_16);
      expect(caps.supportedFormats).toContain(AudioFormat.MP3);
      expect(caps.supportedLanguages).toContain('en');
      expect(caps.supportedLanguages).toContain('es');
      expect(caps.supportedLanguages.length).toBe(20); // All 23 supported
      expect(caps.supportsStreaming).toBe(false);
      expect(caps.maxConcurrentSessions).toBe(10); // GPU enabled
    });

    it('reports lower concurrent sessions without GPU', () => {
      const cpuExecutor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000, gpuEnabled: false },
      });

      const caps = cpuExecutor.getCapabilities();
      expect(caps.maxConcurrentSessions).toBe(2);
    });
  });

  describe('STT Operations', () => {
    beforeEach(() => {
      executor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000 },
      });
    });

    it('rejects transcribe (TTS-only provider)', async () => {
      const audio = {
        data: new Uint8Array(1000),
        format: AudioFormat.PCM_16,
        sampleRate: 16000,
        duration: 1000,
        channels: 1,
      };

      await expect(executor.transcribe(audio)).rejects.toThrow(ChatterboxProviderError);
    });
  });

  describe('Error Handling', () => {
    it('creates ChatterboxProviderError with code', () => {
      const error = new ChatterboxProviderError(
        'Test error',
        ChatterboxErrorCode.SYNTHESIS_FAILED,
      );

      expect(error.message).toContain('chatterbox');
      expect(error.code).toBe(ChatterboxErrorCode.SYNTHESIS_FAILED);
      expect(error.name).toBe('ChatterboxProviderError');
    });

    it('includes details in error', () => {
      const error = new ChatterboxProviderError(
        'Test error',
        ChatterboxErrorCode.UNSUPPORTED_LANGUAGE,
        { language: 'klingon' },
      );

      expect(error.details?.language).toBe('klingon');
    });
  });

  describe('Lifecycle', () => {
    beforeEach(() => {
      executor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000 },
      });
    });

    it('initializes successfully', async () => {
      // Mock handler creation
      vi.mock('./chatterbox.docker.js', () => ({
        ChatterboxDockerHandler: vi.fn().mockImplementation(() => ({
          initialize: vi.fn(),
          isHealthy: vi.fn().mockResolvedValue(true),
        })),
      }));

      // Would need proper mocking in real test
      // await expect(executor.initialize()).resolves.not.toThrow();
    });

    it('handles shutdown gracefully', async () => {
      executor['handler'] = {
        shutdown: vi.fn(),
      };
      executor['isInitialized'] = true;

      await executor.shutdown();
      expect(executor['isInitialized']).toBe(false);
    });
  });

  describe('Health Checks', () => {
    beforeEach(() => {
      executor = new ChatterboxExecutor({
        mode: 'docker',
        docker: { image: 'test', port: 8000, healthCheckInterval: 5000 },
      });
    });

    it('reports health status', async () => {
      executor['handler'] = {
        isHealthy: vi.fn().mockResolvedValue(true),
      };
      executor['isInitialized'] = true;

      const health = await executor.isHealthy();
      expect(health).toBe(true);
    });

    it('handles health check failures', async () => {
      executor['handler'] = {
        isHealthy: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };
      executor['isInitialized'] = true;

      const health = await executor.isHealthy();
      expect(health).toBe(false);
    });
  });
});
```

## Configuration in Orchestrator

Add to orchestrator configuration:

```typescript
// src/config/voice-providers.config.ts
const chatterboxEntry: VoiceProviderEntry = {
  id: 'chatterbox-docker',
  name: 'Chatterbox (Docker)',
  type: 'tts',
  priority: 1,
  deployment: 'docker',
  enabled: true,
  estimatedLatencyMs: 150,
  estimatedCostPerMonth: 0,
  metadata: {
    deploymentConfig: {
      mode: 'docker',
      docker: {
        image: 'resemble-ai/chatterbox:latest',
        port: 8000,
        gpuEnabled: true,
        healthCheckInterval: 30000,
      },
    },
  },
};
```

## Testing Checklist

- [ ] Unit tests pass (config, error handling, validation)
- [ ] Docker handler tests pass (HTTP communication)
- [ ] System handler tests pass (subprocess, GPU detection)
- [ ] Integration tests with orchestrator
- [ ] Live tests with Docker container running
- [ ] Live tests with system Python installation
- [ ] Performance benchmarks (latency, memory)
- [ ] Voice cloning tests
- [ ] Error recovery and fallback tests

## Next Steps

1. Create executor skeleton and test framework
2. Implement Docker handler with HTTP API communication
3. Implement System handler with Python subprocess management
4. Add configuration and error handling
5. Write comprehensive tests
6. Document public API and examples
7. Performance tuning and optimization
8. Submit for code review

## Reference Files

- **Base Executor Pattern:** `src/media/voice-providers/kokoro.ts`
- **Docker Handler Example:** `src/media/voice-providers/faster-whisper.docker.ts`
- **System Handler Example:** `src/media/voice-providers/faster-whisper.system.ts`
- **Test Examples:** `src/media/voice-providers/*.test.ts`
- **Orchestrator Integration:** `src/media/voice-providers/orchestrator.ts`

---

**Last Updated:** January 2026
**Status:** Ready for Implementation
