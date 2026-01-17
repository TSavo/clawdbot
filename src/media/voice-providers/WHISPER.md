# Whisper STT Provider

## Overview

The Whisper STT (Speech-to-Text) provider integrates OpenAI's Whisper model for robust speech recognition. It supports multiple deployment modes and provides comprehensive error handling with automatic fallback capabilities.

## Features

- **Dual Deployment Modes**
  - Docker: Containerized API service with GPU support
  - System: Local Python package installation

- **Flexible Model Selection**
  - Tiny, Small, Base, Medium, Large model sizes
  - Automatic model download and caching
  - Configurable cache directory

- **Language Support**
  - Multilingual transcription (99 languages)
  - Automatic language detection
  - Manual language specification

- **Audio Format Support**
  - PCM 16-bit
  - MP3, AAC, OGG Vorbis, Opus
  - Various sample rates (16kHz, 44.1kHz, 48kHz)

- **Streaming Support**
  - Real-time transcription via audio streams
  - Partial result streaming
  - Configurable chunk buffering

- **Robust Error Handling**
  - Provider-specific error codes
  - Automatic health checks
  - Fallback provider support

## Deployment Modes

### Docker Deployment

Runs Whisper as a containerized API service. Best for:
- High concurrency (up to 4 concurrent sessions)
- GPU acceleration
- Isolated environments
- Production deployments

```typescript
const handler = new WhisperDockerDeploymentHandler({
  port: 8000,
  dockerImage: 'openai/whisper:latest',
  gpuEnabled: true,
  modelSize: 'base',
  memoryLimit: '4g',
});

await handler.start();
```

**Environment Variables:**
- `WHISPER_DEPLOYMENT=docker`
- `WHISPER_DOCKER_PORT=8000`
- `WHISPER_DOCKER_IMAGE=openai/whisper:latest`

**Docker API Endpoints:**
- `GET /health` - Health check
- `POST /transcribe` - Transcribe audio
  - Parameters: `audio` (file), `language` (optional), `model_size` (optional)
  - Returns: `{ text, language, duration, confidence }`

### System Deployment

Uses locally installed Python package. Best for:
- Single concurrent session
- Development environments
- Lightweight deployments
- CPU-only setups

```typescript
const handler = new WhisperSystemDeploymentHandler({
  modelSize: 'base',
  pythonPath: 'python3',
  device: 'cpu',
});

await handler.initialize();
```

**Environment Variables:**
- `WHISPER_DEPLOYMENT=system`
- `WHISPER_PYTHON_PATH=/usr/bin/python3`
- `WHISPER_CACHE_PATH=~/.cache/whisper`

**Requirements:**
- Python 3.8+
- PyTorch
- openai-whisper: `pip install openai-whisper`
- FFmpeg (optional, for audio format conversion)

```bash
# Install system deployment
pip install openai-whisper torch

# Verify installation
python3 -c "import whisper; whisper.load_model('base')"
```

## Configuration

### Provider Configuration

```yaml
providers:
  - id: whisper-stt
    stt:
      type: whisper
      modelSize: base          # tiny, small, base, medium, large
      language: en             # Optional: language code
```

### Service Initialization

```typescript
import { WhisperPluginService } from './whisper.service';

const service = new WhisperPluginService({
  autoDetectDeployment: true,
  preferredDeployment: 'docker',
  autoStartDocker: true,
  downloadModelsOnInit: true,
  cacheDir: '~/.cache/whisper',
});

await service.initialize('whisper-stt', {
  type: 'whisper',
  modelSize: 'base',
});
```

## Usage

### Basic Transcription

```typescript
import { WhisperExecutor } from './whisper';

const executor = new WhisperExecutor('whisper-stt', {
  type: 'whisper',
  modelSize: 'base',
});

await executor.initialize();

const result = await executor.transcribe(audioBuffer, {
  language: 'en',
});

console.log(result.text);  // "Hello, this is a test"
```

### Stream Transcription

```typescript
const audioStream = /* ReadableStream<AudioBuffer> */;

for await (const chunk of executor.transcribeStream(audioStream)) {
  if (!chunk.partial) {
    console.log('Final:', chunk.text);
  }
}
```

### Capabilities

```typescript
const caps = executor.getCapabilities();

console.log(caps.supportedFormats);      // ['pcm16', 'opus', 'aac', 'mp3']
console.log(caps.supportedLanguages);    // [99 languages]
console.log(caps.supportsStreaming);     // true
console.log(caps.maxConcurrentSessions); // 1 (system) or 4 (docker)
```

### Health Checks

```typescript
const healthy = await executor.isHealthy();

if (!healthy) {
  console.warn('Provider is unhealthy');
}
```

## Error Handling

All errors are wrapped in `VoiceProviderError` with specific codes:

### Common Error Codes

- `INIT_FAILED` - Initialization failed
- `NOT_INITIALIZED` - Executor not initialized
- `TRANSCRIPTION_FAILED` - Transcription failed
- `STREAM_TRANSCRIPTION_FAILED` - Stream transcription failed
- `CONTAINER_NOT_RUNNING` - Docker container not running
- `CONNECTION_FAILED` - Failed to connect to Docker API
- `TIMEOUT` - Operation timed out
- `NOT_SUPPORTED` - Operation not supported (e.g., synthesis)

### Error Handling Example

```typescript
import { VoiceProviderError } from './executor';

try {
  const result = await executor.transcribe(audio);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
  }
}
```

## Performance

### Docker Deployment

- **Throughput**: ~4 concurrent sessions
- **Latency**: ~2000ms (2 seconds)
- **Memory**: ~2GB per session with base model
- **GPU**: Supports NVIDIA CUDA with `--gpus all`

### System Deployment

- **Throughput**: 1 concurrent session
- **Latency**: ~3000ms (3 seconds)
- **Memory**: ~1GB with base model
- **CPU**: Uses all available threads by default

### Model Sizes

| Size | English-only | Multilingual | Parameters | Download Size |
|------|-------------|------------|-----------|---------------|
| tiny | 39M | 39M | 39M | 140MB |
| base | 74M | 74M | 74M | 292MB |
| small | 244M | 244M | 244M | 969MB |
| medium | 769M | 769M | 769M | 3.1GB |
| large | 1.5B | 1.5B | 1.5B | 6.2GB |

## Integration with Registry

The provider is automatically discovered and instantiated via the `VoiceProviderRegistry`:

```typescript
import { VoiceProviderRegistry } from './registry';

const registry = new VoiceProviderRegistry();

await registry.loadProviders(config);

const executor = await registry.getTranscriber('whisper-stt');

const result = await executor.transcribe(audioBuffer);
```

## Deployment Handlers

### WhisperDockerDeploymentHandler

Manages Docker container lifecycle.

```typescript
const handler = new WhisperDockerDeploymentHandler({
  port: 8000,
  dockerImage: 'openai/whisper:latest',
  containerName: 'whisper-stt',
  gpuEnabled: true,
  modelSize: 'base',
  cpuLimit: '2',
  memoryLimit: '4g',
});

// Start container
await handler.start();

// Transcribe via API
const result = await handler.transcribe(audioBuffer);

// Health check
const healthy = await handler.healthCheck();

// Get logs
const logs = await handler.getLogs(100);

// Stop container
await handler.stop();
```

### WhisperSystemDeploymentHandler

Manages system Python package deployment.

```typescript
const handler = new WhisperSystemDeploymentHandler({
  modelSize: 'base',
  pythonPath: 'python3',
  device: 'cpu',
  cachePath: '~/.cache/whisper',
});

// Initialize
await handler.initialize();

// Transcribe
const result = await handler.transcribe(audioBuffer, {
  language: 'en',
});

// Health check
const healthy = await handler.healthCheck();

// Get Python info
const info = await handler.getPythonInfo();
```

## Testing

```bash
# Run all tests
pnpm test src/media/voice-providers/whisper.test.ts

# Run specific test suite
pnpm test whisper -t "Docker Deployment"

# Run with coverage
pnpm test:coverage
```

## Troubleshooting

### Docker Container Won't Start

```bash
# Check Docker daemon
docker ps

# Check image exists
docker images | grep whisper

# View container logs
docker logs whisper-stt

# Check port availability
lsof -i :8000
```

### Python Package Installation Issues

```bash
# Install with specific PyTorch backend
pip install openai-whisper torch torchvision torchaudio

# For CUDA support
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For Apple Silicon (MPS)
pip install torch torchvision torchaudio
```

### Audio Processing Issues

```bash
# Install FFmpeg
brew install ffmpeg      # macOS
apt-get install ffmpeg   # Ubuntu/Debian
choco install ffmpeg     # Windows
```

### Memory Issues

- Use smaller model size (tiny or small)
- Docker: Increase memory limit
- System: Run fewer concurrent sessions

### Timeout Issues

- Increase timeout in transcribe options
- Use smaller model size
- Check system resources

## Migration Notes

The Whisper implementation follows the same pattern as other voice providers:

- **Executor Interface**: `VoiceProviderExecutor`
- **Registry Integration**: Via `createExecutor()` in `VoiceProviderRegistry`
- **Error Handling**: `VoiceProviderError`
- **Health Checks**: `isHealthy()` method
- **Capabilities**: `getCapabilities()` method

## Future Enhancements

- GPU optimization for larger models
- Custom vocabulary/prompting
- Phrase hints for improved accuracy
- Model quantization support
- Batch transcription API
- Language-specific optimizations

## References

- OpenAI Whisper: https://github.com/openai/whisper
- Faster-Whisper: https://github.com/guillaumekln/faster-whisper
- PyTorch: https://pytorch.org
- FFmpeg: https://ffmpeg.org

## Support

For issues or questions:
1. Check troubleshooting section above
2. Review test files for usage examples
3. Check provider logs for error details
4. File GitHub issue if needed
