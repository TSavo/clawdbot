# Whisper STT Provider - Quick Start Guide

## Installation

### System Mode (Python Package)

```bash
# Install openai-whisper
pip install openai-whisper torch

# Verify installation
python3 -c "import whisper; whisper.load_model('base')"

# Optional: Install FFmpeg for audio format support
brew install ffmpeg    # macOS
apt-get install ffmpeg # Ubuntu/Debian
```

### Docker Mode (Containerized)

```bash
# Pull Whisper Docker image
docker pull openai/whisper:latest

# Or verify Docker is available
docker version
```

## Configuration

### Add to Voice Providers Config

```yaml
voice:
  enabled: true
  providers:
    - id: whisper-stt
      enabled: true
      priority: 1
      stt:
        type: whisper
        modelSize: base  # tiny, small, base, medium, large
        language: en     # optional
```

### Environment Setup

```bash
# Choose deployment mode
export WHISPER_DEPLOYMENT=system    # or 'docker'

# System mode
export WHISPER_PYTHON_PATH=/usr/bin/python3
export WHISPER_CACHE_PATH=~/.cache/whisper

# Docker mode
export WHISPER_DOCKER_PORT=8000
export WHISPER_DOCKER_IMAGE=openai/whisper:latest
```

## Basic Usage

### Initialize and Transcribe

```typescript
import { WhisperExecutor } from 'src/media/voice-providers/whisper';

// Create executor
const executor = new WhisperExecutor('whisper-stt', {
  type: 'whisper',
  modelSize: 'base',
});

// Initialize (starts deployment)
await executor.initialize();

// Create audio buffer (example: 1-second silence at 16kHz)
const audioBuffer = {
  data: new Uint8Array(32000),  // 16000 samples * 2 bytes
  format: 'pcm16',
  sampleRate: 16000,
  duration: 1000,
  channels: 1,
};

// Transcribe
try {
  const result = await executor.transcribe(audioBuffer, {
    language: 'en',
  });
  console.log('Transcribed:', result.text);
} catch (error) {
  console.error('Transcription failed:', error);
}

// Cleanup
await executor.shutdown();
```

### Using with Voice Provider Registry

```typescript
import { VoiceProviderRegistry } from 'src/media/voice-providers/registry';

// Create and load registry
const registry = new VoiceProviderRegistry();
await registry.loadProviders(voiceConfig);

// Get executor
const executor = await registry.getTranscriber('whisper-stt');

// Use it
const result = await executor.transcribe(audioBuffer);
console.log(result.text);
```

### Using Plugin Service

```typescript
import {
  WhisperPluginService,
  getWhisperPluginService
} from 'src/media/voice-providers/whisper.service';

// Get global service instance
const service = getWhisperPluginService({
  autoDetectDeployment: true,
  downloadModelsOnInit: true,
});

// Initialize provider
await service.initialize('whisper-stt', {
  type: 'whisper',
  modelSize: 'base',
});

// Get executor
const executor = service.getExecutor();

// Use it
const result = await executor.transcribe(audioBuffer);

// Check health
const healthy = await executor.isHealthy();
console.log('Provider healthy:', healthy);

// Cleanup
await service.shutdown();
```

## Streaming Transcription

```typescript
// Create audio stream
const audioStream = new ReadableStream({
  start(controller) {
    // Enqueue audio chunks
    controller.enqueue(audioChunk1);
    controller.enqueue(audioChunk2);
    controller.close();
  },
});

// Transcribe stream
for await (const chunk of executor.transcribeStream(audioStream)) {
  if (chunk.partial) {
    console.log('Partial:', chunk.text);
  } else {
    console.log('Final:', chunk.text);
  }
}
```

## Model Sizes

| Size | Use Case | Memory | Download |
|------|----------|--------|----------|
| tiny | Quick tests | 100MB | 140MB |
| small | Low-latency apps | 500MB | 292MB |
| base | Balanced (default) | 1GB | 969MB |
| medium | High accuracy | 2.5GB | 3.1GB |
| large | Best accuracy | 4GB | 6.2GB |

## Common Tasks

### Check Provider Capabilities

```typescript
const caps = executor.getCapabilities();
console.log('Supported formats:', caps.supportedFormats);
console.log('Sample rates:', caps.supportedSampleRates);
console.log('Languages:', caps.supportedLanguages);
console.log('Max concurrent:', caps.maxConcurrentSessions);
```

### Get Provider Status

```typescript
const service = getWhisperPluginService();
const status = service.getStatus();

console.log('Initialized:', status.initialized);
console.log('Deployment mode:', status.deploymentMode);
console.log('Healthy:', status.healthy);
```

### Handle Errors

```typescript
import { VoiceProviderError } from 'src/media/voice-providers/executor';

try {
  const result = await executor.transcribe(audioBuffer);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.error(`[${error.provider}] ${error.code}`);
    console.error(`Message: ${error.message}`);
  }
}
```

### Get Docker Logs

```typescript
const dockerHandler = executor.getDockerDeployment();
if (dockerHandler) {
  const logs = await dockerHandler.getLogs(50);
  console.log(logs);
}
```

### Get System Info

```typescript
const systemHandler = executor.getSystemDeployment();
if (systemHandler) {
  const info = await systemHandler.getPythonInfo();
  console.log('Python version:', info.pythonVersion);
  console.log('Whisper version:', info.whisperVersion);
  console.log('FFmpeg available:', info.ffmpegAvailable);
}
```

## Troubleshooting

### Python Package Not Found (System Mode)

```bash
# Install with pip
pip install openai-whisper torch

# Or check installation
python3 -m pip show openai-whisper
```

### Docker Container Won't Start (Docker Mode)

```bash
# Check Docker is running
docker ps

# Pull image manually
docker pull openai/whisper:latest

# Check port availability
lsof -i :8000
```

### Models Not Downloading

```bash
# Check cache directory exists
mkdir -p ~/.cache/whisper

# Set custom cache location
export WHISPER_CACHE_PATH=/path/to/cache
```

### Memory Issues

- Use smaller model size (tiny or small)
- Increase system resources
- Docker: Set memory limit via `memoryLimit` option

### Timeout Issues

```typescript
// Increase timeout
const result = await executor.transcribe(audioBuffer, {
  timeout: 120000,  // 2 minutes
});
```

## Environment Variables Reference

```bash
# Deployment
WHISPER_DEPLOYMENT=system|docker

# System mode
WHISPER_PYTHON_PATH=/path/to/python3
WHISPER_CACHE_PATH=/path/to/cache

# Docker mode
WHISPER_DOCKER_PORT=8000
WHISPER_DOCKER_IMAGE=openai/whisper:latest
```

## Testing

### Run Tests

```bash
pnpm test src/media/voice-providers/whisper.test.ts
```

### Run Specific Test

```bash
pnpm test whisper -t "Initialization"
```

### With Coverage

```bash
pnpm test:coverage
```

## Next Steps

1. Read [WHISPER.md](./WHISPER.md) for detailed documentation
2. Review [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for architecture
3. Check [whisper.test.ts](./whisper.test.ts) for usage examples
4. Review [registry.ts](./registry.ts) for integration pattern

## Support

- Check logs: `docker logs whisper-stt` (Docker mode)
- Python traceback: Check stderr output (System mode)
- Enable debug logging by reviewing error codes in `executor.ts`

## Related Providers

- **Faster-Whisper**: Faster variant with same interface
- **OpenAI STT**: Cloud-based transcription
- **Other STT Providers**: Google, Azure, etc. (via registry pattern)
