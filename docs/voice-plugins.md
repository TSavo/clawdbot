# Pluggable STT/TTS Architecture

This document describes the core plugin system design for Clawdbot's Speech-to-Text (STT) and Text-to-Speech (TTS) providers, enabling support for multiple backends (OpenAI, local Whisper, Kokoro, ElevenLabs, etc.) on Windows and Linux platforms.

## Architecture Overview

The pluggable architecture decouples the voice-call extension from specific STT/TTS implementations, allowing providers to be registered, configured, and swapped at runtime.

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Voice Call Extension                            │
│  (Twilio, Telnyx, Plivo, etc. - call lifecycle management)           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        v                      v                      v
┌─────────────────────┐ ┌─────────────────────┐ ┌─────────────────────┐
│   Audio Pipeline    │ │  Plugin Registry    │ │   Configuration     │
│  (normalization,    │ │  (discovery, init)  │ │   Manager           │
│   format handling)  │ │                     │ │  (yaml/json load)   │
└─────────────────────┘ └─────────────────────┘ └─────────────────────┘
        │                      │                      │
        └──────────────────────┼──────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        v                      v                      v
    ┌─────────┐           ┌─────────┐           ┌─────────┐
    │   STT   │           │   TTS   │           │ Fallback│
    │Provider │           │Provider │           │ Policy  │
    │ Registry│           │ Registry│           │         │
    └────┬────┘           └────┬────┘           └────┬────┘
         │                     │                     │
    ┌────┴──────────────┬──────┴─────────────────────┤
    │                   │                            │
    v                   v                            v
┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐
│ OpenAI       │  │ ElevenLabs   │  │ Provider Priority &  │
│ Realtime API │  │ API          │  │ Fallback Mechanism   │
│              │  │              │  │                      │
│• Streaming   │  │• Streaming   │  │ 1. Primary provider  │
│• Batch       │  │• Batch       │  │ 2. Fallback provider │
│• mu-law      │  │• MP3/WAV     │  │ 3. Error handling    │
└──────────────┘  └──────────────┘  └──────────────────────┘
    │                   │
    ├─────────────────────────────────┐
    │                                   v
    │                          ┌──────────────────┐
    │                          │ Local Providers  │
    │                          │ (Windows/Linux)  │
    │                          │                  │
    │                          │• Whisper (batch) │
    │                          │• Kokoro (TTS)    │
    │                          │• Coqui (STT)     │
    │                          └──────────────────┘
    │
    v
┌──────────────────────────────────────────────────────────┐
│              Audio Format Normalization                   │
│  • PCM (16-bit, 24kHz, 8kHz) ↔ mu-law (8kHz)            │
│  • Resampling, chunking, buffering                       │
│  • Format detection & conversion                         │
└──────────────────────────────────────────────────────────┘
```

## Core Plugin Interfaces

### STT Provider Interface

```typescript
/**
 * Options for STT transcription.
 */
export interface STTOptions {
  /**
   * Language code (e.g., 'en', 'es', 'fr').
   * If omitted, provider should auto-detect.
   */
  language?: string;

  /**
   * Audio sample rate in Hz (8000, 16000, 24000, 48000).
   * Required for batch transcription; streaming may infer from context.
   */
  sampleRate?: number;

  /**
   * Audio format: 'pcm', 'wav', 'mp3', 'mu-law'.
   * Defaults to 'pcm' (16-bit signed LE).
   */
  format?: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';

  /**
   * Custom audio codec/metadata (provider-specific).
   * Used for non-standard formats.
   */
  customFormat?: Record<string, unknown>;

  /**
   * Transcription timeout in milliseconds.
   * Defaults to 30000 (30s).
   */
  timeoutMs?: number;

  /**
   * Provider-specific options (e.g., model selection, VAD threshold).
   */
  providerOptions?: Record<string, unknown>;
}

/**
 * Partial transcript result for streaming.
 */
export interface STTPartial {
  /** Partial text (may change as more audio arrives) */
  text: string;

  /** Whether this is a final result (will not change) */
  isFinal: boolean;

  /** Confidence score (0-1) if provider supports it */
  confidence?: number;

  /** Intermediate metadata (e.g., language detected) */
  metadata?: Record<string, unknown>;
}

/**
 * Stream for receiving transcripts in real-time.
 */
export interface STTStream {
  /**
   * Send audio data to the stream.
   * The stream handles buffering, normalization, and format conversion.
   */
  write(audioChunk: Buffer): void;

  /**
   * Signal end of audio (triggers final transcript).
   */
  end(): void;

  /**
   * Close the stream without final transcript.
   */
  close(): void;

  /**
   * Listen for partial transcripts.
   */
  on(event: 'partial', listener: (partial: STTPartial) => void): void;

  /**
   * Listen for final transcripts.
   */
  on(event: 'final', listener: (transcript: string) => void): void;

  /**
   * Listen for errors.
   */
  on(event: 'error', listener: (error: Error) => void): void;

  /**
   * Remove listener.
   */
  off(event: string, listener: Function): void;

  /**
   * Check if stream is active.
   */
  isActive(): boolean;
}

/**
 * STT Provider interface.
 * Implementations must support at least one mode (batch or streaming).
 */
export interface STTProvider {
  /**
   * Human-readable provider name (e.g., 'OpenAI Realtime', 'Whisper Local').
   */
  readonly name: string;

  /**
   * Capabilities of this provider.
   */
  readonly capabilities: STTCapabilities;

  /**
   * Supported audio formats (PCM, WAV, MP3, mu-law).
   */
  readonly supportedFormats: STTAudioFormat[];

  /**
   * Batch transcription (single audio file → single transcript).
   * Required for all providers.
   *
   * @param audio - Audio data (buffer)
   * @param options - Transcription options
   * @returns Transcribed text
   * @throws Error if audio format is unsupported or transcription fails
   */
  transcribe(audio: Buffer, options?: STTOptions): Promise<string>;

  /**
   * Create a streaming transcription session.
   * Optional; only implement if provider supports streaming.
   *
   * @param options - Streaming session options
   * @returns Stream for sending audio and receiving transcripts
   * @throws Error if streaming is not supported
   */
  createStream?(options?: STTOptions): STTStream;

  /**
   * Health check / connectivity test.
   * Used by the registry to validate provider availability.
   *
   * @returns true if provider is ready, false otherwise
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Gracefully shutdown the provider (close connections, cleanup resources).
   */
  shutdown?(): Promise<void>;
}

/**
 * Capabilities supported by an STT provider.
 */
export interface STTCapabilities {
  /** Supports batch transcription */
  batch: boolean;

  /** Supports streaming transcription */
  streaming: boolean;

  /** Supports server-side VAD (voice activity detection) */
  vad?: boolean;

  /** Supports partial transcript emission */
  partialTranscripts?: boolean;

  /** Supports confidence scores */
  confidence?: boolean;

  /** List of supported languages (ISO 639-1 codes) */
  languages?: string[];

  /** Whether the provider requires internet (vs local-only) */
  requiresInternet: boolean;

  /** Typical latency for single request (ms) */
  avgLatencyMs?: number;

  /** Max concurrent streams (null = unlimited) */
  maxConcurrentStreams?: number | null;
}

/**
 * Supported audio formats for STT.
 */
export interface STTAudioFormat {
  /** Format name */
  name: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';

  /** Typical sample rates (Hz) */
  sampleRates: number[];

  /** Bit depth (8, 16, 24, 32) */
  bitDepth: number;

  /** Channels (1 = mono, 2 = stereo, etc.) */
  channels: number;

  /** Encoding (e.g., 'G.711 mu-law', 'MPEG-1 Layer III', 'signed-int') */
  encoding: string;

  /** Whether this is the provider's preferred format */
  isPreferred?: boolean;
}
```

### TTS Provider Interface

```typescript
/**
 * Options for TTS synthesis.
 */
export interface TTSOptions {
  /**
   * Audio format: 'pcm', 'wav', 'mp3', 'mu-law'.
   * Defaults to 'pcm' (16-bit signed LE).
   */
  format?: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';

  /**
   * Target sample rate in Hz (8000, 16000, 24000, 48000).
   * Defaults to provider's native rate.
   */
  sampleRate?: number;

  /**
   * Custom audio codec/metadata (provider-specific).
   */
  customFormat?: Record<string, unknown>;

  /**
   * Voice selection (provider-specific name or ID).
   * E.g., 'coral' (OpenAI), 'Adam' (Google), 'Joanna' (AWS).
   */
  voice?: string;

  /**
   * Speech speed multiplier (0.25 to 4.0).
   * Defaults to 1.0 (normal speed).
   */
  speed?: number;

  /**
   * Tone/style instructions (provider-specific).
   * E.g., 'speak in a cheerful tone', 'customer service voice'.
   */
  instructions?: string;

  /**
   * Timeout in milliseconds.
   * Defaults to 30000 (30s).
   */
  timeoutMs?: number;

  /**
   * Provider-specific options (e.g., model selection, custom parameters).
   */
  providerOptions?: Record<string, unknown>;
}

/**
 * Stream for sending text and receiving audio chunks in real-time.
 */
export interface TTSStream {
  /**
   * Send text to be synthesized (can be called multiple times).
   * The stream buffers and streams audio as synthesis completes.
   */
  write(text: string): void;

  /**
   * Signal end of text input (triggers flush).
   */
  end(): void;

  /**
   * Close the stream without flushing remaining text.
   */
  close(): void;

  /**
   * Listen for audio chunks.
   * Called as audio is synthesized (not necessarily in single chunks).
   */
  on(event: 'data', listener: (audioChunk: Buffer) => void): void;

  /**
   * Listen for stream end (all audio has been emitted).
   */
  on(event: 'end', listener: () => void): void;

  /**
   * Listen for errors.
   */
  on(event: 'error', listener: (error: Error) => void): void;

  /**
   * Remove listener.
   */
  off(event: string, listener: Function): void;

  /**
   * Check if stream is active.
   */
  isActive(): boolean;
}

/**
 * TTS Provider interface.
 * Implementations must support at least one mode (batch or streaming).
 */
export interface TTSProvider {
  /**
   * Human-readable provider name (e.g., 'OpenAI TTS', 'ElevenLabs').
   */
  readonly name: string;

  /**
   * Capabilities of this provider.
   */
  readonly capabilities: TTSCapabilities;

  /**
   * Supported audio formats.
   */
  readonly supportedFormats: TTSAudioFormat[];

  /**
   * Batch synthesis (single text → single audio buffer).
   * Required for all providers.
   *
   * @param text - Text to synthesize
   * @param options - Synthesis options
   * @returns Audio buffer
   * @throws Error if text is empty or synthesis fails
   */
  synthesize(text: string, options?: TTSOptions): Promise<Buffer>;

  /**
   * Create a streaming synthesis session.
   * Optional; only implement if provider supports streaming.
   *
   * @param options - Streaming session options
   * @returns Stream for sending text and receiving audio
   * @throws Error if streaming is not supported
   */
  createStream?(options?: TTSOptions): TTSStream;

  /**
   * Get available voices for this provider.
   * Returns metadata about voices (name, description, sample audio URL, etc.).
   *
   * @returns Array of voice metadata
   */
  getVoices?(): Promise<TTSVoiceMetadata[]>;

  /**
   * Health check / connectivity test.
   *
   * @returns true if provider is ready, false otherwise
   */
  healthCheck?(): Promise<boolean>;

  /**
   * Gracefully shutdown the provider.
   */
  shutdown?(): Promise<void>;
}

/**
 * Capabilities supported by a TTS provider.
 */
export interface TTSCapabilities {
  /** Supports batch synthesis */
  batch: boolean;

  /** Supports streaming synthesis */
  streaming: boolean;

  /** Supports voice selection */
  voiceSelection: boolean;

  /** Supports speed control */
  speedControl?: boolean;

  /** Supports style/tone instructions */
  styleInstructions?: boolean;

  /** Supports SSML markup */
  ssml?: boolean;

  /** Number of available voices */
  voiceCount?: number;

  /** Whether the provider requires internet (vs local-only) */
  requiresInternet: boolean;

  /** Typical latency for single request (ms) */
  avgLatencyMs?: number;

  /** Max concurrent streams (null = unlimited) */
  maxConcurrentStreams?: number | null;
}

/**
 * Supported audio format for TTS.
 */
export interface TTSAudioFormat {
  /** Format name */
  name: 'pcm' | 'wav' | 'mp3' | 'mu-law' | 'custom';

  /** Native sample rate (Hz) */
  sampleRate: number;

  /** Bit depth (8, 16, 24, 32) */
  bitDepth: number;

  /** Channels (1 = mono, 2 = stereo) */
  channels: number;

  /** Encoding description */
  encoding: string;

  /** Bitrate for lossy formats (kbps) */
  bitrate?: number;

  /** Whether this is the provider's preferred format */
  isPreferred?: boolean;
}

/**
 * Metadata about a TTS voice.
 */
export interface TTSVoiceMetadata {
  /** Voice ID (provider-specific) */
  id: string;

  /** Human-readable voice name */
  name: string;

  /** Voice description (e.g., 'Male, American English') */
  description?: string;

  /** Language code (ISO 639-1) */
  language: string;

  /** Gender (male, female, neutral) */
  gender?: 'male' | 'female' | 'neutral';

  /** Age group (child, young-adult, adult, senior) */
  ageGroup?: 'child' | 'young-adult' | 'adult' | 'senior';

  /** URL to sample audio file */
  sampleUrl?: string;

  /** Quality tier (budget, standard, premium, ultra) */
  quality?: 'budget' | 'standard' | 'premium' | 'ultra';

  /** Natural/expressive quality (0-1) */
  naturalness?: number;

  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}
```

## Plugin Registry System

The registry manages provider lifecycle: discovery, initialization, validation, and fallback.

### Registry Interface

```typescript
/**
 * Plugin registry for STT/TTS providers.
 */
export interface PluginRegistry<T extends STTProvider | TTSProvider> {
  /**
   * Register a provider instance with optional config.
   *
   * @param providerId - Unique provider identifier
   * @param provider - Provider instance
   * @param priority - Priority for selection (higher = preferred). Defaults to 0.
   */
  register(providerId: string, provider: T, priority?: number): void;

  /**
   * Unregister a provider.
   */
  unregister(providerId: string): void;

  /**
   * Get a registered provider by ID.
   * Returns null if not found.
   */
  get(providerId: string): T | null;

  /**
   * Get the primary (highest-priority) provider.
   * Used for automatic provider selection.
   *
   * @returns Primary provider or null if no providers registered
   */
  getPrimary(): T | null;

  /**
   * Get fallback provider (second-highest priority).
   * Used when primary provider fails.
   *
   * @returns Fallback provider or null if < 2 providers registered
   */
  getFallback(): T | null;

  /**
   * List all registered providers (sorted by priority).
   */
  list(): Array<{ id: string; provider: T; priority: number }>;

  /**
   * Set default provider by ID.
   * Raises error if provider not found.
   */
  setDefault(providerId: string): void;

  /**
   * Get the currently active provider (may differ from primary).
   */
  getActive(): T | null;

  /**
   * Override active provider (temp or persistent).
   *
   * @param providerId - Provider to activate
   * @param persist - Save as new default if true
   */
  setActive(providerId: string, persist?: boolean): void;

  /**
   * Run health checks on all providers.
   * Returns results for each provider.
   *
   * @returns Map of provider ID → health status
   */
  healthCheck(): Promise<Map<string, boolean>>;

  /**
   * Discover and auto-register local/packaged providers.
   * Searches for providers in:
   * - Built-in providers (this package)
   * - npm packages matching pattern @clawdbot/stt-*, @clawdbot/tts-*
   * - Filesystem directory (if configured)
   *
   * @param options - Discovery options
   */
  discover(options?: DiscoveryOptions): Promise<void>;

  /**
   * Shutdown all providers gracefully.
   */
  shutdown(): Promise<void>;
}

/**
 * Options for provider discovery.
 */
export interface DiscoveryOptions {
  /** Search for providers in npm packages */
  npm?: boolean;

  /** Search in specific filesystem directory */
  pluginDir?: string;

  /** Only discover providers matching pattern */
  namePattern?: RegExp;

  /** Auto-register discovered providers */
  autoRegister?: boolean;

  /** Skip built-in providers */
  skipBuiltin?: boolean;
}
```

### Registry Implementation Details

The registry should:

1. **Maintain registration order** with priority metadata
2. **Cache health check results** with TTL (time-to-live)
3. **Support dynamic provider swapping** without stopping active sessions
4. **Emit events** (provider-registered, provider-failed, etc.)
5. **Support provider-specific configuration** via options object
6. **Validate provider interfaces** at registration time

## Configuration System

Configuration files specify which providers to use, their settings, and fallback behavior.

### Configuration File Format (YAML/JSON)

```yaml
# ~/.clawdbot/voice-providers.yaml
# or specified via CLAWDBOT_VOICE_PLUGINS_CONFIG env var

# Default providers to use
defaults:
  stt: "openai-realtime"      # Provider ID
  tts: "openai-tts"

# STT provider configurations
stt:
  providers:
    # OpenAI Realtime (streaming)
    openai-realtime:
      enabled: true
      priority: 10
      config:
        apiKey: "${OPENAI_API_KEY}"  # Read from env
        model: "gpt-4o-transcribe"
        silenceDurationMs: 800
        vadThreshold: 0.5

    # Local Whisper (batch only, requires local model)
    whisper-local:
      enabled: false  # Disabled by default; enable if you have local model
      priority: 5
      config:
        modelSize: "base"           # tiny, base, small, medium, large
        device: "cpu"               # cuda, cpu, mps
        computeType: "default"      # default, int8
        language: "en"              # Optional: auto-detect if omitted

    # Coqui STT (batch, local, open-source)
    coqui-local:
      enabled: false
      priority: 3
      config:
        modelPath: "/path/to/model"
        scorerPath: "/path/to/scorer"
        beamWidth: 100
        lmWeight: 0.75

  # Fallback rules
  fallback:
    strategy: "priority"            # priority, round-robin, failover
    maxRetries: 2
    retryDelay: 1000               # ms
    failoverProviders:              # Explicit fallback chain
      - "whisper-local"
      - "coqui-local"

# TTS provider configurations
tts:
  providers:
    # OpenAI TTS
    openai-tts:
      enabled: true
      priority: 10
      config:
        apiKey: "${OPENAI_API_KEY}"
        model: "gpt-4o-mini-tts"
        voice: "coral"
        speed: 1.0
        instructions: null

    # ElevenLabs API (streaming)
    elevenlabs:
      enabled: false
      priority: 8
      config:
        apiKey: "${ELEVENLABS_API_KEY}"
        voice: "Rachel"
        model: "eleven_turbo_v2_5"
        stability: 0.5
        similarityBoost: 0.75
        optimizeStreamingLatency: 2

    # Kokoro TTS (local, fast)
    kokoro-local:
      enabled: false
      priority: 5
      config:
        modelPath: "/path/to/kokoro"
        device: "cpu"               # cuda, cpu, mps
        voiceDir: "/path/to/voices"
        language: "en-us"

  # Fallback rules
  fallback:
    strategy: "priority"
    maxRetries: 2
    retryDelay: 500

# Audio format normalization rules
audio:
  # Default format for streaming
  defaultStreamFormat:
    stt: "pcm"                      # PCM 16-bit, mono
    tts: "pcm"
    sampleRate: 8000

  # Format conversion rules
  conversions:
    pcm24k-to-mulaw8k:
      resamplingMethod: "linear"
      targetSampleRate: 8000
      targetFormat: "mu-law"
      chunkSizeMs: 20

# Platform-specific settings
platforms:
  windows:
    stt:
      preferred: "openai-realtime"
      alternatives:
        - "whisper-local"           # Requires ~2GB VRAM
        - "coqui-local"

    tts:
      preferred: "openai-tts"
      alternatives:
        - "kokoro-local"            # Requires ~500MB VRAM

  linux:
    stt:
      preferred: "openai-realtime"
      alternatives:
        - "whisper-local"
        - "coqui-local"

    tts:
      preferred: "openai-tts"
      alternatives:
        - "kokoro-local"
```

### JSON Alternative

```json
{
  "defaults": {
    "stt": "openai-realtime",
    "tts": "openai-tts"
  },
  "stt": {
    "providers": {
      "openai-realtime": {
        "enabled": true,
        "priority": 10,
        "config": {
          "apiKey": "${OPENAI_API_KEY}",
          "model": "gpt-4o-transcribe"
        }
      }
    },
    "fallback": {
      "strategy": "priority",
      "maxRetries": 2,
      "retryDelay": 1000
    }
  }
}
```

## Example Configurations

### Configuration 1: OpenAI Realtime + ElevenLabs (Cloud-based, High Quality)

```yaml
defaults:
  stt: "openai-realtime"
  tts: "elevenlabs"

stt:
  providers:
    openai-realtime:
      enabled: true
      priority: 10
      config:
        apiKey: "${OPENAI_API_KEY}"
        model: "gpt-4o-transcribe"
        vadThreshold: 0.5

tts:
  providers:
    elevenlabs:
      enabled: true
      priority: 10
      config:
        apiKey: "${ELEVENLABS_API_KEY}"
        voice: "Rachel"
        model: "eleven_turbo_v2_5"
        stability: 0.75
```

### Configuration 2: Local Whisper + Kokoro (Fully Offline)

```yaml
defaults:
  stt: "whisper-local"
  tts: "kokoro-local"

stt:
  providers:
    whisper-local:
      enabled: true
      priority: 10
      config:
        modelSize: "small"          # Fast + accurate balance
        device: "cuda"              # GPU acceleration
        computeType: "default"
        language: "en"

tts:
  providers:
    kokoro-local:
      enabled: true
      priority: 10
      config:
        modelPath: "/opt/kokoro"
        device: "cuda"
        voiceDir: "/opt/kokoro/voices"
        language: "en-us"
```

### Configuration 3: Mixed Approach (OpenAI Primary + Local Fallback)

```yaml
defaults:
  stt: "openai-realtime"
  tts: "openai-tts"

stt:
  providers:
    openai-realtime:
      enabled: true
      priority: 10
      config:
        apiKey: "${OPENAI_API_KEY}"
        model: "gpt-4o-transcribe"

    whisper-local:
      enabled: true
      priority: 5
      config:
        modelSize: "base"
        device: "cpu"

  fallback:
    strategy: "failover"
    maxRetries: 1
    failoverProviders:
      - "whisper-local"

tts:
  providers:
    openai-tts:
      enabled: true
      priority: 10
      config:
        apiKey: "${OPENAI_API_KEY}"
        model: "gpt-4o-mini-tts"

    kokoro-local:
      enabled: true
      priority: 5
      config:
        modelPath: "/opt/kokoro"
        device: "cpu"

  fallback:
    strategy: "failover"
    failoverProviders:
      - "kokoro-local"
```

## Plugin Discovery Mechanism

### Built-in Providers

These are included in the core voice-call extension:

- `openai-realtime` → `OpenAIRealtimeSTTProvider`
- `openai-tts` → `OpenAITTSProvider`

### NPM Package Discovery

Clawdbot will auto-discover providers published as npm packages:

**Naming convention:** `@clawdbot/stt-<name>` or `@clawdbot/tts-<name>`

**Example packages:**
- `@clawdbot/stt-whisper` (Whisper integration)
- `@clawdbot/stt-coqui` (Coqui STT)
- `@clawdbot/tts-elevenlabs` (ElevenLabs integration)
- `@clawdbot/tts-kokoro` (Kokoro TTS)

**Package structure:**

```
@clawdbot/stt-whisper/
├── package.json
├── dist/
│   ├── index.d.ts
│   ├── index.js
│   └── provider.js
├── src/
│   ├── index.ts
│   └── provider.ts
└── README.md
```

**Provider export (index.ts):**

```typescript
// @clawdbot/stt-whisper/src/index.ts

export const metadata = {
  id: "whisper-local",
  name: "Whisper (Local)",
  type: "stt",
  version: "1.0.0",
  description: "OpenAI Whisper for offline speech recognition",
};

export { WhisperSTTProvider } from "./provider.js";
```

### Filesystem Discovery

If `CLAWDBOT_VOICE_PLUGINS_DIR` is set, plugins can be loaded from a local directory:

```
~/.clawdbot/voice-plugins/
├── stt-custom/
│   ├── package.json
│   └── dist/index.js
└── tts-custom/
    ├── package.json
    └── dist/index.js
```

## Provider Priority & Fallback Mechanism

### Priority System

Providers are ranked by priority (higher = preferred). When selecting a provider:

1. If `defaults.stt` is set, use that provider (if healthy)
2. Otherwise, use the highest-priority healthy provider
3. If primary provider fails, try fallback providers in priority order

### Fallback Strategies

| Strategy | Behavior |
|----------|----------|
| `priority` | Use provider list in priority order until success |
| `round-robin` | Cycle through providers on each request |
| `failover` | Stick with one provider; only switch on explicit failure |

### Health Check & Automatic Failover

```typescript
// Registry periodically runs health checks
setInterval(async () => {
  const results = await registry.healthCheck();

  for (const [providerId, isHealthy] of results) {
    if (!isHealthy && providerId === registry.getActive()?.name) {
      // Active provider failed; switch to fallback
      const fallback = registry.getFallback();
      if (fallback) {
        registry.setActive(fallback.name);
        emitEvent("provider-switched", { from: providerId, to: fallback.name });
      }
    }
  }
}, 30000); // Check every 30 seconds
```

## Audio Format Normalization

The voice-call extension must normalize audio formats between:
- Provider input requirements
- Telephony requirements (mu-law 8kHz for Twilio)
- Internal streaming pipeline

### Conversion Pipeline

```typescript
export interface AudioNormalizer {
  /**
   * Detect audio format from buffer or descriptor.
   */
  detect(audio: Buffer, hint?: AudioFormatHint): AudioFormat;

  /**
   * Convert from one format to another.
   */
  convert(
    audio: Buffer,
    from: AudioFormat,
    to: AudioFormat
  ): Buffer;

  /**
   * Resample to target sample rate.
   */
  resample(
    audio: Buffer,
    fromRate: number,
    toRate: number,
    method?: 'linear' | 'cubic' | 'sinc'
  ): Buffer;

  /**
   * Chunk audio into fixed-size frames.
   */
  chunk(audio: Buffer, chunkSizeMs: number, sampleRate: number): Buffer[];

  /**
   * Apply audio effects (gain, filtering, etc.).
   */
  apply(
    audio: Buffer,
    effects: AudioEffect[]
  ): Buffer;
}
```

### Format Support Matrix

| Format | PCM 16-bit | WAV | MP3 | mu-law 8k | Custom |
|--------|-----------|-----|-----|-----------|--------|
| OpenAI Realtime (STT) | ✓ | ✓ | ✗ | ✓ (preferred) | - |
| Whisper Local | ✓ | ✓ | ✓ | ✗ | - |
| OpenAI TTS | ✓ (24k) | ✗ | ✗ | ✓ (via converter) | - |
| ElevenLabs | ✓ | ✓ | ✓ | ✗ | - |
| Kokoro Local | ✓ (24k) | ✗ | ✗ | ✓ (via converter) | - |

## Backwards Compatibility

The existing `OpenAIRealtimeSTTProvider` and `OpenAITTSProvider` will be automatically wrapped to conform to the new plugin interfaces:

```typescript
// Adapter wrapping existing providers
export class LegacySTTAdapter implements STTProvider {
  readonly name = "openai-realtime-legacy";
  readonly capabilities = {
    batch: false,
    streaming: true,
    vad: true,
    partialTranscripts: true,
    requiresInternet: true,
  };
  readonly supportedFormats = [
    {
      name: "mu-law",
      sampleRates: [8000],
      bitDepth: 8,
      channels: 1,
      encoding: "G.711 mu-law",
      isPreferred: true,
    },
  ];

  constructor(private legacyProvider: OpenAIRealtimeSTTProvider) {}

  async transcribe(audio: Buffer, options?: STTOptions): Promise<string> {
    // Convert to legacy API
    const session = this.legacyProvider.createSession();
    await session.connect();
    // ... handle batch transcription via streaming session
  }

  createStream(options?: STTOptions): STTStream {
    // Wrap legacy session as new stream interface
    const legacySession = this.legacyProvider.createSession();
    return new StreamAdapter(legacySession);
  }
}
```

## Migration Path for Voice-Call Extension

### Phase 1: Prepare (No Breaking Changes)

1. Create `extensions/voice-call/src/plugins/` directory
2. Define plugin interfaces (`stt-provider.ts`, `tts-provider.ts`, `registry.ts`)
3. Create registry implementation (`plugin-registry.ts`)
4. Create configuration system (`plugin-config.ts`)
5. Add unit tests for new interfaces

### Phase 2: Integrate (Backwards Compatible)

1. Create adapters wrapping existing providers
2. Initialize registry with adapters on startup
3. Update call manager to use registry (with feature flag)
4. Add configuration file loading (`voice-providers.yaml`)
5. Deprecation warnings for hardcoded provider selection

### Phase 3: Modernize (Opt-in)

1. Update voice-call extension to use registry by default
2. Refactor existing providers to implement new interfaces directly
3. Remove adapters
4. Update docs with new provider selection mechanism

### Phase 4: Future Enhancements

1. Implement npm package discovery
2. Add provider-specific UI (settings panels per provider)
3. Support dynamic provider installation
4. Implement provider performance metrics
5. Add provider recommendations based on platform/usage

## Design Decisions Rationale

### Why Streaming is Optional

Not all STT/TTS services support streaming:
- **Whisper (OpenAI):** Batch API only (no streaming endpoint)
- **Kokoro:** Local synthesis; streaming requires buffering input text
- **Some TTS services:** No true streaming; chunk & concatenate instead

By making streaming optional, we allow a wider ecosystem of providers while still supporting high-performance streaming where available.

### Why Audio Format Normalization is Central

Different providers prefer different formats:
- OpenAI Realtime (STT): mu-law 8kHz
- OpenAI TTS: PCM 24kHz
- Telephony (Twilio): mu-law 8kHz

By centralizing format conversion, we ensure consistent behavior and reduce per-provider boilerplate.

### Why Provider Priority is Explicit

Implicit provider selection (hardcoded strings) makes systems fragile:
- Can't swap providers without code changes
- Can't handle provider failures gracefully
- Can't test with different providers

Explicit priority + fallback allows:
- Configuration-driven provider selection
- Automatic failover on errors
- Easy testing with mock providers

### Why Registry Uses Dependency Injection

The registry pattern (get provider by ID) decouples:
- Call manager from specific providers
- Tests from real API keys
- Configuration from code

This enables easy swapping for testing and multi-provider support.

## Testing Strategy

### Unit Tests

Test each provider interface independently:

```typescript
describe("STTProvider interface", () => {
  it("should implement batch transcription", async () => {
    const provider = createTestProvider();
    const result = await provider.transcribe(testAudio);
    expect(result).toBe("expected text");
  });

  it("should implement streaming", () => {
    const provider = createTestProvider();
    const stream = provider.createStream?.();
    expect(stream).toBeDefined();
  });
});
```

### Integration Tests

Test provider registry with multiple providers:

```typescript
describe("PluginRegistry", () => {
  it("should failover to fallback provider", async () => {
    registry.register("primary", failingProvider, 10);
    registry.register("fallback", workingProvider, 5);

    const result = await registry.transcribe(audio);
    expect(result).toBe("from fallback");
  });
});
```

### Configuration Tests

Test YAML/JSON loading and validation:

```typescript
describe("Configuration loading", () => {
  it("should load YAML config", async () => {
    const config = await loadConfig("voice-providers.yaml");
    expect(config.defaults.stt).toBe("openai-realtime");
  });
});
```

## Future Enhancements

1. **Provider metrics:** Track provider performance (latency, success rate, cost)
2. **Adaptive provider selection:** Automatically choose provider based on metrics
3. **Custom provider marketplace:** Allow community providers via npm
4. **Provider composition:** Chain providers (e.g., OpenAI → Whisper fallback)
5. **Cost tracking:** Monitor API spend per provider
6. **A/B testing:** Compare provider outputs for quality
7. **Real-time provider swapping:** Change providers without restarting
8. **Provider-specific UI:** Custom settings panels per provider
9. **Voice cloning:** Support TTS providers with voice cloning (e.g., ElevenLabs)
10. **Multi-language support:** Auto-detect language from config or audio

---

## Related Documentation

- [Voice Call Extension](/voice-call)
- [Audio Format Reference](/concepts/audio-formats)
- [Configuration Guide](/configuration)
- [Extending Clawdbot](/developers/plugins)
