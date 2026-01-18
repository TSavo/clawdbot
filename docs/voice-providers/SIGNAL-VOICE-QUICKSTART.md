# Signal Voice Quick Start Guide

Quick reference for using Signal Voice Integration in Clawdbot.

## Installation

```bash
# Install Signal CLI
brew install signal-cli  # macOS
# or
apt-get install signal-cli  # Linux
```

## Basic Setup

### 1. Configure Signal Account

Add to `~/.clawdbot/config.json`:

```json
{
  "signal": {
    "accounts": [
      {
        "id": "main",
        "account": "+1234567890",
        "baseUrl": "http://localhost:8080",
        "voiceEnabled": true
      }
    ]
  }
}
```

### 2. Configure TTS Provider

```json
{
  "voice": {
    "enabled": true,
    "providers": [
      {
        "id": "cartesia",
        "apiKey": "your-api-key",
        "voice": "en-US"
      }
    ]
  }
}
```

## Quick Examples

### Receive Voice Message

```typescript
import { processVoiceMessage, extractVoiceMetadata } from './signal/voice';

// Process incoming voice message
const voiceMessage = await processVoiceMessage({
  attachment: event.attachment,
  sender: event.source,
  timestamp: event.timestamp,
  messageId: event.serverGuid,
  baseUrl: 'http://localhost:8080',
  verified: true,
});

// Extract metadata (no audio)
const metadata = extractVoiceMetadata(voiceMessage);
console.log('Received voice:', metadata);
```

### Send Voice Response

```typescript
import { handleVoiceResponse } from './signal/voice';

// Send encrypted voice response
await handleVoiceResponse({
  text: 'Hello! This is my response.',
  recipient: '+1234567890',
  baseUrl: 'http://localhost:8080',
  ttsExecutor: cartesiaTts,
  config: {
    disableLogging: true,
    ephemeralMode: true,
  },
});
```

### Manage Privacy

```typescript
import { SignalVoicePrivacyManager } from './signal/voice';

// Initialize privacy manager
const privacy = new SignalVoicePrivacyManager({
  autoDeleteMs: 24 * 60 * 60 * 1000, // 24 hours
  privacyMode: 'strict',
});

await privacy.initialize();

// Store conversation context
const convId = SignalVoicePrivacyManager.getConversationId('+1234567890');
await privacy.storeContext(convId, '+1234567890');

// Auto-cleanup
await privacy.cleanup();
```

## Privacy Checklist

Before production:

- [ ] Privacy mode: `'strict'`
- [ ] Auto-delete: ≤ 24 hours
- [ ] Audit logging: enabled
- [ ] No audio caching
- [ ] Ephemeral mode: enabled
- [ ] Encryption: verified

## Common Tasks

### Check Voice Message

```typescript
import { isVoiceMessage } from './signal/voice';

if (isVoiceMessage(attachment)) {
  // Process voice message
}
```

### Batch Voice Responses

```typescript
import { sendBatchVoiceResponses } from './signal/voice';

await sendBatchVoiceResponses({
  texts: ['First message', 'Second message'],
  recipient: '+1234567890',
  baseUrl: 'http://localhost:8080',
  ttsExecutor: cartesiaTts,
  delayMs: 1000, // 1 second between messages
});
```

### Get Compliance Status

```typescript
const status = await privacy.getComplianceStatus();
console.log('Compliant:', status.compliant);
console.log('Privacy mode:', status.privacyMode);
console.log('Auto-delete:', status.autoDeleteMs);
```

### Export Privacy Report

```typescript
const report = await privacy.exportPrivacyReport();
console.log('Total contexts:', report.totalContexts);
console.log('Privacy settings:', report.privacySettings);
```

## Supported Formats

### Audio Input (Receive)
- OPUS (best)
- WAV
- OGG

### Audio Output (Send)
- OPUS (recommended)
- WAV
- OGG

## Privacy Modes

### Strict (Production)

```typescript
{
  privacyMode: 'strict',
  disableLogging: true,
  ephemeralMode: true,
  requireVerification: true,
  autoDeleteMs: 24 * 60 * 60 * 1000,
}
```

**Guarantees**: No audio storage, no text logging, encryption required

### Standard (Development Only)

```typescript
{
  privacyMode: 'standard',
  disableLogging: false,
  ephemeralMode: true,
  requireVerification: false,
  autoDeleteMs: 7 * 24 * 60 * 60 * 1000,
}
```

⚠️ **Do not use in production**

## Troubleshooting

### Voice message not detected

```typescript
console.log('Content type:', attachment.contentType);
console.log('Voice note:', attachment.voiceNote);
```

### Encryption not verified

```typescript
if (!voiceMessage.verified) {
  console.warn('E2E encryption not verified');
}
```

### Auto-cleanup not working

```typescript
const status = await privacy.getComplianceStatus();
console.log('Auto-delete interval:', status.autoDeleteMs);
```

## Testing

```bash
# Run all tests
pnpm test src/signal/voice/

# Run specific component
pnpm test src/signal/voice/message-handler.test.ts

# With coverage
pnpm test:coverage src/signal/voice/
```

## API Reference

### Message Handler

- `isVoiceMessage(attachment)` - Detect voice messages
- `downloadVoiceMessage(attachment, options)` - Download encrypted audio
- `processVoiceMessage(params)` - Complete processing
- `extractVoiceMetadata(message)` - Get metadata only

### Response Handler

- `synthesizeTextToVoice(text, config, tts)` - Synthesize audio
- `sendEncryptedVoiceMessage(params)` - Send encrypted voice
- `handleVoiceResponse(params)` - Complete response flow
- `sendBatchVoiceResponses(params)` - Send multiple messages

### Privacy Manager

- `storeContext(id, participant, metadata)` - Store context
- `getContext(id)` - Retrieve context
- `deleteContext(id)` - Delete context
- `cleanup()` - Auto-cleanup expired
- `getComplianceStatus()` - Check compliance
- `exportPrivacyReport()` - Export report

## Best Practices

1. **Use Cartesia for TTS**: Best privacy and quality
2. **Enable Ephemeral Mode**: Auto-delete audio after sending
3. **Disable Logging**: Use `disableLogging: true`
4. **Verify Encryption**: Always check `verified` flag
5. **Regular Cleanup**: Run `cleanup()` hourly
6. **Audit Logs**: Review privacy audit logs weekly
7. **Limit Context Size**: Keep under 100 messages

## Documentation

- **Full Guide**: `docs/voice-providers/SIGNAL-VOICE.md`
- **Privacy Compliance**: `docs/voice-providers/PRIVACY-COMPLIANCE.md`
- **Implementation**: `docs/voice-providers/SIGNAL-VOICE-IMPLEMENTATION.md`

## Support

For issues or questions:
- GitHub Issues: https://github.com/clawdbot/clawdbot/issues
- Documentation: https://docs.clawd.bot

## License

Same as Clawdbot main license.
