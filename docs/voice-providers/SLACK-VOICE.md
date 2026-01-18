# Slack Voice Integration

Enable voice messaging and voice bot responses in Slack without requiring real-time transcription.

## Overview

The Slack voice integration allows Clawdbot to:

1. Receive voice messages from Slack users (as file uploads)
2. Respond with synthesized voice audio
3. Support threaded voice conversations
4. Handle multiple audio formats (MP3, WAV, OGG, M4A, etc.)

## Architecture

```
User sends voice message (audio file)
    ↓
Slack uploads as file (file_shared event)
    ↓
Message handler detects audio file
    ↓
Download from Slack API
    ↓
Optional transcription (configurable)
    ↓
Agent processes context
    ↓
Generate text response
    ↓
TTS synthesizes response
    ↓
Convert to MP3
    ↓
Upload to Slack
    ↓
User receives voice response
```

## Setup

### Prerequisites

1. Slack bot with appropriate permissions:
   - `files:read` - Read file information
   - `files:write` - Upload voice responses
   - `channels:history` - Read channel messages
   - `chat:write` - Send messages

2. TTS provider configured (one of):
   - Kokoro (local, fast)
   - Cartesia (cloud, high-quality)
   - ElevenLabs (cloud, premium)

3. FFmpeg installed for audio conversion:
   ```bash
   # macOS
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt-get install ffmpeg

   # Windows
   choco install ffmpeg
   ```

### Configuration

Configure voice providers first:

```bash
clawdbot configure voice
```

Choose your preferred TTS provider (Kokoro recommended for local use).

## Usage

### Enable Voice in Slack Bot

```typescript
import {
  SlackVoiceMessageHandler,
  SlackVoiceResponseHandler,
  registerSlackVoiceEvents,
} from './slack/voice/index.js';

// Initialize handlers
const messageHandler = new SlackVoiceMessageHandler(
  slackClient,
  runtime,
  {
    maxFileSizeBytes: 50 * 1024 * 1024, // 50MB
    enableTranscription: false, // Optional
  }
);

const responseHandler = new SlackVoiceResponseHandler(
  slackClient,
  runtime,
  {
    defaultVoice: 'en_us',
    defaultSpeed: 1.0,
    targetSampleRate: 24000,
    targetBitrate: 64,
    includeTranscriptByDefault: true,
  }
);

// Register event handlers
registerSlackVoiceEvents({
  ctx: slackContext,
  handlers: {
    messageHandler,
    responseHandler,
    onVoiceMessage: async (fileId, channelId, userId) => {
      // Handle incoming voice message
      const fileInfo = await slackClient.files.info({ file: fileId });
      const voiceFile = {
        id: fileInfo.file.id,
        name: fileInfo.file.name,
        mimetype: fileInfo.file.mimetype,
        size: fileInfo.file.size,
        url_private: fileInfo.file.url_private,
        timestamp: fileInfo.file.timestamp,
      };

      // Download and process
      const context = await messageHandler.downloadAudioFile(
        voiceFile,
        channelId
      );

      // Generate agent response
      const agentResponse = await processVoiceMessage(context);

      // Send voice response
      await responseHandler.sendVoiceResponse({
        channelId,
        text: agentResponse,
        includeTranscript: true,
      });

      // Cleanup
      await messageHandler.cleanup(context);
    },
  },
});
```

### Sending Voice Messages to Clawdbot

1. In Slack, click the "+" button in the message input
2. Select "Upload a file"
3. Choose an audio file (MP3, WAV, OGG, M4A, etc.)
4. Upload to a channel where Clawdbot is active

Clawdbot will:
- Detect the audio file
- Download and process it
- Optionally transcribe (if enabled)
- Generate a response
- Reply with synthesized voice audio

### Threaded Voice Conversations

Voice responses automatically support threading:

```typescript
await responseHandler.sendVoiceResponse({
  channelId: 'C123456',
  threadTs: '1234567890.123456', // Reply in thread
  text: 'Here is my response',
  includeTranscript: true,
});
```

## Supported Audio Formats

### Input (receiving voice messages):
- MP3 (audio/mpeg)
- WAV (audio/wav, audio/wave)
- OGG (audio/ogg, audio/opus)
- M4A (audio/m4a, audio/aac)
- WebM (audio/webm)

### Output (sending voice responses):
- MP3 (24kHz, mono, 64kbps by default)
- Configurable sample rate and bitrate

## Configuration Options

### Message Handler Options

```typescript
interface VoiceMessageHandlerOptions {
  maxFileSizeBytes?: number;        // Default: 50MB
  supportedFormats?: string[];      // Audio mimetypes
  tempDir?: string;                 // Temp storage location
  enableTranscription?: boolean;    // Default: false
}
```

### Response Handler Options

```typescript
interface VoiceResponseConfig {
  defaultVoice?: string;              // Default: 'en_us'
  defaultSpeed?: number;              // Default: 1.0
  targetFormat?: AudioFormat;         // Default: MP3
  targetSampleRate?: number;          // Default: 24000
  targetBitrate?: number;             // Default: 64 kbps
  includeTranscriptByDefault?: boolean; // Default: true
  tempDir?: string;                   // Temp storage
}
```

## Performance

### Latency
- Voice download: 1-3 seconds (depends on file size)
- TTS synthesis: 0.5-2 seconds (depends on provider)
- MP3 conversion: 0.1-0.5 seconds
- Upload to Slack: 1-2 seconds
- **Total**: 3-8 seconds end-to-end

### Optimization Tips

1. **Use local TTS** (Kokoro) for lower latency
2. **Keep voice messages short** (< 30 seconds)
3. **Use MP3 format** to skip conversion
4. **Clean up old files** regularly

## Cleanup

Temporary files are created during processing. Clean them up periodically:

```typescript
// Cleanup files older than 1 hour
await messageHandler.cleanupOldFiles(3600000);
await responseHandler.cleanupOldFiles(3600000);
```

Consider running cleanup on a schedule:

```typescript
setInterval(async () => {
  await messageHandler.cleanupOldFiles(3600000);
  await responseHandler.cleanupOldFiles(3600000);
}, 600000); // Every 10 minutes
```

## Troubleshooting

### Voice messages not detected

1. Check bot permissions include `files:read`
2. Verify bot is in the channel
3. Check audio file format is supported

### TTS synthesis fails

1. Verify voice provider is configured: `clawdbot voice provider status`
2. Test TTS: `clawdbot voice synthesize --text "Hello world"`
3. Check provider health: `clawdbot voice provider test`

### FFmpeg errors

1. Ensure FFmpeg is installed: `ffmpeg -version`
2. Check PATH includes FFmpeg binary
3. Try manual conversion: `ffmpeg -i input.wav -b:a 64k output.mp3`

### Upload failures

1. Check bot token has `files:write` permission
2. Verify file size is under Slack's limit (50MB)
3. Check network connectivity

### High latency

1. Use local TTS provider (Kokoro)
2. Reduce target bitrate (32kbps)
3. Lower sample rate (16kHz)
4. Keep messages short

## Security

### File Handling
- Files are downloaded to temporary directory
- Automatic cleanup after processing
- Configurable max file size
- Format validation before processing

### Authentication
- Uses Slack bot token for API calls
- Token stored securely in credentials
- No API keys exposed in responses

## Testing

Run the test suite:

```bash
pnpm test src/slack/voice/
```

Test coverage:
- Message handler: 85%+
- Response handler: 85%+
- Integration: 80%+

## Examples

### Basic Voice Response

```typescript
await responseHandler.sendVoiceResponse({
  channelId: 'C123456',
  text: 'Hello! How can I help you today?',
});
```

### Custom Voice and Speed

```typescript
await responseHandler.sendVoiceResponse({
  channelId: 'C123456',
  text: 'Speaking faster in British accent',
  voice: 'en_uk',
  speed: 1.3,
});
```

### Thread Reply without Transcript

```typescript
await responseHandler.sendVoiceResponse({
  channelId: 'C123456',
  threadTs: '1234567890.123456',
  text: 'This is a threaded voice reply',
  includeTranscript: false,
});
```

## API Reference

See TypeScript definitions in:
- `src/slack/voice/message-handler.ts`
- `src/slack/voice/response-handler.ts`
- `src/slack/voice/events.ts`

## Support

For issues or questions:
- GitHub Issues: https://github.com/clawdbot/clawdbot/issues
- Documentation: https://docs.clawd.bot/voice-providers

## Future Enhancements

- [ ] Real-time voice streaming
- [ ] Voice activity detection
- [ ] Multi-language auto-detection
- [ ] Voice cloning support
- [ ] Emotion/tone control
- [ ] Voice conversation memory
