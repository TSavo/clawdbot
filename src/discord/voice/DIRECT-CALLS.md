# Discord Direct Calls Implementation

## Overview

This implementation provides full support for **1-on-1 voice calls** between users and the Discord bot. Unlike voice channels (N-party broadcast), direct calls are bidirectional audio streams with a single user.

## Architecture

### Components

1. **DiscordDirectCallConnector** (`direct-call-connector.ts`)
   - Low-level voice connection management
   - Bidirectional audio streaming (capture + playback)
   - Opus encoding/decoding
   - Real-time STT integration (Deepgram WebSocket)
   - Call state tracking (idle, ringing, connected, ended)
   - Sub-100ms latency for transcription + TTS

2. **DiscordCallManager** (`call-manager.ts`)
   - High-level call lifecycle management
   - Tracks active calls by user ID
   - Supports up to 5 concurrent calls (configurable)
   - Call history and statistics
   - Auto-cleanup of stale calls
   - Graceful shutdown with cleanup

3. **DiscordCallResponder** (`call-responder.ts`)
   - Voice response generation during calls
   - TTS synthesis (Cartesia/ElevenLabs/Kokoro)
   - Long response chunking (sentence boundaries)
   - Response interruption handling
   - Optional text preview in DM chat

### Key Differences: Direct Calls vs Voice Channels

| Feature | Voice Channels | Direct Calls |
|---------|---------------|--------------|
| Participants | N users (mixer) | 1-on-1 bidirectional |
| Join Method | Command or message | Incoming call event |
| Audio Flow | Broadcast to all | Stream to/from single user |
| Response Mode | Voice (configurable) | Always voice (primary) |
| Use Case | Group conversations | Personal voice assistant |

## Features

- **Incoming Calls**: Auto-detect when user joins voice channel, accept/decline
- **Outgoing Calls**: Bot initiates call to user
- **Real-time Audio Streaming**:
  - Capture: Opus → PCM 16-bit → Deepgram WebSocket → Transcription
  - Playback: Response → TTS → Opus → User
- **Call State Management**: Ringing, connecting, connected, ended, declined, busy, timeout
- **Error Handling**: Busy signal, declined, timeout, connection failures
- **Statistics**: Bytes/packets sent/received, transcriptions, responses, duration
- **Concurrent Calls**: Support up to 5 simultaneous calls (configurable)
- **Call History**: Track completed calls with statistics

## Performance Targets

- **Latency**: < 100ms for transcription + TTS
- **Concurrent Calls**: 5+ simultaneous calls
- **Audio Quality**: 48kHz, stereo → mono conversion
- **Uptime**: Graceful cleanup, no memory leaks

## Usage

### Basic Setup

```typescript
import { setupDirectCallHandlers } from './discord/voice/direct-call-integration.example.js';
import { Client } from 'discord.js';

const client = new Client({
  intents: ['Guilds', 'GuildVoiceStates', 'GuildMessages'],
});

// Initialize direct call handlers
const callManager = await setupDirectCallHandlers(client, {
  autoAcceptCalls: true,
  maxConcurrentCalls: 5,
  voiceProviders: {
    enabled: true,
    defaultSttProviderId: 'deepgram',
    defaultTtsProviderId: 'cartesia',
  },
  generateAgentResponse: async (userId, input) => {
    // Your AI agent logic here
    return `You said: ${input}`;
  },
});

await client.login(process.env.DISCORD_BOT_TOKEN);
```

### Incoming Call Flow

1. User joins voice channel
2. Bot detects `voiceStateUpdate` event
3. Bot accepts call (auto or manual)
4. Voice connection established
5. Bot listens for user speech
6. User speech → Opus → PCM → Deepgram → Transcription
7. Transcription → Agent → Response text
8. Response text → TTS → Opus → User
9. Loop until call ends

### Outgoing Call Flow

```typescript
import { initiateOutgoingCall } from './discord/voice/direct-call-integration.example.js';

// Call a user
await initiateOutgoingCall(
  userId,
  voiceChannelId,
  callManager,
  config,
);
```

### Managing Calls

```typescript
// Check if user has active call
const hasCall = callManager.hasActiveCall(userId);

// Get call state
const state = callManager.getCallState(userId);

// Get call statistics
const stats = callManager.getCallStats(userId);

// End call
await callManager.endCall(userId);

// Get all active calls
const activeCalls = callManager.getActiveCalls();

// Get call history
const history = callManager.getCallHistory({
  userId: 'optional-filter',
  limit: 10,
  since: Date.now() - 86400000, // Last 24 hours
});
```

### Custom Response Generation

```typescript
const callManager = await setupDirectCallHandlers(client, {
  generateAgentResponse: async (userId, input) => {
    // Example: Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: input,
      }],
    });

    return response.content[0].text;
  },
});
```

## Configuration

### CallManagerConfig

```typescript
interface CallManagerConfig {
  maxConcurrentCalls?: number;      // Default: 5
  autoAcceptCalls?: boolean;        // Default: false
  callTimeout?: number;             // Default: 30000ms (30s)
  maxCallDuration?: number;         // Default: 3600000ms (1 hour)
  cleanupInterval?: number;         // Default: 60000ms (1 minute)
  historyRetention?: number;        // Default: 86400000ms (24 hours)
}
```

### CallResponseConfig

```typescript
interface CallResponseConfig {
  providersConfig?: VoiceProvidersConfig;
  maxChunkLength?: number;          // Default: 500 chars
  allowInterruption?: boolean;      // Default: true
  voiceId?: string;                 // Provider-specific
  responseTimeout?: number;         // Default: 30000ms (30s)
  sendTextPreview?: boolean;        // Default: false
}
```

## Integration with Response Mode System

Direct calls **always respond with voice** as the primary modality:

- **Voice**: Primary response (audio streaming)
- **Text Preview**: Optional (DM chat preview, disabled by default)
- **Response Mode Config**: Only affects text preview behavior, not audio

This differs from voice channels, where response mode can be `voice`, `text`, or `both`.

## Error Handling

### Call States

- `idle`: No active call
- `ringing`: Incoming/outgoing call not yet accepted
- `connecting`: Establishing voice connection
- `connected`: Active call in progress
- `ended`: Call ended normally
- `declined`: User/bot declined call
- `busy`: User already in another call
- `failed`: Connection/technical failure
- `timeout`: Call acceptance timeout (default: 30s)

### Error Scenarios

1. **Connection Failures**: Voice connection fails → state = `failed`, cleanup
2. **Call Timeout**: No answer within 30s → state = `timeout`, cleanup
3. **Max Concurrent Calls**: New call exceeds limit → throw error
4. **STT Failure**: Transcription fails → log error, continue call
5. **TTS Failure**: Synthesis fails → log error, skip response
6. **User Disconnects**: Voice state update → auto-end call

## Testing

### Manual Testing

1. Start bot with direct call handlers
2. Join a voice channel as a user
3. Bot should auto-accept (if enabled)
4. Speak into microphone
5. Bot should transcribe and respond with voice
6. Leave voice channel to end call

### Programmatic Testing

```typescript
// Test incoming call
const connector = await callManager.acceptCall({
  userId: 'test-user-id',
  channelId: 'test-channel-id',
  adapterCreator: mockAdapterCreator,
});

// Test transcription callback
connector.onTranscription((transcription) => {
  console.log('Transcribed:', transcription.text);
});

// Test response generation
connector.onResponseRequest(async (text) => {
  return `You said: ${text}`;
});

// Test call end
await callManager.endCall('test-user-id');
```

## Performance Considerations

### Latency Optimization

- Use `nova-2` model for Deepgram (fastest)
- Use `sonic-turbo` for Cartesia TTS (low latency)
- Batch audio packets (5 packets = ~100ms)
- Stream responses in chunks for long replies

### Memory Management

- Auto-cleanup of stale calls (1 minute interval)
- Call history retention (24 hours default)
- Proper cleanup on call end/disconnect
- No memory leaks from unclosed streams

### Concurrent Call Limits

- Default: 5 concurrent calls
- Each call uses: ~100KB memory, 1 WebSocket, 1 voice connection
- Increase limit based on server resources

## Roadmap

### Not Yet Implemented

- [ ] Slash commands for direct calls (e.g., `/call @user`)
- [ ] Call forwarding/transfer
- [ ] Conference calls (3+ participants)
- [ ] Call recording
- [ ] Voicemail system
- [ ] Call scheduling

### Future Enhancements

- [ ] Adaptive bitrate based on connection quality
- [ ] Echo cancellation for feedback loops
- [ ] Noise suppression for background noise
- [ ] Voice activity detection (VAD) improvements
- [ ] Multiple TTS voice selection per user
- [ ] Per-user call preferences

## Dependencies

- `@discordjs/voice`: Voice connection management
- `@discordjs/opus`: Opus encoding/decoding
- `discord.js`: Discord client library
- Deepgram: Real-time STT
- Cartesia/ElevenLabs/Kokoro: TTS synthesis

## Related Files

- Voice channels: `/src/discord/voice/channel-connector.ts`
- Voice messages: `/src/discord/voice/integration.ts`
- Response handler: `/src/discord/voice/response-handler.ts`
- Voice providers: `/src/media/voice-providers/`
- Audio codecs: `/src/media/codecs/`

## Support

For questions or issues with direct calls:

1. Check logs for error messages
2. Verify Deepgram API key is set
3. Ensure voice intents are enabled
4. Test with a single call first
5. Check Discord API rate limits

## License

Same as parent project (Clawdbot).
