# Faster-Whisper STT Provider Integration Guide

This document describes the Faster-Whisper Speech-to-Text (STT) provider implementation with comprehensive compute optimization, GPU detection, and deployment support.

## Overview

Faster-Whisper is a high-performance implementation of OpenAI's Whisper model by Systran. This integration provides:

- **Multi-compute type support**: int8 (fastest), float16 (balanced), float32 (most accurate)
- **Automatic GPU detection**: CUDA (NVIDIA), Metal/MPS (Apple), ROCm (AMD), Intel GPU
- **Hardware-aware optimization**: Auto-selects optimal compute type and settings
- **Streaming transcription**: Real-time audio processing support
- **Performance monitoring**: Track latency, throughput, and resource usage
- **Multiple deployment methods**: Docker (isolated) and System (native)
- **Comprehensive benchmarking**: Performance comparison suite

## Architecture

### Core Components

1. **FasterWhisperExecutor** (`faster-whisper.ts`)
   - Implements `VoiceProviderExecutor` interface
   - Handles transcription with configurable compute types
   - Supports streaming audio input
   - Provides performance metrics tracking
   - Model caching for efficiency

2. **GPU Detection** (`gpu-detection.ts`)
   - Detects available GPU hardware
   - Determines compute capability and memory
   - Auto-recommends optimal settings
   - Provides system information

3. **Plugin Service** (`faster-whisper-service.ts`)
   - Service registration and lifecycle
   - Hardware profiling on initialization
   - Auto-optimization configuration
   - Performance reporting

4. **Deployment Handlers** (`deployment-handlers.ts`)
   - Docker deployment with GPU passthrough
   - System deployment with environment setup
   - CUDA/ROCm path detection
   - Systemd and launchd service generation

5. **Benchmarking Suite** (`faster-whisper.benchmark.ts`)
   - Performance comparison across configurations
   - Latency, throughput, and RTF metrics
   - CSV/JSON export
   - Recommendations engine

## Configuration

### Basic Configuration

```typescript
const config: FasterWhisperConfig = {
  type: 'faster-whisper',
  modelSize: 'base', // tiny, small, base, medium, large
  language: 'en',
  computeType: 'float16', // int8, float16, float32
  cpuThreads: 4,
  beamSize: 5,
};
```

### Via Registry

```typescript
import { VoiceProviderRegistry } from './registry';
import type { VoiceProvidersConfig } from '../../config/zod-schema.voice-providers';

const config: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: 'faster-whisper-primary',
      name: 'Faster-Whisper STT',
      enabled: true,
      priority: 1,
      stt: {
        type: 'faster-whisper',
        modelSize: 'base',
        language: 'en',
        computeType: 'float16',
        cpuThreads: 4,
        beamSize: 5,
      },
    },
  ],
};

const registry = new VoiceProviderRegistry();
await registry.loadProviders(config);
const transcriber = await registry.getTranscriber('faster-whisper-primary');
```

## Usage Examples

### Basic Transcription

```typescript
import { FasterWhisperExecutor } from './faster-whisper';
import { AudioFormat } from './executor';

const executor = new FasterWhisperExecutor('my-provider', {
  type: 'faster-whisper',
  modelSize: 'base',
  computeType: 'float16',
  cpuThreads: 4,
  beamSize: 5,
});

await executor.initialize();

const audio = {
  data: new Uint8Array(/* PCM audio data */),
  format: AudioFormat.PCM_16,
  sampleRate: 16000,
  duration: 5000, // milliseconds
  channels: 1,
};

const result = await executor.transcribe(audio);
console.log(`Transcribed: ${result.text}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Language: ${result.language}`);
```

### Streaming Transcription

```typescript
const audioStream = new ReadableStream({
  start(controller) {
    // Push audio chunks
    controller.enqueue(chunk1);
    controller.enqueue(chunk2);
    controller.close();
  },
});

for await (const chunk of executor.transcribeStream(audioStream)) {
  console.log(`Partial: ${chunk.text}`);
}
```

### Performance Monitoring

```typescript
// Perform transcriptions...

const metrics = executor.getPerformanceMetrics();
console.log(`Average latency: ${metrics.averageLatencyMs}ms`);
console.log(`Average RTF: ${metrics.averageRTF}`);
console.log(`GPU usage: ${metrics.gpuUsagePercent}%`);
```

### GPU Detection and Optimization

```typescript
import { detectGPU, recommendOptimizations, formatGPUInfo } from './gpu-detection';

const gpu = await detectGPU();
console.log(`GPU Info: ${formatGPUInfo(gpu)}`);

const recommendations = await recommendOptimizations(gpu);
console.log(`Recommended compute type: ${recommendations.computeType}`);
console.log(`Recommended threads: ${recommendations.cpuThreads}`);
console.log(`Estimated latency: ${recommendations.estimatedLatencyMs}ms`);

// Apply recommendations
executor.setComputeType(recommendations.computeType);
executor.setCPUThreads(recommendations.cpuThreads);
executor.setBeamSize(recommendations.beamSize);
```

### Service Registration

```typescript
import { createFasterWhisperService, FasterWhisperPluginMetadata } from './faster-whisper-service';

const result = await createFasterWhisperService({
  id: 'faster-whisper-prod',
  config: {
    type: 'faster-whisper',
    modelSize: 'base',
    computeType: 'float16',
    cpuThreads: 4,
    beamSize: 5,
  },
  enableLogging: true,
  autoOptimize: true,
});

console.log(`GPU Available: ${result.gpuAvailable}`);
console.log(`GPU Info: ${result.gpuInfo}`);
console.log(`Compute Type: ${result.optimizations.computeType}`);

const executor = result.executor;
```

## Deployment

### Docker Deployment

```typescript
import { DockerDeploymentHandler } from './deployment-handlers';

const dockerConfig = {
  image: 'systran/faster-whisper:latest-cuda',
  gpuSupport: true,
  gpuRuntime: 'nvidia',
  memoryMb: 8192,
  cpuCores: 4,
  computeType: 'float16' as const,
  beamSize: 5,
  port: 8000,
};

const result = await DockerDeploymentHandler.deploy(dockerConfig);

// Generated docker run command:
console.log(result.configuration.command);

// Generated Dockerfile:
console.log(result.configuration.dockerfile);

// Generated docker-compose.yml:
console.log(result.configuration.dockerCompose);
```

### System Deployment

```typescript
import { SystemDeploymentHandler } from './deployment-handlers';

const systemConfig = {
  pythonPath: '/usr/bin/python3',
  venvPath: '/opt/faster-whisper-env',
  gpuSupport: true,
  cudaPath: '/usr/local/cuda',
  computeType: 'float16' as const,
  beamSize: 5,
  cpuThreads: 4,
};

const result = await SystemDeploymentHandler.deploy(systemConfig);

// Generated installation script:
console.log(result.configuration.installScript);

// Generated systemd service:
console.log(result.configuration.systemdService);

// Generated launchd plist (macOS):
console.log(result.configuration.launchdPlist);
```

## Benchmarking

### Quick Benchmark

```typescript
import { runQuickBenchmark } from './faster-whisper.benchmark';

const report = await runQuickBenchmark();

// Report includes:
// - System information
// - Test results (latency, RTF, throughput)
// - Recommendations
// - Exportable data (JSON/CSV)
```

### Custom Benchmark

```typescript
import { FasterWhisperBenchmark } from './faster-whisper.benchmark';

const benchmark = new FasterWhisperBenchmark({
  runs: 10,
  audioLengthMs: 10000,
  testComputeTypes: ['int8', 'float16', 'float32'],
  testBeamSizes: [1, 5, 10],
  testCpuThreads: [1, 2, 4, 8],
  verboseLogging: true,
});

const report = await benchmark.runBenchmarks();

// Print results
FasterWhisperBenchmark.printReport(report);

// Export results
const json = FasterWhisperBenchmark.exportJSON(report);
const csv = FasterWhisperBenchmark.exportCSV(report);
```

## Performance Optimization

### Hardware-Specific Recommendations

#### NVIDIA GPU (CUDA)
- **High-end (16GB+)**: float32, beam_size=10, max threads
- **Mid-range (8GB)**: float16, beam_size=8, half threads
- **Low-end (2-4GB)**: int8, beam_size=3, 1-2 threads

#### Apple Silicon (Metal/MPS)
- **M1/M2**: float16, beam_size=5, 2-4 threads
- **M1 Pro/Max**: float16, beam_size=8, 4-6 threads
- **M1 Ultra**: float32, beam_size=10, max threads

#### AMD GPU (ROCm)
- **High-end**: float16, beam_size=5, auto-threads
- **Limited info**: Defaults to int8, beam_size=3

#### CPU-Only
- **16+ cores**: float16, beam_size=5, half cores
- **8-15 cores**: float16, beam_size=3, quarter cores
- **4-7 cores**: int8, beam_size=3, 1-2 cores
- **1-3 cores**: int8, beam_size=1, single thread

### Real-Time Factor (RTF)

RTF = Processing Time / Audio Duration

- RTF < 0.1: Very fast (can handle >10x real-time)
- RTF 0.1-1.0: Real-time capable
- RTF 1.0-5.0: Near real-time (slight delay)
- RTF > 5.0: Offline only

## Supported Languages

Whisper supports 99 languages including:
- English, Spanish, French, German, Chinese
- Japanese, Korean, Russian, Portuguese, Italian
- Arabic, Hindi, Vietnamese, Thai, Indonesian
- And 84 more languages

## Configuration Schema

```typescript
interface FasterWhisperConfig {
  type: 'faster-whisper';
  modelSize?: 'tiny' | 'small' | 'base' | 'medium' | 'large';
  language?: string;
  computeType?: 'int8' | 'float16' | 'float32';
  cpuThreads?: number; // 1-512
  beamSize?: number; // 1-512
}
```

## Capabilities

```typescript
interface ProviderCapabilities {
  supportedFormats: [PCM_16, OPUS, MP3];
  supportedSampleRates: [8000, 16000, 32000, 44100, 48000];
  supportedLanguages: 99 languages;
  supportsStreaming: true;
  maxConcurrentSessions: cpuThreads;
  estimatedLatencyMs: 500-2000 (GPU) or 2000-8000 (CPU);
  requiresNetworkConnection: false;
  requiresLocalModel: true;
}
```

## Error Handling

```typescript
import { VoiceProviderError } from './executor';

try {
  await executor.transcribe(audio);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.error(`Provider: ${error.provider}`);
    console.error(`Code: ${error.code}`);
    console.error(`Message: ${error.message}`);
  }
}
```

## Testing

Run the test suite:

```bash
pnpm test src/media/voice-providers/faster-whisper.test.ts
pnpm test src/media/voice-providers/gpu-detection.test.ts
```

## Integration with Voice Registry

The executor is automatically integrated with the voice provider registry. When a Faster-Whisper STT configuration is encountered:

```typescript
// In registry.ts
if (sttConfig.type === 'faster-whisper') {
  const { FasterWhisperExecutor } = await import('./faster-whisper.js');
  return new FasterWhisperExecutor(entry.id, sttConfig);
}
```

## Performance Characteristics

### Typical Latencies (per 1 second of audio)

| Config | CPU (8c) | GPU (RTX 3080) |
|--------|----------|----------------|
| int8, beam=1 | 1.5s | 200ms |
| int8, beam=5 | 2.0s | 250ms |
| float16, beam=5 | 3.0s | 400ms |
| float32, beam=10 | 5.0s | 800ms |

### Memory Usage

| Model | int8 | float16 | float32 |
|-------|------|---------|---------|
| tiny | 400MB | 600MB | 900MB |
| small | 600MB | 1GB | 1.5GB |
| base | 900MB | 1.4GB | 2.6GB |
| medium | 2GB | 3.5GB | 6GB |
| large | 3GB | 5GB | 9GB |

## Troubleshooting

### GPU Not Detected

Check environment variables:
- CUDA_PATH (for NVIDIA)
- ROCM_PATH (for AMD)
- Platform (for Apple Silicon)

### Slow Performance

- Check GPU utilization: `nvidia-smi` or equivalent
- Reduce beam_size for speed
- Use int8 compute type
- Reduce model size (tiny/small)

### Out of Memory

- Reduce batch size
- Use int8 quantization
- Reduce beam_size
- Reduce model size

### Accuracy Issues

- Increase beam_size (5-10 recommended)
- Use float16 or float32 instead of int8
- Ensure audio is high quality
- Check language setting

## License

Faster-Whisper by Systran is distributed under MIT License.
Whisper by OpenAI is distributed under MIT License.

## References

- Faster-Whisper: https://github.com/SYSTRAN/faster-whisper
- Whisper: https://github.com/openai/whisper
- CUDA: https://developer.nvidia.com/cuda-toolkit
- ROCm: https://rocmdocs.amd.com/
- Metal/MPS: https://developer.apple.com/metal/
