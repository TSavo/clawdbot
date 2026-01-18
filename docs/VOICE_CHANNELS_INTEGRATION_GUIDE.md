# Voice Channel Architecture Integration Guide

Quick reference for building Discord-like voice channels on top of existing clawdbot infrastructure.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                  CLIENT (Browser/Mobile/Desktop)                │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐   │
│  │ WebRTC/     │  │ Audio       │  │ User UI              │   │
│  │ WebSocket   │  │ Capture     │  │ • Channel list       │   │
│  │ Connection  │  │ Playback    │  │ • Members present    │   │
│  └──────┬──────┘  └──────┬──────┘  │ • Speaking indicator │   │
│         │                │         └──────────────────────┘   │
│         └────────┬───────┘                                     │
│                  │                                             │
└──────────────────┼─────────────────────────────────────────────┘
                   │
          ┌────────▼────────┐
          │ WebSocket       │
          │ /voice/channel/ │
          │ {channelId}     │
          └────────┬────────┘
                   │
                   │ (Persistent bidirectional connection)
                   │ (Upgrade from HTTP → WebSocket)
                   │
┌──────────────────▼─────────────────────────────────────────────┐
│              CHANNEL SERVER (Node.js + Clawdbot)               │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │           VoiceChannelManager (NEW)                      │ │
│  │                                                          │ │
│  │  • Manage active channels                              │ │
│  │  • Track user presence                                 │ │
│  │  • Route audio streams                                 │ │
│  │  • Broadcast to all members                            │ │
│  │                                                          │ │
│  │  Map<ChannelId, VoiceChannel>                          │ │
│  │    ├─ members: Set<UserId>                             │ │
│  │    ├─ activeStreams: Map<UserId, AudioStream>          │ │
│  │    └─ mixer: AudioMixer                                │ │
│  └────────┬─────────────────┬──────────────────────────────┘ │
│           │                 │                                  │
│           │                 │                                  │
│  ┌────────▼─────┐  ┌────────▼──────────────────────────────┐  │
│  │ AudioMixer   │  │ STT/TTS Providers                    │  │
│  │ (NEW)        │  │ (REUSE EXISTING)                     │  │
│  │              │  │                                      │  │
│  │ • Mix N      │  │ • OpenAI Realtime STT               │  │
│  │   streams    │  │ • Whisper (local)                   │  │
│  │ • Apply      │  │ • 11labs TTS ← INTEGRATE HERE       │  │
│  │   effects    │  │ • OpenAI TTS                        │  │
│  │ • Resample   │  │ • Kokoro/Piper (local)              │  │
│  │   if needed  │  │                                      │  │
│  └──────────────┘  └──────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Session Management (REUSE EXISTING)                     │ │
│  │                                                          │ │
│  │  • Session keys: agent:id:channel:room-id              │ │
│  │  • Persistence: ~/.clawdbot/sessions/                  │ │
│  │  • Multi-channel federation                            │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Current Architecture (What Exists)

### Voice Calls (Phone-based)
```
Extension: /extensions/voice-call/

Manager:  CallManager (one call = 2-party)
├─ State machine: initiated → active → completed
├─ Persistence: ~/.clawdbot/voice-calls/
├─ Events: webhook-based (Telnyx/Twilio/Plivo)
└─ Media: WebSocket from provider

Providers:
├─ Telnyx (Call Control API)
├─ Twilio (REST + WebSocket media)
└─ Plivo (REST API)

STT/TTS:
├─ STT: OpenAI Realtime (streaming)
├─ TTS: OpenAI (configured), 11labs (config-only)
└─ Local: Whisper, Kokoro, Piper
```

### Sessions (Message-based)
```
Manager: Session router

Keys: agent:id:[channel:kind:peer]
└─ "agent:main:main" (default)
└─ "agent:main:slack:dm:user123" (Slack DM)
└─ "agent:main:slack:group:channel456" (Slack channel)
└─ "agent:main:msteams:channel:team/channel" (Teams)

Persistence: ~/.clawdbot/sessions/*.jsonl
└─ One session history per key
```

## New Architecture (Voice Channels)

### Channel Manager
```
Extension: /extensions/voice-channels/

Manager: VoiceChannelManager (N-user channels)
├─ State machine: created → active → archived
├─ Persistence: ~/.clawdbot/channels/
├─ Events: real-time sync (all connected users)
└─ Media: WebSocket to all members

Channels:
├─ Type: persistent (exists beyond single session)
├─ Members: N users can join simultaneously
├─ Presence: Track who's currently connected
└─ Permissions: admin/speaker/listener roles
```

### Audio Mixer
```
Component: AudioMixer

Input:
├─ Audio stream from user A (microphone)
├─ Audio stream from user B (microphone)
└─ Audio stream from user C (microphone)

Processing:
├─ Normalize volumes
├─ Apply voice effects (optional)
├─ Detect voice activity
└─ Mix into single stream

Output:
├─ Broadcast mixed audio to all connected clients
└─ Each client gets: everyone except themselves
    (or everyone including themselves for monitoring)
```

## Integration Points

### 1. 11labs TTS Integration (Immediate)

**Current location:** Voice calls use OpenAI TTS by default

**Target location:** `/extensions/speech-plugins/src/providers/`

**Implementation:**
```typescript
// New file: elevenlabs-tts-provider.ts
export class ElevenLabsTTSProvider implements TTSProvider {
  readonly metadata: TTSProviderMetadata = {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Natural voice synthesis with streaming support",
    capabilities: {
      formats: ["wav", "mp3", "ulaw"],
      sampleRates: [24000, 22050, 16000, 8000],
      supportsStreaming: true,
      languages: ["en", "es", "fr", "de", "it", "pt", "nl", ...],
    }
  };

  async initialize(config: Record<string, unknown>): Promise<void> {
    this.apiKey = (config as any).apiKey || process.env.ELEVENLABS_API_KEY;
  }

  async synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer> {
    // Call 11labs API
    // Return audio buffer
  }

  async synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions
  ): Promise<void> {
    // Call 11labs streaming API
    // Emit chunks via callbacks.onAudio()
    // Emit complete via callbacks.onComplete()
  }
}
```

**Configuration:**
```json
{
  "voice": {
    "providers": [{
      "id": "cloud-tts",
      "enabled": true,
      "tts": {
        "type": "elevenlabs",
        "service": "elevenlabs",
        "voiceId": "21m00Tcm4TlvDq8ikWAM",
        "apiKey": "${ELEVENLABS_API_KEY}"
      }
    }]
  }
}
```

**Usage in voice calls:**
```typescript
// config.ts: select 11labs instead of OpenAI
const manager = new CallManager({
  tts: {
    provider: "elevenlabs",
    voiceId: "21m00Tcm4TlvDq8ikWAM"
  }
});

// Result: Phone calls use 11labs TTS instead of OpenAI
```

### 2. Voice Channels (New Implementation)

**Location:** `/extensions/voice-channels/src/`

**Directory structure:**
```
/extensions/voice-channels/
├─ src/
│  ├─ manager.ts              ← VoiceChannelManager
│  ├─ audio-mixer.ts          ← AudioMixer
│  ├─ broadcast-handler.ts    ← WebSocket broadcast
│  ├─ presence-manager.ts     ← User presence tracking
│  ├─ types.ts                ← Channel types & schemas
│  ├─ webhook.ts              ← WebSocket upgrade handler
│  ├─ providers/
│  │  └─ channel-provider.ts  ← Provider interface
│  └─ utils/
│     ├─ session-keys.ts      ← Session key management
│     └─ audio-utils.ts       ← Audio processing
├─ tests/
└─ package.json
```

**Core interfaces:**
```typescript
// types.ts
export interface VoiceChannel {
  id: string;
  name: string;
  owner: string;
  members: Set<string>;
  activeConnections: Map<string, WebSocket>;
  audioMixer: AudioMixer;
  createdAt: number;
  permissions: ChannelPermissions;
  recordingEnabled: boolean;
}

export interface ChannelPermissions {
  allowlistUsers?: string[];
  defaultRole: "listener" | "speaker" | "admin";
  userRoles: Map<string, "listener" | "speaker" | "admin">;
}

export interface ChannelState {
  channelId: string;
  membersPresent: Array<{
    userId: string;
    joinedAt: number;
    role: "listener" | "speaker" | "admin";
    isSpeaking: boolean;
  }>;
  totalConnected: number;
  audioQuality: {
    sampleRate: number;
    bitrate: number;
    codec: string;
  };
}
```

## WebSocket Protocol

### Connection Upgrade
```
Client → Server: GET /api/voice/channel/{channelId}
Server → Client: 101 Switching Protocols
```

### Message Types
```typescript
// Client → Server
{
  "type": "audio",
  "data": "base64-encoded-audio-chunk"
}

{
  "type": "join",
  "userId": "user-123",
  "role": "speaker"
}

{
  "type": "leave",
  "userId": "user-123"
}

// Server → Client
{
  "type": "audio",
  "from": "user-456",  // omit self
  "data": "base64-encoded-mixed-audio"
}

{
  "type": "presence",
  "members": [
    { "userId": "user-123", "isSpeaking": true, "role": "speaker" },
    { "userId": "user-456", "isSpeaking": false, "role": "listener" }
  ]
}

{
  "type": "error",
  "error": "permission-denied"
}
```

## Session Key Format

### Voice Calls (Existing)
```
"agent:main:main"                                    ← default session
"agent:main:phone:outbound:+15551234567"            ← phone call
```

### Voice Channels (New)
```
"agent:main:channel:room-id"                        ← channel participant
"agent:main:channel:room-id:listener"               ← listener role
"agent:main:channel:room-id:admin"                  ← admin role
```

## Performance Considerations

### Audio Quality Settings

| Use Case | Sample Rate | Bitrate | Codec | Latency Target |
|----------|-------------|---------|-------|-----------------|
| Voice channel | 16kHz | 32kbps | opus | 50-100ms |
| Phone call | 8kHz | 16-32kbps | ulaw | 100-200ms |
| Music channel | 48kHz | 128kbps | opus | 200-500ms |

### Mixing Overhead

```
Per user:
├─ Decode audio: 2-5ms
├─ Resample if needed: 5-10ms
├─ Effects/normalization: 5-10ms
└─ Mix operation: 5-10ms
Total per user: ~20-35ms

For N users:
├─ Decode N streams: 20-50ms (parallel)
├─ Mix N streams: 20-35ms
└─ Encode output: 5-10ms
Total: ~50-100ms (acceptable for real-time)
```

## Testing Strategy

### Unit Tests
- Audio mixing correctness
- Session key generation
- Presence management

### Integration Tests
- 2-user channel (baseline)
- 4-user channel (realistic)
- 8+ user channel (stress test)

### Performance Tests
- Latency (microphone → speaker)
- CPU usage per user
- Memory per channel
- Jitter/packet loss resilience

## Migration from Voice Calls

**Voice Calls remain unchanged:**
- Phone numbers still work
- Existing call routing intact
- 2-party telephony continues

**Voice Channels are additive:**
- New extension, no breaking changes
- Can coexist with voice calls
- Users can be in both simultaneously (different agents)

## Rollout Plan

### Phase 1: 11labs TTS (Week 1-2)
```
✓ Integrate 11labs provider
✓ Update voice call config
✓ Benchmark vs OpenAI
→ No user-facing changes yet
```

### Phase 2: Voice Channels Beta (Week 3-4)
```
✓ Implement ChannelManager
✓ Build AudioMixer
✓ WebSocket broadcast working
✓ Internal testing with team
→ Limited rollout to power users
```

### Phase 3: Full Release (Week 5-6)
```
✓ UI for channel management
✓ Documentation complete
✓ Performance tuning
✓ Recording support
→ General availability
```

## Quick Reference

### Files to Modify (11labs TTS)
1. `/extensions/speech-plugins/src/providers/` - Add 11labs provider
2. `/extensions/voice-call/src/config.ts` - Accept elevenlabs config
3. `/src/commands/onboarding/onboarding.voice-providers.ts` - Setup wizard

### Files to Create (Voice Channels)
1. `/extensions/voice-channels/` - New extension
2. `/extensions/voice-channels/src/manager.ts` - Channel manager
3. `/extensions/voice-channels/src/audio-mixer.ts` - Audio mixing
4. `/extensions/voice-channels/src/broadcast-handler.ts` - WebSocket handling

### No Changes Needed
- Session management (reuse existing)
- STT providers (already flexible)
- Webhook patterns (can adapt)
- Configuration system (already extensible)

---

**Last Updated:** January 16, 2026
**Status:** Research Complete - Ready for Architecture Review
