# Speech Plugins Test Suite

Comprehensive testing guide for the pluggable STT/TTS system.

## Overview

The test suite covers:

- **Unit Tests**: Provider interfaces, capabilities, and configuration validation
- **Integration Tests**: Provider implementations (OpenAI, local providers)
- **Cross-Provider Tests**: Audio pipeline compatibility and provider switching
- **Test Utilities**: Mock implementations, audio fixtures, and test helpers

## Test Structure

```
src/
├── interfaces/
│   ├── stt-provider.ts           # STT interface definition
│   ├── stt-provider.test.ts      # STT interface unit tests
│   ├── tts-provider.ts           # TTS interface definition
│   ├── tts-provider.test.ts      # TTS interface unit tests
│   ├── plugin-registry.ts        # Registry interface
│   └── plugin-registry.test.ts   # Registry unit tests
├── providers/
│   ├── openai-stt.test.ts        # OpenAI Whisper integration tests
│   ├── openai-tts.test.ts        # OpenAI TTS integration tests
│   └── local-providers.test.ts   # Whisper/Piper mock tests
├── cross-provider/
│   └── compatibility.test.ts     # Cross-provider pipeline tests
└── test-utils/
    ├── mocks.ts                   # Mock provider implementations
    └── audio-fixtures.ts          # Audio generation utilities
```

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm run test:watch
```

### Coverage Report
```bash
npm run test:coverage
```

### Specific Test File
```bash
npm test -- stt-provider.test.ts
```

### Specific Test Suite
```bash
npm test -- --grep "Provider Configuration"
```

## Test Coverage Targets

- **Statements**: 70%+
- **Branches**: 70%+
- **Functions**: 70%+
- **Lines**: 70%+

Current implementation aims for >85% coverage in core interfaces.

## Unit Tests

### STT Provider Interface Tests (`stt-provider.test.ts`)

Tests the STT provider contract:

```typescript
describe("STT Provider Interface", () => {
  // Provider Metadata
  // - Required metadata properties
  // - Capabilities definition
  // - Configuration schema validation

  // Provider Initialization
  // - Initialize with/without configuration
  // - Configuration validation

  // Transcription Methods
  // - Basic transcription
  // - Optional transcription options
  // - Required segment properties

  // Stream Transcription
  // - Partial transcripts callback
  // - Transcript events
  // - Completion callback

  // Provider Lifecycle
  // - Shutdown support
  // - Optional shutdown methods

  // Edge Cases
  // - Empty transcript results
  // - Confidence boundaries (0-1)
  // - Long transcript durations
  // - Multiple language support

  // Contract Validation
  // - All required methods present
  // - Read-only metadata
  // - Optional parameters
});
```

**Key Test Cases**: 25+

### TTS Provider Interface Tests (`tts-provider.test.ts`)

Tests the TTS provider contract:

```typescript
describe("TTS Provider Interface", () => {
  // Provider Metadata
  // - Required metadata properties
  // - Available voices listing
  // - Voice properties (id, name, language)

  // Provider Initialization
  // - Initialize with/without configuration
  // - Configuration validation

  // Voice Management
  // - List available voices
  // - Consistency between capabilities and listed voices
  // - Required/optional voice properties

  // Synthesis Methods
  // - Basic text synthesis
  // - Synthesis options (speechRate, pitch, volumeDb)
  // - Multiple audio formats
  // - Empty/long text handling

  // Stream Synthesis
  // - Audio chunk callback
  // - Complete event
  // - Error callback

  // Audio Resampling
  // - Basic resampling between rates
  // - Common rate pairs (44100→16000, 24000→8000, etc.)

  // Provider Lifecycle
  // - Shutdown support
  // - Optional shutdown methods

  // Edge Cases
  // - Empty text synthesis
  // - Extreme audio parameters
  // - Format support consistency
  // - Minimum voice requirement
});
```

**Key Test Cases**: 28+

### Plugin Registry Tests (`plugin-registry.test.ts`)

Tests the provider registry:

```typescript
describe("Plugin Registry", () => {
  // Provider Registration
  // - Register STT/TTS providers
  // - Register multiple providers
  // - Mix STT and TTS providers

  // Provider Discovery
  // - Get provider by ID
  // - Return undefined for unknown provider
  // - Get default providers
  // - Default provider selection

  // Provider Unregistration
  // - Unregister providers
  // - Handle other providers when unregistering one
  // - Not affect other provider types

  // Configuration Management
  // - Retrieve configuration
  // - Track provider type
  // - Track enabled status

  // Provider Initialization
  // - Initialize all providers
  // - Handle initialization errors
  // - Handle empty registry

  // Provider Shutdown
  // - Shutdown all providers
  // - Handle optional shutdown
  // - Handle shutdown errors

  // Edge Cases
  // - Duplicate provider IDs
  // - Concurrent registration
  // - Multiple providers per type
});
```

**Key Test Cases**: 24+

## Integration Tests

### OpenAI STT Provider Tests (`openai-stt.test.ts`)

Tests OpenAI Whisper API integration:

- **Configuration**: API key validation, model selection
- **Multi-format Support**: WAV, MP3, OGG, FLAC, M4A
- **Language Support**: 15+ languages with detection
- **Streaming**: Partial transcripts, WebSocket events
- **Reconnection**: Error handling, fallback logic
- **Capabilities**: Streaming, partial transcripts, 10-minute duration limit

**Key Features Tested**:
- Transcription accuracy (confidence scoring)
- Language detection and specification
- Context prompts for better transcription
- Streaming with partial results
- Error recovery and reconnection

### OpenAI TTS Provider Tests (`openai-tts.test.ts`)

Tests OpenAI Text-to-Speech API integration:

- **Configuration**: API key, model selection
- **Voice Management**: 6 available voices
- **Audio Formats**: MP3, PCM, mu-law encoding
- **Synthesis Options**: Speech rate, pitch, volume control
- **Resampling**: 24kHz → 8kHz (phone quality), other rates
- **Streaming Support**: Audio chunks, completion events

**Key Features Tested**:
- Voice selection consistency
- Audio format output validation
- Resampling (24000→8000 for phone compatibility)
- Mu-law encoding for PSTN compatibility
- Streaming with audio chunks

### Local Providers Tests (`local-providers.test.ts`)

Tests local Whisper and Piper/Kokoro implementations:

**Whisper Local (STT)**:
- Model size options (tiny, base, small, medium, large)
- Device selection (CPU, CUDA, MPS)
- GPU acceleration
- No streaming (synchronous only)
- Unlimited duration support
- Comprehensive language coverage

**Piper/Kokoro Local (TTS)**:
- 3+ voice options with genders
- WAV and PCM output
- No streaming support
- Configurable speech rate
- Voice resampling to different rates

## Cross-Provider Tests

### Compatibility Tests (`compatibility.test.ts`)

Tests mixing providers from different sources:

```typescript
describe("Cross-Provider Audio Processing Pipeline", () => {
  // STT to TTS Pipeline
  // - OpenAI STT → OpenAI TTS
  // - OpenAI STT → Local TTS
  // - Local STT → OpenAI TTS
  // - Local STT → Local TTS

  // Audio Format Consistency
  // - Format conversion between providers
  // - Resampling between different rates
  // - Audio level normalization
  // - Frame rate compatibility

  // Provider Switching
  // - Switch STT providers mid-pipeline
  // - Switch TTS providers mid-pipeline
  // - Fallback scenarios (primary → secondary provider)

  // Error Propagation
  // - STT errors to TTS
  // - TTS errors in pipeline
  // - Resampling errors

  // Configuration Compatibility
  // - Language configuration (en, es, fr, etc.)
  // - Format negotiation (common formats between providers)

  // Performance and Caching
  // - Caching transcription results
  // - Caching synthesis results

  // Concurrent Operations
  // - Concurrent transcriptions
  // - Concurrent syntheses
});
```

**Key Test Cases**: 22+

## Test Utilities

### Mock Implementations (`test-utils/mocks.ts`)

Provides ready-to-use mock providers:

```typescript
// Create mock STT provider
const stt = createMockSTTProvider("stt-1");
await stt.initialize();
const transcript = await stt.transcribe(audioBuffer);

// Create mock TTS provider
const tts = createMockTTSProvider("tts-1");
await tts.initialize();
const audio = await tts.synthesize("Hello", {
  voiceId: "voice-1",
  format: "wav",
  sampleRate: 16000,
});

// Create mock audio buffers
const wav = createMockWAVFile(2000, 16000); // 2 seconds at 16kHz
const pcm = createMockAudioBuffer(1000, 8000); // 1 second PCM

// Create error providers for testing error handling
const errorSTT = createErrorSTTProvider("error-stt", "Initialization failed");
const errorTTS = createErrorTTSProvider("error-tts", "Synthesis failed");
```

### Audio Fixtures (`test-utils/audio-fixtures.ts`)

Generates test audio without external files:

```typescript
// Generate waveforms
const sineWave = generateSineWave(1000, 440, 16000); // 1s 440Hz tone
const whiteNoise = generateWhiteNoise(500, 16000); // 500ms white noise
const speech = generateSpeechPattern(2000, 16000); // 2s speech pattern
const chirp = AudioFixtures.chirp(); // Frequency sweep

// Create complete WAV files
const wav = createWAVBuffer(audioData, 16000, 1, 16);

// Audio utilities
const duration = AudioBufferUtils.getDurationMs(buffer, 16000);
const silence = AudioBufferUtils.silence(500, 16000); // 500ms silence
const normalized = AudioBufferUtils.normalize(buffer); // Normalize levels
const resampled = AudioBufferUtils.resample(buffer, 24000, 8000);
const faded = AudioBufferUtils.fadeIn(buffer, 500); // 500ms fade in
```

## Test Data

### Audio Fixtures Available

- **Silence**: Short (100ms), medium (500ms), long (as needed)
- **Tones**: Single frequency, multiple frequencies, chirps
- **Noise**: White noise patterns
- **Speech**: Simulated speech characteristics with formants
- **Mixed**: Silence with clicks, fades, normalization

### Sample Rates Tested

- 8000 Hz (phone quality, mu-law)
- 16000 Hz (wideband, default)
- 22050 Hz (Piper default)
- 24000 Hz (OpenAI default)
- 44100 Hz (CD quality)
- 48000 Hz (professional audio)

### Audio Formats Tested

- WAV (RIFF format with PCM)
- MP3 (compressed audio)
- PCM (raw audio data)
- mu-law (PSTN compatible)
- OGG (Vorbis compressed)

## Mocking Strategies

### External API Mocking

All external API calls are mocked using `vi.fn()`:

```typescript
const provider = createMockSTTProvider("openai-stt");

// Mock returns configured results
const transcript = await provider.transcribe(buffer);
expect(provider.transcribe).toHaveBeenCalled();

// Mock can be configured per test
provider.transcribe.mockResolvedValueOnce([
  { text: "Custom result", confidence: 0.99, ... }
]);
```

### Stream Mocking

Streaming is tested with mock callbacks:

```typescript
const onPartial = vi.fn();
const onComplete = vi.fn();
const onError = vi.fn();

await provider.transcribeStream(mockStream, {
  onPartial,
  onComplete,
  onError,
});

expect(onPartial).toHaveBeenCalled();
expect(onComplete).toHaveBeenCalled();
```

## Performance Benchmarks

Tests include performance validation:

- Provider initialization time (10-100ms for mocks)
- Transcription latency (should complete quickly for test data)
- Synthesis latency (audio generation)
- Memory efficiency (buffer sizes reasonable)

## Error Scenarios Tested

### Provider Errors
- Missing API keys
- Invalid configuration
- Model loading failures
- Network timeouts
- Malformed audio data

### Audio Errors
- Unsupported formats
- Invalid sample rates
- Resampling failures
- Buffer overflows
- Encoding errors

### Configuration Errors
- Missing required options
- Invalid language codes
- Unsupported voices
- Out-of-range parameters (pitch, rate, volume)

## Continuous Integration

Tests are designed for CI/CD:

- No external dependencies (all mocked)
- No API keys required (uses mock credentials)
- Fast execution (<5 seconds for full suite)
- Deterministic results
- Portable (runs on Linux, macOS, Windows)

## Adding New Tests

### For New Provider Type

1. Create test file in `providers/` directory
2. Use mock provider creation utilities
3. Test against interface contracts
4. Add to cross-provider compatibility tests

### For New Provider Implementation

1. Implement the STT/TTS provider interface
2. Ensure all required methods are present
3. Add integration tests with real provider
4. Use error providers to test error cases
5. Validate audio format support

### For New Audio Format

1. Add fixtures to `audio-fixtures.ts`
2. Update format lists in provider tests
3. Add conversion/resampling tests
4. Test format compatibility across providers

## Debugging Tests

### Run Single Test
```bash
npm test -- --grep "specific test name"
```

### Enable Debug Output
```bash
DEBUG=* npm test
```

### Watch File Changes
```bash
npm run test:watch
```

### Generate Coverage Report
```bash
npm run test:coverage
# View HTML report
open coverage/index.html
```

## Best Practices

1. **Isolation**: Each test is independent and can run in any order
2. **Mocking**: All external dependencies are mocked
3. **Cleanup**: Resources are cleaned up in `afterEach`
4. **Descriptive**: Test names clearly describe what is being tested
5. **Coverage**: Aim for >80% coverage in core modules
6. **Performance**: Tests complete quickly (<5 seconds total)

## Future Enhancements

- [ ] Performance benchmarking suite
- [ ] Integration tests with real API keys (optional, live tests)
- [ ] Browser-based STT/TTS providers
- [ ] WebAssembly-based providers
- [ ] Snapshot testing for audio characteristics
- [ ] Stress testing (large audio files, many concurrent requests)
- [ ] Memory profiling tests
