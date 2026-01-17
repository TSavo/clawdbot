# Plugin System

A modular plugin architecture for managing STT (Speech-to-Text) and TTS (Text-to-Speech) providers in the voice-call extension.

## Features

- **Modular Architecture**: Standalone plugin implementations with clear interfaces
- **Plugin Registry**: Centralized registration and discovery system
- **Built-in Plugins**: OpenAI Realtime STT and OpenAI TTS providers included
- **Backwards Compatibility**: Existing code continues to work without changes
- **Extensibility**: Easy to add custom STT/TTS providers
- **Type Safety**: Full TypeScript support with strict typing

## Quick Start

```typescript
import {
  initializeBuiltInPlugins,
  getPluginRegistry
} from "@clawdbot/voice-call";

// Initialize built-in plugins
await initializeBuiltInPlugins();

// Get registry
const registry = getPluginRegistry();

// Use STT
const sttProvider = registry.getSTT("openai-realtime");
const session = sttProvider.createSession();
await session.connect();

// Use TTS
const ttsProvider = registry.getTTS("openai-tts");
const audio = await ttsProvider.synthesize("Hello, world!");
```

## Architecture

### Core Interfaces

- **`STTProvider`** - Speech-to-Text provider interface
- **`STTSession`** - Active STT transcription session
- **`TTSProvider`** - Text-to-Speech provider interface
- **`PluginRegistry`** - Global plugin registry and discovery

### Built-in Plugins

1. **OpenAI Realtime STT** (`openai-realtime`)
   - Location: `stt-openai-realtime/`
   - Uses WebSocket for low-latency streaming
   - Server-side VAD for turn detection
   - Direct mu-law audio support

2. **OpenAI TTS** (`openai-tts`)
   - Location: `tts-openai/`
   - REST API for speech synthesis
   - Audio format conversion (PCM → mu-law)
   - Multiple voice options
   - Speed and instruction support

## File Structure

```
src/plugins/
├── README.md                     # This file
├── INTEGRATION_GUIDE.md          # Detailed integration guide
├── EXAMPLES.ts                   # Usage examples
├── interfaces.ts                 # Core interfaces and types
├── registry.ts                   # Plugin registry implementation
├── index.ts                      # Main exports and initialization
├── stt-openai-realtime/
│   ├── index.ts                 # Plugin exports
│   ├── provider.ts              # Provider implementation
│   └── session.ts               # Session implementation (WebSocket)
└── tts-openai/
    ├── index.ts                 # Plugin exports
    ├── provider.ts              # Provider implementation
    └── audio-utils.ts           # Audio conversion utilities
```

## API Reference

### Plugin Registry

```typescript
// Get global registry instance
const registry = getPluginRegistry();

// Register providers
registry.registerSTT(id, provider);
registry.registerTTS(id, provider);

// Retrieve providers
const sttProvider = registry.getSTT(id);
const ttsProvider = registry.getTTS(id);

// Discovery
registry.getAll();
registry.getAllSTT();
registry.getAllTTS();
registry.discover(options);
registry.has(id);
registry.get(id);

// Management
registry.unregister(id);
registry.clear();
registry.size();
```

### STT Provider

```typescript
interface STTProvider {
  metadata: PluginMetadata;
  createSession(config?: PluginConfig): STTSession;
  validateConfig(): void;
}

interface STTSession {
  sessionId: string;
  connect(): Promise<void>;
  sendAudio(audio: Buffer): void;
  onPartial(callback: (partial: string) => void): void;
  onTranscript(callback: (transcript: string) => void): void;
  onError?(callback: (error: Error) => void): void;
  waitForTranscript(timeoutMs?: number): Promise<string>;
  isConnected(): boolean;
  close(): void;
}
```

### TTS Provider

```typescript
interface TTSProvider {
  metadata: PluginMetadata;
  synthesize(text: string, options?: TTSSynthesisOptions): Promise<Buffer>;
  validateConfig(): void;
}

interface TTSSynthesisOptions {
  voice?: string;
  speed?: number;
  instructions?: string;
  config?: PluginConfig;
}
```

## Usage Examples

### Initialize and List Plugins

```typescript
import { initializeBuiltInPlugins, getPluginRegistry } from "@clawdbot/voice-call";

await initializeBuiltInPlugins();
const registry = getPluginRegistry();

console.log("Registered plugins:");
for (const plugin of registry.getAll()) {
  console.log(`- ${plugin.name} (${plugin.type})`);
}
```

### STT Session

```typescript
const provider = registry.getSTT("openai-realtime");
const session = provider.createSession();

await session.connect();

session.onPartial((text) => console.log("Partial:", text));
session.onTranscript((text) => console.log("Final:", text));
session.onError((err) => console.error("Error:", err));

session.sendAudio(muLawBuffer);
const transcript = await session.waitForTranscript(30000);
session.close();
```

### TTS Synthesis

```typescript
const provider = registry.getTTS("openai-tts");

// Generate PCM audio (24kHz)
const pcm = await provider.synthesize("Hello!");

// Generate mu-law audio (8kHz, Twilio compatible)
const mulaw = await provider.synthesizeForTwilio("Hello!");

// Custom options
const audio = await provider.synthesize("Premium", {
  voice: "cedar",
  speed: 1.2,
  instructions: "Speak professionally"
});
```

### Register Custom Provider

```typescript
import {
  STTProvider,
  PluginMetadata,
  getPluginRegistry
} from "@clawdbot/voice-call";

class CustomProvider implements STTProvider {
  metadata: PluginMetadata = {
    name: "custom",
    version: "1.0.0",
    type: "stt",
    description: "Custom provider",
    capabilities: ["streaming"]
  };

  createSession(config) {
    // Implement session
  }

  validateConfig() {
    // Validate
  }
}

const registry = getPluginRegistry();
registry.registerSTT("custom", new CustomProvider());
```

## Audio Utilities

Convert between audio formats for telephony compatibility:

```typescript
import {
  resample24kTo8k,
  pcmToMulaw,
  mulawToLinear,
  chunkAudio,
} from "@clawdbot/voice-call";

// Resample PCM
const pcm8k = resample24kTo8k(pcm24k);

// Convert to mu-law
const mulaw = pcmToMulaw(pcm8k);

// Convert from mu-law
const pcm16 = mulawToLinear(mulawByte);

// Chunk for streaming (20ms frames at 8kHz = 160 bytes)
for (const chunk of chunkAudio(mulaw, 160)) {
  // Send chunk
}
```

## Environment Variables

Configure providers via environment variables:

```bash
# OpenAI API key (used by both STT and TTS)
export OPENAI_API_KEY="sk-..."
```

## Error Handling

All errors from the plugin system inherit from or are instances of:

```typescript
import { PluginRegistryError } from "@clawdbot/voice-call";

try {
  const provider = registry.getSTT("nonexistent");
} catch (error) {
  if (error instanceof PluginRegistryError) {
    console.error(`Error (${error.code}): ${error.message}`);
  }
}
```

## Backwards Compatibility

Existing code importing from old paths continues to work:

```typescript
// Old (deprecated but still works)
import { OpenAITTSProvider } from "@clawdbot/voice-call/dist/providers/tts-openai.js";

// New (recommended)
import { OpenAITTSProvider } from "@clawdbot/voice-call";
```

## OpenAI TTS Voices

All 13 OpenAI voices are supported:

```typescript
import { OPENAI_TTS_VOICES } from "@clawdbot/voice-call";

// ["alloy", "ash", "ballad", "coral", "echo", "fable",
//  "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]
```

For best quality, use `marin` or `cedar`. Note that `tts-1` and `tts-1-hd` only support a subset of voices.

## Integration with Voice Call Extension

The plugin system integrates seamlessly with the voice-call extension:

1. Initialize during startup
2. Register plugins
3. Voice call manager uses plugins for STT/TTS operations
4. Support for multiple concurrent sessions

## See Also

- [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) - Comprehensive integration guide
- [EXAMPLES.ts](./EXAMPLES.ts) - Code examples and usage patterns
- `interfaces.ts` - Complete type definitions
- `registry.ts` - Registry implementation details

## License

MIT
