# VoiceOrchestrator

Central coordinator for speech-to-text (STT) and text-to-speech (TTS) voice providers with intelligent provider selection, fallback chain management, health monitoring, and configuration integration.

## Overview

The `VoiceOrchestrator` manages multiple voice providers, automatically selecting the best available provider based on health status and priority. It implements:

- **Provider selection logic** with priority-based ordering
- **Fallback chain traversal** on provider failures
- **Circuit breaker pattern** for repeated failures
- **Periodic health monitoring** with configurable intervals
- **Deployment mode preference** (docker/system/cloud)
- **Hot configuration updates** without restart
- **Comprehensive logging and metrics**

## Key Features

### Intelligent Provider Selection

The orchestrator selects providers based on:
1. **Priority ordering** - Configured provider priority in config
2. **Health status** - Skip unhealthy providers
3. **Circuit breaker state** - Prevent cascading failures
4. **Deployment mode** - Consider docker/system/cloud preferences

```typescript
// Orchestrator automatically uses first healthy provider
const result = await orchestrator.transcribe(audio);

// Can switch providers explicitly
orchestrator.switchProvider('elevenlabs-tts');
```

### Fallback Chain Management

When a provider fails, the orchestrator automatically tries the next provider in the chain:

```typescript
// Try provider 1, then provider 2, then provider 3...
const result = await orchestrator.transcribe(audio);
// If provider 1 fails, automatically tries provider 2, etc.
```

### Circuit Breaker Pattern

Prevents cascading failures by temporarily disabling providers after repeated failures:

```typescript
// After N consecutive failures, circuit opens
// Provider is skipped for configurable duration
// Automatically resets after timeout period
```

### Health Monitoring

Tracks provider health with detailed metrics:

```typescript
const health = await orchestrator.getHealthStatus();
// Returns health status for all providers including:
// - healthy: boolean
// - lastCheck: timestamp
// - consecutiveFailures: count
// - consecutiveSuccesses: count
// - circuitBreakerOpen: boolean
```

## API Reference

### Constructor

```typescript
const orchestrator = new VoiceOrchestrator({
  config: voiceProvidersConfig,
  deploymentConfig: deploymentConfigs,
  defaultMode: 'system',
  fallbackChain: true,
  healthCheckInterval: 30000,
  circuitBreakerThreshold: 3,
  circuitBreakerResetMs: 60000,
  logger: customLogger,
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `config` | `VoiceProvidersConfig` | Required | Voice providers configuration |
| `deploymentConfig` | `DeploymentConfig \| DeploymentConfig[]` | Optional | Deployment configuration(s) |
| `defaultMode` | `'docker' \| 'system' \| 'cloud'` | `'system'` | Preferred deployment mode |
| `fallbackChain` | `boolean` | `true` | Enable automatic fallback on failure |
| `healthCheckInterval` | `number` | `30000` | Health check interval in ms |
| `circuitBreakerThreshold` | `number` | `3` | Failures before opening circuit |
| `circuitBreakerResetMs` | `number` | `60000` | Circuit reset timeout in ms |
| `logger` | `Logger` | console | Custom logger implementation |

### Core Methods

#### `initialize(options?): Promise<void>`

Initialize the orchestrator and all providers.

```typescript
await orchestrator.initialize({
  config: updatedConfig,
  defaultMode: 'docker',
});
```

#### `shutdown(): Promise<void>`

Gracefully shutdown all providers and cleanup resources.

```typescript
await orchestrator.shutdown();
```

#### `transcribe(audio, options?): Promise<TranscriptionResult>`

Transcribe audio using STT providers with fallback chain.

```typescript
const result = await orchestrator.transcribe(audio, {
  language: 'en',
  format: AudioFormat.PCM_16,
  timeout: 30000,
});
// Result:
// {
//   text: "Hello world",
//   confidence: 0.95,
//   language: "en",
//   duration: 2500,
//   provider: "whisper-docker"
// }
```

#### `transcribeStream(audioStream, options?): AsyncIterable<TranscriptionChunk>`

Transcribe audio stream with real-time results.

```typescript
for await (const chunk of orchestrator.transcribeStream(audioStream)) {
  console.log('Partial:', chunk.text, 'Partial:', chunk.partial);
}
```

#### `synthesize(text, options?): Promise<AudioBuffer>`

Synthesize text to speech using TTS providers.

```typescript
const audio = await orchestrator.synthesize('Hello world', {
  voice: 'nova',
  speed: 1.0,
  language: 'en',
  format: AudioFormat.MP3,
});
```

#### `synthesizeStream(textStream, options?): AsyncIterable<AudioBuffer>`

Synthesize text stream to audio stream.

```typescript
for await (const chunk of orchestrator.synthesizeStream(textStream)) {
  // Process audio chunk
  await writeToOutput(chunk);
}
```

### Provider Management

#### `getSTTProviders(): VoiceProviderExecutor[]`

Get all configured STT providers.

```typescript
const sttProviders = orchestrator.getSTTProviders();
console.log(`Available STT providers: ${sttProviders.length}`);
```

#### `getTTSProviders(): VoiceProviderExecutor[]`

Get all configured TTS providers.

```typescript
const ttsProviders = orchestrator.getTTSProviders();
```

#### `getActiveProvider(type): VoiceProviderExecutor | undefined`

Get the currently active provider for type (stt/tts).

```typescript
const active = orchestrator.getActiveProvider('stt');
if (active) {
  console.log(`Using ${active.id}`);
}
```

#### `switchProvider(id): void`

Switch to a different provider (prioritize it).

```typescript
orchestrator.switchProvider('elevenlabs-tts');
// Next operation uses ElevenLabs TTS
```

### Health Monitoring

#### `getHealthStatus(): Promise<Record<string, ProviderHealth>>`

Get comprehensive health status of all providers.

```typescript
const health = await orchestrator.getHealthStatus();
for (const [id, status] of Object.entries(health)) {
  console.log(`${id}: ${status.healthy ? 'healthy' : 'unhealthy'}`);
  console.log(`  Failures: ${status.consecutiveFailures}`);
  console.log(`  Successes: ${status.consecutiveSuccesses}`);
  console.log(`  Circuit breaker: ${status.circuitBreakerOpen}`);
}
```

#### `checkProviderHealth(providerId): Promise<boolean>`

Check health of specific provider.

```typescript
const healthy = await orchestrator.checkProviderHealth('whisper-docker');
```

### Configuration

#### `getConfig(): VoiceProvidersConfig`

Get current voice providers configuration.

```typescript
const config = orchestrator.getConfig();
console.log(`Providers: ${config.providers.map(p => p.id).join(', ')}`);
```

#### `updateDeploymentConfig(config): void`

Update deployment configuration at runtime without restart.

```typescript
orchestrator.updateDeploymentConfig({
  id: 'whisper-docker',
  type: 'whisper',
  mode: 'docker',
  image: 'openai/whisper:latest',
  ports: { 8000: 8000 },
});
```

## Usage Examples

### Basic Setup

```typescript
import { VoiceOrchestrator } from './media/voice-providers/orchestrator';
import { config } from './config';

const orchestrator = new VoiceOrchestrator({
  config: config.voice.providers,
  healthCheckInterval: 30000,
});

// Initialize
await orchestrator.initialize();

// Use for transcription
const result = await orchestrator.transcribe(audioBuffer);
console.log(`Transcribed: ${result.text}`);

// Cleanup
await orchestrator.shutdown();
```

### Fallback Chain with Multiple Providers

```typescript
const config = {
  enabled: true,
  providers: [
    {
      id: 'whisper-docker',
      priority: 10, // Higher priority = tried first
      stt: { type: 'whisper', modelSize: 'base' },
    },
    {
      id: 'faster-whisper-system',
      priority: 5,
      stt: { type: 'faster-whisper', computeType: 'float16' },
    },
    {
      id: 'openai-stt',
      priority: 1,
      stt: { type: 'openai', service: 'openai' },
    },
  ],
  fallbackChain: true,
};

const orchestrator = new VoiceOrchestrator({ config });
await orchestrator.initialize();

// Transcription automatically falls through chain on failure
const result = await orchestrator.transcribe(audio);
// Tries: whisper-docker -> faster-whisper-system -> openai-stt
```

### Health Monitoring and Provider Switching

```typescript
const orchestrator = new VoiceOrchestrator({ config });
await orchestrator.initialize();

// Monitor health
setInterval(async () => {
  const health = await orchestrator.getHealthStatus();

  for (const [id, status] of Object.entries(health)) {
    if (!status.healthy) {
      console.warn(`Provider ${id} is unhealthy`);
    }
  }
}, 30000);

// Switch provider if degradation detected
try {
  const result = await orchestrator.transcribe(audio);
} catch (error) {
  console.error('Primary provider failed, switching...');
  orchestrator.switchProvider('fallback-provider');

  // Retry with fallback
  const result = await orchestrator.transcribe(audio);
}
```

### Custom Logging

```typescript
const logger = {
  debug: (msg, meta) => console.debug(`[DEBUG] ${msg}`, meta),
  info: (msg, meta) => console.info(`[INFO] ${msg}`, meta),
  warn: (msg, meta) => console.warn(`[WARN] ${msg}`, meta),
  error: (msg, meta) => console.error(`[ERROR] ${msg}`, meta),
};

const orchestrator = new VoiceOrchestrator({
  config,
  logger,
});
```

### Stream Processing

```typescript
// Real-time transcription with streaming
const audioStream = createAudioStream(); // Your source

for await (const chunk of orchestrator.transcribeStream(audioStream)) {
  if (chunk.partial) {
    console.log(`Partial: ${chunk.text}`);
  } else {
    console.log(`Final: ${chunk.text}`);
  }
}

// Real-time synthesis with streaming
const textStream = createTextStream(); // Your source

for await (const audioChunk of orchestrator.synthesizeStream(textStream)) {
  await audioOutput.write(audioChunk);
}
```

## Circuit Breaker Behavior

The orchestrator implements exponential backoff circuit breaking:

```
Initial state: CLOSED (all requests pass through)
                  ↓
After 3 consecutive failures: OPEN (requests rejected)
                  ↓
After 60 seconds: HALF-OPEN (one request allowed to test)
                  ↓
If success: CLOSED (return to normal)
If failure: OPEN (restart timeout)
```

Configuration:

```typescript
const orchestrator = new VoiceOrchestrator({
  config,
  circuitBreakerThreshold: 3,      // Failures before opening
  circuitBreakerResetMs: 60000,    // Timeout before reset attempt
});
```

## Error Handling

All orchestrator methods throw `VoiceProviderError` with context:

```typescript
try {
  await orchestrator.transcribe(audio);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
  }
}
```

Common error codes:

| Code | Meaning |
|------|---------|
| `NOT_INITIALIZED` | Orchestrator not initialized |
| `NO_PROVIDERS` | No providers available for operation |
| `NO_HEALTHY_PROVIDERS` | All providers unhealthy |
| `ALL_PROVIDERS_FAILED` | Fallback chain exhausted |
| `PROVIDER_NOT_FOUND` | Provider ID not found |

## Configuration

See [`VoiceProvidersConfig`](/voice-providers/configuration) for complete configuration options.

## Performance Considerations

- **Health checks** run in background (configurable interval)
- **Circuit breaker** prevents thundering herd
- **Fallback chain** reduces latency by trying faster providers first
- **Streaming operations** support real-time processing
- **Resource cleanup** via `shutdown()` prevents memory leaks

## Testing

The VoiceOrchestrator includes comprehensive test coverage:

```bash
pnpm test src/media/voice-providers/orchestrator.test.ts
```

See [`orchestrator.test.ts`](orchestrator.test.ts) for test examples.

## Related

- [Voice Providers Configuration](/voice-providers/configuration)
- [VoiceProviderExecutor](/voice-providers/executor)
- [Deployment Configuration](/deployment/configuration)
- [Voice Channels](/voice/channels)
