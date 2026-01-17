# Voice Providers Architecture & Voice Channel Integration

## Overview

This document outlines the architecture for Clawdbot's pluggable voice provider system with support for Discord-style voice channels (N-party audio rooms).

## System Components

### 1. Provider Execution Layer

The execution layer handles actual STT/TTS operations with a unified interface.

```typescript
// src/media/voice-providers/executor.ts
export interface VoiceProviderExecutor {
  // STT operations
  transcribe(audio: AudioBuffer, config?: TranscribeOptions): Promise<TranscriptionResult>;
  transcribeStream(audioStream: ReadableStream, config?: TranscribeOptions): AsyncIterable<TranscriptionChunk>;

  // TTS operations
  synthesize(text: string, config?: SynthesisOptions): Promise<AudioBuffer>;
  synthesizeStream(textStream: ReadableStream, config?: SynthesisOptions): AsyncIterable<AudioBuffer>;

  // Provider lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getCapabilities(): ProviderCapabilities;
}

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration: number;
  provider: string;
}

export interface SynthesisOptions {
  voice?: string;
  speed?: number;
  language?: string;
  format?: AudioFormat;
}

export interface AudioBuffer {
  data: Uint8Array;
  format: AudioFormat;
  sampleRate: number;
  duration: number;
}

export enum AudioFormat {
  PCM_16 = 'pcm16',
  OPUS = 'opus',
  AAC = 'aac',
  MP3 = 'mp3',
  VORBIS = 'vorbis',
}
```

### 2. Provider Registry & Selection

Dynamic provider loading and selection based on configuration and fallback chains.

```typescript
// src/media/voice-providers/registry.ts
export class VoiceProviderRegistry {
  private providers: Map<string, VoiceProviderExecutor> = new Map();
  private config: VoiceProvidersConfig;

  async loadProviders(config: VoiceProvidersConfig): Promise<void> {
    // Load each configured provider
    for (const providerEntry of config.providers || []) {
      if (!providerEntry.enabled) continue;

      try {
        const executor = await this.createExecutor(providerEntry);
        await executor.initialize();
        this.providers.set(providerEntry.id, executor);
      } catch (error) {
        logger.warn(`Failed to load provider ${providerEntry.id}`, error);
      }
    }
  }

  async getTranscriber(providerId?: string): Promise<VoiceProviderExecutor> {
    // Use explicit provider or find first available STT provider
    const config = this.config;
    const providers = getProvidersInPriorityOrder(config);

    const sttProviders = providers.filter(p => p.stt);
    const provider = sttProviders[0];

    if (!provider?.id) {
      throw new Error('No STT provider available');
    }

    return this.providers.get(provider.id)
      || (await this.createAndInitialize(provider));
  }

  async getSynthesizer(providerId?: string): Promise<VoiceProviderExecutor> {
    // Similar to getTranscriber but for TTS
  }

  private async createExecutor(
    entry: VoiceProviderEntry,
  ): Promise<VoiceProviderExecutor> {
    if (entry.stt?.type === 'whisper') {
      return new WhisperExecutor(entry.stt);
    } else if (entry.stt?.type === 'faster-whisper') {
      return new FasterWhisperExecutor(entry.stt);
    } else if (entry.stt?.type === 'openai') {
      return new OpenAIExecutor(entry.stt);
    }
    // ... other providers

    if (entry.tts?.type === 'local') {
      if (entry.tts.model === 'kokoro') {
        return new KokoroExecutor(entry.tts);
      } else if (entry.tts.model === 'piper') {
        return new PiperExecutor(entry.tts);
      }
    } else if (entry.tts?.type === 'elevenlabs') {
      return new ElevenLabsExecutor(entry.tts);
    }
    // ... other providers
  }
}
```

### 3. Audio Normalization & Pipeline

Handle format conversion, resampling, and audio preprocessing.

```typescript
// src/media/audio-pipeline.ts
export class AudioPipeline {
  private targetFormat: AudioFormat = AudioFormat.PCM_16;
  private targetSampleRate: number = 16000;

  async normalize(
    input: AudioBuffer,
    targetFormat?: AudioFormat,
    targetSampleRate?: number,
  ): Promise<AudioBuffer> {
    let buffer = input;

    // Resample if needed
    if (buffer.sampleRate !== (targetSampleRate || this.targetSampleRate)) {
      buffer = await this.resample(
        buffer,
        targetSampleRate || this.targetSampleRate,
      );
    }

    // Convert format if needed
    if (buffer.format !== (targetFormat || this.targetFormat)) {
      buffer = await this.convertFormat(
        buffer,
        targetFormat || this.targetFormat,
      );
    }

    return buffer;
  }

  private async resample(
    buffer: AudioBuffer,
    targetRate: number,
  ): Promise<AudioBuffer> {
    // Use resampler library (e.g., libsamplerate, sox)
    // Implementation depends on performance requirements
  }

  private async convertFormat(
    buffer: AudioBuffer,
    targetFormat: AudioFormat,
  ): Promise<AudioBuffer> {
    // Use ffmpeg or native codec libraries
  }
}
```

### 4. Voice Channel System (N-Party Rooms)

Core voice channel implementation with audio mixing, routing, and session management.

```typescript
// src/media/voice-channels/channel.ts
export class VoiceChannel {
  id: string;
  name: string;
  participants: Map<string, VoiceParticipant> = new Map();
  private audioMixer: AudioMixer;
  private config: VoiceChannelConfig;

  constructor(id: string, config: VoiceChannelConfig) {
    this.id = id;
    this.name = config.name;
    this.config = config;
    this.audioMixer = new AudioMixer(config.mixerOptions);
  }

  async addParticipant(
    userId: string,
    options: ParticipantOptions,
  ): Promise<VoiceParticipant> {
    const participant = new VoiceParticipant(userId, options);
    await participant.connect(this);
    this.participants.set(userId, participant);

    // Broadcast join event
    this.broadcastEvent('participant-joined', { userId });

    return participant;
  }

  async removeParticipant(userId: string): Promise<void> {
    const participant = this.participants.get(userId);
    if (participant) {
      await participant.disconnect();
      this.participants.delete(userId);
      this.broadcastEvent('participant-left', { userId });
    }
  }

  async broadcastAudio(
    userId: string,
    audioChunk: AudioBuffer,
  ): Promise<void> {
    // Add participant's audio to mix
    this.audioMixer.addTrack(userId, audioChunk);

    // Generate mixed output for each participant
    const mixed = await this.audioMixer.mix();

    // Send to all other participants
    for (const [pId, participant] of this.participants) {
      if (pId !== userId) {
        await participant.receiveAudio(mixed);
      }
    }
  }

  private broadcastEvent(
    eventType: string,
    data: unknown,
  ): void {
    for (const participant of this.participants.values()) {
      participant.emit(eventType, data);
    }
  }
}

export class VoiceParticipant {
  id: string;
  channel?: VoiceChannel;
  private transcriber?: VoiceProviderExecutor;
  private synthesizer?: VoiceProviderExecutor;

  constructor(
    id: string,
    options: ParticipantOptions,
  ) {
    this.id = id;
    this.transcriber = options.transcriber;
    this.synthesizer = options.synthesizer;
  }

  async connect(channel: VoiceChannel): Promise<void> {
    this.channel = channel;
    // Setup audio streams
  }

  async disconnect(): Promise<void> {
    this.channel = undefined;
    // Cleanup audio streams
  }

  async receiveAudio(audio: AudioBuffer): Promise<void> {
    // Play audio to participant
    if (this.synthesizer) {
      // If we want to handle TTS in channel
    }
  }

  async sendAudio(audioStream: ReadableStream): Promise<void> {
    if (!this.channel) throw new Error('Not connected to channel');

    // Transcribe incoming audio
    if (this.transcriber) {
      for await (const chunk of this.transcriber.transcribeStream(audioStream)) {
        this.channel.broadcastEvent('text', {
          userId: this.id,
          text: chunk.text,
        });
      }
    }

    // Forward raw audio to channel for mixing
    // (implementation depends on streaming protocol)
  }
}

export interface VoiceChannelConfig {
  name: string;
  maxParticipants?: number;
  audioCodec?: AudioFormat;
  sampleRate?: number;
  mixerOptions?: AudioMixerOptions;
  recordingEnabled?: boolean;
}

export interface ParticipantOptions {
  userId: string;
  transcriber?: VoiceProviderExecutor;
  synthesizer?: VoiceProviderExecutor;
  audioSource?: 'microphone' | 'stream' | 'synthetic';
}
```

### 5. Audio Mixer (Most Complex Component)

Handles real-time mixing of multiple audio streams with selective routing.

```typescript
// src/media/audio-mixer.ts
export class AudioMixer {
  private tracks: Map<string, TrackBuffer> = new Map();
  private config: AudioMixerOptions;
  private sampleRate: number = 16000;

  constructor(config: AudioMixerOptions = {}) {
    this.config = {
      algorithm: config.algorithm || 'broadcast', // 'broadcast', 'selective', 'spatial'
      maxParticipants: config.maxParticipants || 16,
      dynamicNormalization: config.dynamicNormalization ?? true,
      ...config,
    };
  }

  addTrack(
    userId: string,
    audio: AudioBuffer,
  ): void {
    if (!this.tracks.has(userId)) {
      this.tracks.set(userId, {
        userId,
        buffers: [],
        volume: 1.0,
        enabled: true,
      });
    }

    const track = this.tracks.get(userId)!;
    track.buffers.push(audio);

    // Keep buffer limited to reduce latency
    while (track.buffers.length > 3) {
      track.buffers.shift();
    }
  }

  async mix(): Promise<AudioBuffer> {
    const samples = this.collectSamples();

    if (samples.length === 0) {
      return this.createSilence();
    }

    // Mix based on algorithm
    let mixed: Float32Array;
    if (this.config.algorithm === 'broadcast') {
      mixed = this.mixBroadcast(samples);
    } else if (this.config.algorithm === 'selective') {
      mixed = this.mixSelective(samples);
    } else if (this.config.algorithm === 'spatial') {
      mixed = this.mixSpatial(samples);
    } else {
      mixed = this.mixBroadcast(samples);
    }

    // Apply normalization
    if (this.config.dynamicNormalization) {
      mixed = this.normalizeDynamic(mixed);
    }

    return this.bufferToAudio(mixed);
  }

  private mixBroadcast(samples: Map<string, Float32Array>): Float32Array {
    // Simple average mix - all tracks equally weighted
    const result = new Float32Array(Math.max(...Array.from(samples.values()).map(s => s.length)));
    let count = 0;

    for (const audio of samples.values()) {
      for (let i = 0; i < audio.length; i++) {
        result[i] += audio[i];
      }
      count++;
    }

    // Prevent clipping
    for (let i = 0; i < result.length; i++) {
      result[i] /= count;
    }

    return result;
  }

  private mixSelective(samples: Map<string, Float32Array>): Float32Array {
    // Selective mix - prioritize louder participants
    // Implementation: use energy detection to select top N tracks
  }

  private mixSpatial(samples: Map<string, Float32Array>): Float32Array {
    // Spatial mix - simulate audio position for each participant
    // Implementation: apply HRTF filters or simpler panning
  }

  private normalizeDynamic(audio: Float32Array): Float32Array {
    // Normalize to prevent distortion from multiple sources
    const max = Math.max(...Array.from(audio).map(Math.abs));
    if (max > 1.0) {
      for (let i = 0; i < audio.length; i++) {
        audio[i] /= max;
      }
    }
    return audio;
  }
}
```

### 6. Error Handling & Failover

Graceful degradation and provider fallback chains.

```typescript
// src/media/voice-providers/failover.ts
export class VoiceProviderFailover {
  private primaryProvider?: VoiceProviderExecutor;
  private fallbackProviders: VoiceProviderExecutor[] = [];
  private config: VoiceProvidersConfig;

  async transcribeWithFailover(
    audio: AudioBuffer,
    maxRetries: number = 3,
  ): Promise<TranscriptionResult> {
    const providers = [
      this.primaryProvider,
      ...this.fallbackProviders,
    ].filter((p): p is VoiceProviderExecutor => p !== undefined);

    for (let attempt = 0; attempt < providers.length; attempt++) {
      try {
        const provider = providers[attempt];
        const result = await provider.transcribe(audio);
        return result;
      } catch (error) {
        logger.warn(
          `Transcription attempt ${attempt + 1} failed`,
          error,
        );

        if (attempt === providers.length - 1) {
          throw new Error('All transcription providers failed');
        }
        // Continue to next provider
      }
    }

    throw new Error('Transcription failed');
  }

  async synthesizeWithFailover(
    text: string,
    options?: SynthesisOptions,
  ): Promise<AudioBuffer> {
    const providers = [
      this.primaryProvider,
      ...this.fallbackProviders,
    ].filter((p): p is VoiceProviderExecutor => p !== undefined);

    for (const provider of providers) {
      try {
        return await provider.synthesize(text, options);
      } catch (error) {
        logger.warn('Synthesis attempt failed', error);
        // Continue to next provider
      }
    }

    throw new Error('All synthesis providers failed');
  }
}
```

## Integration Points

### 1. Clawdbot Gateway Integration

Connect voice providers to existing gateway for call management.

```typescript
// src/infra/gateway-voice.ts
export async function initializeVoiceProviders(
  gateway: GatewayClient,
  config: ClawdbotConfig,
): Promise<void> {
  const voiceConfig = config.voice?.providers;
  if (!voiceConfig?.enabled) {
    logger.info('Voice providers disabled');
    return;
  }

  const registry = new VoiceProviderRegistry();
  await registry.loadProviders(voiceConfig);

  // Attach to gateway
  gateway.voiceRegistry = registry;

  // Setup channel lifecycle hooks
  gateway.on('call-connected', async (call) => {
    const channel = await createVoiceChannelForCall(call, registry);
    call.voiceChannel = channel;
  });

  gateway.on('call-disconnected', async (call) => {
    await call.voiceChannel?.shutdown();
  });
}
```

### 2. CLI Voice Channel Commands

Expose voice channels through CLI for testing and management.

```bash
# Create a voice channel
clawdbot voice channel create my-room --max-participants 10

# List active channels
clawdbot voice channel list

# Add participant
clawdbot voice channel add my-room --user @someone

# Test STT/TTS
clawdbot voice test-stt --file audio.wav --provider faster-whisper
clawdbot voice test-tts --text "Hello world" --provider kokoro
```

### 3. Dashboard Integration

Voice channel management UI showing:
- Active channels and participants
- Audio levels / quality metrics
- Provider health and latency
- Recording status

## Performance Considerations

### Latency Budget

- Audio capture: 20ms
- STT processing: 100-300ms (depending on provider)
- Mixing: 10ms
- TTS processing: 100-500ms (depending on provider)
- Network round-trip: 50-100ms
- **Total: 290-930ms** (acceptable for voice chat)

### Memory Usage

- Audio buffers: ~100KB per second per participant (PCM 16-bit, 16kHz, mono)
- Mixer state: ~500KB per 16 participants
- Provider models: 500MB-4GB depending on model (local providers)

### Scalability

- **Broadcast mix**: N participants → 1 mixed stream (scalable to 16+ participants)
- **Selective mix**: Top 4-6 speakers + ambient (optimized for Discord-like experience)
- **Spatial mix**: Limited to 6-8 participants (more complex processing)

## Phase 1: MVP Implementation

1. **Week 1-2**: Execution layer with Whisper/Faster-Whisper and Kokoro
2. **Week 3**: Basic voice channel with broadcast mixing
3. **Week 4**: Failover and error handling
4. **Week 5**: CLI commands and testing
5. **Week 6**: Dashboard integration and performance optimization

## Phase 2: Advanced Features

1. Selective and spatial mixing algorithms
2. Voice activity detection (VAD) for efficient mixing
3. Echo cancellation and noise suppression
4. Spatial audio with HRTF
5. Cloud provider integration (OpenAI Realtime STT)
6. Recording and transcription storage

## References

- Audio format specs: RFC 3551 (RTP Payload Formats for Audio)
- Mixing algorithms: Discord Engineering Blog (audio quality & latency)
- Real-time streaming: WebRTC Audio Processing Module
- Voice detection: WebRTC VAD
