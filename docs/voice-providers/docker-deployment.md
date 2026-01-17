# Docker Deployment for Voice Providers

This guide explains how to deploy and manage voice providers using Docker containers with the Docker Provider Adapter system.

## Overview

The Docker Provider Adapter enables:

- **Multi-provider support**: Deploy Faster-Whisper, Chatterbox, Whisper, Deepgram, Kokoro, and more
- **Automatic port allocation**: Prevents port conflicts when running multiple provider instances
- **Volume management**: Persistent model caching across container restarts
- **Health monitoring**: Built-in health checks for each provider
- **Resource limits**: CPU and memory constraints per container
- **GPU support**: CUDA-accelerated inference when available

## Quick Start

### Basic Deployment

```typescript
import { getGlobalDockerProviderAdapter } from '@/media/voice-providers/deployments/docker-provider-adapter.js';

const adapter = getGlobalDockerProviderAdapter();

// Create a Faster-Whisper STT instance
const handler = await adapter.createProviderInstance(
  'whisper-stt',
  'faster-whisper',
);

// Handler is ready to use for speech-to-text
```

### Custom Configuration

```typescript
const handler = await adapter.createProviderInstance(
  'whisper-gpu',
  'faster-whisper',
  {
    image: 'fedirz/faster-whisper-server:latest-gpu',
    port: 8001,
    gpuEnabled: true,
    memoryLimit: '8g',
    env: {
      COMPUTE_TYPE: 'float16',
      DEVICE: 'cuda',
    },
  }
);
```

## Available Providers

### Faster-Whisper (STT)

CPU-optimized speech-to-text based on OpenAI's Whisper.

**Template ID**: `faster-whisper`

**Features**:
- Fast inference on CPU and GPU
- Multiple model sizes (tiny, base, small, medium, large)
- Support for quantization (int8, float16)
- Model caching for persistent storage

**Configuration**:

```json
{
  "image": "fedirz/faster-whisper-server:latest-cpu",
  "port": 8001,
  "volumes": {
    "faster-whisper-models": "/root/.cache/huggingface"
  },
  "env": {
    "DEFAULT_MODEL_SIZE": "base",
    "COMPUTE_TYPE": "int8"
  }
}
```

### Chatterbox (TTS)

High-quality text-to-speech synthesis.

**Template ID**: `chatterbox`

**Features**:
- Natural-sounding voice synthesis
- Multiple voice models
- GPU acceleration support
- Real-time synthesis

**Configuration**:

```json
{
  "image": "chatterbox-tts:latest",
  "port": 5000,
  "gpuEnabled": true,
  "volumes": {
    "chatterbox-models": "/app/models",
    "chatterbox-cache": "/app/cache"
  },
  "env": {
    "TTS_ENGINE": "glow-tts",
    "VOCODER": "hifi-gan"
  }
}
```

### Whisper (STT)

OpenAI's Whisper speech-to-text model.

**Template ID**: `whisper`

**Features**:
- Multi-lingual speech recognition
- Large and medium models
- Robust to accents, background noise
- Zero-shot learning capabilities

**Configuration**:

```json
{
  "image": "openai/whisper:latest-gpu",
  "port": 8002,
  "gpuEnabled": true,
  "env": {
    "MODEL": "medium",
    "DEVICE": "cuda"
  }
}
```

### Deepgram (STT)

Self-hosted Deepgram speech recognition.

**Template ID**: `deepgram`

**Features**:
- High-accuracy transcription
- Real-time streaming support
- Accent and noise robustness
- Efficient resource usage

**Configuration**:

```json
{
  "image": "deepgram-self-hosted:latest",
  "port": 8003,
  "cpuLimit": "4",
  "memoryLimit": "8g"
}
```

### Kokoro (TTS)

Fast, high-quality text-to-speech synthesis.

**Template ID**: `kokoro`

**Features**:
- Ultra-fast synthesis
- Natural prosody
- Multiple voice options
- Low latency inference

**Configuration**:

```json
{
  "image": "kokoro:latest",
  "port": 8000,
  "gpuEnabled": true,
  "volumes": {
    "kokoro-models": "/app/models"
  }
}
```

## Port Allocation

The system automatically allocates ports to prevent conflicts:

```typescript
// Create two instances - they get different ports automatically
const handler1 = await adapter.createProviderInstance('whisper-1', 'faster-whisper');
const handler2 = await adapter.createProviderInstance('whisper-2', 'faster-whisper');

// Each gets a unique port (8000, 8001, etc.)
```

To use specific ports:

```typescript
// Request specific port
const handler = await adapter.createProviderInstance(
  'whisper-gpu',
  'faster-whisper',
  { port: 8001 } // Will use this port if available
);
```

## Volume Management

Volumes persist model data across container restarts:

```typescript
// Models are automatically cached in named volumes
const handler = await adapter.createProviderInstance(
  'whisper-cache',
  'faster-whisper',
  {
    volumes: {
      'custom-models': '/root/.cache/custom',
      'whisper-models': '/root/.cache/huggingface'
    }
  }
);
```

Volume naming convention: `voice-provider-{providerId}-{volumeName}`

## Health Checks

Each provider has a health check endpoint:

```typescript
// Health check is performed automatically during initialization
const handler = await adapter.createProviderInstance(
  'whisper-health',
  'faster-whisper',
  {
    healthCheck: {
      endpoint: 'http://127.0.0.1:8001/health',
      interval: 30000, // Check every 30 seconds
      timeout: 10000   // 10 second timeout
    }
  }
);
```

## GPU Support

Enable GPU acceleration for supported providers:

```typescript
const handler = await adapter.createProviderInstance(
  'whisper-gpu',
  'faster-whisper',
  {
    image: 'fedirz/faster-whisper-server:latest-gpu',
    gpuEnabled: true,
    env: {
      DEVICE: 'cuda',
      DEVICE_INDEX: '0' // Use first GPU
    }
  }
);
```

Requirements:
- NVIDIA Docker runtime installed
- CUDA-compatible GPU
- Sufficient VRAM for model

## Resource Limits

Control container resource usage:

```typescript
const handler = await adapter.createProviderInstance(
  'whisper-limited',
  'faster-whisper',
  {
    cpuLimit: '2',        // 2 CPU cores
    memoryLimit: '4g'     // 4GB RAM
  }
);
```

## Managing Multiple Instances

### Create Multiple Providers

```typescript
const adapter = getGlobalDockerProviderAdapter();

// Create multiple STT instances with different models
const baseStt = await adapter.createProviderInstance(
  'whisper-base',
  'faster-whisper',
  { env: { DEFAULT_MODEL_SIZE: 'base' } }
);

const largeStt = await adapter.createProviderInstance(
  'whisper-large',
  'faster-whisper',
  { env: { DEFAULT_MODEL_SIZE: 'large' } }
);

// Create TTS instance
const tts = await adapter.createProviderInstance(
  'chatterbox-tts',
  'chatterbox'
);
```

### List Active Instances

```typescript
const instances = adapter.getActiveInstances();
// Returns: ['whisper-base', 'whisper-large', 'chatterbox-tts']
```

### Get Handler by ID

```typescript
const handler = adapter.getHandler('whisper-base');
```

### Remove Instance

```typescript
adapter.removeProviderInstance('whisper-base');
// Stops container, releases port, cleans up volumes
```

## Configuration File

The `docker-providers.json` file contains predefined configurations:

```json
{
  "providers": [
    {
      "id": "faster-whisper-gpu",
      "type": "faster-whisper",
      "config": {
        "image": "fedirz/faster-whisper-server:latest-gpu",
        "port": 8001,
        "gpuEnabled": true,
        "env": {
          "COMPUTE_TYPE": "float16"
        }
      }
    }
  ]
}
```

Load from file:

```typescript
import * as fs from 'fs';

const configFile = fs.readFileSync('./config/docker-providers.json', 'utf-8');
const config = JSON.parse(configFile);

for (const provider of config.providers) {
  await adapter.createProviderInstance(
    provider.id,
    provider.type,
    provider.config
  );
}
```

## Environment Variables

Common environment variables for providers:

### Faster-Whisper

- `DEFAULT_MODEL_SIZE`: tiny, base, small, medium, large
- `COMPUTE_TYPE`: int8, float16, float32
- `DEVICE`: cpu, cuda, mps
- `LOG_LEVEL`: DEBUG, INFO, WARNING, ERROR

### Chatterbox

- `API_PORT`: Server port (default: 5000)
- `DEVICE`: cpu, cuda, mps
- `TTS_ENGINE`: glow-tts, tacotron2
- `VOCODER`: hifi-gan, waveglow

### Whisper

- `MODEL`: tiny, base, small, medium, large
- `DEVICE`: cpu, cuda, mps
- `LANGUAGE`: en, es, fr, etc.
- `TASK`: transcribe, translate

## Error Handling

```typescript
try {
  const handler = await adapter.createProviderInstance(
    'whisper-test',
    'unknown-provider'
  );
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.error(`Provider error: ${error.message}`);
    console.error(`Code: ${error.code}`);
    console.error(`Provider: ${error.providerId}`);
  }
}
```

Common errors:

- `UNKNOWN_PROVIDER`: Provider type not found
- `PORT_ALLOCATION_FAILED`: No available ports
- `DOCKER_NOT_INSTALLED`: Docker not available on system
- `IMAGE_PULL_FAILED`: Failed to pull Docker image
- `CONTAINER_STARTUP_FAILED`: Container failed to start
- `HEALTH_CHECK_TIMEOUT`: Service did not become healthy

## Cleanup

Always clean up resources when done:

```typescript
// Remove individual instance
adapter.removeProviderInstance('whisper-1');

// Remove all instances and clean up
await adapter.cleanup();
```

## Best Practices

1. **Use named volumes** for persistent model caching
2. **Set appropriate resource limits** to prevent system overload
3. **Enable health checks** for production deployments
4. **Use GPU for large models** when available
5. **Monitor health check logs** for issues
6. **Clean up unused instances** to free resources
7. **Use predefined templates** as starting points
8. **Test configuration locally** before production

## Troubleshooting

### Port Already in Use

```typescript
// Use auto-allocation or specify a different port
const handler = await adapter.createProviderInstance(
  'whisper-alt',
  'faster-whisper',
  { port: 8100 } // Use non-standard port
);
```

### Health Check Fails

Check container logs:

```bash
docker logs {container_name}
```

Increase health check timeout:

```typescript
{
  healthCheck: {
    endpoint: 'http://127.0.0.1:8001/health',
    timeout: 30000 // Increase to 30 seconds
  }
}
```

### Out of Memory

Reduce model size or memory limit:

```typescript
{
  env: { DEFAULT_MODEL_SIZE: 'tiny' },
  memoryLimit: '2g'
}
```

### GPU Not Detected

Verify NVIDIA Docker runtime:

```bash
docker run --rm --gpus all nvidia/cuda:latest nvidia-smi
```

Disable GPU if unavailable:

```typescript
{ gpuEnabled: false }
```

## References

- [Docker Provider Adapter API Documentation](#)
- [Faster-Whisper GitHub](https://github.com/SYSTRAN/faster-whisper)
- [Chatterbox Documentation](#)
- [OpenAI Whisper](https://github.com/openai/whisper)
- [Deepgram Self-Hosted](https://developers.deepgram.com/)
- [Kokoro TTS](https://github.com/kokoro-tts)
