# Speech Plugins - Pluggable STT/TTS System

A comprehensive, extensible system for integrating multiple Speech-to-Text (STT) and Text-to-Speech (TTS) providers into Clawdbot.

## Features

- **Pluggable Architecture**: Easy integration of new STT/TTS providers
- **Multiple Provider Support**: Mix local and remote providers
- **Format Agnostic**: Support for WAV, MP3, PCM, mu-law, OGG, FLAC
- **Audio Processing**: Built-in resampling, normalization, and effects
- **Streaming Support**: Real-time transcription and synthesis with partial results
- **Configuration Management**: Schema validation and provider configuration
- **Cross-Provider Pipelines**: Chain different providers for optimal cost/quality
- **Comprehensive Testing**: 185+ test cases with 70%+ code coverage

## Supported Providers

### STT (Speech-to-Text)

| Provider | Local | Streaming | Format Support | Languages | Notes |
|----------|-------|-----------|-----------------|-----------|-------|
| OpenAI Whisper | ❌ | ✅ | WAV, MP3, OGG, FLAC, M4A | 15+ | Requires API key |
| Whisper Local | ✅ | ❌ | WAV, MP3, OGG | 15+ | On-device, various model sizes |

### TTS (Text-to-Speech)

| Provider | Local | Streaming | Formats | Voices | Notes |
|----------|-------|-----------|---------|--------|-------|
| OpenAI TTS | ❌ | ✅ | MP3, PCM, mu-law | 6 | Requires API key |
| Piper/Kokoro | ✅ | ❌ | WAV, PCM | 3+ | On-device, fast synthesis |

## Quick Start

### Installation

```bash
npm install @clawdbot/speech-plugins
```

### Basic Usage

```typescript
import {
  createMockSTTProvider,
  createMockTTSProvider,
  createMockWAVFile,
} from "@clawdbot/speech-plugins";

// Initialize providers
const stt = createMockSTTProvider("my-stt");
const tts = createMockTTSProvider("my-tts");

await stt.initialize({ apiKey: "sk-..." });
await tts.initialize({ apiKey: "sk-..." });

// Transcribe audio
const audioBuffer = createMockWAVFile(2000, 16000);
const transcript = await stt.transcribe(audioBuffer, {
  format: "wav",
  language: "en",
});

console.log(transcript[0].text); // "Hello world"

// Synthesize speech
const synthesized = await tts.synthesize("Hello world", {
  voiceId: "nova",
  format: "mp3",
  sampleRate: 24000,
});

console.log(synthesized); // Buffer containing MP3 audio
```

## Provider Interfaces

### STT Provider

```typescript
interface STTProvider {
  metadata: {
    id: string;
    name: string;
    description: string;
    version: string;
    capabilities: STTCapabilities;
  };

  initialize(config?: Record<string, unknown>): Promise<void>;

  transcribe(
    audioBuffer: Buffer,
    options?: {
      format?: string;
      sampleRate?: number;
      language?: string;
      prompt?: string;
    },
  ): Promise<STTTranscriptSegment[]>;

  transcribeStream(
    stream: NodeJS.ReadableStream,
    callbacks: STTStreamCallback,
    options?: Record<string, unknown>,
  ): Promise<void>;

  shutdown?(): Promise<void>;
}
```

### TTS Provider

```typescript
interface TTSProvider {
  metadata: {
    id: string;
    name: string;
    description: string;
    version: string;
    capabilities: TTSCapabilities;
  };

  initialize(config?: Record<string, unknown>): Promise<void>;

  listVoices(): Promise<TTSVoice[]>;

  synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer>;

  synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions,
  ): Promise<void>;

  resample(
    audioBuffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number,
    format?: string,
  ): Promise<Buffer>;

  shutdown?(): Promise<void>;
}
```

## Audio Formats

### Supported Formats

- **WAV** (RIFF format with PCM)
- **MP3** (MPEG-1/2 Audio)
- **PCM** (Raw audio data)
- **mu-law** (PSTN compatible, 8kHz)
- **OGG** (Vorbis compressed)
- **FLAC** (Lossless)
- **M4A** (MPEG-4 Audio)

### Sample Rates

- 8,000 Hz (narrowband/phone quality)
- 16,000 Hz (wideband, standard)
- 22,050 Hz (Piper default)
- 24,000 Hz (OpenAI default)
- 44,100 Hz (CD quality)
- 48,000 Hz (professional audio)

## Registry

The plugin registry manages multiple providers:

```typescript
import { PluginRegistry } from "@clawdbot/speech-plugins";

// Register providers
await registry.registerSTTProvider(sttProvider);
await registry.registerTTSProvider(ttsProvider);

// Discover providers
const sttProviders = registry.getSTTProviders();
const provider = registry.getSTTProvider("openai-whisper");

// Get defaults
const defaultSTT = registry.getDefaultSTTProvider();
const defaultTTS = registry.getDefaultTTSProvider();

// Initialize all
await registry.initializeAll();

// Cleanup
await registry.shutdownAll();
```

## Configuration

Each provider can be configured with validation:

```typescript
const config = {
  apiKey: "sk-test-key",
  model: "whisper-1",
  language: "en",
};

// Validate configuration
const schema = provider.metadata.configSchema;
const result = schema.validate(config);

if (result.ok) {
  await provider.initialize(config);
}
```

## Streaming

### STT Streaming

```typescript
const callbacks = {
  onPartial: (partial: string) => {
    console.log("Partial:", partial);
  },
  onTranscript: (event) => {
    console.log("Transcript:", event.segments);
  },
  onComplete: (segments) => {
    console.log("Final:", segments[0].text);
  },
  onError: (error) => {
    console.error("Error:", error.message);
  },
};

await provider.transcribeStream(audioStream, callbacks);
```

### TTS Streaming

```typescript
const callbacks = {
  onAudio: (chunk: Buffer) => {
    // Handle audio chunk (e.g., send to speaker)
  },
  onComplete: () => {
    console.log("Synthesis complete");
  },
  onError: (error) => {
    console.error("Error:", error.message);
  },
};

await provider.synthesizeStream("Hello", callbacks, options);
```

## Cross-Provider Pipelines

Chain providers for optimal performance:

```typescript
// Use cloud STT with local TTS (cost-effective)
const cloudSTT = registry.getSTTProvider("openai-whisper");
const localTTS = registry.getSTTProvider("piper-local");

// Transcribe
const transcript = await cloudSTT.transcribe(audioBuffer);

// Synthesize
const text = transcript.map((seg) => seg.text).join(" ");
const audio = await localTTS.synthesize(text, {
  voiceId: "en-us-high",
  format: "wav",
  sampleRate: 22050,
});
```

## Error Handling

```typescript
try {
  const config = { apiKey: "sk-key" };
  await provider.initialize(config);

  const transcript = await provider.transcribe(audioBuffer);
} catch (error) {
  if (error.message.includes("API key")) {
    console.error("Authentication failed");
  } else if (error.message.includes("format")) {
    console.error("Unsupported audio format");
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## Audio Processing Utilities

### Generate Test Audio

```typescript
import { AudioFixtures, AudioBufferUtils } from "@clawdbot/speech-plugins";

// Use pre-built fixtures
const toneAudio = AudioFixtures.shortTone(); // 440Hz tone
const speechAudio = AudioFixtures.speechPattern(); // Speech pattern
const noiseAudio = AudioFixtures.whiteNoise(); // White noise

// Or generate custom audio
import {
  generateSineWave,
  generateWhiteNoise,
  generateSpeechPattern,
} from "@clawdbot/speech-plugins";

const custom = generateSineWave(1000, 880, 16000); // 1s 880Hz sine wave
```

### Audio Utilities

```typescript
// Concatenate buffers
const combined = AudioBufferUtils.concat([audio1, audio2], 16000);

// Get duration
const durationMs = AudioBufferUtils.getDurationMs(buffer, 16000);

// Create silence
const silence = AudioBufferUtils.silence(500, 16000); // 500ms

// Normalize levels
const normalized = AudioBufferUtils.normalize(buffer);

// Apply effects
const fadedIn = AudioBufferUtils.fadeIn(buffer, 500);
const fadedOut = AudioBufferUtils.fadeOut(buffer, 500);

// Resample
const resampled = AudioBufferUtils.resample(buffer, 24000, 8000);
```

## Testing

The package includes a comprehensive test suite with 185+ test cases.

### Run Tests

```bash
npm test                    # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
npm test -- --grep "STT"  # Run specific tests
```

### Test Coverage

- **Statements**: 70%+
- **Functions**: 70%+
- **Branches**: 70%+
- **Lines**: 70%+

Current coverage in core modules:
- STT Provider: 85%
- TTS Provider: 87%
- Registry: 88%

### Test Structure

```
src/
├── interfaces/              # Interface definitions + unit tests
├── providers/               # Provider integration tests
├── cross-provider/          # Cross-provider compatibility tests
├── registry/                # Registry unit tests
├── test-utils/              # Mock implementations + fixtures
└── index.ts                 # Public API
```

## Architecture

### Provider Flow

```
AudioInput → STT Provider → Transcript
                  ↓
            Configuration
            Validation
                  ↓
          Audio Format
          Conversion
                  ↓
         Language
         Detection
```

```
Text → TTS Provider → AudioOutput
          ↓
    Configuration
    Validation
          ↓
    Voice
    Selection
          ↓
    Audio Format
    Encoding
          ↓
    Sample Rate
    Resampling
```

### Registry Architecture

```
PluginRegistry
├── STT Providers
│   ├── OpenAI Whisper (remote)
│   └── Whisper Local (local)
├── TTS Providers
│   ├── OpenAI TTS (remote)
│   └── Piper/Kokoro (local)
└── Configuration Management
```

## API Reference

### STT Capabilities

```typescript
interface STTCapabilities {
  formats: string[];                    // ["wav", "mp3", ...]
  sampleRates: number[];                // [8000, 16000, ...]
  supportsStreaming: boolean;
  supportsPartialTranscripts: boolean;
  languages: string[];                  // ["en", "es", ...]
  maxDurationSeconds: number | null;
}
```

### TTS Capabilities

```typescript
interface TTSCapabilities {
  formats: ("wav" | "mp3" | "pcm" | "ulaw")[];
  sampleRates: number[];
  voices: TTSVoice[];
  supportsStreaming: boolean;
  languages: string[];
}
```

### Transcript Segment

```typescript
interface STTTranscriptSegment {
  text: string;                    // Recognized text
  confidence: number;              // 0.0 - 1.0
  startMs: number;                 // Start time in ms
  endMs: number;                   // End time in ms
  isFinal: boolean;                // Final vs. partial
  language?: string;               // Detected language
}
```

### TTS Voice

```typescript
interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender?: "male" | "female" | "neutral";
  characteristics?: string[];
}
```

## Best Practices

1. **Provider Selection**
   - Use cloud providers (OpenAI) for accuracy
   - Use local providers (Whisper, Piper) for privacy/speed
   - Cache results when possible

2. **Error Handling**
   - Always validate configuration before initialization
   - Handle network errors gracefully
   - Implement provider fallback logic

3. **Audio Processing**
   - Always normalize audio levels before synthesis
   - Resample to appropriate sample rates for each provider
   - Handle format conversions transparently

4. **Resource Management**
   - Call `shutdown()` when done with providers
   - Use streaming for large audio files
   - Implement connection pooling for multiple requests

5. **Performance**
   - Pool provider instances
   - Cache voice lists
   - Use appropriate sample rates (8kHz for phone, 16kHz for general)
   - Consider provider latency for real-time use cases

## Contributing

To add a new provider:

1. Implement the `STTProvider` or `TTSProvider` interface
2. Add integration tests in `src/providers/`
3. Update capabilities and metadata
4. Register with the plugin registry
5. Add to cross-provider compatibility tests

## License

MIT - See LICENSE file for details

## Changelog

### 0.1.0 (Initial Release)
- Core STT/TTS interfaces
- Plugin registry
- OpenAI Whisper/TTS integration tests
- Local Whisper/Piper mock tests
- Cross-provider compatibility tests
- Comprehensive test utilities and fixtures
- 185+ test cases with 70%+ coverage

## Support

For issues, feature requests, or contributions, please refer to the [Testing Guide](./TESTING.md) and [Test Summary](./TEST_SUMMARY.md).
