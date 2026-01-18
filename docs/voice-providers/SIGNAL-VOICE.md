# Signal Voice Integration

Privacy-first voice message support for Signal with end-to-end encryption.

## Overview

The Signal Voice Integration enables Clawdbot to receive and respond to voice messages in Signal while maintaining Signal's strong privacy and encryption guarantees.

### Key Features

- **End-to-End Encrypted Voice Messages**: All voice messages are E2E encrypted by Signal
- **Privacy-First Design**: No audio content stored, only metadata
- **Auto-Cleanup**: Automatic deletion of old conversation data
- **GDPR Compliant**: Privacy-preserving architecture
- **TTS Support**: Text-to-speech synthesis for voice responses
- **Group Support**: Works in Signal groups and 1:1 chats

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Signal Voice Flow                        │
└─────────────────────────────────────────────────────────────┘

User sends encrypted voice message
            ↓
Signal library decrypts (E2E verified)
            ↓
Message handler processes
            ↓
Metadata extracted (no audio stored)
            ↓
Optional transcription (memory only)
            ↓
Agent generates response
            ↓
TTS synthesizes audio
            ↓
Signal encryption applied
            ↓
Send encrypted voice message
            ↓
User receives encrypted in Signal
            ↓
Auto-cleanup of local state
```

## Components

### 1. Message Handler (`message-handler.ts`)

Handles incoming voice messages from Signal.

**Features:**
- Detects voice message attachments
- Downloads and decrypts voice messages
- Validates end-to-end encryption
- Extracts metadata (sender, timestamp, group info)
- Privacy: No logging of audio content

**Usage:**

```typescript
import { processVoiceMessage } from './signal/voice/message-handler.js';

// Process incoming voice message
const decryptedMessage = await processVoiceMessage({
  attachment: voiceAttachment,
  sender: '+1234567890',
  timestamp: Date.now(),
  messageId: 'msg-123',
  baseUrl: 'http://localhost:8080',
  account: '+9876543210',
  verified: true, // E2E encryption verified
});

console.log('Received voice message:', {
  from: decryptedMessage.sender,
  size: decryptedMessage.size,
  format: decryptedMessage.audioFormat,
  encrypted: decryptedMessage.encrypted,
});
```

**Privacy guarantees:**
- Audio content never logged
- Only metadata stored
- Encryption status always verified

### 2. Response Handler (`response-handler.ts`)

Synthesizes and sends encrypted voice responses.

**Features:**
- Privacy-preserving TTS synthesis (no caching)
- Signal E2E encryption for responses
- Batch voice responses
- Voice message reactions
- Ephemeral mode (auto-delete after sending)

**Usage:**

```typescript
import { handleVoiceResponse } from './signal/voice/response-handler.js';

// Send voice response
const delivery = await handleVoiceResponse({
  text: 'Hello! This is my voice response.',
  recipient: '+1234567890',
  baseUrl: 'http://localhost:8080',
  account: '+9876543210',
  ttsExecutor: cartesiaTts, // Recommended: Cartesia for privacy
  config: {
    voice: 'en-US',
    disableLogging: true, // Privacy mode
    ephemeralMode: true, // Auto-delete after sending
  },
});

console.log('Voice message delivered:', {
  messageId: delivery.messageId,
  encrypted: delivery.encrypted,
  verified: delivery.verified,
});
```

**Privacy guarantees:**
- No audio caching
- Ephemeral mode enabled by default
- No conversation logging
- End-to-end encryption

### 3. Privacy Manager (`privacy-manager.ts`)

Manages conversation state with privacy-first design.

**Features:**
- Encrypted storage of metadata only
- Auto-deletion of old contexts (24h default)
- Privacy audit logging
- GDPR compliance reporting
- No audio content storage

**Usage:**

```typescript
import { SignalVoicePrivacyManager } from './signal/voice/privacy-manager.js';

// Initialize privacy manager
const privacyManager = new SignalVoicePrivacyManager({
  autoDeleteMs: 24 * 60 * 60 * 1000, // 24 hours
  privacyMode: 'strict',
  enableAuditLog: true,
});

await privacyManager.initialize();

// Store conversation context (metadata only)
const conversationId = SignalVoicePrivacyManager.getConversationId(
  '+1234567890',
  'group-id', // Optional for groups
);

await privacyManager.storeContext(conversationId, '+1234567890', {
  groupId: 'group-123',
  groupName: 'Test Group',
});

// Add message reference (no audio content)
await privacyManager.addMessageReference(
  conversationId,
  voiceMetadata,
  'inbound',
);

// Auto-cleanup expired contexts
const deleted = await privacyManager.cleanup();
console.log(`Cleaned up ${deleted} expired contexts`);
```

**Privacy guarantees:**
- All data encrypted at rest
- Only metadata stored (never audio)
- Auto-deletion after 24h
- Privacy audit trail
- GDPR compliant

## Configuration

### Basic Setup

1. **Install Signal CLI**:

```bash
# Install signal-cli
brew install signal-cli  # macOS
# or
apt-get install signal-cli  # Linux
```

2. **Configure Signal Account**:

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

3. **Configure TTS Provider** (Cartesia recommended):

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

### Voice Response Settings

```typescript
const voiceConfig: VoiceResponseConfig = {
  ttsProvider: 'cartesia', // Recommended for privacy
  voice: 'en-US',
  speed: 1.0,
  audioFormat: AudioFormat.OPUS, // Best for Signal
  disableLogging: true, // Privacy mode
  ephemeralMode: true, // Auto-delete
  verifyDelivery: true,
};
```

### Privacy Settings

```typescript
const privacyConfig: PrivacyManagerConfig = {
  autoDeleteMs: 24 * 60 * 60 * 1000, // 24 hours
  privacyMode: 'strict',
  enableAuditLog: true,
  maxContextSize: 50, // Max messages per context
};
```

## Integration Example

Complete example of handling voice messages and responding:

```typescript
import {
  processVoiceMessage,
  handleVoiceResponse,
  SignalVoicePrivacyManager,
} from './signal/voice/index.js';

// Initialize privacy manager
const privacyManager = new SignalVoicePrivacyManager({
  autoDeleteMs: 24 * 60 * 60 * 1000,
  privacyMode: 'strict',
});

await privacyManager.initialize();

// Handle incoming voice message
async function handleIncomingVoice(event: SignalEvent) {
  // Extract voice attachment from Signal event
  const attachment = event.envelope.dataMessage.attachments?.[0];

  if (!attachment || !isVoiceMessage(attachment)) {
    return; // Not a voice message
  }

  // Process voice message
  const voiceMessage = await processVoiceMessage({
    attachment,
    sender: event.envelope.source,
    timestamp: event.envelope.timestamp,
    messageId: event.envelope.serverGuid,
    baseUrl: 'http://localhost:8080',
    verified: true,
  });

  // Store conversation context
  const conversationId = SignalVoicePrivacyManager.getConversationId(
    voiceMessage.sender,
    voiceMessage.groupId,
  );

  await privacyManager.storeContext(conversationId, voiceMessage.sender);

  // Add message reference (metadata only)
  const metadata = extractVoiceMetadata(voiceMessage);
  await privacyManager.addMessageReference(conversationId, metadata, 'inbound');

  // Optional: Transcribe (in memory only, not stored)
  const transcription = await transcribeAudio(voiceMessage.audioBuffer);

  // Generate response
  const responseText = await generateResponse(transcription);

  // Send voice response
  await handleVoiceResponse({
    text: responseText,
    recipient: voiceMessage.sender,
    groupId: voiceMessage.groupId,
    baseUrl: 'http://localhost:8080',
    ttsExecutor: cartesiaTts,
    config: {
      disableLogging: true,
      ephemeralMode: true,
    },
  });

  // Auto-cleanup
  await privacyManager.cleanup();
}
```

## Privacy Compliance

### GDPR Compliance

The Signal Voice Integration is designed to be GDPR compliant:

1. **Data Minimization**: Only metadata stored, never audio content
2. **Encryption**: All data encrypted at rest
3. **Auto-Deletion**: Automatic cleanup after 24 hours
4. **Audit Trail**: Complete privacy audit logging
5. **Right to Deletion**: Easy context deletion API

### Privacy Checklist

- [ ] Audio content never stored
- [ ] Conversation text never logged
- [ ] All data encrypted at rest
- [ ] Auto-deletion configured (24h default)
- [ ] End-to-end encryption verified
- [ ] Privacy audit enabled
- [ ] Ephemeral mode enabled
- [ ] No audio caching

### Compliance Report

Generate a privacy compliance report:

```typescript
const report = await privacyManager.exportPrivacyReport();

console.log('Privacy Report:', {
  totalContexts: report.totalContexts,
  privacyMode: report.privacySettings.privacyMode,
  autoDeleteMs: report.privacySettings.autoDeleteMs,
  auditEvents: report.auditSummary.totalEvents,
});
```

## Testing

Run the test suite:

```bash
# Run all Signal voice tests
pnpm test src/signal/voice/

# Run specific test file
pnpm test src/signal/voice/message-handler.test.ts

# Run with coverage
pnpm test:coverage src/signal/voice/
```

### Test Coverage

- Message handler: >85% coverage
- Response handler: >85% coverage
- Privacy manager: >90% coverage

## Troubleshooting

### Voice messages not detected

Check attachment content type:

```typescript
console.log('Attachment:', {
  contentType: attachment.contentType,
  voiceNote: attachment.voiceNote,
});
```

Supported formats: `audio/opus`, `audio/ogg`, `audio/wav`

### Encryption verification failed

Verify Signal connection:

```typescript
const verified = voiceMessage.verified;
if (!verified) {
  console.warn('E2E encryption not verified');
}
```

### Auto-cleanup not working

Check expiration settings:

```typescript
const status = await privacyManager.getComplianceStatus();
console.log('Auto-delete interval:', status.autoDeleteMs);
```

### Large voice messages rejected

Adjust size limits:

```typescript
const voiceMessage = await processVoiceMessage({
  // ...
  options: {
    maxSizeMb: 16, // Increase from default 8MB
  },
});
```

## Best Practices

1. **Use Cartesia for TTS**: Best privacy and quality
2. **Enable Ephemeral Mode**: Auto-delete audio after sending
3. **Disable Logging**: Use `disableLogging: true` in production
4. **Verify Encryption**: Always check `verified` flag
5. **Regular Cleanup**: Run `cleanup()` periodically
6. **Audit Logs**: Review privacy audit logs regularly
7. **Limit Context Size**: Keep `maxContextSize` under 100

## API Reference

See inline TypeScript documentation for complete API reference.

### Key Types

- `SignalVoiceAttachment`: Voice message attachment metadata
- `DecryptedVoiceMessage`: Decrypted voice message with metadata
- `VoiceResponseConfig`: Configuration for voice responses
- `VoiceConversationContext`: Privacy-safe conversation state
- `PrivacyAuditEntry`: Privacy audit log entry

## Contributing

When contributing to Signal voice integration:

1. Maintain privacy-first design
2. Never log audio content
3. Always encrypt at rest
4. Add comprehensive tests
5. Update documentation
6. Verify GDPR compliance

## License

Same as Clawdbot main license.
