# Voice Plugin System - Quick Reference Card

One-page summary of the pluggable STT/TTS plugin architecture.

## Architecture at a Glance

```
┌─────────────────────────────────────────┐
│       Voice Call Extension (Twilio)     │
└──────────────┬──────────────────────────┘
               │
        ┌──────┴──────┬──────────────┐
        │             │              │
        v             v              v
   STTRegistry   TTSRegistry   AudioNormalizer
        │             │              │
   ┌────┴──────┐  ┌────┴──────┐    │
   │ Provider  │  │ Provider  │    │
   │ Selection │  │ Selection │    │
   │ Fallback  │  │ Fallback  │    │
   └───────────┘  └───────────┘    │
        │             │              │
   ┌────┴──────────────┴──────────────┤
   │  Configuration (.yaml/.json)    │
   └─────────────────────────────────┘
```

## Core Interfaces

### STTProvider
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

### TTSProvider
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

## Registry Usage

```typescript
import { STTRegistry, TTSRegistry } from './plugins';

// Create registries
const stt = new STTRegistry();
const tts = new TTSRegistry();

// Register providers
stt.register('openai', provider1, 10);  // priority 10
stt.register('whisper', provider2, 5);  // priority 5

// Get provider
const primary = stt.getPrimary();        // Highest priority
const fallback = stt.getFallback();      // Second highest
const specific = stt.get('whisper');     // By ID

// Health check & failover
await stt.healthCheck();                 // Check all
stt.setActive('whisper');                // Switch provider
```

## Configuration Format

```yaml
# ~/.clawdbot/voice-providers.yaml

defaults:
  stt: openai-realtime      # Provider ID
  tts: openai-tts

stt:
  providers:
    openai-realtime:
      enabled: true
      priority: 10          # Higher = preferred
      config:
        apiKey: ${OPENAI_API_KEY}
        model: gpt-4o-transcribe

    whisper-local:
      enabled: true
      priority: 5
      config:
        modelSize: base
        device: cpu

  fallback:
    strategy: failover      # priority, round-robin, failover
    maxRetries: 2
    retryDelay: 1000

tts:
  providers:
    openai-tts:
      enabled: true
      priority: 10
      config:
        apiKey: ${OPENAI_API_KEY}
        voice: coral
```

## Supported Providers

### Speech-to-Text
| Provider | Type | Streaming | Batch | Notes |
|----------|------|-----------|-------|-------|
| OpenAI Realtime | Cloud | ✓ | ✗ | Real-time, VAD |
| Whisper | Cloud/Local | ✗ | ✓ | Accurate, offline |
| Coqui | Local | ✗ | ✓ | Open-source |

### Text-to-Speech
| Provider | Type | Streaming | Batch | Notes |
|----------|------|-----------|-------|-------|
| OpenAI | Cloud | ✗ | ✓ | 13 voices |
| ElevenLabs | Cloud | ✓ | ✓ | Voice cloning |
| Kokoro | Local | ✗ | ✓ | Fast, offline |

## Provider Discovery

```typescript
// Auto-discover providers
await stt.discover({
  npm: true,              // Search @clawdbot/stt-*
  pluginDir: '/path',     // Or local directory
  autoRegister: true      // Auto-register found
});
```

## Audio Format Support

### Common Formats
- **PCM** - Raw 16-bit signed LE (preferred for providers)
- **WAV** - Wav container with PCM
- **MP3** - Compressed audio
- **mu-law** - 8-bit telephony format (Twilio requirement)

### Normalization
```typescript
const normalizer = new AudioNormalizer();

// Convert PCM 24kHz to mu-law 8kHz
const mulaw = normalizer.convert(
  pcm24k,
  { name: 'pcm', sampleRate: 24000, bitDepth: 16, channels: 1 },
  { name: 'mu-law', sampleRate: 8000, bitDepth: 8, channels: 1 }
);

// Resample
const pcm16k = normalizer.resample(pcm48k, 48000, 16000, 'cubic');

// Chunk audio (20ms frames)
const frames = normalizer.chunk(audio, 20, 8000);
```

## Implementing a Provider

```typescript
import type { STTProvider, STTOptions } from './stt-provider';

export class CustomSTTProvider implements STTProvider {
  readonly name = 'custom-stt';
  readonly capabilities = {
    batch: true,
    streaming: false,
    requiresInternet: true,
  };
  readonly supportedFormats = [
    { name: 'pcm', sampleRates: [16000], bitDepth: 16, channels: 1 }
  ];

  async transcribe(audio: Buffer, options?: STTOptions): Promise<string> {
    // Implement transcription
    return 'transcribed text';
  }

  async healthCheck(): Promise<boolean> {
    // Check provider availability
    return true;
  }

  async shutdown(): Promise<void> {
    // Cleanup resources
  }
}

// Export as npm package
export const metadata = {
  id: 'custom-stt',
  name: 'Custom STT',
  type: 'stt',
  version: '1.0.0',
};
```

## Error Handling

```typescript
try {
  const transcript = await provider.transcribe(audio);
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes('timeout')) {
      // Retry or fallback
    } else if (error.message.includes('API')) {
      // API error - use fallback
    }
  }
}
```

## Health Checks & Failover

```typescript
// Periodic health checks
setInterval(async () => {
  const results = await registry.healthCheck();
  
  for (const [providerId, isHealthy] of results) {
    if (!isHealthy && providerId === registry.getActive()?.name) {
      // Switch to fallback
      const fallback = registry.getFallback();
      if (fallback) {
        registry.setActive(fallback.name);
      }
    }
  }
}, 30000); // Every 30s
```

## Configuration Examples

### Example 1: Cloud-Only (Recommended for Simplicity)
```yaml
defaults:
  stt: openai-realtime
  tts: openai-tts
```

### Example 2: Offline-First (Privacy)
```yaml
defaults:
  stt: whisper-local
  tts: kokoro-local
```

### Example 3: Resilient (Cloud + Fallback)
```yaml
defaults:
  stt: openai-realtime
  tts: openai-tts

stt:
  fallback:
    strategy: failover
    failoverProviders:
      - whisper-local

tts:
  fallback:
    strategy: failover
    failoverProviders:
      - kokoro-local
```

## File Structure

```
extensions/voice-call/src/plugins/
├── index.ts                    # Main exports
├── stt-provider.ts            # STT interface
├── tts-provider.ts            # TTS interface
├── plugin-registry.ts         # Registry
├── plugin-config.ts           # Config loading
├── audio-normalizer.ts        # Format conversion
├── legacy-adapters.ts         # Backwards compat
└── __tests__/
    └── *.test.ts              # Tests
```

## Implementation Phases

| Phase | Duration | Component | LOC |
|-------|----------|-----------|-----|
| 1 | Week 1 | Interfaces & types | 200 |
| 2 | Week 1-2 | Registry | 300 |
| 3 | Week 2 | Config system | 200 |
| 4 | Week 2-3 | Audio normalizer | 250 |
| 5 | Week 3 | Adapters | 150 |
| 6 | Week 3-4 | Integration | 150 |
| 7 | Week 4 | Discovery | 200 |
| 8 | Week 4-5 | Migration | 100 |
| 9+ | Week 5+ | Testing & rollout | - |
| **Total** | **~14w** | **All** | **~1600** |

## Key Design Decisions

| Decision | Why |
|----------|-----|
| Streaming optional | Not all providers support it (Whisper is batch) |
| Batch required | Ensures basic compatibility |
| Config-driven | Swap providers without code changes |
| Priority registry | Automatic failover on errors |
| Centralized audio | Reduce per-provider boilerplate |
| Backwards compatible | Adapters wrap existing providers |

## Success Criteria

- [ ] All interfaces typed & documented
- [ ] Registry supports priority & fallback
- [ ] Configuration system working
- [ ] Audio format conversion correct
- [ ] Providers wrapped with adapters
- [ ] Discovery from npm working
- [ ] > 80% test coverage
- [ ] Zero breaking changes

## Documentation Links

- **Main Design:** [voice-plugins.md](./voice-plugins.md)
- **Implementation Guide:** [voice-plugins-implementation.md](./voice-plugins-implementation.md)
- **API Reference:** [voice-plugins-api-reference.md](./voice-plugins-api-reference.md)
- **Index & Navigation:** [VOICE_PLUGIN_DESIGN.md](./VOICE_PLUGIN_DESIGN.md)

## Quick Links

- **Configuration examples:** [voice-plugins.md#example-configurations](./voice-plugins.md#example-configurations)
- **Provider discovery:** [voice-plugins.md#plugin-discovery-mechanism](./voice-plugins.md#plugin-discovery-mechanism)
- **Fallback strategy:** [voice-plugins.md#provider-priority--fallback-mechanism](./voice-plugins.md#provider-priority--fallback-mechanism)
- **Audio normalization:** [voice-plugins.md#audio-format-normalization](./voice-plugins.md#audio-format-normalization)
- **Implementation steps:** [voice-plugins-implementation.md#implementation-checklist](./voice-plugins-implementation.md#implementation-checklist)

---

**Print this page for quick reference while implementing!**
