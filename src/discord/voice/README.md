# Discord Voice Messages

Discord voice message support for Clawdbot. Enables receiving audio attachments and responding with voice, text, or both.

## Quick Start

### 1. Enable Voice Messages

Add to your `.clawdbot.json5`:

```json5
{
  channels: {
    discord: {
      accounts: {
        main: {
          token: "your-discord-bot-token",
          voice: {
            enabled: true,
            messageResponse: "text", // or "voice" or "both" or "match"
            voiceFormat: "mp3",
            audioQuality: "medium"
          }
        }
      }
    }
  }
}
```

### 2. Configure TTS Provider

Set your Cartesia API key:

```bash
export CARTESIA_API_KEY="your-api-key"
```

### 3. Test It

Send an audio message to your bot in Discord. The bot will:
1. Detect the audio attachment
2. Download and validate it
3. Transcribe the audio
4. Process through agent
5. Respond based on your configuration

## Files

- **config.ts**: Configuration types and validation
- **message-handler.ts**: Audio attachment detection and download
- **response-handler.ts**: TTS synthesis and voice message sending
- **index.ts**: Public API exports

## Response Types

- `text`: Always respond with text (default)
- `voice`: Always respond with voice messages
- `both`: Send both text and voice responses
- `match`: Match the user's input modality (voice → voice, text → text)

## Configuration Priority

1. User override (highest)
2. Channel override
3. Guild override
4. Global default (lowest)

## Supported Formats

### Input
- MP3 (audio/mpeg)
- WAV (audio/wav)
- OGG (audio/ogg)
- FLAC (audio/flac)

### Output
- MP3 (recommended)
- OGG (alternative)

## Audio Quality

- **high**: 128kbps (~960KB/min)
- **medium**: 64kbps (~480KB/min) - default
- **low**: 32kbps (~240KB/min)

## Examples

### Example 1: Text Response (Default)

```json5
{
  voice: {
    messageResponse: "text"
  }
}
```

User sends voice message → Bot responds with text

### Example 2: Voice Response

```json5
{
  voice: {
    messageResponse: "voice"
  }
}
```

User sends voice message → Bot responds with voice message

### Example 3: Both Responses

```json5
{
  voice: {
    messageResponse: "both"
  }
}
```

User sends voice message → Bot responds with both text and voice

### Example 4: Match Mode

```json5
{
  voice: {
    messageResponse: "match"
  }
}
```

- User sends voice → Bot responds with voice
- User sends text → Bot responds with text

### Example 5: Per-Channel Configuration

```json5
{
  voice: {
    messageResponse: "text",
    perChannelOverride: {
      "123456789": "voice",  // Voice in #voice-chat
      "987654321": "both"    // Both in #support
    }
  }
}
```

## Architecture

```
Discord Message
    ↓
hasAudioAttachment()
    ↓
downloadAudioAttachment()
    ↓
extractAudioMetadata()
    ↓
[Agent Processing]
    ↓
handleVoiceMessageResponse()
    ↓
resolveVoiceResponseType()
    ↓
synthesizeTextToSpeech()
    ↓
convertToMP3() or convertToOGG()
    ↓
sendVoiceMessage() or sendTextMessage()
```

## Testing

Run tests:

```bash
pnpm test src/discord/voice
```

Coverage:
- Config: 18 tests
- Message Handler: 23 tests
- Response Handler: 9 tests

Total: 50 tests, all passing ✅

## Documentation

See [DISCORD-VOICE-MESSAGES.md](../../../docs/voice-providers/DISCORD-VOICE-MESSAGES.md) for full documentation.

## Integration

This module integrates with:
- **Cartesia TTS**: `src/media/voice-providers/cartesia.ts`
- **Opus Codec**: `src/media/codecs/opus.ts`
- **Discord Monitor**: `src/discord/monitor/message-handler.ts`

## Error Handling

All operations include comprehensive error handling:
- Invalid formats are logged and ignored
- Download failures trigger text fallback
- TTS failures send text with error note
- Files too large automatically use text

## Performance

- Audio download: 50-200ms (1-5MB files)
- TTS synthesis: 40-500ms (provider dependent)
- Total response: ~800-2000ms

## Future Enhancements

- [ ] Voice cloning from user samples
- [ ] Multi-language auto-detection
- [ ] Audio effects (reverb, pitch)
- [ ] Custom voice profiles per user
- [ ] Streaming TTS for long responses

## Related

- [Discord Voice Channels](../../voice/channels/)
- [Cartesia Provider](../../media/voice-providers/cartesia.ts)
- [Opus Codec](../../media/codecs/opus.ts)

## Voice Configuration UI (Team 11)

### Slash Commands

Configure voice response modality via Discord slash commands:

```
/voice-config-get                    # Show current settings
/voice-config-set mode:voice         # Set personal to voice
/voice-config-set mode:match level:channel  # Channel-level match
/voice-config-reset level:user       # Reset personal settings
/voice-config-status                 # Show all configurations
/voice-config-dashboard              # Open interactive UI
/voice-config-stats                  # Show statistics
```

### Interactive Dashboard

Visual button-based configuration:

```
┌─────────────────────────────────────────┐
│ 🎤 Voice Configuration Dashboard        │
├─────────────────────────────────────────┤
│ Current Mode (Personal): 🔄 match       │
│ Effective Mode: 🎤 voice                │
│                                          │
│ [👤 Personal] [💬 Channel] [🏰 Server] │
│ [🔄 match]   [🎤 voice]                 │
│ [📝 text]    [🎤📝 both]                │
└─────────────────────────────────────────┘
```

### Programmatic Configuration

```typescript
import { setVoiceResponseType } from './discord/voice/config-store';

setVoiceResponseType(config, 'channel', 'voice', {
  channelId: 'channel-123'
});
```

### Additional Documentation

- **User Guide:** `/docs/voice-providers/VOICE-CONFIG-GUIDE.md`
- **Implementation Plan:** `/src/discord/voice/IMPLEMENTATION-PLAN.md`
- **Integration Examples:** `/src/discord/voice/config-integration.ts`

