# Plugin Registry Integration Guide

This guide shows how to integrate the voice provider plugins with the plugin registry and use different deployment modes.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Loading Configuration](#loading-configuration)
3. [Provider Registration](#provider-registration)
4. [Deployment Modes](#deployment-modes)
5. [Dynamic Provider Selection](#dynamic-provider-selection)
6. [Error Handling](#error-handling)
7. [Advanced Usage](#advanced-usage)

## Quick Start

### Basic Registry Setup

```typescript
import { SimplePluginRegistry } from "@clawdbot/speech-plugins";

// Create registry
const registry = new SimplePluginRegistry();

// Load configuration from file
await registry.loadFromConfig("./config/default-providers.json");

// Initialize all enabled providers
await registry.initializeAll();

// Get default providers
const sttProvider = registry.getDefaultSTTProvider();
const ttsProvider = registry.getDefaultTTSProvider();

// Use providers
const transcript = await sttProvider.transcribe(audioBuffer);
const speech = await ttsProvider.synthesize("Hello world", {
  voiceId: "nova",
  format: "wav",
  sampleRate: 24000,
});

// Cleanup when done
await registry.shutdownAll();
```

## Loading Configuration

### From Default Configuration

```typescript
import { SimplePluginRegistry } from "@clawdbot/speech-plugins";
import { resolve } from "node:path";

const registry = new SimplePluginRegistry();

// Load default providers
const configPath = resolve(__dirname, "../config/default-providers.json");
await registry.loadFromConfig(configPath);

// Check loaded configuration
const config = registry.getConfig();
console.log(`Loaded ${config.length} provider configurations`);
```

### From Custom Configuration

```typescript
// Create custom configuration
const customConfig = {
  providers: [
    {
      id: "whisper-custom",
      type: "stt",
      name: "Custom Whisper",
      module: "@clawdbot/speech-plugins/providers/whisper",
      deployment: {
        mode: "system",
        system: {
          binaryPath: "/opt/whisper/bin/whisper",
          env: {
            WHISPER_MODEL: "large-v2",
          },
        },
      },
      config: {
        model: "large-v2",
        language: "en",
      },
      enabled: true,
      priority: 120,
    },
  ],
};

// Save to file
import { writeFile } from "node:fs/promises";
await writeFile("./my-config.json", JSON.stringify(customConfig, null, 2));

// Load it
await registry.loadFromConfig("./my-config.json");
```

## Provider Registration

### Manual Provider Registration

```typescript
import {
  SimplePluginRegistry,
  createMockSTTProvider,
  createMockTTSProvider,
} from "@clawdbot/speech-plugins";

const registry = new SimplePluginRegistry();

// Create providers
const sttProvider = createMockSTTProvider("whisper-local");
const ttsProvider = createMockTTSProvider("kokoro-local");

// Initialize providers
await sttProvider.initialize({
  model: "base",
  device: "cpu",
});

await ttsProvider.initialize({
  voice: "af_sky",
  sampleRate: 22050,
});

// Register with registry
await registry.registerSTTProvider(sttProvider);
await registry.registerTTSProvider(ttsProvider);

// Get registered providers
const allSTT = registry.getSTTProviders();
const allTTS = registry.getTTSProviders();
console.log(`Registered ${allSTT.length} STT and ${allTTS.length} TTS providers`);
```

### Event Listeners

```typescript
import type { RegistryEventListener } from "@clawdbot/speech-plugins";

const listener: RegistryEventListener = {
  onProviderRegistered(provider, type) {
    console.log(`Registered ${type} provider: ${provider.metadata.name}`);
  },
  onProviderUnregistered(providerId, type) {
    console.log(`Unregistered ${type} provider: ${providerId}`);
  },
  onProviderError(providerId, error) {
    console.error(`Provider ${providerId} error:`, error.message);
  },
};

registry.addEventListener(listener);

// Now register providers and events will fire
await registry.registerSTTProvider(sttProvider);
// Logs: "Registered stt provider: Mock STT Provider"
```

## Deployment Modes

### System Mode (Local Binary)

**Configuration:**
```json
{
  "id": "whisper-system",
  "type": "stt",
  "deployment": {
    "mode": "system",
    "system": {
      "binaryPath": "whisper",
      "workingDir": "/tmp/whisper",
      "env": {
        "WHISPER_MODEL": "base"
      }
    }
  },
  "config": {
    "model": "base",
    "language": "en"
  }
}
```

**Usage:**
```typescript
// Provider will execute: whisper --model base --language en <audio_file>
// In working directory: /tmp/whisper
// With environment: WHISPER_MODEL=base

const provider = registry.getSTTProvider("whisper-system");
const result = await provider.transcribe(audioBuffer, {
  format: "wav",
  language: "en",
});
```

**Best For:**
- Privacy-sensitive transcription
- Offline operation
- High-volume usage (no per-request costs)

### Docker Mode (Containerized)

**Configuration:**
```json
{
  "id": "faster-whisper-docker",
  "type": "stt",
  "deployment": {
    "mode": "docker",
    "docker": {
      "image": "ghcr.io/openai/faster-whisper",
      "tag": "latest-gpu",
      "containerName": "clawdbot-faster-whisper",
      "volumes": [
        {
          "host": "${HOME}/.cache/whisper",
          "container": "/root/.cache/whisper"
        }
      ],
      "env": {
        "NVIDIA_VISIBLE_DEVICES": "all"
      }
    }
  }
}
```

**Usage:**
```typescript
// Provider will execute:
// docker run --gpus all \
//   -v ${HOME}/.cache/whisper:/root/.cache/whisper \
//   -e NVIDIA_VISIBLE_DEVICES=all \
//   ghcr.io/openai/faster-whisper:latest-gpu

const provider = registry.getSTTProvider("faster-whisper-docker");
const result = await provider.transcribe(audioBuffer, {
  format: "wav",
  language: "en",
});
```

**Best For:**
- GPU-accelerated transcription
- Reproducible environments
- Version-pinned deployments

### Cloud Mode (API)

**Configuration:**
```json
{
  "id": "deepgram-cloud",
  "type": "stt",
  "deployment": {
    "mode": "cloud",
    "cloud": {
      "endpoint": "https://api.deepgram.com/v1/listen",
      "apiKey": "${DEEPGRAM_API_KEY}",
      "region": "us",
      "timeout": 30000
    }
  },
  "config": {
    "model": "nova-2",
    "punctuate": true
  }
}
```

**Usage:**
```typescript
// Set environment variable
process.env.DEEPGRAM_API_KEY = "your-api-key";

// Provider will make API request to:
// POST https://api.deepgram.com/v1/listen
// Authorization: Token ${DEEPGRAM_API_KEY}
// Body: <audio_data>

const provider = registry.getSTTProvider("deepgram-cloud");
const result = await provider.transcribe(audioBuffer, {
  format: "wav",
  language: "en",
});
```

**Best For:**
- Quick start with no setup
- Access to latest models
- Variable load (auto-scaling)

## Dynamic Provider Selection

### Priority-Based Selection

```typescript
// Get highest priority enabled provider
const defaultSTT = registry.getDefaultSTTProvider();
const defaultTTS = registry.getDefaultTTSProvider();

console.log(`Using STT: ${defaultSTT?.metadata.name}`);
console.log(`Using TTS: ${defaultTTS?.metadata.name}`);
```

### Fallback Chain

```typescript
async function transcribeWithFallback(audioBuffer: Buffer): Promise<string> {
  const providers = [
    registry.getSTTProvider("deepgram-cloud"),
    registry.getSTTProvider("faster-whisper-docker"),
    registry.getSTTProvider("whisper-system"),
  ].filter((p) => p !== undefined);

  for (const provider of providers) {
    try {
      const result = await provider!.transcribe(audioBuffer, {
        format: "wav",
        language: "en",
      });
      return result[0].text;
    } catch (error) {
      console.warn(
        `Provider ${provider!.metadata.id} failed, trying next...`,
        error,
      );
    }
  }

  throw new Error("All STT providers failed");
}

// Use with automatic fallback
const text = await transcribeWithFallback(audioBuffer);
```

### Capability-Based Selection

```typescript
// Find provider that supports streaming
const streamingProviders = registry
  .getSTTProviders()
  .filter((p) => p.metadata.capabilities.supportsStreaming);

if (streamingProviders.length > 0) {
  const provider = streamingProviders[0];
  await provider.transcribeStream(audioStream, {
    onPartial: (partial) => console.log("Partial:", partial),
    onTranscript: (event) => console.log("Transcript:", event.segments),
    onComplete: (segments) => console.log("Final:", segments[0].text),
    onError: (error) => console.error("Error:", error.message),
  });
}
```

### Language-Based Selection

```typescript
function getProviderForLanguage(language: string, type: "stt" | "tts") {
  const providers =
    type === "stt" ? registry.getSTTProviders() : registry.getTTSProviders();

  // Find providers that support the language
  const matches = providers.filter((p) =>
    p.metadata.capabilities.languages.includes(language),
  );

  // Return highest priority match
  return matches.sort(
    (a, b) =>
      (registry
        .getConfig()
        .find((c) => c.id === b.metadata.id)?.priority ?? 0) -
      (registry
        .getConfig()
        .find((c) => c.id === a.metadata.id)?.priority ?? 0),
  )[0];
}

// Get best provider for Spanish
const esProvider = getProviderForLanguage("es", "stt");
console.log(`Spanish STT provider: ${esProvider?.metadata.name}`);
```

## Error Handling

### Provider Initialization Errors

```typescript
try {
  await registry.initializeAll();
} catch (error) {
  console.error("Failed to initialize providers:", error);

  // Try to initialize providers individually
  for (const config of registry.getConfig()) {
    if (!config.enabled) continue;

    try {
      const provider =
        config.type === "stt"
          ? registry.getSTTProvider(config.id)
          : registry.getTTSProvider(config.id);

      if (provider) {
        await provider.initialize(config.config);
        console.log(`✓ Initialized ${config.id}`);
      }
    } catch (err) {
      console.error(`✗ Failed to initialize ${config.id}:`, err);
    }
  }
}
```

### Runtime Errors

```typescript
async function safeTranscribe(
  provider: STTProvider,
  audioBuffer: Buffer,
): Promise<string | null> {
  try {
    const result = await provider.transcribe(audioBuffer, {
      format: "wav",
      language: "en",
    });
    return result[0].text;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("API key")) {
        console.error("Authentication error - check API key");
      } else if (error.message.includes("format")) {
        console.error("Unsupported audio format");
      } else if (error.message.includes("timeout")) {
        console.error("Request timed out");
      } else {
        console.error("Transcription error:", error.message);
      }
    }
    return null;
  }
}
```

### Configuration Validation

```typescript
import { validateDeploymentConfig, expandEnvVars } from "@clawdbot/speech-plugins";

// Validate deployment configuration
try {
  const deployment = {
    mode: "cloud" as const,
    cloud: {
      endpoint: "https://api.example.com",
      apiKey: "${API_KEY}",
    },
  };

  validateDeploymentConfig(deployment);

  // Expand environment variables
  const apiKey = expandEnvVars(deployment.cloud.apiKey);
  console.log("API key loaded from environment");
} catch (error) {
  console.error("Invalid deployment configuration:", error);
}
```

## Advanced Usage

### Cross-Provider Audio Pipeline

```typescript
async function processAudioPipeline(
  inputAudio: Buffer,
): Promise<{ transcript: string; responseAudio: Buffer }> {
  // Step 1: Transcribe with cloud STT (high accuracy)
  const sttProvider = registry.getSTTProvider("deepgram-cloud")!;
  const transcript = await sttProvider.transcribe(inputAudio, {
    format: "wav",
    language: "en",
  });

  const text = transcript[0].text;

  // Step 2: Process text (e.g., LLM response)
  const responseText = await processWithLLM(text);

  // Step 3: Synthesize with local TTS (low cost)
  const ttsProvider = registry.getTTSProvider("kokoro-system")!;
  const responseAudio = await ttsProvider.synthesize(responseText, {
    voiceId: "af_sky",
    format: "wav",
    sampleRate: 22050,
  });

  return { transcript: text, responseAudio };
}

async function processWithLLM(text: string): Promise<string> {
  // Your LLM processing logic
  return `Response to: ${text}`;
}
```

### Batch Processing

```typescript
async function batchTranscribe(audioFiles: Buffer[]): Promise<string[]> {
  const provider = registry.getDefaultSTTProvider()!;

  // Process in parallel
  const results = await Promise.all(
    audioFiles.map(async (audio) => {
      try {
        const transcript = await provider.transcribe(audio, {
          format: "wav",
          language: "en",
        });
        return transcript[0].text;
      } catch (error) {
        console.error("Transcription failed:", error);
        return "";
      }
    }),
  );

  return results;
}
```

### Provider Hot-Swapping

```typescript
class AdaptiveRegistry {
  constructor(private registry: SimplePluginRegistry) {}

  async switchProvider(
    type: "stt" | "tts",
    fromId: string,
    toId: string,
  ): Promise<void> {
    // Get new provider
    const newProvider =
      type === "stt"
        ? this.registry.getSTTProvider(toId)
        : this.registry.getTTSProvider(toId);

    if (!newProvider) {
      throw new Error(`Provider ${toId} not found`);
    }

    // Initialize if not already
    const config = this.registry
      .getConfig()
      .find((c) => c.id === toId);
    if (config && !newProvider.metadata.version) {
      await newProvider.initialize(config.config);
    }

    console.log(`Switched ${type} provider: ${fromId} → ${toId}`);
  }

  async optimizeForLatency(): Promise<void> {
    // Switch to system/docker providers for low latency
    await this.switchProvider("stt", "deepgram-cloud", "whisper-system");
    await this.switchProvider("tts", "cartesia-cloud", "kokoro-system");
  }

  async optimizeForQuality(): Promise<void> {
    // Switch to cloud providers for high quality
    await this.switchProvider("stt", "whisper-system", "deepgram-cloud");
    await this.switchProvider("tts", "kokoro-system", "cartesia-cloud");
  }
}

const adaptive = new AdaptiveRegistry(registry);
await adaptive.optimizeForLatency();
```

### Resource Pooling

```typescript
class ProviderPool {
  private pools = new Map<string, any[]>();

  constructor(
    private registry: SimplePluginRegistry,
    private poolSize: number = 3,
  ) {}

  async initialize(): Promise<void> {
    for (const config of this.registry.getConfig()) {
      if (!config.enabled) continue;

      const pool: any[] = [];
      for (let i = 0; i < this.poolSize; i++) {
        const provider =
          config.type === "stt"
            ? this.registry.getSTTProvider(config.id)
            : this.registry.getTTSProvider(config.id);

        if (provider) {
          await provider.initialize(config.config);
          pool.push(provider);
        }
      }

      this.pools.set(config.id, pool);
    }
  }

  acquire(providerId: string): any {
    const pool = this.pools.get(providerId);
    if (!pool || pool.length === 0) {
      throw new Error(`No available providers in pool for ${providerId}`);
    }
    return pool.shift();
  }

  release(providerId: string, provider: any): void {
    const pool = this.pools.get(providerId);
    if (pool) {
      pool.push(provider);
    }
  }
}
```

## Best Practices

1. **Always call `shutdownAll()` when done** to clean up resources
2. **Use fallback chains** for resilience
3. **Validate configuration** before loading
4. **Handle errors gracefully** with appropriate user feedback
5. **Pool providers** for high-throughput scenarios
6. **Monitor provider health** with event listeners
7. **Choose deployment mode** based on requirements (privacy, cost, latency)
8. **Use environment variables** for sensitive data (API keys)
9. **Test with mock providers** before using real providers
10. **Document provider-specific quirks** in your configuration

## Next Steps

- Review the [Configuration Guide](../config/README.md) for detailed deployment mode options
- Check [Testing Guide](../TESTING.md) for testing strategies
- See [Provider Reference](../README.md#supported-providers) for provider capabilities
- Explore [Quick Reference](../QUICK_REFERENCE.md) for common patterns
