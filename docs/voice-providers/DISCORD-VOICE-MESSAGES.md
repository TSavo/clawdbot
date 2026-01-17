# Discord Voice Messages

Discord voice message support enables Clawdbot to receive audio messages and respond with voice, text, or both.

## Overview

Clawdbot can now:
- **Receive** audio messages sent by Discord users (MP3, WAV, OGG, FLAC)
- **Process** audio attachments with automatic transcription
- **Respond** with voice messages, text messages, or both (configurable)
- **Configure** response types per-guild, per-channel, or per-user

This feature complements the existing Discord voice channel support, giving users multiple ways to interact with Clawdbot using voice.

## Features

### Audio Message Detection
- Automatically detects audio attachments in Discord messages
- Supports MP3, WAV, OGG, and FLAC formats
- Validates audio size (max 25MB per Discord limits)
- Works in text channels, threads, and DMs

### Configurable Response Types
Configure how Clawdbot responds to voice messages:
- **voice**: Always respond with audio (TTS synthesis)
- **text**: Always respond with text (default)
- **both**: Send both text and audio responses
- **match**: Match the user's input modality (future feature)

### Flexible Configuration
Response types can be configured at multiple levels:
1. **Global default**: Base response type for all voice messages
2. **Per-guild override**: Custom response type for specific Discord servers
3. **Per-channel override**: Custom response type for specific channels
4. **Per-user override**: Custom response type for specific users (highest priority)

### Audio Quality Settings
Three quality presets for voice responses:
- **high**: 128kbps (larger files, best quality)
- **medium**: 64kbps (default, balanced)
- **low**: 32kbps (smaller files, lower quality)

## Configuration

### Basic Setup

Add voice message configuration to your `.clawdbot.json5`:

```json5
{
  channels: {
    discord: {
      accounts: {
        main: {
          token: "your-discord-bot-token",

          // Voice message configuration
          voice: {
            enabled: true,
            messageResponse: "text", // Default: text responses
            voiceFormat: "mp3",
            audioQuality: "medium",
            ttsProvider: "cartesia",
            maxAudioSizeMb: 24
          }
        }
      }
    }
  }
}
```

### Per-Guild Configuration

Configure different response types for different servers:

```json5
{
  channels: {
    discord: {
      voice: {
        messageResponse: "text", // Global default

        perGuildOverride: {
          "123456789": "voice",  // Always voice in this guild
          "987654321": "both"    // Both text and voice in this guild
        }
      }
    }
  }
}
```

### Per-Channel Configuration

Fine-tune response types per channel:

```json5
{
  channels: {
    discord: {
      voice: {
        messageResponse: "text",

        perChannelOverride: {
          "555555555": "voice",  // Voice in #voice-chat channel
          "666666666": "text",   // Text in #general channel
          "777777777": "both"    // Both in #announcements
        }
      }
    }
  }
}
```

### Per-User Configuration

Customize responses for specific users:

```json5
{
  channels: {
    discord: {
      voice: {
        messageResponse: "text",

        perUserOverride: {
          "111111111": "voice",  // User prefers voice
          "222222222": "both"    // User wants both formats
        }
      }
    }
  }
}
```

## Priority Order

Configuration priority (highest to lowest):
1. **User override** (perUserOverride)
2. **Channel override** (perChannelOverride)
3. **Guild override** (perGuildOverride)
4. **Global default** (messageResponse)

Example:
```json5
{
  messageResponse: "text",           // 4. Global default
  perGuildOverride: {
    "guild1": "voice"                 // 3. Guild override
  },
  perChannelOverride: {
    "channel1": "both"                // 2. Channel override
  },
  perUserOverride: {
    "user1": "text"                   // 1. User override (wins!)
  }
}
```

For `user1` in `channel1` within `guild1`, the response will be **text** (user override wins).

## Usage Examples

### Basic Voice Message Flow

1. **User sends audio message** in Discord
2. **Clawdbot detects** the audio attachment
3. **Downloads and validates** the audio file
4. **Transcribes** the audio (using configured STT provider)
5. **Processes** through agent
6. **Synthesizes response** (if voice/both mode)
7. **Sends response** to Discord

### Text Response (Default)

```
User: [sends voice message: "What's the weather?"]
Bot: "The current weather is sunny, 72°F with clear skies."
```

### Voice Response

```
User: [sends voice message: "What's the weather?"]
Bot: [sends voice message: "The current weather is sunny, 72°F..."]
```

### Both Responses

```
User: [sends voice message: "What's the weather?"]
Bot: "The current weather is sunny, 72°F with clear skies."
Bot: 🔊 Voice version [sends voice message]
```

## Audio Formats

### Supported Input Formats
- **MP3** (audio/mpeg, audio/mp3)
- **WAV** (audio/wav, audio/wave)
- **OGG** (audio/ogg, audio/vorbis)
- **FLAC** (audio/flac, audio/x-flac)

### Supported Output Formats
- **MP3** (recommended, smaller files)
- **OGG** (alternative, good compression)

## TTS Providers

Clawdbot uses the same TTS providers as voice channels:
- **Cartesia** (default, ultra-fast, 40-90ms latency)
- **ElevenLabs** (high quality, natural voices)
- **Kokoro** (future support)

Configure the provider in your voice settings:

```json5
{
  voice: {
    ttsProvider: "cartesia",
    voiceId: "your-voice-id"  // Optional, provider-specific
  }
}
```

## Size Limits

Discord enforces a **25MB file size limit** for attachments. Clawdbot defaults to 24MB to leave headroom.

Estimated file sizes:
- **Low quality** (32kbps): ~240KB per minute
- **Medium quality** (64kbps): ~480KB per minute
- **High quality** (128kbps): ~960KB per minute

Examples:
- 5 minutes at medium quality: ~2.4MB ✅
- 30 minutes at high quality: ~28.8MB ❌ (too large)
- 30 minutes at low quality: ~7.2MB ✅

If a response would exceed the size limit, Clawdbot automatically falls back to text.

## Threading and Replies

Voice messages support Discord's reply system:
- Responses are sent as **replies** to the original voice message
- Maintains conversation context in busy channels
- Works in threads and DMs

## Error Handling

Clawdbot gracefully handles errors:
1. **Invalid audio format**: Logs error, ignores message
2. **Download failure**: Logs error, notifies user via text
3. **TTS synthesis failure**: Falls back to text response
4. **File too large**: Sends text response with note

Example fallback:
```
Bot: "The current weather is sunny, 72°F with clear skies.

     (Voice response failed, sent as text)"
```

## Performance

### Audio Download
- Parallel downloads from Discord CDN
- No authentication required (bot has access)
- Typical download time: 50-200ms for 1-5MB files

### TTS Synthesis
- **Cartesia Sonic Turbo**: 40ms first chunk latency
- **Cartesia Sonic 3**: 90ms first chunk latency
- **ElevenLabs**: 200-500ms latency

### Total Response Time
- Text response: ~500-1000ms
- Voice response: ~800-1500ms (including synthesis)
- Both responses: ~1000-2000ms (sequential)

## Monitoring and Logging

Voice message operations are logged for debugging:

```
[discord-voice-messages] Downloading audio attachment
[discord-voice-messages] Audio attachment downloaded successfully
[discord-voice-messages] Handling voice message response
[discord-voice-messages] Text message sent successfully
[discord-voice-messages] Voice message sent successfully
```

Enable verbose logging:
```bash
CLAWDBOT_LOG_LEVEL=debug clawdbot start
```

## Integration with Voice Channels

Voice messages complement voice channel support:

| Feature | Voice Messages | Voice Channels |
|---------|---------------|----------------|
| **Interaction** | Asynchronous | Real-time |
| **Format** | Audio attachments | Live audio stream |
| **Location** | Text channels, DMs | Voice channels |
| **Latency** | ~1-2 seconds | <500ms |
| **Use Case** | Quick audio notes | Live conversation |

Users can choose the interface that best fits their needs.

## Security and Privacy

- Audio files are **not stored** permanently (processed in memory)
- Transcriptions follow the same privacy policies as text messages
- Audio responses are generated on-demand (not pre-recorded)
- User configuration respects Discord's privacy settings

## Troubleshooting

### Voice messages not detected
1. Verify audio format is supported (MP3, WAV, OGG, FLAC)
2. Check file size is under 25MB
3. Ensure bot has `READ_MESSAGE_HISTORY` permission

### Voice responses not working
1. Verify TTS provider API key is configured
2. Check `voice.enabled` is `true` in config
3. Verify `messageResponse` is set to `"voice"` or `"both"`
4. Check logs for TTS synthesis errors

### Responses too large
1. Reduce audio quality: `"audioQuality": "low"`
2. Split long responses into multiple messages
3. Use text responses for very long content

### Permission errors
Required Discord bot permissions:
- `VIEW_CHANNEL`
- `SEND_MESSAGES`
- `ATTACH_FILES`
- `READ_MESSAGE_HISTORY`

## API Reference

### Configuration Types

```typescript
interface DiscordVoiceConfig {
  // Global default response type
  messageResponse: 'voice' | 'text' | 'both';

  // Per-guild overrides
  perGuildOverride?: Record<string, VoiceResponseType>;

  // Per-channel overrides
  perChannelOverride?: Record<string, VoiceResponseType>;

  // Per-user overrides
  perUserOverride?: Record<string, VoiceResponseType>;

  // Audio format (mp3 or ogg)
  voiceFormat: 'mp3' | 'ogg';

  // Quality preset
  audioQuality: 'high' | 'medium' | 'low';

  // TTS provider
  ttsProvider?: 'cartesia' | 'elevenlabs' | 'kokoro';

  // Voice ID for TTS
  voiceId?: string;

  // Max audio size in MB
  maxAudioSizeMb?: number;

  // Enable/disable feature
  enabled?: boolean;
}
```

### Audio Message Metadata

```typescript
interface AudioMessageMetadata {
  duration?: number;
  userId: string;
  userName: string;
  channelId: string;
  channelName?: string;
  guildId?: string;
  guildName?: string;
  messageId: string;
  threadId?: string;
  replyToMessageId?: string;
  timestamp: Date;
  fileSizeBytes: number;
  filename: string;
  contentType: string;
}
```

## Best Practices

1. **Start with text responses** (default) and enable voice selectively
2. **Use medium quality** for balanced file size and quality
3. **Configure per-channel** to match channel purpose (e.g., voice in #voice-chat)
4. **Monitor file sizes** for long-form content
5. **Test with real audio messages** before deploying to production

## Future Enhancements

Planned features:
- [ ] **Match mode**: Automatically match user's input modality
- [ ] **Custom voice profiles**: Per-user voice customization
- [ ] **Audio effects**: Echo, reverb, pitch shifting
- [ ] **Multi-language support**: Auto-detect language, respond in same language
- [ ] **Voice cloning**: Clone user's voice for responses (with permission)

## Related Documentation

- [Discord Voice Channels](./DISCORD-VOICE-CHANNELS.md)
- [Cartesia TTS Provider](../../media/voice-providers/cartesia.md)
- [Opus Codec](../../media/codecs/opus.md)
- [Discord Configuration](../configuration.md)

## Support

For issues or questions:
- GitHub Issues: https://github.com/clawdbot/clawdbot/issues
- Discord: https://discord.gg/clawdbot
- Email: support@clawd.bot
