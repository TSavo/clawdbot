# Voice Channel Development Quick Start

**TL;DR:** Discord-like voice channels need a separate architecture from phone calls. Here's what exists, what's needed, and where to start.

## What Exists

### Phone Call System (2-party)
```
src/
├─ extensions/voice-call/
│  ├─ manager.ts (CallManager)
│  ├─ media-stream.ts (WebSocket handling)
│  ├─ webhook.ts (provider integration)
│  └─ providers/ (Telnyx, Twilio, Plivo)
│
├─ extensions/speech-plugins/
│  ├─ interfaces/tts-provider.ts ← Add 11labs here
│  ├─ interfaces/stt-provider.ts
│  └─ providers/ (OpenAI, local, etc.)
│
└─ config/types.voice.ts (voice config)
```

### Session Management (proven)
```
src/routing/session-key.ts
├─ Session key format: agent:id:context:extra
├─ Examples: agent:main:main, agent:main:slack:dm:user123
└─ Persistence: ~/.clawdbot/sessions/*.jsonl
```

## What's Missing

### For Voice Channels
```
NEED TO BUILD:
├─ ChannelManager (orchestrate N-user channels)
├─ AudioMixer (combine multiple streams)
├─ BroadcastHandler (send mixed audio to all)
├─ PresenceManager (track who's present)
└─ ChannelProvider (like VoiceCallProvider but for rooms)
```

## Integration Points

### 1. Add 11labs TTS (EASY - Do This First)

**File:** `/extensions/speech-plugins/src/providers/elevenlabs-tts.ts`

```typescript
import { TTSProvider, TTSProviderMetadata, TTSSynthesisOptions, TTSStreamCallback } from "../interfaces/tts-provider.js";

export class ElevenLabsTTSProvider implements TTSProvider {
  private apiKey: string;
  private baseUrl = "https://api.elevenlabs.io/v1";

  readonly metadata: TTSProviderMetadata = {
    id: "elevenlabs",
    name: "ElevenLabs",
    description: "Natural voice synthesis with streaming support",
    version: "1.0.0",
    capabilities: {
      formats: ["wav", "mp3", "ulaw"],
      sampleRates: [24000, 22050, 16000, 8000],
      voices: [], // Populated in listVoices()
      supportsStreaming: true,
      languages: ["en", "es", "fr", "de", "it", "pt", "nl"],
    },
  };

  async initialize(config?: Record<string, unknown>): Promise<void> {
    this.apiKey = (config?.apiKey as string) || process.env.ELEVENLABS_API_KEY || "";
    if (!this.apiKey) {
      throw new Error("ElevenLabs API key not configured");
    }
  }

  async synthesize(text: string, options: TTSSynthesisOptions): Promise<Buffer> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${options.voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    });

    if (!response.ok) throw new Error(`ElevenLabs API error: ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: TTSSynthesisOptions
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/text-to-speech/${options.voiceId}/stream`, {
      method: "POST",
      headers: {
        "xi-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!response.ok) {
      callbacks.onError?.({ code: "api_error", message: `Status ${response.status}` });
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError?.({ code: "stream_error", message: "No response body" });
      return;
    }

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        callbacks.onAudio?.(value);
      }
      callbacks.onComplete?.();
    } catch (error) {
      callbacks.onError?.({
        code: "stream_error",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  async resample(
    audioBuffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number
  ): Promise<Buffer> {
    // Implement or use existing resampling library
    if (fromSampleRate === toSampleRate) return audioBuffer;
    // TODO: Add resampling logic
    throw new Error("Resampling not yet implemented");
  }

  async listVoices(): Promise<Array<{ id: string; name: string; language: string }>> {
    const response = await fetch(`${this.baseUrl}/voices`, {
      headers: { "xi-api-key": this.apiKey },
    });

    if (!response.ok) throw new Error(`Failed to fetch voices: ${response.status}`);
    const data = (await response.json()) as any;

    return data.voices.map((v: any) => ({
      id: v.voice_id,
      name: v.name,
      language: "en", // 11labs returns language in different field
    }));
  }

  async shutdown?(): Promise<void> {
    // No resources to clean up
  }
}
```

**Register it:** Add to provider registry in `/extensions/speech-plugins/src/index.ts`

### 2. Build Voice Channels (HARDER - Start After 11labs)

**Structure:**
```
extensions/voice-channels/
├─ src/
│  ├─ manager.ts              ← Main orchestrator
│  ├─ audio-mixer.ts          ← Audio processing
│  ├─ broadcast-handler.ts    ← WebSocket coordination
│  ├─ presence-manager.ts     ← User tracking
│  ├─ types.ts                ← TypeScript interfaces
│  └─ webhook.ts              ← HTTP/WebSocket server
└─ tests/
```

**Start with types:**
```typescript
// types.ts
export interface VoiceChannel {
  id: string;
  name: string;
  owner: string;
  members: Map<string, ChannelMember>;
  createdAt: number;
  permissions: {
    allowlist?: string[];
    defaultRole: "listener" | "speaker" | "admin";
  };
}

export interface ChannelMember {
  userId: string;
  role: "listener" | "speaker" | "admin";
  joinedAt: number;
  isSpeaking: boolean;
  streamSid?: string; // WebSocket connection ID
}

export interface ChannelEvent {
  type: "audio" | "join" | "leave" | "speaking" | "state-sync";
  payload: unknown;
  timestamp: number;
}
```

**Then manager:**
```typescript
// manager.ts
import { EventEmitter } from "events";

export class VoiceChannelManager extends EventEmitter {
  private channels = new Map<string, VoiceChannel>();
  private audioMixer = new AudioMixer();

  createChannel(name: string, owner: string): string {
    const id = crypto.randomUUID();
    const channel: VoiceChannel = {
      id,
      name,
      owner,
      members: new Map(),
      createdAt: Date.now(),
      permissions: { defaultRole: "speaker" },
    };
    this.channels.set(id, channel);
    return id;
  }

  async joinChannel(channelId: string, userId: string, role: "listener" | "speaker" | "admin"): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) throw new Error("Channel not found");

    const member: ChannelMember = {
      userId,
      role,
      joinedAt: Date.now(),
      isSpeaking: false,
    };

    channel.members.set(userId, member);
    this.emit("member-joined", { channelId, userId, member });
  }

  async leaveChannel(channelId: string, userId: string): Promise<void> {
    const channel = this.channels.get(channelId);
    if (!channel) return;

    channel.members.delete(userId);
    this.emit("member-left", { channelId, userId });

    if (channel.members.size === 0) {
      this.channels.delete(channelId);
    }
  }

  getChannel(channelId: string): VoiceChannel | undefined {
    return this.channels.get(channelId);
  }

  listChannels(): VoiceChannel[] {
    return Array.from(this.channels.values());
  }
}
```

## Audio Mixing (The Hard Part)

**Problem:** You have audio from User A, B, C - need to send mixed audio to all three

**Solution options:**
1. **Naive:** Send A+B mix to C, A+C mix to B, B+C mix to A
2. **Broadcast:** Mix all → send same to everyone (simpler, works for real-time)
3. **Selective:** Each user receives what they should hear

**For voice channels, start with option 2:**
```typescript
// audio-mixer.ts
export class AudioMixer {
  private streams = new Map<string, AudioStream>();

  addStream(userId: string, stream: AudioStream): void {
    this.streams.set(userId, stream);
  }

  removeStream(userId: string): void {
    this.streams.delete(userId);
  }

  getMixedAudio(): Buffer {
    if (this.streams.size === 0) return Buffer.alloc(0);

    const streamArray = Array.from(this.streams.values());
    // TODO: Implement mixing algorithm
    // For now, placeholder - in real code use ffmpeg or audio library
    return streamArray[0]; // Temporary: just return first stream
  }
}
```

## WebSocket Handling

**Upgrade handler:**
```typescript
// From existing media-stream.ts pattern, adapt for channels

app.get("/api/voice/channel/:channelId", (req, res) => {
  const channelId = req.params.channelId;

  res.on("upgrade", (req, socket, head) => {
    broadcastHandler.handleUpgrade(channelId, req, socket, head);
  });
});

// broadcastHandler handles:
// 1. Accept WebSocket connection
// 2. Register user to channel
// 3. Stream mixed audio back
// 4. Handle disconnect/cleanup
```

## Session Keys for Channels

```typescript
// Use existing session key format:
const sessionKey = `agent:${agentId}:channel:${channelId}`;

// With optional role:
const sessionKeyWithRole = `agent:${agentId}:channel:${channelId}:${role}`;

// Example:
// "agent:main:channel:room-123" ← in a channel
// "agent:main:channel:room-123:speaker" ← speaker role
// "agent:main:channel:room-123:admin" ← admin role
```

## Development Checklist

### Phase 1: Setup (Day 1-2)
- [ ] Create `/extensions/voice-channels/` directory
- [ ] Set up package.json and tsconfig.json
- [ ] Create types.ts with interfaces
- [ ] Create manager.ts skeleton
- [ ] Create tests directory

### Phase 2: Core Manager (Day 3-5)
- [ ] Implement VoiceChannelManager
- [ ] Add create/join/leave methods
- [ ] Add persistence (save to disk)
- [ ] Write unit tests

### Phase 3: Audio Foundation (Day 6-8)
- [ ] Create AudioMixer skeleton
- [ ] Evaluate audio libraries (ffmpeg, audio-concat, etc.)
- [ ] Implement basic mixing
- [ ] Performance test

### Phase 4: WebSocket (Day 9-10)
- [ ] Create broadcast-handler.ts
- [ ] Implement WebSocket upgrade
- [ ] Handle messages
- [ ] Error handling

### Phase 5: Integration (Day 11-12)
- [ ] Connect to agent runtime
- [ ] Update session management
- [ ] Create CLI commands
- [ ] End-to-end testing

### Phase 6: Polish (Day 13+)
- [ ] Performance optimization
- [ ] Stress testing (N users)
- [ ] Documentation
- [ ] Security review

## Testing

### Local 2-User Test
```bash
# Terminal 1
npm run dev:voice-channels

# Terminal 2 (simulate user A)
wscat -c ws://localhost:3335/api/voice/channel/test-room

# Terminal 3 (simulate user B)
wscat -c ws://localhost:3335/api/voice/channel/test-room

# Send audio from both terminals, verify mixing
```

### Performance Benchmark
```bash
# Test with increasing users: 2, 4, 8, 16
npm run test:voice-channels:load

# Monitor:
# - Latency (microphone → speaker)
# - CPU usage per user
# - Memory per channel
```

## Debugging Tips

1. **Audio sync issues:**
   - Check timestamp alignment
   - Verify resampling logic
   - Test with identical sample rates first

2. **WebSocket connection drops:**
   - Add heartbeat/ping-pong
   - Implement reconnection logic
   - Track connection state per user

3. **Missing audio:**
   - Verify streams are being added to mixer
   - Check output format matches input
   - Confirm WebSocket buffer size

4. **Latency problems:**
   - Profile audio processing
   - Check network jitter
   - Verify buffer sizes

## Related Docs

- Full research: `RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md`
- Integration guide: `VOICE_CHANNELS_INTEGRATION_GUIDE.md`
- Voice call system: `extensions/voice-call/src/`
- TTS providers: `extensions/speech-plugins/src/interfaces/tts-provider.ts`

---

**Last Updated:** January 16, 2026
**Difficulty:** Medium-High
**Estimated Time:** 2 weeks for MVP, 4-6 weeks for full feature set
