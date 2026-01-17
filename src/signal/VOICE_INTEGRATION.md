# Signal Voice Integration Guide

This document explains how to integrate Signal voice message and call support end-to-end into the main Signal event handler.

## Overview

Signal voice support consists of three main components:

1. **Voice Messages** - Receive voice messages, transcribe them, generate responses, synthesize to voice
2. **Voice Calls** - Receive voice calls, establish encrypted audio streams, handle bidirectional audio
3. **Privacy** - All voice data is E2E encrypted by Signal, transcriptions are memory-only, no persistent logging

## File Structure

```
src/signal/voice/
├── integration.ts              # Main integration point (DISCORD PATTERN)
├── message-handler.ts          # Receive voice messages
├── call-handler.ts             # Real-time voice calls
├── response-handler.ts         # Send voice responses
├── call-response-handler.ts    # Bidirectional call audio
├── privacy-manager.ts          # Conversation state management
└── index.ts                    # Public exports

src/signal/monitor/
├── event-handler.ts            # Main Signal event handler
├── event-handler-voice.ts      # Voice event detection & routing
└── event-handler.types.ts      # Event types
```

## Quick Integration: Voice Messages in Event Handler

To add voice message support to the main Signal event handler, follow this pattern:

### 1. Import Voice Handler

```typescript
// In src/signal/monitor/event-handler.ts
import {
  hasVoiceMessageAttachment,
  extractVoiceAttachment,
  handleSignalVoiceMessageEvent,
} from './event-handler-voice.js';
import { logVerbose } from '../../globals.js';
```

### 2. Add Voice Detection Before Text Processing

In the main `createSignalEventHandler` function, after sender validation but before text processing:

```typescript
export function createSignalEventHandler(deps: SignalEventHandlerDeps) {
  return async (event: { event?: string; data?: string }) => {
    if (event.event !== "receive" || !event.data) return;

    let payload: SignalReceivePayload | null = null;
    try {
      payload = JSON.parse(event.data) as SignalReceivePayload;
    } catch (err) {
      deps.runtime.error?.(`failed to parse event: ${String(err)}`);
      return;
    }

    const envelope = payload?.envelope;
    if (!envelope) return;
    if (envelope.syncMessage) return;

    const dataMessage = envelope.dataMessage ?? envelope.editMessage?.dataMessage;
    const sender = resolveSignalSender(envelope);

    // ... existing sender/policy validation ...

    // NEW: Check for voice message BEFORE text processing
    if (dataMessage && hasVoiceMessageAttachment(dataMessage)) {
      const voiceAttachment = extractVoiceAttachment(dataMessage);
      if (voiceAttachment) {
        const isGroup = Boolean(dataMessage.groupInfo?.groupId);

        try {
          const handled = await handleSignalVoiceMessageEvent({
            attachment: voiceAttachment,
            messageId: envelope.timestamp ? String(envelope.timestamp) : 'unknown',
            timestamp: envelope.timestamp ?? Date.now(),
            sender: senderRecipient, // The Signal identifier
            senderUuid: resolveSignalSender(envelope)?.uuid,
            senderName: envelope.sourceName,
            groupId: dataMessage.groupInfo?.groupId,
            groupName: dataMessage.groupInfo?.groupName,
            baseUrl: deps.baseUrl,
            account: deps.account,
            accountId: deps.accountId,
            runtime: deps.runtime,

            // Callback: Generate response text from transcribed voice
            onVoiceDetected: async ({ transcribedText, sender, groupId, isGroup }) => {
              // Call agent to generate response from transcribed text
              const response = await deps.dispatchReplyFromConfig({
                .../* existing context */,
                Body: transcribedText,
                RawBody: transcribedText,
                CommandBody: transcribedText,
              });

              // Return first response text, or empty to skip voice response
              return response?.replies?.[0]?.text ?? '';
            },

            // Callback: Send voice response to Signal
            onVoiceResponse: async ({ voiceBuffer, text, format }) => {
              if (voiceBuffer) {
                // Send as voice message attachment
                await sendMessageSignal(
                  isGroup ? `group:${groupId}` : `signal:${sender}`,
                  text ?? '', // Optional caption
                  {
                    baseUrl: deps.baseUrl,
                    account: deps.account,
                    accountId: deps.accountId,
                    mediaBuffer: voiceBuffer,
                    maxBytes: deps.mediaMaxBytes,
                  }
                );
              } else if (text) {
                // Send as text if voice synthesis failed
                await sendMessageSignal(
                  isGroup ? `group:${groupId}` : `signal:${sender}`,
                  text,
                  {
                    baseUrl: deps.baseUrl,
                    account: deps.account,
                    accountId: deps.accountId,
                    maxBytes: deps.mediaMaxBytes,
                  }
                );
              }
            },
          });

          if (handled) {
            // Voice message fully handled, skip text processing
            logVerbose('signal: voice message handled, skipping text processing');
            return;
          }
        } catch (err) {
          deps.runtime.error?.(`voice event handler failed: ${String(err)}`);
          // Fall through to text processing
        }
      }
    }

    // ... existing text message processing continues ...
  };
}
```

## Voice Message Configuration

Voice behavior is configured via `SignalVoiceConfig`:

```typescript
interface SignalVoiceConfig {
  // Enable/disable voice message handling
  enabled?: boolean;                    // Default: true

  // Response type: 'voice', 'text', or 'both'
  responseType?: 'voice' | 'text' | 'both';  // Default: 'voice' (text in groups)

  // TTS voice settings
  voice?: string;                       // e.g., 'en-US-Neural2-A'
  speed?: number;                       // 0.5-2.0, default 1.0
  language?: string;                    // e.g., 'en-US'

  // Audio format
  audioFormat?: 'opus' | 'ogg' | 'wav';     // Default: 'opus'

  // Privacy settings
  disableLogging?: boolean;             // Default: true
  ephemeralMode?: boolean;              // Default: true (auto-delete audio)

  // Transcription
  enableTranscription?: boolean;         // Default: true
}
```

## Voice Calls (Real-Time Audio)

To support real-time voice calls:

```typescript
import { SignalVoiceCallHandler } from '../voice/call-handler.js';
import { SignalVoiceCallResponseHandler } from '../voice/call-response-handler.js';

// Create handler
const callHandler = new SignalVoiceCallHandler(
  { baseUrl: deps.baseUrl },
  {
    autoAcceptCalls: true,
    allowedCallers: [], // Empty = allow all
    maxDurationMs: 10 * 60 * 1000,
    requireEncryptionVerification: true,
  },
  deps.runtime
);

// Listen for incoming calls
callHandler.on('call:incoming', async (call) => {
  deps.runtime.log?.(`Incoming ${call.type} call from ${call.caller}`);

  // Accept and establish audio stream
  await callHandler.acceptCall(deps.account);
  const audioStream = await callHandler.establishAudioStream();

  // Now ready for bidirectional audio...
});

callHandler.on('call:audio-ready', (call) => {
  // Start audio processing
});

callHandler.on('call:ended', (call) => {
  deps.runtime.log?.(`Call ended after ${(call.duration! / 1000).toFixed(1)}s`);
});
```

## Privacy & Encryption

All voice processing respects Signal's privacy model:

1. **Encrypted at rest** - Signal handles E2E encryption
2. **Transcription memory-only** - Never logged or persisted
3. **No audio storage** - Audio deleted after processing (ephemeral mode)
4. **Verification** - E2E encryption verified before processing

```typescript
// From message-handler.ts
const voiceMessage = await processVoiceMessage({
  attachment,
  sender,
  timestamp,
  messageId,
  baseUrl: deps.baseUrl,
  account: deps.account,
  // Signal automatically verifies E2E encryption
});

console.log(voiceMessage.encrypted);    // true (always)
console.log(voiceMessage.verified);     // true if sender verified
```

## Testing Voice Integration

### Unit Tests

```typescript
// Test voice message detection
import { isVoiceMessage } from '../voice/message-handler.js';

const voiceAttachment = {
  id: 'test-voice-msg-1',
  contentType: 'audio/opus',
  voiceNote: true,
  size: 12345,
};

expect(isVoiceMessage(voiceAttachment)).toBe(true);
```

### Integration Tests

```typescript
// Test end-to-end voice flow
import { handleSignalVoiceMessage } from '../voice/integration.js';

const handled = await handleSignalVoiceMessage({
  attachment: voiceAttachment,
  voiceConfig: { enabled: true, responseType: 'voice' },
  providersConfig: config.voiceProviders,
  replyFn: async (text) => `You said: "${text}"`,
  sendFn: async ({ voiceBuffer, text }) => {
    expect(voiceBuffer).toBeDefined();
    expect(text).toBeUndefined(); // Voice response only
  },
});

expect(handled).toBe(true);
```

## Supported Audio Formats

- **Receive**: Audio/OPUS (Signal standard), Audio/WAV, Audio/OGG, Audio/MP3, Audio/AAC
- **Send**: Audio/OPUS (recommended), Audio/WAV, Audio/OGG
- **Transcription**: Auto-detected by provider (typically handles most formats)
- **Synthesis**: Provider-dependent (usually MP3 or WAV), auto-converted to OPUS for Signal

## Error Handling

Voice processing includes graceful fallback:

```typescript
// If transcription fails → use text only
// If synthesis fails → use text instead of voice
// If delivery fails → attempt text fallback
// If voice disabled → skip to text processing
```

All errors are logged verbosely for debugging but never expose audio content.

## Performance Considerations

- **Transcription latency**: 1-3 seconds for typical 30-60 second voice messages
- **Synthesis latency**: 0.5-2 seconds depending on response length
- **Network**: Uses Signal's encrypted channel (no additional bandwidth)
- **CPU**: Minimal (transcription/synthesis done by external providers)

## Related Files

- `src/signal/voice/integration.ts` - Main integration (Discord pattern)
- `src/signal/monitor/event-handler-voice.ts` - Event handler hooks
- `src/discord/voice/integration.ts` - Reference implementation (Discord)
- `src/signal/voice/` - Complete voice module
