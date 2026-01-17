# Plugin System Integration Guide

This guide explains how to use the plugin system for STT and TTS providers in the voice-call extension.

## Overview

The plugin system provides a standardized interface for registering and using speech-to-text (STT) and text-to-speech (TTS) providers. This allows for:

- Modular provider implementations
- Easy plugin discovery and registration
- Backwards compatibility with existing code
- Extensibility for custom providers

## Quick Start

### Initializing Built-in Plugins

At application startup, initialize the built-in OpenAI plugins:

```typescript
import { initializeBuiltInPlugins, getPluginRegistry } from "@clawdbot/voice-call";

// Initialize plugins
const result = await initializeBuiltInPlugins();
if (!result.success) {
  console.error("Failed to initialize plugins:", result.message);
} else {
  console.log("Plugins initialized:", result.message);
}

// Get registry for future use
const registry = getPluginRegistry();
```

### Using the STT Provider

```typescript
import { getPluginRegistry } from "@clawdbot/voice-call";

const registry = getPluginRegistry();

// Get the OpenAI Realtime STT provider
const sttProvider = registry.getSTT("openai-realtime");

// Create a session
const session = sttProvider.createSession({ instanceId: "session-123" });

// Connect and set callbacks
await session.connect();

session.onPartial((partial) => {
  console.log("Partial transcript:", partial);
});

session.onTranscript((transcript) => {
  console.log("Final transcript:", transcript);
});

// Send audio data
const muLawAudio = Buffer.from([/* mu-law encoded audio */]);
session.sendAudio(muLawAudio);

// Wait for transcript
const text = await session.waitForTranscript(30000);
console.log("Got transcript:", text);

// Clean up
session.close();
```

### Using the TTS Provider

```typescript
import { getPluginRegistry } from "@clawdbot/voice-call";

const registry = getPluginRegistry();

// Get the OpenAI TTS provider
const ttsProvider = registry.getTTS("openai-tts");

// Generate speech audio (24kHz PCM)
const pcm24k = await ttsProvider.synthesize("Hello, world!");

// Or generate Twilio-compatible audio (8kHz mu-law)
const mulawAudio = await ttsProvider.synthesizeForTwilio("Hello, world!");

// You can also customize the synthesis
const customAudio = await ttsProvider.synthesize("Hello!", {
  voice: "marin",
  speed: 1.2,
  instructions: "Speak in a cheerful tone",
});
```

## Registering Custom Providers

Implement the `STTProvider` or `TTSProvider` interface and register it:

```typescript
import {
  STTProvider,
  PluginMetadata,
  getPluginRegistry,
} from "@clawdbot/voice-call";

// Implement your provider
class MyCustomSTTProvider implements STTProvider {
  readonly metadata: PluginMetadata = {
    name: "my-custom-stt",
    version: "1.0.0",
    type: "stt",
    description: "My custom speech-to-text provider",
    capabilities: ["streaming"],
  };

  createSession() {
    // Return your session implementation
  }

  validateConfig() {
    // Validate your provider config
  }
}

// Register it
const registry = getPluginRegistry();
const provider = new MyCustomSTTProvider();
const result = registry.registerSTT("my-stt", provider);

if (result.success) {
  console.log("Provider registered:", result.message);
} else {
  console.error("Registration failed:", result.message);
}
```

## Plugin Discovery

The registry provides several methods for discovering registered plugins:

```typescript
import { getPluginRegistry } from "@clawdbot/voice-call";

const registry = getPluginRegistry();

// Get all plugins
const all = registry.getAll();

// Get all STT providers
const sttProviders = registry.getAllSTT();

// Get all TTS providers
const ttsProviders = registry.getAllTTS();

// Discover with filters
const results = registry.discover({
  type: "stt",
  namePattern: /openai/i,
});

// Check if plugin exists
if (registry.has("openai-tts")) {
  console.log("OpenAI TTS is registered");
}

// Get plugin by ID (returns full registration info)
const registration = registry.get("openai-realtime");
if (registration) {
  console.log(`Plugin: ${registration.name}`);
  console.log(`Registered at: ${registration.registeredAt}`);
}
```

## Plugin Metadata

Each plugin provides metadata describing its capabilities:

```typescript
const sttProvider = registry.getSTT("openai-realtime");
const metadata = sttProvider.metadata;

console.log(`Name: ${metadata.name}`);
console.log(`Version: ${metadata.version}`);
console.log(`Type: ${metadata.type}`); // "stt" or "tts"
console.log(`Description: ${metadata.description}`);
console.log(`Capabilities: ${metadata.capabilities.join(", ")}`);
```

## Audio Utilities

The TTS plugin includes utilities for audio format conversion. These can also be imported directly:

```typescript
import {
  resample24kTo8k,
  pcmToMulaw,
  mulawToLinear,
  chunkAudio,
} from "@clawdbot/voice-call";

// Resample from 24kHz to 8kHz
const pcm8k = resample24kTo8k(pcm24k);

// Convert PCM to mu-law
const mulaw = pcmToMulaw(pcm8k);

// Convert mu-law to PCM
const pcm = mulawToLinear(mulawByte);

// Chunk audio for streaming (20ms frames at 8kHz = 160 bytes)
for (const chunk of chunkAudio(mulaw, 160)) {
  // Send chunk
}
```

## Error Handling

Handle plugin errors appropriately:

```typescript
import { PluginRegistryError, getPluginRegistry } from "@clawdbot/voice-call";

const registry = getPluginRegistry();

try {
  const provider = registry.getSTT("nonexistent");
} catch (error) {
  if (error instanceof PluginRegistryError) {
    console.error(`Plugin error (${error.code}): ${error.message}`);
  }
}

// Handle STT session errors
const session = sttProvider.createSession();
session.onError((error) => {
  console.error("Session error:", error.message);
});
```

## Configuration

Providers can be configured at creation time:

```typescript
import { OpenAIRealtimeSTTProvider, getPluginRegistry } from "@clawdbot/voice-call";

// Create with custom configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4o-transcribe",
  silenceDurationMs: 1000,
  vadThreshold: 0.6,
};

const provider = new OpenAIRealtimeSTTProvider(config);

// Register it
const registry = getPluginRegistry();
const result = registry.registerSTT("openai-realtime-custom", provider);
```

## Backwards Compatibility

Existing code that imports from the old locations continues to work:

```typescript
// Old way (still works)
import { OpenAITTSProvider } from "@clawdbot/voice-call/dist/providers/tts-openai.js";

// New way (recommended)
import { OpenAITTSProvider } from "@clawdbot/voice-call";
```

## OpenAI Voices

The TTS provider supports all 13 OpenAI voices:

```typescript
import { OPENAI_TTS_VOICES } from "@clawdbot/voice-call";

console.log("Available voices:", OPENAI_TTS_VOICES);
// Output: ["alloy", "ash", "ballad", "coral", "echo", "fable", "nova", "onyx", "sage", "shimmer", "verse", "marin", "cedar"]
```

For best quality, use `marin` or `cedar`. Note that `tts-1` and `tts-1-hd` models only support a subset of voices.

## Session Lifecycle

STT sessions have a well-defined lifecycle:

```typescript
// Create session
const session = provider.createSession();

// Check connection status
if (!session.isConnected()) {
  await session.connect();
}

// Send audio
session.sendAudio(audioBuffer);

// Wait for transcript
const transcript = await session.waitForTranscript(30000);

// Clean up
session.close();

// After close, isConnected() returns false
console.assert(!session.isConnected());
```

## TTS Synthesis Options

Customize TTS synthesis with options:

```typescript
const audio = await ttsProvider.synthesize("Hello!", {
  voice: "cedar",
  speed: 1.5,
  instructions: "Speak like a professional news anchor",
});
```

## File Organization

The plugin system is organized as follows:

```
src/plugins/
├── interfaces.ts                 # Base interfaces and types
├── registry.ts                   # Plugin registry
├── index.ts                      # Main exports
├── stt-openai-realtime/
│   ├── provider.ts              # Provider implementation
│   ├── session.ts               # Session implementation
│   └── index.ts                 # Plugin exports
└── tts-openai/
    ├── provider.ts              # Provider implementation
    ├── audio-utils.ts           # Audio conversion utilities
    └── index.ts                 # Plugin exports
```

## See Also

- `interfaces.ts` - Type definitions and interfaces
- `registry.ts` - Plugin registry implementation
- `stt-openai-realtime/` - OpenAI Realtime STT plugin
- `tts-openai/` - OpenAI TTS plugin
