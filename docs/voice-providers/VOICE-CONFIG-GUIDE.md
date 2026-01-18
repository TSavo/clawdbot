# Voice Configuration Guide

Comprehensive guide for configuring voice response modality in Clawdbot's Discord integration.

## Overview

Clawdbot supports flexible voice message configuration, allowing users to control how the bot responds to their messages across different contexts (global, server, channel, and personal).

## Voice Response Modes

### Available Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `match` | Respond in the same modality as user input | Natural UX - voice→voice, text→text (default) |
| `voice` | Always respond with voice messages | Voice-first channels or accessibility |
| `text` | Always respond with text messages | Text-only channels or archival |
| `both` | Respond with both voice and text | Maximum accessibility |

### Mode Emojis

- 🎤 `voice` - Voice-only responses
- 📝 `text` - Text-only responses
- 🎤📝 `both` - Dual-mode responses
- 🔄 `match` - Dynamic matching (default)

## Configuration Levels

Configuration priority (highest to lowest):

```
User > Channel > Server (Guild) > Global
```

### Level Descriptions

1. **User (Personal)** - Personal preferences, applies everywhere
2. **Channel** - Channel-specific settings
3. **Server (Guild)** - Server-wide defaults
4. **Global** - System-wide default (fallback)

## Slash Commands

### `/voice-config-get`

Show current voice configuration for your context.

```
/voice-config-get
```

**Output:**
- Current setting for this context
- Global default
- Server override (if in a guild)
- Channel override (if exists)
- Personal setting (if set)

**Permissions:** None (anyone can view)

### `/voice-config-set`

Set voice response mode.

```
/voice-config-set mode:<mode> [level:<level>]
```

**Parameters:**
- `mode` (required): `voice`, `text`, `both`, or `match`
- `level` (optional): `user` (default), `channel`, `guild`, or `global`

**Examples:**
```
/voice-config-set mode:voice
/voice-config-set mode:match level:channel
/voice-config-set mode:text level:guild
```

**Permissions:**
- `user` level: Anyone
- `channel`, `guild`, `global` levels: Administrator permission required

### `/voice-config-reset`

Reset voice configuration to defaults.

```
/voice-config-reset [level:<level>]
```

**Parameters:**
- `level` (optional): `user` (default), `channel`, `guild`, or `global`

**Examples:**
```
/voice-config-reset
/voice-config-reset level:channel
```

**Behavior:**
- `global`: Resets to `match`
- Other levels: Removes override, falls back to parent level

**Permissions:** Same as `/voice-config-set`

### `/voice-config-status`

Show all active voice configurations across all levels.

```
/voice-config-status
```

**Output:**
- Global default
- All server overrides
- All channel overrides
- All user overrides (up to 10, with count)

**Permissions:** None

### `/voice-config-dashboard`

Open interactive button-based configuration dashboard.

```
/voice-config-dashboard
```

**Features:**
- Visual mode selection with buttons
- Level switching (Personal/Channel/Server/Global)
- Real-time configuration updates
- Current and effective mode display

**Permissions:** None to open, admin required for server/channel changes

### `/voice-config-stats`

Show voice configuration statistics.

```
/voice-config-stats
```

**Output:**
- Total servers, channels, users with overrides
- Mode distribution across all configs
- Most popular mode

**Permissions:** None

## Interactive Dashboard

The dashboard provides a user-friendly visual interface for configuration.

### Features

1. **Level Selection** - Switch between Personal/Channel/Server/Global views
2. **Mode Selection** - Visual buttons for each mode
3. **Active Indicators** - Primary button style for active mode
4. **Live Updates** - Changes apply immediately

### Button Layout

```
Row 1: [👤 Personal] [💬 Channel] [🏰 Server] [🌍 Global]
Row 2: [🔄 match]   [🎤 voice]
Row 3: [📝 text]     [🎤📝 both]
```

### Using the Dashboard

1. Run `/voice-config-dashboard`
2. Select configuration level (defaults to Personal)
3. Click desired mode button
4. Configuration updates instantly
5. Dashboard reflects new state

## Configuration Storage

Voice configuration is persisted in Clawdbot's config file:

```json5
{
  "channels": {
    "discord": {
      "voice": {
        "messageResponse": "match",          // Global default
        "perGuildOverride": {
          "guild-id-1": "voice",
          "guild-id-2": "text"
        },
        "perChannelOverride": {
          "channel-id-1": "both",
          "channel-id-2": "match"
        },
        "perUserOverride": {
          "user-id-1": "voice",
          "user-id-2": "text"
        },
        "voiceFormat": "mp3",
        "audioQuality": "medium",
        "enabled": true
      }
    }
  }
}
```

### Configuration Path

- Linux/macOS: `~/.clawdbot/config.json5`
- Windows: `%USERPROFILE%\.clawdbot\config.json5`

## Permission Matrix

| Command | User Level | Channel Level | Guild Level | Global Level |
|---------|-----------|---------------|-------------|--------------|
| `/voice-config-get` | ✅ Anyone | ✅ Anyone | ✅ Anyone | ✅ Anyone |
| `/voice-config-set` | ✅ Anyone | 🔒 Admin | 🔒 Admin | 🔒 Admin |
| `/voice-config-reset` | ✅ Anyone | 🔒 Admin | 🔒 Admin | 🔒 Admin |
| `/voice-config-status` | ✅ Anyone | ✅ Anyone | ✅ Anyone | ✅ Anyone |
| `/voice-config-dashboard` | ✅ Anyone (view) | 🔒 Admin (modify) | 🔒 Admin (modify) | 🔒 Admin (modify) |
| `/voice-config-stats` | ✅ Anyone | ✅ Anyone | ✅ Anyone | ✅ Anyone |

Legend:
- ✅ Anyone - All users can execute
- 🔒 Admin - Requires Discord Administrator permission

## Common Scenarios

### Scenario 1: Voice-Only Channel

Create a dedicated voice channel where all responses are voice:

```
1. Go to your voice channel
2. Run: /voice-config-set mode:voice level:channel
3. All responses in this channel will now be voice
```

### Scenario 2: Personal Text Preference

Set your personal preference to always receive text:

```
1. Run: /voice-config-set mode:text level:user
2. You'll receive text responses everywhere
```

### Scenario 3: Server-Wide Match Mode

Set server default to match user input:

```
1. Run: /voice-config-set mode:match level:guild
2. Server will default to matching user modality
```

### Scenario 4: Accessibility - Both Modes

Ensure accessibility by providing both:

```
1. Run: /voice-config-set mode:both level:channel
2. All responses include voice + text transcript
```

### Scenario 5: Reset Personal Settings

Remove your personal override and use server defaults:

```
1. Run: /voice-config-reset level:user
2. Your settings now fall back to channel/server/global
```

## Troubleshooting

### Configuration Not Applying

1. Check configuration priority - user overrides take precedence
2. Verify permissions for server/channel changes
3. Run `/voice-config-get` to see effective configuration
4. Check config file syntax if manually edited

### Permission Errors

```
❌ You need Administrator permission to change server or channel settings.
```

**Solution:** Only users with Discord Administrator permission can modify server/channel settings. Personal settings don't require special permissions.

### Dashboard Not Updating

1. Close and reopen dashboard with `/voice-config-dashboard`
2. Verify configuration persisted with `/voice-config-get`
3. Check console for errors

### Voice Messages Not Working

1. Verify voice messages are enabled: check `enabled: true` in config
2. Check TTS provider configuration (`ttsProvider`, `voiceId`)
3. Verify audio quality settings (`audioQuality`, `voiceFormat`)
4. Check Discord file size limits (25MB max)

## Advanced Configuration

### Manual Config Editing

You can manually edit the config file for bulk changes:

```json5
{
  "channels": {
    "discord": {
      "voice": {
        "messageResponse": "match",
        // Bulk add guild overrides
        "perGuildOverride": {
          "guild-1": "voice",
          "guild-2": "voice",
          "guild-3": "text"
        }
      }
    }
  }
}
```

**Important:** Restart Clawdbot after manual edits.

### Programmatic Access

Developers can use the configuration API:

```typescript
import {
  getVoiceResponseType,
  setVoiceResponseType,
  resetVoiceConfig,
  getActiveVoiceConfigs
} from '@clawdbot/discord/voice';

// Get effective mode for context
const mode = getVoiceResponseType(config, {
  guildId: 'guild-123',
  channelId: 'channel-456',
  userId: 'user-789'
});

// Set channel override
setVoiceResponseType(config, 'channel', 'voice', {
  channelId: 'channel-456'
});
```

## Best Practices

1. **Start with defaults** - Use `match` globally, override as needed
2. **User preferences** - Respect user-level overrides for accessibility
3. **Channel context** - Set voice channels to `voice` mode
4. **Documentation** - Pin channel topic explaining voice mode
5. **Statistics** - Monitor `/voice-config-stats` for usage patterns

## Integration with Other Features

### Voice Channels

When users send voice messages in Discord voice channels:

```javascript
// Automatically detected as voice input
inputModality = 'voice-channel'

// With mode: 'match'
responseType = 'voice'  // Responds with voice
```

### Transcription

Text responses can include transcription metadata:

```typescript
// mode: 'both'
{
  voice: Buffer,        // Audio file
  text: "Transcription" // Text content
}
```

## API Reference

See implementation files:

- **Core Types**: `/src/discord/voice/config.ts`
- **Storage Layer**: `/src/discord/voice/config-store.ts`
- **Slash Commands**: `/src/discord/voice/config-commands.ts`
- **Dashboard UI**: `/src/discord/voice/config-dashboard.ts`

## Examples

### Example 1: Gaming Server Setup

```bash
# Voice channel - always voice
/voice-config-set mode:voice level:channel

# Text channels - always text
/voice-config-set mode:text level:channel

# DMs - match user preference
/voice-config-set mode:match level:user
```

### Example 2: Accessibility Server

```bash
# Server-wide: provide both
/voice-config-set mode:both level:guild

# Users can override to their preference
/voice-config-set mode:text level:user
```

### Example 3: Corporate Server

```bash
# Default to text for archival
/voice-config-set mode:text level:guild

# Voice channels use voice
/voice-config-set mode:voice level:channel
```

## Support

For issues or questions:

- GitHub Issues: https://github.com/clawdbot/clawdbot/issues
- Documentation: https://docs.clawd.bot
- Discord: Join our community server

---

**Version:** 2026.1.16
**Last Updated:** January 16, 2026
