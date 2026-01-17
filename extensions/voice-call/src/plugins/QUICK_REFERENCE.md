# Plugin System - Quick Reference

## Installation & Initialization

```typescript
import { initializeBuiltInPlugins, getPluginRegistry } from "@clawdbot/voice-call";

// At application startup
await initializeBuiltInPlugins();
const registry = getPluginRegistry();
```

## STT (Speech-to-Text)

### Create and Use Session

```typescript
const stt = registry.getSTT("openai-realtime");
const session = stt.createSession();

// Connect
await session.connect();

// Set callbacks
session.onPartial((text) => console.log("Partial:", text));
session.onTranscript((text) => console.log("Final:", text));
session.onError((error) => console.error("Error:", error));

// Send audio
session.sendAudio(muLawBuffer);

// Wait for result
const transcript = await session.waitForTranscript(30000);

// Cleanup
session.close();
```

### Session Status

```typescript
if (session.isConnected()) {
  console.log("Connected to STT service");
}
```

## TTS (Text-to-Speech)

### Synthesize Audio

```typescript
const tts = registry.getTTS("openai-tts");

// PCM audio (24kHz)
const pcm = await tts.synthesize("Hello!");

// Mu-law audio (8kHz, Twilio compatible)
const mulaw = await tts.synthesizeForTwilio("Hello!");

// With custom voice
const audio = await tts.synthesize("Premium message", {
  voice: "cedar",
  speed: 1.2,
  instructions: "Speak professionally"
});
```

### Available Voices

```typescript
import { OPENAI_TTS_VOICES } from "@clawdbot/voice-call";
// ["alloy", "ash", "ballad", "coral", "echo", "fable",
//  "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]
```

## Audio Utilities

```typescript
import { chunkAudio, resample24kTo8k, pcmToMulaw } from "@clawdbot/voice-call";

// Resample 24kHz → 8kHz
const pcm8k = resample24kTo8k(pcm24k);

// Convert PCM → mu-law
const mulaw = pcmToMulaw(pcm8k);

// Chunk for streaming (20ms frames)
for (const chunk of chunkAudio(mulaw, 160)) {
  // Send chunk
}
```

## Plugin Discovery

```typescript
// Get all plugins
registry.getAll();

// Get all STT providers
registry.getAllSTT();

// Get all TTS providers
registry.getAllTTS();

// Check if plugin exists
registry.has("openai-tts");

// Get plugin info
const plugin = registry.get("openai-realtime");
console.log(plugin.instance.metadata);
```

## Register Custom Provider

```typescript
import { STTProvider, PluginMetadata } from "@clawdbot/voice-call";

class CustomProvider implements STTProvider {
  metadata: PluginMetadata = {
    name: "custom-stt",
    version: "1.0.0",
    type: "stt",
    description: "Custom provider",
    capabilities: ["streaming"]
  };

  createSession(config) { /* ... */ }
  validateConfig() { /* ... */ }
}

const result = registry.registerSTT("custom", new CustomProvider());
```

## Error Handling

```typescript
import { PluginRegistryError } from "@clawdbot/voice-call";

try {
  const provider = registry.getSTT("invalid");
} catch (error) {
  if (error instanceof PluginRegistryError) {
    console.error(`Error (${error.code}): ${error.message}`);
  }
}
```

## Full Conversation Example

```typescript
// 1. Listen
const stt = registry.getSTT("openai-realtime");
const sttSession = stt.createSession();
await sttSession.connect();
sttSession.sendAudio(audioInput);
const userText = await sttSession.waitForTranscript();
sttSession.close();

// 2. Process (your logic)
const responseText = processUserInput(userText);

// 3. Speak
const tts = registry.getTTS("openai-tts");
const audioOutput = await tts.synthesizeForTwilio(responseText);
```

## Configuration via Environment

```bash
# Set OpenAI API key
export OPENAI_API_KEY="sk-..."
```

## Common Patterns

### Session Reuse
```typescript
const session = stt.createSession();
await session.connect();

// Multiple uses
while (true) {
  const text = await session.waitForTranscript();
  console.log(text);
}

session.close();
```

### Error Recovery
```typescript
session.onError((error) => {
  console.error("Session error:", error.message);
  session.close();
  // Reconnect in your app logic
});
```

### Streaming Audio
```typescript
const mulaw = await tts.synthesizeForTwilio("Long message");

// Stream in 20ms chunks
for (const chunk of chunkAudio(mulaw, 160)) {
  await sendToMediaStream(chunk);
  await delay(20); // 20ms per frame
}
```

## Provider Metadata

```typescript
const provider = registry.getSTT("openai-realtime");
const { metadata } = provider;

console.log(metadata.name);           // "openai-realtime"
console.log(metadata.version);        // "1.0.0"
console.log(metadata.type);           // "stt"
console.log(metadata.description);    // "..."
console.log(metadata.capabilities);   // ["streaming", "realtime", "vad", "mu-law"]
```

## Session Lifecycle

```
new Session
    ↓
connect() → connected = true
    ↓
sendAudio() → [can be called multiple times]
    ↓
onTranscript/onPartial → [callbacks fire]
    ↓
waitForTranscript() → returns text
    ↓
close() → connected = false
```

## Plugin System Structure

```
Registry (Singleton)
├── STT Plugins
│   └── "openai-realtime" → Provider → Session
└── TTS Plugins
    └── "openai-tts" → Provider
```

## Backwards Compatibility

Old imports still work:
```typescript
// Deprecated (but works)
import { OpenAITTSProvider } from "./providers/tts-openai";

// New way (recommended)
import { OpenAITTSProvider } from "@clawdbot/voice-call";
```

## Next Steps

1. **Read**: `README.md` for detailed system overview
2. **Learn**: `INTEGRATION_GUIDE.md` for comprehensive guide
3. **Explore**: `EXAMPLES.ts` for code examples
4. **Review**: `interfaces.ts` for type definitions
5. **Implement**: Register plugins in your app startup

---

For detailed documentation, see:
- `README.md` - System overview
- `INTEGRATION_GUIDE.md` - Integration guide
- `EXAMPLES.ts` - Usage examples
