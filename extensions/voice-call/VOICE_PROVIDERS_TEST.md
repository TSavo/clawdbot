# Voice Providers Test Suite Documentation

## Overview

Comprehensive test suite for all voice providers in Clawdbot:

- **Local Providers**: Whisper (STT), Kokoro (TTS), Piper (TTS)
- **Cloud Providers**: OpenAI TTS, OpenAI Realtime (STT)
- **Audio Processing**: PCM, Mu-Law, A-Law codec conversions
- **Provider Management**: Fallback chains, provider switching
- **CLI Commands**: voice status, voice test, voice providers

## Test Files

### 1. providers.test.ts
Vitest-based provider integration tests.

**Coverage:**
- Local provider availability and configuration
- Cloud provider API connectivity
- Audio codec conversions (PCM ↔ Mu-Law, PCM ↔ A-Law)
- Fallback chain logic
- Provider status and discovery
- Error handling and recovery
- Provider initialization and configuration

**Run with:**
```bash
pnpm test providers.test.ts
```

### 2. voice-commands.test.ts
CLI command integration tests.

**Coverage:**
- `clawdbot voice status`: Show provider status
- `clawdbot voice test`: Test individual providers
- `clawdbot voice providers`: List all providers
- `clawdbot voice providers test <provider>`: Test specific provider
- Output formats: JSON, table, markdown
- Diagnostic information and error reporting
- Performance monitoring

**Run with:**
```bash
pnpm test voice-commands.test.ts
```

### 3. run-voice-tests.ts
Standalone test runner script for comprehensive testing.

**Features:**
- Detects installed providers
- Tests all providers (local and cloud)
- Audio codec conversion validation
- Fallback chain verification
- Generates detailed test report
- Saves results to `~/.clawdbot/voice-test-reports/`

**Run with:**
```bash
# Basic test
bun src/__tests__/run-voice-tests.ts

# With API key tests
LIVE=1 bun src/__tests__/run-voice-tests.ts

# Export JSON output
JSON_OUTPUT=1 bun src/__tests__/run-voice-tests.ts > results.json
```

## Local Providers

### Whisper (Speech-to-Text)

**Model Sizes:**
- `tiny` - Fastest, lowest quality, ~40MB
- `small` - ~140MB
- `base` - Default, ~140MB
- `medium` - ~405MB
- `large` - Best quality, ~2.9GB

**Configuration:**
```typescript
{
  modelSize: "base",
  language: "auto",  // or specific: "en", "es", "fr"
  wordTimestamps: false,
  transcriptionTimeoutMs: 60000
}
```

**Test Status:** Skipped (requires model download)

### Kokoro (Text-to-Speech)

**Available Voices:**
- `af_bella` - Female, American, Bella
- `af_sarah` - Female, American, Sarah
- `af_nicole` - Female, American, Nicole
- `am_michael` - Male, American, Michael
- `am_joshua` - Male, American, Joshua
- `am_brandon` - Male, American, Brandon
- `bf_emma` - Female, British, Emma
- `bm_george` - Male, British, George

**Features:**
- 24kHz PCM audio output
- Speed control (0.5 - 2.0x)
- Batch synthesis support

**Configuration:**
```typescript
{
  voice: "af_bella",
  speed: 1.0,
  validateSpeaker: true
}
```

**Test Status:** Skipped (requires model installation)

### Piper (Text-to-Speech)

**Voice Format:** `<language>-<region>-<name>-<quality>`

**Example Voices:**
- `en-us-libritts-high`
- `en-us-libritts-medium`
- `en-us-libritts-low`

**Features:**
- Lightweight offline synthesis
- 22.05kHz audio output
- 30+ voices across multiple languages

**Test Status:** Skipped (requires model download)

## Cloud Providers

### OpenAI TTS (Text-to-Speech)

**Available Voices:**
- `alloy` - Neutral tone
- `echo` - Friendly tone
- `fable` - Narrative tone
- `onyx` - Deep tone
- `nova` - Warm tone
- `shimmer` - Bright tone

**Models:**
- `tts-1` - Fast, lower quality
- `tts-1-hd` - Higher quality

**Output:**
- 24kHz PCM audio
- Streaming support

**Configuration:**
```typescript
{
  apiKey: process.env.OPENAI_API_KEY,
  model: "tts-1-hd",
  voice: "alloy"
}
```

**Test Status:** Requires `OPENAI_API_KEY`

### OpenAI Realtime API (Speech-to-Text)

**Features:**
- WebSocket-based real-time transcription
- ~100ms latency
- Bidirectional audio streaming
- Supports PCM and Mu-Law encoding

**Supported Audio Formats:**
- `pcm16` - 16-bit PCM
- `mulaw` - Mu-Law (G.711)
- `opus` - Opus codec

**Configuration:**
```typescript
{
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-realtime-preview",
  audioEncoding: "pcm16"
}
```

**Test Status:** Requires `OPENAI_API_KEY`

## Audio Codec Support

### Codec Conversions

**PCM to Mu-Law (G.711):**
- Input: PCM 16-bit signed
- Output: Mu-Law 8-bit
- Compression ratio: 2:1
- Use case: Twilio, PSTN compatibility

```typescript
import { pcmToMuLaw } from "../providers/audio-utils";
const muLawData = pcmToMuLaw(pcmBuffer);
```

**Mu-Law to PCM:**
- Input: Mu-Law 8-bit
- Output: PCM 16-bit signed
- Use case: Recovering audio from compressed format

```typescript
import { muLawToPcm } from "../providers/audio-utils";
const pcmData = muLawToPcm(muLawBuffer);
```

**PCM to A-Law (G.711):**
- Similar to Mu-Law but used in Europe/Asia
- Better for quieter signals

### Audio Format Specifications

**OpenAI TTS Output:**
```typescript
{
  sampleRate: 24000,  // Hz
  bits: 16,           // bits per sample
  channels: 1,        // mono
  encoding: "pcm",
  bigEndian: false    // little-endian
}
```

**Twilio Input (Mu-Law):**
```typescript
{
  sampleRate: 8000,
  bits: 8,
  channels: 1,
  encoding: "mulaw",
  bigEndian: false
}
```

**Whisper/Standard PCM:**
```typescript
{
  sampleRate: 16000,
  bits: 16,
  channels: 1,
  encoding: "pcm",
  bigEndian: false
}
```

## Fallback Chains

### Default Chain
```
openai-tts → kokoro → piper
```
Attempts cloud provider first, falls back to local.

### Local-Only Chain
```
kokoro → piper → whisper
```
Uses only offline providers.

### Cloud-First Chain
```
openai-tts → openai-realtime
```
Prioritizes cloud APIs.

### Chain Logic
1. Try primary provider
2. On error/timeout, try next in chain
3. Log provider switch with reason
4. Track fallback statistics

## CLI Commands

### voice status
Display provider availability and status.

```bash
# Show provider status summary
clawdbot voice status

# Detailed status with configuration
clawdbot voice status --detailed

# JSON output for automation
clawdbot voice status --json
```

**Output includes:**
- Provider status (installed/not-installed)
- Availability (ready/not-configured)
- Resource usage (memory, disk)
- Last test results
- Configuration summary

### voice test
Test voice provider functionality.

```bash
# Test all providers
clawdbot voice test

# Test specific provider
clawdbot voice test --provider kokoro
clawdbot voice test --provider openai-tts

# Verbose output
clawdbot voice test --verbose
```

**Tests:**
- Model availability
- API connectivity (cloud)
- Synthesis/transcription capability
- Audio codec support
- Latency measurements

### voice providers
List and inspect providers.

```bash
# List all providers
clawdbot voice providers
clawdbot voice providers list

# Show provider details
clawdbot voice providers --details

# Test specific provider
clawdbot voice providers test whisper
clawdbot voice providers test openai-tts

# Compare providers
clawdbot voice providers compare
```

**Output includes:**
- Provider name and type (STT/TTS)
- Location (local/cloud)
- Capabilities and features
- Requirements (disk space, API key)
- Performance metrics
- Recommendations

## Test Results Format

Results are saved to: `~/.clawdbot/voice-test-reports/<timestamp>.json`

```json
{
  "timestamp": "2026-01-16T12:34:56.789Z",
  "summary": {
    "totalProviders": 5,
    "localProviders": 3,
    "cloudProviders": 2,
    "testsRun": 8,
    "testsPassed": 2,
    "testsFailed": 0,
    "testsSkipped": 6,
    "totalDuration": 1250
  },
  "providers": [
    {
      "name": "whisper",
      "type": "stt",
      "location": "local",
      "ready": false,
      "reason": "model-not-downloaded",
      "capabilities": ["speech-to-text", "language-detection"]
    }
  ],
  "results": [
    {
      "provider": "whisper",
      "type": "local",
      "tests": [
        {
          "name": "model-availability",
          "passed": false,
          "error": "Model not downloaded"
        }
      ],
      "summary": {
        "total": 1,
        "passed": 0,
        "failed": 0,
        "skipped": 1,
        "duration": 0
      }
    }
  ],
  "audioCodecTests": {
    "pcmToMulaw": true,
    "mulawToPcm": true,
    "pcmToAlaw": true,
    "alawToPcm": true,
    "resamplingSupport": true
  },
  "fallbackChains": {
    "default": ["openai-tts", "kokoro", "piper"],
    "localOnly": ["kokoro", "piper"],
    "cloudFirst": ["openai-tts", "openai-realtime"]
  },
  "cliCommands": {
    "voiceStatus": false,
    "voiceTest": false,
    "voiceProviders": false,
    "voiceProvidersTest": false
  },
  "recommendations": [
    "Set OPENAI_API_KEY to enable OpenAI provider tests",
    "Install local providers for offline voice capabilities"
  ]
}
```

## Running Tests

### All Tests
```bash
# Run all voice provider tests
pnpm test providers voice-commands

# With coverage
pnpm test:coverage providers voice-commands
```

### Live Tests (with API keys)
```bash
# Test with OpenAI API
LIVE=1 pnpm test:live providers voice-commands

# Or run standalone
OPENAI_API_KEY=sk-... bun src/__tests__/run-voice-tests.ts
```

### Specific Provider Tests
```bash
# Local providers only
pnpm test providers.test.ts -t "Local Providers"

# Cloud providers only
pnpm test providers.test.ts -t "Cloud Providers"

# Audio codecs only
pnpm test providers.test.ts -t "Audio Codec"

# CLI commands only
pnpm test voice-commands.test.ts
```

### CLI Integration Tests
```bash
# Test voice status command
clawdbot voice status --json > /tmp/status.json

# Test voice providers command
clawdbot voice providers --json > /tmp/providers.json

# Test voice test command
clawdbot voice test --verbose
```

## Performance Benchmarks

### Expected Latencies

| Provider | Operation | Latency | Notes |
|----------|-----------|---------|-------|
| Whisper | Transcription | Varies | Depends on audio length, CPU |
| Kokoro | Synthesis | 500-1000ms | Per sentence (~10 words) |
| Piper | Synthesis | 1000-2000ms | Lighter model, CPU-bound |
| OpenAI TTS | Synthesis | 200-500ms | Network + API |
| OpenAI Realtime | Transcription | ~100ms | WebSocket streaming |

### Success Rates

| Provider | Typical Success Rate | Notes |
|----------|---------------------|-------|
| Local | 99% | Reliable, offline |
| Cloud | 95-99% | Depends on API health, rate limits |

## Environment Setup

### For API Key Testing
```bash
# Set OpenAI API key
export OPENAI_API_KEY=sk-...

# Run tests with API keys
LIVE=1 pnpm test:live providers voice-commands
```

### For Local Model Testing
```bash
# Install Whisper
pip install openai-whisper

# Install Kokoro (if available)
# Instructions at: https://github.com/remsky/Kokoro

# Install Piper
pip install piper-tts
```

## Troubleshooting

### "Model not found" errors
- Local models need to be downloaded separately
- See provider documentation for installation
- Models stored in provider cache directories

### API Key errors
- Check `OPENAI_API_KEY` is set correctly
- Run `clawdbot voice status --json` to verify
- Ensure API key has voice permissions

### Codec conversion failures
- Verify input buffer size (must be multiple of 2 for PCM)
- Check encoding format matches expected format
- Test with standard audio samples

### Fallback chain not activating
- Check provider order in configuration
- Verify timeout values are reasonable
- Enable verbose logging for debugging

## Contributing

To add a new voice provider:

1. Implement `VoiceCallProvider` interface in `src/providers/`
2. Add tests to `providers.test.ts`
3. Update CLI commands in `src/cli.ts`
4. Document in this file
5. Run full test suite: `pnpm test`

## Resources

- [Whisper Documentation](https://github.com/openai/whisper)
- [OpenAI API Docs](https://platform.openai.com/docs)
- [G.711 Codec Info](https://en.wikipedia.org/wiki/G.711)
- [Voice Call Extension Docs](/extensions/voice-call)

## Support

For issues or questions:
- Check test output: `~/.clawdbot/voice-test-reports/`
- Run: `clawdbot voice status --verbose`
- Enable debug logging: `DEBUG=clawdbot:* pnpm dev`
