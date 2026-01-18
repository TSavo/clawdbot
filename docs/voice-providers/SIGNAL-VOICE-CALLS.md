# Signal Real-Time Voice Calls

Privacy-first real-time voice call support for Signal with end-to-end encryption maintained throughout the call.

## Overview

Clawdbot can join Signal voice calls with full E2E encryption verification. The implementation includes:

- **Incoming call detection and acceptance**
- **E2E encryption verification** throughout the call
- **Bidirectional encrypted audio streaming** (Opus codec at 48kHz)
- **Optional transcription** (memory-only, not logged)
- **Agent response generation** with TTS synthesis
- **Privacy-first design** (no audio/call content logged)
- **Support for 1:1 and group calls**

## Architecture

```
Signal Voice Call Flow (Privacy-First):

User calls Clawdbot (E2E encrypted)
    ↓
Call handler verifies encryption
    ↓
Encrypted audio stream established
    ↓
Receive encrypted Opus audio
    ↓
Optional transcription (memory-only)
    ↓
Agent generates response
    ↓
TTS synthesizes (no caching)
    ↓
Encrypt and stream back
    ↓
User hears encrypted response
    ↓
Call ends
    ↓
Auto-cleanup + privacy preservation
```

## Components

### 1. Call Handler (`call-handler.ts`)

Manages incoming Signal voice calls with privacy-first design.

**Features:**
- Detect incoming voice calls
- Accept calls with E2E encryption verification
- Establish encrypted audio connection
- Handle call metadata (caller, duration, encryption status)
- Support one call at a time
- Monitor call quality and duration
- Auto-hangup after max duration

**Example Usage:**

```typescript
import { SignalVoiceCallHandler } from './signal/voice/call-handler.js';

const callHandler = new SignalVoiceCallHandler(
  { baseUrl: 'http://localhost:8080' },
  {
    autoAcceptCalls: false,
    allowedCallers: ['+15551234567'], // Optional allowlist
    maxDurationMs: 10 * 60 * 1000, // 10 minutes max
    requireEncryptionVerification: true, // Default: true
    enableGroupCalls: false, // Default: false
  },
  runtime,
);

// Listen for incoming calls
callHandler.on('call:incoming', async (call) => {
  console.log(`Incoming call from ${call.caller}`);

  // Accept the call
  await callHandler.acceptCall();
});

// Listen for encryption verification
callHandler.on('call:encryption-verified', (call) => {
  console.log(`E2E encryption verified: ${call.encryptionFingerprint}`);
});

// Listen for call ended
callHandler.on('call:ended', (call) => {
  console.log(`Call ended (duration: ${call.duration}ms)`);
});

// Handle incoming call
await callHandler.handleIncomingCall({
  callId: 'call-123',
  caller: '+15551234567',
  callerUuid: 'uuid-abc',
});

// Establish audio stream
const stream = await callHandler.establishAudioStream();
console.log(`Audio stream: ${stream.format} @ ${stream.sampleRate}Hz`);

// End call
await callHandler.endCall('Call completed');
```

### 2. Call Response Handler (`call-response-handler.ts`)

Handles bidirectional encrypted audio streaming with agent responses.

**Features:**
- Bidirectional encrypted audio (Opus codec)
- Optional transcription (memory-only, not logged)
- Agent response generation
- TTS synthesis (no caching/logging)
- Latency tracking (<300ms target)
- Privacy preservation (auto-cleanup)

**Example Usage:**

```typescript
import { SignalVoiceCallResponseHandler } from './signal/voice/call-response-handler.js';
import { CartesiaExecutor } from '../../media/voice-providers/cartesia.js';
import { WhisperExecutor } from '../../media/voice-providers/whisper.js';

// Initialize voice providers
const transcriptionProvider = new WhisperExecutor({ ... });
const ttsProvider = new CartesiaExecutor({
  apiKey: process.env.CARTESIA_API_KEY,
  model: 'sonic-turbo', // Low-latency model
});

await transcriptionProvider.initialize();
await ttsProvider.initialize();

// Create response handler
const responseHandler = new SignalVoiceCallResponseHandler(
  { baseUrl: 'http://localhost:8080' },
  {
    enableTranscription: true,
    transcriptionProvider: 'whisper',
    agentEnabled: true,
    agentPrompt: 'You are a helpful voice assistant.',
    ttsProvider: 'cartesia',
    ttsVoice: 'voice-id-here',
    maxLatencyMs: 300, // Target latency
    disableAudioLogging: true, // Privacy
    disableTextLogging: true, // Privacy
    clearMemoryOnEnd: true, // Privacy
  },
  runtime,
);

// Initialize with providers
await responseHandler.initialize({
  transcriptionProvider,
  ttsProvider,
});

// Listen for events
responseHandler.on('audio:received', (chunk) => {
  console.log(`Received audio: ${chunk.data.length} bytes`);
});

responseHandler.on('transcription:ready', (text) => {
  console.log(`Transcribed: ${text}`);
});

responseHandler.on('agent:response', (text) => {
  console.log(`Agent response: ${text}`);
});

responseHandler.on('tts:synthesized', (audio) => {
  console.log(`TTS synthesized: ${audio.duration}ms audio`);
});

responseHandler.on('latency:measured', (latencyMs, stage) => {
  console.log(`${stage}: ${latencyMs}ms`);
});

// Start streaming for a call
await responseHandler.startStreaming(call, streamId);

// Check latency
const avgLatency = responseHandler.getAverageLatency('tts-synthesis');
const endToEndLatency = responseHandler.getEndToEndLatency();
console.log(`End-to-end latency: ${endToEndLatency}ms`);

// Stop streaming
await responseHandler.stopStreaming();

// Cleanup
await responseHandler.cleanup();
```

## Call Events

### Call Handler Events

| Event | Description | Payload |
|-------|-------------|---------|
| `call:incoming` | New incoming call | `VoiceCall` |
| `call:accepted` | Call accepted | `VoiceCall` |
| `call:connected` | Call connected | `VoiceCall` |
| `call:audio-ready` | Audio stream ready | `VoiceCall` |
| `call:ended` | Call ended | `VoiceCall` |
| `call:failed` | Call failed | `VoiceCall, Error` |
| `call:encryption-verified` | E2E encryption verified | `VoiceCall` |
| `call:participant-joined` | Participant joined (group) | `VoiceCall, CallParticipant` |
| `call:participant-left` | Participant left (group) | `VoiceCall, CallParticipant` |
| `call:quality-changed` | Connection quality changed | `VoiceCall, quality` |

### Response Handler Events

| Event | Description | Payload |
|-------|-------------|---------|
| `audio:received` | Audio chunk received | `AudioChunk` |
| `audio:sent` | Audio chunk sent | `AudioChunk` |
| `transcription:ready` | Transcription completed | `string` (text) |
| `agent:response` | Agent response generated | `string` (text) |
| `tts:synthesized` | TTS synthesis completed | `AudioBuffer` |
| `latency:measured` | Latency metric recorded | `number, string` (ms, stage) |
| `error` | Error occurred | `Error, string` (error, stage) |

## Privacy Guarantees

### No Audio Storage
- Audio content is **never persisted to disk**
- Audio is processed in memory only
- Auto-cleanup after call ends

### No Call Logging
- Call content (audio/text) is **never logged**
- Only metadata is stored (caller, duration, encryption status)
- Metadata auto-deleted per privacy manager settings (24 hours default)

### Memory-Only Transcription
- Transcriptions are **never persisted**
- Stored in memory buffer only during call
- Auto-cleared when call ends (if `clearMemoryOnEnd: true`)
- Limited buffer size (prevents unlimited history)

### TTS No Caching
- TTS synthesis **never cached**
- Fresh synthesis for each response
- No audio content stored

### End-to-End Encryption
- Signal's E2E encryption maintained throughout
- Encryption verification required (configurable)
- Encryption fingerprint validated
- Encrypted Opus audio streams

## Configuration

### Call Handler Config

```typescript
{
  autoAcceptCalls: false, // Auto-accept incoming calls
  allowedCallers: [], // Allowlist (empty = allow all)
  maxDurationMs: 10 * 60 * 1000, // Max call duration (10 min)
  requireEncryptionVerification: true, // Require E2E verification
  enableGroupCalls: false, // Enable group call support
  enableEchoCancellation: true, // Enable echo cancellation
  enableNoiseSuppression: true, // Enable noise suppression
  disableCallLogging: true, // Privacy: disable call logging
}
```

### Response Handler Config

```typescript
{
  enableTranscription: true, // Enable audio transcription
  transcriptionProvider: 'whisper', // STT provider
  agentEnabled: true, // Enable agent responses
  agentPrompt: 'You are a helpful voice assistant.',
  agentContextWindow: 5, // Recent transcriptions to include
  ttsProvider: 'cartesia', // TTS provider
  ttsVoice: 'voice-id', // TTS voice ID
  ttsSpeed: 1.0, // TTS speed multiplier
  maxLatencyMs: 300, // Target latency (300ms)
  bufferSizeMs: 100, // Audio buffer duration
  disableAudioLogging: true, // Privacy: no audio logging
  disableTextLogging: true, // Privacy: no text logging
  clearMemoryOnEnd: true, // Privacy: clear memory on call end
}
```

## Latency Optimization

Target: **<300ms end-to-end latency**

### Latency Breakdown

| Stage | Target | Provider |
|-------|--------|----------|
| Audio receive | <50ms | Signal WebSocket |
| Transcription | <100ms | Whisper (local) or Deepgram |
| Agent response | <50ms | Simple LLM |
| TTS synthesis | <50ms | Cartesia Sonic Turbo (40ms) |
| Audio send | <50ms | Signal WebSocket |
| **Total** | **<300ms** | |

### Optimization Tips

1. **Use Cartesia Sonic Turbo** for ultra-low TTS latency (40ms)
2. **Use local Whisper** for transcription (faster than cloud)
3. **Keep agent responses simple** (avoid complex LLM reasoning)
4. **Enable audio buffering** (`bufferSizeMs: 100`)
5. **Monitor latency metrics** via events

## Testing

```bash
# Run tests
pnpm test src/signal/voice/call-handler.test.ts
pnpm test src/signal/voice/call-response-handler.test.ts

# Run with coverage
pnpm test:coverage src/signal/voice/
```

## Security & Privacy

### E2E Encryption
- Signal's end-to-end encryption maintained
- Encryption fingerprint verified on accept
- No plaintext audio outside Signal protocol

### Privacy Compliance
- GDPR-compliant (no audio storage)
- No conversation logging
- Memory auto-cleared
- Metadata auto-deleted (24 hours)

### Access Control
- Caller allowlist support
- Per-call authorization
- Max duration enforcement

## Troubleshooting

### Call Not Connecting
- Check Signal daemon is running
- Verify E2E encryption keys synced
- Check network connectivity

### Poor Audio Quality
- Check connection quality (`call:quality-changed` event)
- Monitor latency metrics
- Verify Opus codec support

### High Latency
- Use Cartesia Sonic Turbo for TTS
- Use local Whisper for transcription
- Reduce agent context window
- Check network latency

## References

- [Signal Protocol](https://signal.org/docs/)
- [Opus Codec](https://opus-codec.org/)
- [Cartesia TTS](../media/voice-providers/cartesia.md)
- [Whisper STT](../media/voice-providers/whisper.md)
- [Privacy Manager](./privacy-manager.md)
