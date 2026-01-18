# Voice Plugin System - API Reference

Complete TypeScript API documentation for the pluggable STT/TTS plugin system.

## STT Provider API

### STTProvider Interface

```typescript
interface STTProvider {
  readonly name: string;
  readonly capabilities: STTCapabilities;
  readonly supportedFormats: STTAudioFormat[];

  transcribe(audio: Buffer, options?: STTOptions): Promise<string>;
  createStream?(options?: STTOptions): STTStream;
  healthCheck?(): Promise<boolean>;
  shutdown?(): Promise<void>;
}
```

### STTOptions

Configuration for transcription requests.

```typescript
interface STTOptions {
  language?: string;              // ISO 639-1: 'en', 'es', 'fr', etc.
  sampleRate?: number;            // 8000, 16000, 24000, 48000
  format?: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';
  customFormat?: Record<string, unknown>;
  timeoutMs?: number;             // Default: 30000
  providerOptions?: Record<string, unknown>;
}
```

### STTStream Interface

Real-time streaming session for transcription.

```typescript
interface STTStream {
  write(audioChunk: Buffer): void;
  end(): void;
  close(): void;

  on(event: 'partial', listener: (partial: STTPartial) => void): void;
  on(event: 'final', listener: (transcript: string) => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  off(event: string, listener: Function): void;

  isActive(): boolean;
}
```

### STTPartial

Result object for streaming partial transcripts.

```typescript
interface STTPartial {
  text: string;                   // Transcript so far (may change)
  isFinal: boolean;               // True if this is final result
  confidence?: number;            // 0-1, if supported
  metadata?: Record<string, unknown>;
}
```

### STTCapabilities

Metadata about provider capabilities.

```typescript
interface STTCapabilities {
  batch: boolean;                           // Supports transcribe()
  streaming: boolean;                       // Supports createStream()
  vad?: boolean;                            // Server-side VAD
  partialTranscripts?: boolean;             // Partial results
  confidence?: boolean;                     // Confidence scores
  languages?: string[];                     // Supported languages
  requiresInternet: boolean;                // Online required
  avgLatencyMs?: number;                    // Typical latency
  maxConcurrentStreams?: number | null;    // Stream limit (null = unlimited)
}
```

### STTAudioFormat

Describes a supported audio format.

```typescript
interface STTAudioFormat {
  name: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';
  sampleRates: number[];          // [8000, 16000, 24000, 48000]
  bitDepth: number;               // 8, 16, 24, 32
  channels: number;               // 1 (mono), 2 (stereo)
  encoding: string;               // 'signed-int', 'G.711 mu-law', etc.
  isPreferred?: boolean;           // Provider's preferred format
}
```

### Example: Implementing STTProvider

```typescript
import type { STTProvider, STTStream, STTOptions } from './stt-provider.js';

export class CustomSTTProvider implements STTProvider {
  readonly name = 'custom-stt';

  readonly capabilities = {
    batch: true,
    streaming: true,
    vad: true,
    partialTranscripts: true,
    requiresInternet: false,
    languages: ['en', 'es', 'fr'],
    avgLatencyMs: 150,
    maxConcurrentStreams: 10,
  };

  readonly supportedFormats = [
    {
      name: 'pcm',
      sampleRates: [16000],
      bitDepth: 16,
      channels: 1,
      encoding: 'signed-int',
      isPreferred: true,
    },
  ];

  async transcribe(audio: Buffer, options?: STTOptions): Promise<string> {
    // Validate input
    if (!audio.length) throw new Error('Audio buffer is empty');

    // Perform transcription
    const result = await this.performTranscription(audio, options);

    return result;
  }

  createStream(options?: STTOptions): STTStream {
    return new CustomSTTStream(options);
  }

  async healthCheck(): Promise<boolean> {
    // Check if provider is ready (e.g., model loaded, API available)
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    // Clean up resources
    await this.cleanup();
  }

  private async performTranscription(audio: Buffer, options?: STTOptions): Promise<string> {
    // Implementation specific to provider
    return 'transcribed text';
  }

  private async ping(): Promise<void> {
    // Health check implementation
  }

  private async cleanup(): Promise<void> {
    // Cleanup implementation
  }
}

class CustomSTTStream implements STTStream {
  private active = true;
  private listeners: Map<string, Function[]> = new Map();

  constructor(private options?: STTOptions) {}

  write(audioChunk: Buffer): void {
    if (!this.active) throw new Error('Stream is closed');
    // Process audio chunk
    this.emit('partial', { text: 'partial', isFinal: false });
  }

  end(): void {
    if (!this.active) return;
    // Flush remaining audio and emit final result
    this.emit('final', 'complete transcript');
    this.active = false;
  }

  close(): void {
    this.active = false;
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: string, data: unknown): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(data);
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
```

## TTS Provider API

### TTSProvider Interface

```typescript
interface TTSProvider {
  readonly name: string;
  readonly capabilities: TTSCapabilities;
  readonly supportedFormats: TTSAudioFormat[];

  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;
  createStream?(options?: TTSOptions): TTSStream;
  getVoices?(): Promise<TTSVoiceMetadata[]>;
  healthCheck?(): Promise<boolean>;
  shutdown?(): Promise<void>;
}
```

### TTSOptions

Configuration for synthesis requests.

```typescript
interface TTSOptions {
  format?: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';
  sampleRate?: number;            // 8000, 16000, 24000, 48000
  customFormat?: Record<string, unknown>;
  voice?: string;                 // Provider-specific voice ID
  speed?: number;                 // 0.25 to 4.0
  instructions?: string;          // Tone/style (provider-specific)
  timeoutMs?: number;             // Default: 30000
  providerOptions?: Record<string, unknown>;
}
```

### TTSStream Interface

Real-time streaming session for synthesis.

```typescript
interface TTSStream {
  write(text: string): void;
  end(): void;
  close(): void;

  on(event: 'data', listener: (audioChunk: Buffer) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (error: Error) => void): void;
  off(event: string, listener: Function): void;

  isActive(): boolean;
}
```

### TTSCapabilities

Metadata about provider capabilities.

```typescript
interface TTSCapabilities {
  batch: boolean;                           // Supports synthesize()
  streaming: boolean;                       // Supports createStream()
  voiceSelection: boolean;                  // Multiple voices
  speedControl?: boolean;                   // Speed adjustment
  styleInstructions?: boolean;              // Tone/style control
  ssml?: boolean;                           // SSML markup
  voiceCount?: number;                      // Number of voices
  requiresInternet: boolean;                // Online required
  avgLatencyMs?: number;                    // Typical latency
  maxConcurrentStreams?: number | null;    // Stream limit
}
```

### TTSAudioFormat

Describes a supported audio format.

```typescript
interface TTSAudioFormat {
  name: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';
  sampleRate: number;             // Native rate (e.g., 24000)
  bitDepth: number;               // 8, 16, 24, 32
  channels: number;               // 1 (mono), 2 (stereo)
  encoding: string;               // Description
  bitrate?: number;               // For lossy formats (kbps)
  isPreferred?: boolean;           // Provider's preferred format
}
```

### TTSVoiceMetadata

Information about a single voice.

```typescript
interface TTSVoiceMetadata {
  id: string;                     // Provider-specific voice ID
  name: string;                   // Human-readable name
  description?: string;           // 'Male, American English'
  language: string;               // ISO 639-1: 'en', 'es'
  gender?: 'male' | 'female' | 'neutral';
  ageGroup?: 'child' | 'young-adult' | 'adult' | 'senior';
  sampleUrl?: string;             // URL to sample audio
  quality?: 'budget' | 'standard' | 'premium' | 'ultra';
  naturalness?: number;           // 0-1
  metadata?: Record<string, unknown>;
}
```

### Example: Implementing TTSProvider

```typescript
import type { TTSProvider, TTSStream, TTSOptions, TTSVoiceMetadata } from './tts-provider.js';

export class CustomTTSProvider implements TTSProvider {
  readonly name = 'custom-tts';

  readonly capabilities = {
    batch: true,
    streaming: true,
    voiceSelection: true,
    speedControl: true,
    styleInstructions: true,
    voiceCount: 5,
    requiresInternet: false,
    avgLatencyMs: 200,
    maxConcurrentStreams: 5,
  };

  readonly supportedFormats = [
    {
      name: 'pcm',
      sampleRate: 24000,
      bitDepth: 16,
      channels: 1,
      encoding: 'signed-int',
      isPreferred: true,
    },
    {
      name: 'wav',
      sampleRate: 24000,
      bitDepth: 16,
      channels: 1,
      encoding: 'WAV',
    },
  ];

  async synthesize(text: string, options?: TTSOptions): Promise<Buffer> {
    if (!text.trim()) throw new Error('Text is empty');

    const result = await this.performSynthesis(text, options);
    return result;
  }

  createStream(options?: TTSOptions): TTSStream {
    return new CustomTTSStream(options);
  }

  async getVoices(): Promise<TTSVoiceMetadata[]> {
    return [
      {
        id: 'voice-1',
        name: 'Sarah',
        language: 'en',
        gender: 'female',
        quality: 'premium',
        naturalness: 0.95,
      },
      // ... more voices
    ];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.ping();
      return true;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    await this.cleanup();
  }

  private async performSynthesis(text: string, options?: TTSOptions): Promise<Buffer> {
    // Implementation specific to provider
    return Buffer.from([]);
  }

  private async ping(): Promise<void> {
    // Health check
  }

  private async cleanup(): Promise<void> {
    // Cleanup
  }
}

class CustomTTSStream implements TTSStream {
  private active = true;
  private listeners: Map<string, Function[]> = new Map();

  constructor(private options?: TTSOptions) {}

  write(text: string): void {
    if (!this.active) throw new Error('Stream is closed');
    // Synthesize and emit audio chunks
    this.emit('data', Buffer.from([]), 'audio chunk');
  }

  end(): void {
    if (!this.active) return;
    this.emit('end');
    this.active = false;
  }

  close(): void {
    this.active = false;
  }

  on(event: string, listener: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(listener);
  }

  off(event: string, listener: Function): void {
    const list = this.listeners.get(event);
    if (list) {
      const idx = list.indexOf(listener);
      if (idx >= 0) list.splice(idx, 1);
    }
  }

  private emit(event: string, ...args: unknown[]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener(...args);
      }
    }
  }

  isActive(): boolean {
    return this.active;
  }
}
```

## Plugin Registry API

### STTRegistry / TTSRegistry

```typescript
interface PluginRegistry<T extends STTProvider | TTSProvider> {
  // Registration
  register(providerId: string, provider: T, priority?: number): void;
  unregister(providerId: string): void;

  // Retrieval
  get(providerId: string): T | null;
  getPrimary(): T | null;
  getFallback(): T | null;
  list(): Array<{ id: string; provider: T; priority: number }>;

  // Active provider management
  setDefault(providerId: string): void;
  getActive(): T | null;
  setActive(providerId: string, persist?: boolean): void;

  // Health & lifecycle
  healthCheck(): Promise<Map<string, boolean>>;
  discover(options?: DiscoveryOptions): Promise<void>;
  shutdown(): Promise<void>;
}
```

### DiscoveryOptions

```typescript
interface DiscoveryOptions {
  npm?: boolean;                  // Search npm packages
  pluginDir?: string;             // Filesystem directory
  namePattern?: RegExp;           // Filter by pattern
  autoRegister?: boolean;         // Auto-register discovered
  skipBuiltin?: boolean;          // Skip built-in providers
}
```

### Example: Using Registry

```typescript
import { STTRegistry, TTSRegistry } from './plugin-registry.js';
import { OpenAIRealtimeSTTProvider } from './providers/stt-openai-realtime.js';
import { OpenAITTSProvider } from './providers/tts-openai.js';

// Create registries
const sttRegistry = new STTRegistry();
const ttsRegistry = new TTSRegistry();

// Register providers manually
const openaiSTT = new OpenAIRealtimeSTTProvider({ apiKey: process.env.OPENAI_API_KEY });
sttRegistry.register('openai-realtime', openaiSTT, 10); // Priority 10

const openaiTTS = new OpenAITTSProvider({ apiKey: process.env.OPENAI_API_KEY });
ttsRegistry.register('openai-tts', openaiTTS, 10);

// Or discover automatically
await sttRegistry.discover({ npm: true, autoRegister: true });
await ttsRegistry.discover({ npm: true, autoRegister: true });

// Get primary providers
const sttProvider = sttRegistry.getPrimary();
const ttsProvider = ttsRegistry.getPrimary();

// Use providers
const transcript = await sttProvider!.transcribe(audioBuffer);
const audio = await ttsProvider!.synthesize('Hello, world!');

// Handle fallback
try {
  const result = await sttRegistry.get('primary-provider')!.transcribe(audio);
} catch (error) {
  console.log('Primary failed, trying fallback...');
  const fallback = sttRegistry.getFallback();
  const result = await fallback!.transcribe(audio);
}

// Shutdown
await sttRegistry.shutdown();
await ttsRegistry.shutdown();
```

## Audio Normalizer API

### AudioNormalizer Interface

```typescript
interface AudioNormalizer {
  detect(audio: Buffer, hint?: AudioFormatHint): AudioFormat;
  convert(audio: Buffer, from: AudioFormat, to: AudioFormat): Buffer;
  resample(audio: Buffer, fromRate: number, toRate: number, method?: ResamplingMethod): Buffer;
  chunk(audio: Buffer, chunkSizeMs: number, sampleRate: number): Buffer[];
  apply(audio: Buffer, effects: AudioEffect[]): Buffer;
}
```

### AudioFormat

```typescript
interface AudioFormat {
  name: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';
  sampleRate: number;
  bitDepth: number;               // 8, 16, 24, 32
  channels: number;               // 1, 2
  encoding: string;               // 'signed-int', 'G.711', etc.
  byteOrder?: 'le' | 'be';       // Byte order (little-endian default)
  metadata?: Record<string, unknown>;
}
```

### Example: Audio Conversion

```typescript
import { AudioNormalizer } from './audio-normalizer.js';

const normalizer = new AudioNormalizer();

// Convert PCM 16-bit 24kHz to mu-law 8kHz (for Twilio)
const pcm24k: Buffer = /* ... */;
const mulaw8k = normalizer.convert(
  pcm24k,
  { name: 'pcm', sampleRate: 24000, bitDepth: 16, channels: 1 },
  { name: 'mu-law', sampleRate: 8000, bitDepth: 8, channels: 1 }
);

// Resample 48kHz to 16kHz
const pcm48k: Buffer = /* ... */;
const pcm16k = normalizer.resample(pcm48k, 48000, 16000, 'cubic');

// Chunk audio into 20ms frames (8kHz = 160 samples = 160 bytes)
const frames = normalizer.chunk(mulaw8k, 20, 8000);

// Apply effects (gain, normalization)
const normalized = normalizer.apply(pcm16k, [
  { type: 'gain', value: 0.8 },
  { type: 'normalize' },
]);
```

## Configuration API

### VoicePluginConfig

```typescript
interface VoicePluginConfig {
  defaults: {
    stt: string;                  // Provider ID
    tts: string;
  };
  stt: {
    providers: Record<string, ProviderConfig>;
    fallback: FallbackConfig;
  };
  tts: {
    providers: Record<string, ProviderConfig>;
    fallback: FallbackConfig;
  };
  audio: {
    defaultStreamFormat: {
      stt: string;
      tts: string;
      sampleRate: number;
    };
    conversions: Record<string, ConversionRule>;
  };
  platforms?: {
    windows?: PlatformConfig;
    linux?: PlatformConfig;
  };
}
```

### Loading Configuration

```typescript
import { loadConfig, validateConfig } from './plugin-config.js';

// Load from file
const config = await loadConfig('~/.clawdbot/voice-providers.yaml');

// Or load from JSON
const config = await loadConfig('voice-providers.json');

// Validate config
const validConfig = await validateConfig(config);

// Access configuration
const sttProviderId = config.defaults.stt;
const ttsOptions = config.tts.providers['openai-tts'].config;
```

## Error Handling

### Provider Errors

```typescript
// All provider methods can throw Error

try {
  const transcript = await provider.transcribe(audio);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('API')) {
      // API error - try fallback
    } else if (error.message.includes('timeout')) {
      // Timeout - retry with longer timeout
    } else if (error.message.includes('format')) {
      // Format error - try converting audio
    }
  }
}
```

### Registry Errors

```typescript
try {
  sttRegistry.setDefault('nonexistent');
} catch (error) {
  // Provider not found
}
```

## Type Guards

```typescript
import type { STTProvider, TTSProvider } from './plugins/index.js';

function isSupportsBatch(provider: STTProvider | TTSProvider): boolean {
  return provider.capabilities.batch;
}

function isSupportsStreaming(provider: STTProvider | TTSProvider): boolean {
  return provider.capabilities.streaming;
}

function hasHealthCheck<T extends STTProvider | TTSProvider>(
  provider: T
): provider is T & { healthCheck: () => Promise<boolean> } {
  return 'healthCheck' in provider && typeof provider.healthCheck === 'function';
}
```

## Module Exports

```typescript
// Main plugin module
export {
  // Interfaces
  type STTProvider,
  type TTSProvider,
  type STTOptions,
  type TTSOptions,
  type STTStream,
  type TTSStream,
  type STTCapabilities,
  type TTSCapabilities,
  type STTAudioFormat,
  type TTSAudioFormat,
  type TTSVoiceMetadata,

  // Registry
  type PluginRegistry,
  type DiscoveryOptions,
  STTRegistry,
  TTSRegistry,

  // Audio
  type AudioFormat,
  type AudioNormalizer,
  AudioNormalizer,

  // Config
  type VoicePluginConfig,
  loadConfig,
  validateConfig,

  // Providers
  OpenAIRealtimeSTTProvider,
  OpenAITTSProvider,
} from './plugins/index.js';
```

---

See [Voice Plugin Architecture](/voice-plugins) for design overview and [Implementation Guide](/voice-plugins-implementation) for step-by-step instructions.
