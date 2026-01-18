# Docker Voice Provider Deployment - Quick Start

## Installation

The Docker Provider Adapter is built into Clawdbot. No additional installation needed.

## Basic Usage

### 1. Deploy a Single Provider

```typescript
import { getGlobalDockerProviderAdapter } from '@/media/voice-providers/deployments/docker-provider-adapter';

const adapter = getGlobalDockerProviderAdapter();

// Create a Faster-Whisper STT instance
const handler = await adapter.createProviderInstance('my-stt', 'faster-whisper');

console.log('STT service running on port 8001');
```

### 2. Deploy Multiple Providers

```typescript
const adapter = getGlobalDockerProviderAdapter();

// STT
const stt = await adapter.createProviderInstance('stt', 'faster-whisper');

// TTS
const tts = await adapter.createProviderInstance('tts', 'chatterbox');

console.log('STT on 8001, TTS on 5000');
```

### 3. Use GPU Acceleration

```typescript
const adapter = getGlobalDockerProviderAdapter();

const handler = await adapter.createProviderInstance('whisper-gpu', 'faster-whisper', {
  gpuEnabled: true,
  memoryLimit: '8g',
  env: {
    COMPUTE_TYPE: 'float16'  // Faster on GPU
  }
});
```

### 4. Load from Configuration File

```typescript
import * as fs from 'fs';

const adapter = getGlobalDockerProviderAdapter();
const config = JSON.parse(fs.readFileSync('./config/docker-providers.json'));

for (const provider of config.providers) {
  await adapter.createProviderInstance(provider.id, provider.type, provider.config);
  console.log(`Created: ${provider.id}`);
}
```

## Available Providers

| Provider | Type | Default Port | GPU Support | Use Case |
|----------|------|--------------|-------------|----------|
| faster-whisper | STT | 8001 | Yes | Fast, accurate speech recognition |
| chatterbox | TTS | 5000 | Yes | High-quality voice synthesis |
| whisper | STT | 8002 | Yes | OpenAI's Whisper model |
| deepgram | STT | 8003 | No | Self-hosted Deepgram |
| kokoro | TTS | 8000 | Yes | Ultra-fast synthesis |

## Common Tasks

### List Available Providers

```typescript
const adapter = getGlobalDockerProviderAdapter();
const providers = adapter.listAvailableProviders();
console.log(providers);  // ['faster-whisper', 'chatterbox', 'whisper', ...]
```

### Get Provider Template

```typescript
const adapter = getGlobalDockerProviderAdapter();
const template = adapter.getTemplate('faster-whisper');

console.log(template.defaultImage);      // fedirz/faster-whisper-server:latest-cpu
console.log(template.defaultPort);       // 8001
console.log(template.healthCheckPath);   // /health
```

### List Active Instances

```typescript
const adapter = getGlobalDockerProviderAdapter();
const instances = adapter.getActiveInstances();
console.log(instances);  // ['stt', 'tts']
```

### Get Instance Handler

```typescript
const adapter = getGlobalDockerProviderAdapter();
const handler = adapter.getHandler('my-stt');
```

### Remove Instance

```typescript
const adapter = getGlobalDockerProviderAdapter();
adapter.removeProviderInstance('my-stt');
```

### Clean Up All

```typescript
const adapter = getGlobalDockerProviderAdapter();
await adapter.cleanup();  // Stops all containers, releases resources
```

## Configuration Examples

### Small Model for Speed

```typescript
{
  env: {
    DEFAULT_MODEL_SIZE: 'tiny',
    COMPUTE_TYPE: 'int8'
  },
  memoryLimit: '2g'
}
```

### Large Model for Accuracy

```typescript
{
  gpuEnabled: true,
  env: {
    DEFAULT_MODEL_SIZE: 'large',
    COMPUTE_TYPE: 'float16'
  },
  memoryLimit: '12g'
}
```

### Production with Redundancy

```typescript
// Primary with GPU
const primary = await adapter.createProviderInstance('stt-primary', 'faster-whisper', {
  gpuEnabled: true,
  memoryLimit: '8g'
});

// Fallback without GPU
const fallback = await adapter.createProviderInstance('stt-fallback', 'faster-whisper', {
  gpuEnabled: false,
  memoryLimit: '2g',
  env: { DEFAULT_MODEL_SIZE: 'tiny' }
});
```

## Port Configuration

### Automatic Port Allocation

```typescript
// These automatically get different ports
const stt1 = await adapter.createProviderInstance('stt-1', 'faster-whisper');
const stt2 = await adapter.createProviderInstance('stt-2', 'faster-whisper');
// stt-1: 8001, stt-2: 8002
```

### Specific Port

```typescript
const handler = await adapter.createProviderInstance('stt-custom', 'faster-whisper', {
  port: 9000  // Use this specific port
});
```

## Environment Variables

### Faster-Whisper

```typescript
{
  env: {
    DEFAULT_MODEL_SIZE: 'base',    // tiny, base, small, medium, large
    COMPUTE_TYPE: 'int8',          // int8, float16, float32
    LOG_LEVEL: 'INFO'              // DEBUG, INFO, WARNING, ERROR
  }
}
```

### Chatterbox

```typescript
{
  env: {
    TTS_ENGINE: 'glow-tts',        // TTS synthesis engine
    VOCODER: 'hifi-gan',           // Vocoder for audio generation
    DEVICE: 'cuda'                 // cpu, cuda, mps
  }
}
```

### Whisper

```typescript
{
  env: {
    MODEL: 'base',                 // tiny, base, small, medium, large
    DEVICE: 'cuda',                // cpu, cuda, mps
    LANGUAGE: 'en'                 // Language code
  }
}
```

## Troubleshooting

### Port Already in Use

```typescript
// Use auto-allocation or specify a different port
const handler = await adapter.createProviderInstance('stt-alt', 'faster-whisper', {
  port: 8100
});
```

### Health Check Fails

Increase timeout:
```typescript
{
  healthCheck: {
    endpoint: 'http://127.0.0.1:8001/health',
    timeout: 30000  // 30 seconds instead of 10
  }
}
```

### Out of Memory

Use smaller model:
```typescript
{
  env: { DEFAULT_MODEL_SIZE: 'tiny' },
  memoryLimit: '2g'
}
```

### GPU Not Found

Disable GPU:
```typescript
{
  gpuEnabled: false
}
```

## Integration with Voice Providers

The adapter integrates with the existing voice provider system:

```typescript
import { KokoroExecutor } from '@/media/voice-providers/kokoro';
import { getGlobalDockerProviderAdapter } from '@/media/voice-providers/deployments/docker-provider-adapter';

const adapter = getGlobalDockerProviderAdapter();

// Deploy via adapter
const handler = await adapter.createProviderInstance('kokoro', 'kokoro');

// Use with executor
const executor = new KokoroExecutor({
  mode: 'docker',
  docker: {
    image: 'kokoro:latest',
    port: 8000
  }
});

await executor.initialize();
```

## Resources

- Full documentation: `./docs/voice-providers/docker-deployment.md`
- Examples: `./src/media/voice-providers/deployments/docker-provider-adapter.example.ts`
- Configuration: `./config/docker-providers.json`
- Tests: `./src/media/voice-providers/deployments/docker-provider-adapter.test.ts`

## Next Steps

1. Read the full [Docker Deployment Guide](./docs/voice-providers/docker-deployment.md)
2. Check the [Example Configurations](./config/docker-providers.json)
3. Review the [Usage Examples](./src/media/voice-providers/deployments/docker-provider-adapter.example.ts)
4. Run the tests: `pnpm test docker-provider-adapter.test.ts`
