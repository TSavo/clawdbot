# Voice Channel Architecture Research Report

**Research Date:** January 16, 2026
**Focus:** Understanding existing voice infrastructure to inform Discord-like voice channel design

---

## Executive Summary

Clawdbot has an extensive **phone call infrastructure** (not Discord-like voice yet), featuring:
- Voice call management system (voice-call extension) with Telnyx/Twilio/Plivo providers
- Streaming media capabilities via WebSocket for bidirectional audio
- STT/TTS provider abstraction layer with local and cloud options
- Session-based call tracking and persistence
- Real-time audio processing with OpenAI Realtime STT

**Key Finding:** The existing architecture is optimized for **point-to-point telephony calls**, not persistent **multi-user voice channels**. Voice channel design needs a different approach.

---

## 1. Current 11labs Integration

### Location
- Primary config: `/src/config/types.voice.ts` and `/src/config/zod-schema.voice-providers.ts`
- TTS provider interface: `/extensions/speech-plugins/src/interfaces/tts-provider.ts`
- Command integration: `/src/commands/voice.ts`

### Integration Pattern
**Type:** Configuration-based, not active API calls yet

```typescript
// From types.voice.ts
type TTSProviderConfig = {
  type?: "cloud" | "local" | "kokoro" | "piper" | "elevenlabs" | "openai" | "google" | "azure";
  service?: string;
  voice?: string;
  voiceId?: string;
  speed?: number;
  apiKey?: string;
  model?: string;
  outputFormat?: string;
};
```

### Supported Usage
1. **Configuration Phase** - 11labs can be configured via CLI:
   - `clawdbot configure voice` - Interactive setup
   - `clawdbot voice status` - Show current configuration
   - `clawdbot voice providers` - List available (11labs listed as cloud TTS option)

2. **Audio Delivery** - Currently not synthesizing with 11labs yet in voice calls
   - Voice calls use **OpenAI TTS** (via `config.tts.provider: "openai"`)
   - 11labs is configured but not yet utilized in active voice flows

### Where 11labs Could Integrate
- Voice call TTS: Replace OpenAI with 11labs in outbound call greeting
- Streaming TTS: Add to media stream for real-time audio generation
- Not currently used in batch synthesis (test command shows "not implemented")

---

## 2. Clawdbot Communication Architecture

### Two Distinct Layers

#### Layer 1: **Messaging Channels** (Mature)
Located: `/src/slack`, `/src/msteams`, `/src/web`, `/src/cli`

**Pattern:** Stateless request-response
```typescript
// From session-key.ts - session management
type ParsedAgentSessionKey = {
  agentId: string;
  rest: string;
};

// Examples of session keys:
// "agent:main:main" - main agent, main session
// "agent:main:slack:dm:user123" - slack DM
// "agent:main:slack:group:channel456" - slack channel
```

**Message Flow:**
1. Provider (Slack/Teams/WhatsApp) sends message
2. Normalized to session key format
3. Routed to agent for processing
4. Response sent back via provider

#### Layer 2: **Voice Calls** (Active, Telephony-focused)
Located: `/extensions/voice-call/src`

**Pattern:** Persistent WebSocket connections during active call
```typescript
// From types.ts - call state machine
type CallState =
  | "initiated" | "ringing" | "answered" | "active" | "speaking" | "listening"
  | "completed" | "hangup-user" | "hangup-bot" | "timeout" | "error";

// From media-stream.ts - streaming sessions
interface StreamSession {
  callId: string;
  streamSid: string;
  ws: WebSocket;  // ← persistent connection
  sttSession: RealtimeSTTSession;
}
```

### Session Management
- **Persistent:** Session directory: `~/.clawdbot/sessions/` (stored as JSONL)
- **Scoped:** Each agent has isolated session context
- **Multi-channel:** Same agent can have parallel sessions across Slack, Teams, WhatsApp, voice calls
- **State:** Persisted on disk; restored on reconnect

---

## 3. Real-time vs Batch Patterns

### Current Batch Pattern (Messages)
```
[User Message] → STT (if audio) → Process → TTS (if audio) → [Deliver]
Latency: 100-5000ms per message
State: Conversation history tracked in session
```

### Current Streaming Pattern (Active Voice Calls)
```typescript
// From webhook.ts - WebSocket-based streaming
class VoiceCallWebhookServer {
  private mediaStreamHandler: MediaStreamHandler | null = null;

  // Handles WebSocket upgrade for persistent media streams
  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer): void {
    if (!this.wss) {
      this.wss = new WebSocketServer({ noServer: true });
      this.wss.on("connection", (ws, req) => this.handleConnection(ws, req));
    }
    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss?.emit("connection", ws, request);
    });
  }
}

// From media-stream.ts - bidirectional audio
class MediaStreamHandler {
  private sessions = new Map<string, StreamSession>();

  // Receives mu-law audio from Twilio
  handleStart(ws: WebSocket, message: TwilioMediaMessage): StreamSession {
    const sttSession = this.config.sttProvider.createSession();

    sttSession.onPartial((partial) => {
      this.config.onPartialTranscript?.(callSid, partial);
    });

    sttSession.onTranscript((transcript) => {
      this.config.onTranscript?.(callSid, transcript);
    });
  }

  // Sends mu-law audio back to Twilio
  sendAudio(streamSid: string, muLawAudio: Buffer): void {
    this.sendToStream(streamSid, {
      event: "media",
      streamSid,
      media: { payload: muLawAudio.toString("base64") },
    });
  }
}
```

### Key Differences for Voice Channels

| Aspect | Batch (Messages) | Streaming (Calls) | Discord Channels |
|--------|------------------|-------------------|-------------------|
| Connection | Stateless | WebSocket (persistent) | WebSocket (persistent) |
| Audio | Discrete blocks | Continuous streams | Continuous streams |
| Latency Target | 100-5000ms | 20-100ms | <100ms |
| State | Session history | Call transcript | Room history + presence |
| Users | 1:1 or group chat | 2-party call | N-party channel |
| Synchronization | Sequential | Real-time (bidirectional) | Real-time (all users) |

---

## 4. Audio Handling Patterns

### Audio Format Support
```typescript
// From tts-provider.ts interface
export interface TTSCapabilities {
  formats: ("wav" | "mp3" | "pcm" | "ulaw")[];
  sampleRates: number[];
  voices: TTSVoice[];
  supportsStreaming: boolean;
  languages: string[];
}

// Synthesis options
export interface TTSSynthesisOptions {
  voiceId: string;
  format: "wav" | "mp3" | "pcm" | "ulaw";
  sampleRate: number;
  speechRate?: number;
  pitch?: number;
  volumeDb?: number;
}
```

### Audio Processing Flow

#### For Voice Calls (Phone)
```
Phone (mu-law @ 8kHz)
  ↓
[WebSocket from Twilio]
  ↓
Decode from base64 + mu-law
  ↓
OpenAI Realtime STT (streaming)
  ↓
Transcript events → CallManager → Event processing
  ↓
Response text → OpenAI TTS
  ↓
Encode to mu-law + base64
  ↓
[WebSocket to Twilio]
  ↓
Phone (audio plays)
```

#### For 11labs Integration
```
Text → 11labs API (streaming) → Audio stream
  ↓
Resample: 11labs @ 24kHz → target rate (8kHz for phone)
  ↓
Encode format (mu-law for Twilio)
  ↓
Send via media stream
```

### Stream Handling
- **Location:** `/src/media/` directory
- **Patterns:** File-based and memory-based streams
- **Codecs:** wav, mp3, pcm, ulaw (mu-law)
- **Resampling:** Library included in TTS provider interface

---

## 5. Session Architecture

### Call Session Lifecycle
```typescript
// From manager.ts
class CallManager {
  private activeCalls = new Map<CallId, CallRecord>();
  private providerCallIdMap = new Map<string, CallId>();
  private processedEventIds = new Set<string>();

  async initiateCall(to: string, sessionKey?: string, options?: OutboundCallOptions) {
    const callId = crypto.randomUUID();
    const callRecord: CallRecord = {
      callId,
      provider: this.provider.name,
      direction: "outbound",
      state: "initiated",
      from,
      to,
      sessionKey,
      startedAt: Date.now(),
      transcript: [],
      processedEventIds: [],
      metadata: { initialMessage, mode },
    };

    this.activeCalls.set(callId, callRecord);
    this.persistCallRecord(callRecord);
  }
}
```

### State Persistence
```
Location: ~/.clawdbot/voice-calls/ (configurable)
Format: JSON call records
Contents:
  - callId (UUID)
  - providerCallId (Telnyx/Twilio/Plivo-specific)
  - state machine tracking
  - full transcript (speaker: "bot" | "user")
  - metadata (initial message, mode, etc.)
  - processed event IDs (idempotency)
```

### Connection State Tracking
1. **Active:** In-memory map + event listeners
2. **Cleanup:** max duration timers auto-hangup
3. **Recovery:** Load persisted active calls on manager init
4. **Termination:** Terminal states trigger cleanup + final persistence

### Concurrent Limits
```typescript
// From manager.ts
if (activeCalls.length >= this.config.maxConcurrentCalls) {
  return { success: false, error: `Maximum concurrent calls reached` };
}
```

---

## 6. Provider Integration Patterns

### Voice Call Providers
**Location:** `/extensions/voice-call/src/providers/`

**Providers Supported:**
- Telnyx (Call Control API)
- Twilio (REST API + WebSocket media)
- Plivo (REST API)
- Mock (for testing)

### Provider Interface
```typescript
// From base.ts
export interface VoiceCallProvider {
  readonly name: ProviderName;
  initialize(config: Record<string, unknown>): Promise<void>;

  // Initiate outbound call
  initiateCall(input: InitiateCallInput): Promise<InitiateCallResult>;

  // Control active call
  playTts(input: PlayTtsInput): Promise<void>;
  startListening(input: StartListeningInput): Promise<void>;
  stopListening(input: StopListeningInput): Promise<void>;
  hangupCall(input: HangupCallInput): Promise<void>;

  // Webhook handling
  parseWebhook(context: WebhookContext): Promise<ProviderWebhookParseResult>;
  verifyWebhookSignature(context: WebhookContext): Promise<WebhookVerificationResult>;
}
```

### Webhook Flow
```
[Provider] → HTTP POST /voice/webhook
  ↓
VoiceCallWebhookServer.handleRequest()
  ↓
provider.verifyWebhookSignature()
  ↓
provider.parseWebhook() → [NormalizedEvent, ...]
  ↓
callManager.processEvent(NormalizedEvent)
  ↓
State machine update + callbacks
```

---

## 7. Architecture Diagram: Current State

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLAWDBOT ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌───────────────┐
│   MESSAGING LAYER    │  │   VOICE CALL LAYER   │  │  ADMIN/CONFIG │
│  (Stateless)         │  │  (Stateful, WebRTC  │  │               │
│                      │  │   ready)             │  │               │
│ • Slack              │  │ • Phone calls        │  │ • CLI cmds    │
│ • Teams              │  │ • Streaming media    │  │ • Web UI      │
│ • WhatsApp           │  │ • Realtime STT/TTS   │  │ • Config      │
│ • Direct HTTP        │  │                      │  │   mgmt        │
└────────┬─────────────┘  └──────────┬───────────┘  └───────────────┘
         │                           │
         │                           │
    ┌────▼───────────────────────────▼──────┐
    │      SESSION MANAGER                   │
    │   (Agent context + routing)            │
    │                                        │
    │  • Session keys (agent:id:context)    │
    │  • Persistent state (~/.clawdbot)      │
    │  • Multi-channel federation            │
    └────┬──────────────┬────────────────────┘
         │              │
         │              └─────────────────┐
         │                                │
    ┌────▼─────────────┐        ┌────────▼──────────┐
    │  AGENT RUNTIME   │        │  CALL MANAGER     │
    │                  │        │  (voice-call ext) │
    │ • LLM calls      │        │                   │
    │ • Tool handling  │        │ • Active calls    │
    │ • Memory access  │        │ • State machine   │
    └────┬─────────────┘        │ • Persistence     │
         │                      │ • Event routing   │
         │                      └────┬──────────────┘
         │                           │
    ┌────▼───────────────────────────▼───────┐
    │        PROVIDER ABSTRACTION LAYER       │
    │                                         │
    │ ┌──────────────────────────────────┐   │
    │ │ STT Providers                    │   │
    │ │ • Whisper (local)                │   │
    │ │ • OpenAI Realtime (streaming)    │   │
    │ │ • Azure Speech                   │   │
    │ └──────────────────────────────────┘   │
    │                                         │
    │ ┌──────────────────────────────────┐   │
    │ │ TTS Providers                    │   │
    │ │ • OpenAI (configured)            │   │
    │ │ • 11labs (config only)           │   │
    │ │ • Kokoro/Piper (local)           │   │
    │ └──────────────────────────────────┘   │
    │                                         │
    │ ┌──────────────────────────────────┐   │
    │ │ Voice Call Providers             │   │
    │ │ • Telnyx (Call Control)          │   │
    │ │ • Twilio (REST + WebSocket)      │   │
    │ │ • Plivo (REST API)               │   │
    │ └──────────────────────────────────┘   │
    └─────────────────────────────────────────┘
            │
            │ (HTTP + WebSocket)
            │
    ┌───────▼─────────────────┐
    │  EXTERNAL SERVICES      │
    │                         │
    │ • Phone network         │
    │ • Cloud APIs            │
    │ • WebSocket tunnels     │
    └─────────────────────────┘
```

---

## 8. Integration Points for Voice Channels

### What Exists (Can Reuse)
1. **Session Management** - Agent sessions already federated
2. **State Persistence** - Infrastructure for persisting call/channel state
3. **STT Infrastructure** - Streaming STT (OpenAI Realtime) ready
4. **TTS Provider Abstraction** - 11labs can plug in here
5. **WebSocket Handling** - Media stream WebSocket patterns established
6. **Audio Format Handling** - Codec support, resampling available
7. **Event Processing** - Normalized event system for state updates

### What Needs New Implementation
1. **Multi-user Presence** - Track who's in each channel
2. **Audio Mixing** - Combine multiple audio streams
3. **Real-time Synchronization** - All users get simultaneous updates
4. **Channel Discovery** - List/search available channels
5. **Permission Model** - Who can join/speak in which channel
6. **Broadcast Pattern** - Send audio to N clients simultaneously
7. **Voice Activity Detection** - Detect who's speaking
8. **Recording** - Optional channel recording
9. **Spatial Audio** - Optional: localized audio positioning

---

## 9. Where to Integrate 11labs

### Option 1: Voice Call TTS (Highest ROI)
**Location:** `/extensions/voice-call/src/providers/tts-openai/provider.ts`

```typescript
// Add 11labs as alternative to OpenAI TTS
// Replace:
//   config.tts.provider = "openai"
// With:
//   config.tts.provider = "elevenlabs"
//   config.tts.voiceId = "21m00Tcm4TlvDq8ikWAM" // 11labs voice ID
```

**Integration:**
- Inherit TTSProvider interface
- Implement synthesize() and synthesizeStream()
- Update manager.ts to support 11labs config
- Update voice call CLI to accept 11labs setup

**Latency Benefit:** 11labs typically 20-30% faster than OpenAI TTS 1.0

### Option 2: Stream-based TTS for Voice Channels
**Location:** New `/extensions/voice-channels/src/providers/tts-streaming.ts`

```typescript
// For voice channels needing low-latency streaming
// Use 11labs streaming API directly
// Send chunks via WebSocket as they arrive
```

**Pattern:**
```
Text → 11labs API (streaming)
  → 1st chunk arrives in 50-100ms
  → Start sending audio while rest generates
  → Full response: 200-300ms
```

### Option 3: Hybrid Model (Future)
**Location:** Provider registry

```typescript
interface VoiceChannelTTSConfig {
  // For interactive (channel): use 11labs (low latency)
  interactive: "elevenlabs" | "openai",

  // For greeting/announcement: use OpenAI (cheaper)
  batch: "openai" | "elevenlabs",
}
```

---

## 10. Critical Gaps for Voice Channels

### High Priority
1. **Multi-user audio mixing** - Can't just forward streams; need mix
2. **Presence tracking** - Who's connected to this channel right now?
3. **Bandwidth management** - Multiple streams to all clients
4. **Jitter handling** - Network delays across users
5. **Echo cancellation** - Feedback prevention (if using speakers)

### Medium Priority
6. **Voice activity detection** - Know when someone stops speaking
7. **Channel persistence** - Channels exist beyond single session
8. **User roles/permissions** - Admin/speaker/listener
9. **Recording infrastructure** - Archive conversations
10. **Notification system** - Alert users when channel has activity

### Lower Priority
11. **Spatial audio** - Position voices in 3D space
12. **Effects** - Echo, reverb, voice modulation
13. **Transcription** - Real-time captions
14. **Translation** - Multi-language channels

---

## 11. Recommended Architecture for Voice Channels

### Layer 1: Channel Manager (New)
```typescript
class VoiceChannelManager {
  private channels = new Map<ChannelId, VoiceChannel>();

  createChannel(name: string, config: ChannelConfig): ChannelId
  joinChannel(channelId: ChannelId, userId: string): StreamConnection
  leaveChannel(channelId: ChannelId, userId: string): void
  broadcastAudio(channelId: ChannelId, fromUserId: string, audio: Buffer): void
  getChannelState(channelId: ChannelId): ChannelState
}
```

### Layer 2: Audio Mixer (New)
```typescript
class AudioMixer {
  private streams = new Map<UserId, AudioStream>();

  // Mix N input streams to single output
  mixStreams(streams: AudioStream[]): Buffer

  // Apply per-user volume/effects
  applyProcessing(audio: Buffer, userId: string): Buffer
}
```

### Layer 3: Reuse Existing STT/TTS
```typescript
// Can use existing infrastructure:
// - MediaStreamHandler (WebSocket patterns)
// - TTSProvider interface (including 11labs)
// - STT (OpenAI Realtime or local Whisper)
// - Session management
```

### Layer 4: WebSocket Broadcast
```typescript
// Extend existing WebSocket pattern from voice calls
// Instead of 1 call (2-way), handle N connected users
// Broadcast mixed audio to all clients
```

---

## 12. Implementation Roadmap

### Phase 1: Infrastructure (Weeks 1-2)
- [ ] Add 11labs TTS provider to voice calls
- [ ] Benchmark latency vs OpenAI
- [ ] Create ChannelManager skeleton
- [ ] Design audio mixer interface

### Phase 2: Voice Channels Basics (Weeks 3-4)
- [ ] Implement single-channel audio broadcast
- [ ] Build WebSocket listener for multi-user
- [ ] Implement basic audio mixing
- [ ] Add presence tracking

### Phase 3: Features (Weeks 5-6)
- [ ] Voice activity detection
- [ ] Permission model (admin/speaker/listener)
- [ ] Channel persistence
- [ ] Recording infrastructure

### Phase 4: Polish (Week 7)
- [ ] UI for managing channels
- [ ] Tests and benchmarks
- [ ] Documentation
- [ ] Performance optimization

---

## 13. Key Files Reference

### Current Architecture
| File | Purpose | Lines |
|------|---------|-------|
| `/extensions/voice-call/src/manager.ts` | Call state machine | 800+ |
| `/extensions/voice-call/src/media-stream.ts` | WebSocket audio handling | 280 |
| `/extensions/voice-call/src/webhook.ts` | Webhook server + streaming init | 480 |
| `/extensions/speech-plugins/src/interfaces/tts-provider.ts` | TTS contract | 137 |
| `/src/routing/session-key.ts` | Session management | 132 |
| `/src/config/types.voice.ts` | Voice configuration types | 98 |
| `/extensions/voice-call/src/types.ts` | Call event types | 273 |

### Where to Add Voice Channels
| New File | Purpose |
|----------|---------|
| `/extensions/voice-channels/src/manager.ts` | Channel lifecycle |
| `/extensions/voice-channels/src/audio-mixer.ts` | Multi-user audio mixing |
| `/extensions/voice-channels/src/broadcast-handler.ts` | WebSocket broadcast |
| `/extensions/voice-channels/src/presence-manager.ts` | User presence tracking |
| `/extensions/voice-channels/src/providers/channel-provider.ts` | Channel provider interface |

---

## 14. Recommendations

### To Integrate 11labs Most Effectively

1. **Start with Voice Calls** (not channels yet)
   - Add ElevenLabs to TTS provider registry
   - Create `/extensions/voice-call/src/providers/tts-elevenlabs/provider.ts`
   - Inherit TTSProvider interface
   - Test streaming vs batch synthesis

2. **Measure Latency Impact**
   - Benchmark 11labs vs OpenAI on phone calls
   - Track end-to-end latency (text → audio → phone)
   - Profile CPU/memory usage

3. **Plan Channel Architecture**
   - Don't reuse CallManager for channels (different state machine)
   - Create ChannelManager alongside CallManager
   - Consider whether channels are ephemeral or persistent

4. **Audio Mixing is the Blocker**
   - This is the main difference from current call architecture
   - Need library for real-time audio mixing (e.g., `audio-concat`, `libav.js`)
   - Will determine latency characteristics

5. **Session Model**
   - Channels ≠ calls (different lifecycle)
   - Need new session key format: `agent:id:channel:room-id`
   - Presence should survive temporary disconnects

---

## 15. Summary: Where vs How

### WHERE to integrate 11labs
1. **Voice Calls** (immediate): Replace OpenAI TTS in active calls
2. **Voice Channels** (future): Low-latency TTS for real-time interaction

### WHERE to build voice channels
1. New extension: `/extensions/voice-channels/`
2. Reuse: Session management, STT infrastructure, WebSocket patterns
3. New: Audio mixer, presence tracking, broadcast handler

### HOW to integrate without breaking existing
1. Voice calls use **provider switching** (already supported)
2. Speech plugins registry allows **multiple TTS** backends
3. Channels are **separate from calls** (different manager)
4. Session keys distinguish channel vs call context

---

## Appendix: Code Examples

### Current 11labs Config
```typescript
// Configured but not used
const voiceConfig = {
  providers: [{
    id: "cloud-tts",
    enabled: true,
    tts: {
      type: "elevenlabs",
      voiceId: "21m00Tcm4TlvDq8ikWAM",
      apiKey: process.env.ELEVENLABS_API_KEY,
    }
  }]
};
```

### WebSocket Media Stream (Existing Pattern)
```typescript
// From media-stream.ts
private async handleConnection(ws: WebSocket, request: IncomingMessage) {
  ws.on("message", async (data: Buffer) => {
    const message = JSON.parse(data.toString());

    switch (message.event) {
      case "start":
        const session = await this.handleStart(ws, message);
        break;

      case "media":
        // Forward audio to STT
        const audioBuffer = Buffer.from(message.media.payload, "base64");
        session.sttSession.sendAudio(audioBuffer);
        break;
    }
  });
}
```

### TTS Provider Interface (For 11labs to implement)
```typescript
export interface TTSProvider {
  readonly metadata: TTSProviderMetadata;

  initialize(config?: Record<string, unknown>): Promise<void>;
  listVoices(): Promise<TTSVoice[]>;
  synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer>;
  synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions
  ): Promise<void>;
  resample(audioBuffer: Buffer, fromSampleRate: number, toSampleRate: number): Promise<Buffer>;
  shutdown?(): Promise<void>;
}
```

---

**Report Generated:** January 16, 2026
**Research Agent:** Claude Haiku 4.5
**Status:** Complete - Ready for architecture design phase
