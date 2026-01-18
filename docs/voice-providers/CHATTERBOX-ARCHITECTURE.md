# Chatterbox TTS Provider Architecture

**Status:** Architecture Design (Pre-Implementation)
**Version:** 1.0.0
**Last Updated:** January 2026

## Executive Summary

Chatterbox is Resemble AI's production-grade, MIT-licensed open-source text-to-speech engine that will complement Clawdbot's existing voice provider ecosystem (Whisper, Faster-Whisper, Kokoro, ElevenLabs). This document provides the architectural design for integrating Chatterbox as a new TTS provider executor following the established provider pattern.

**Key Characteristics:**
- **License:** MIT (fully open-source)
- **Languages:** 23 supported languages
- **Voice Cloning:** Zero-shot voice cloning (seconds of reference audio)
- **Watermarking:** Perceptual watermarking (PerTh) survives MP3 compression
- **Community:** 1M+ Hugging Face downloads, 11K+ GitHub stars
- **Performance:** High-quality TTS with natural prosody and emotional control

## Architecture Overview

### Provider Integration Model

Chatterbox integrates into Clawdbot's voice provider orchestrator following the established `VoiceProviderExecutor` pattern:

```
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer                          │
│  (Commands, API Routes, Gateway Integration)               │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│         VoiceOrchestrator (Coordinator)                     │
│  • Provider selection & fallback chain                      │
│  • Health monitoring & circuit breaker                      │
│  • Load balancing & metrics collection                      │
└────────────────────┬────────────────────────────────────────┘
                     │
          ┌──────────┼──────────┬──────────┐
          │          │          │          │
    ┌─────▼───┐ ┌────▼───┐ ┌──▼─────┐ ┌─▼──────┐
    │Whisper  │ │Kokoro  │ │Chatterbox│ │ElevenLabs│
    │(STT/TTS)│ │(TTS)   │ │(TTS)  │ │(TTS)   │
    └─────────┘ └────────┘ └────────┘ └────────┘
          │          │          │          │
    ┌─────▼───────────▼──────────▼──────────▼────┐
    │    Deployment Layer                        │
    │  • Docker containers                       │
    │  • System Python installations             │
    │  • Cloud API endpoints                     │
    └────────────────────────────────────────────┘
```

### Executor Pattern

All voice providers implement the `VoiceProviderExecutor` interface with three core deployment modes:

```typescript
interface VoiceProviderExecutor {
  // STT (Speech-to-Text)
  transcribe(audio, options?): Promise<TranscriptionResult>;
  transcribeStream(stream, options?): AsyncIterable<TranscriptionChunk>;

  // TTS (Text-to-Speech) - PRIMARY FOR CHATTERBOX
  synthesize(text, options?): Promise<AudioBuffer>;
  synthesizeStream(stream, options?): AsyncIterable<AudioBuffer>;

  // Lifecycle
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getCapabilities(): ProviderCapabilities;
  isHealthy(): Promise<boolean>;
}
```

**For Chatterbox:** Only TTS operations will be implemented (transcribe methods throw `NotImplementedError`).

## Deployment Strategies

### 1. Docker Deployment (Recommended for Production)

**Container Image:** `resemble-ai/chatterbox:latest`

**Configuration:**

```typescript
interface DockerDeploymentConfig {
  mode: 'docker';
  docker: {
    image: string;        // e.g., "resemble-ai/chatterbox:latest"
    tag: string;          // e.g., "v1.2.0"
    port: number;         // HTTP API port (default: 8000)
    gpuEnabled: boolean;  // NVIDIA GPU support
    gpuDevice?: string;   // e.g., "0" or "all"
    volumeMounts?: {
      models?: string;    // Persistent model cache path
      cache?: string;     // TTS computation cache
    };
    env?: {
      CHATTERBOX_LOG_LEVEL?: 'debug' | 'info' | 'warn';
      CHATTERBOX_MAX_WORKERS?: number;
      CHATTERBOX_MODEL_PRECISION?: 'fp32' | 'fp16';
    };
    healthCheck: {
      endpoint: string;   // e.g., "/health"
      intervalMs: number; // e.g., 30000
      timeoutMs: number;  // e.g., 5000
    };
  };
}
```

**Docker Compose Example:**

```yaml
services:
  chatterbox:
    image: resemble-ai/chatterbox:latest
    container_name: clawdbot-chatterbox
    ports:
      - "8000:8000"
    environment:
      CHATTERBOX_LOG_LEVEL: info
      CHATTERBOX_MAX_WORKERS: 4
      CHATTERBOX_MODEL_PRECISION: fp16  # Faster, lower VRAM
    volumes:
      - chatterbox-models:/models
      - chatterbox-cache:/cache
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 5s
      retries: 3

volumes:
  chatterbox-models:
  chatterbox-cache:
```

**Advantages:**
- Isolated environment, no system dependencies
- GPU support via nvidia-docker
- Easy scaling and orchestration
- Reproducible deployment
- Model caching across container restarts

**Considerations:**
- Requires Docker installation
- Initial model download (1-3GB depending on model selection)
- Network latency (local: ~10-50ms per request)

### 2. System Deployment (Development/Local)

**Direct Python Installation:**

```typescript
interface SystemDeploymentConfig {
  mode: 'system';
  system: {
    pythonPath?: string;      // e.g., "/usr/bin/python3"
    virtualEnv?: string;      // e.g., "$HOME/.venv/chatterbox"
    installCmd?: string;      // pip install command
    modelCachePath?: string;   // Hugging Face cache location
  };
  gpuDetection: {
    enabled: boolean;         // Auto-detect CUDA/Metal
    preferredDevice?: string; // 'cuda' | 'mps' | 'cpu'
    fallbackToCPU: boolean;   // If GPU unavailable
  };
}
```

**Installation:**

```bash
# Create virtual environment
python3 -m venv ~/.venv/chatterbox
source ~/.venv/chatterbox/bin/activate

# Install Chatterbox
pip install chatterbox-tts

# For GPU (CUDA)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118

# For GPU (macOS Metal)
pip install torch::device(type='mps')
```

**Advantages:**
- No containerization overhead
- Zero network latency
- Direct GPU access (fastest)
- Development-friendly
- Easy debugging

**Considerations:**
- Python 3.10+ required
- Dependency management complexity
- Model files occupy local storage
- Limited to single machine deployment

### 3. Cloud Deployment (Optional - Future)

**Resemble AI API Endpoint:**

```typescript
interface CloudDeploymentConfig {
  mode: 'cloud';
  cloud: {
    endpoint: string;     // e.g., "https://api.resemble.ai/v2/tts"
    apiKey: string;       // API key from Resemble AI
    modelId?: string;     // Custom model selection
    voiceCloneMode: 'zero-shot' | 'api-provided';
  };
  rateLimit?: {
    requestsPerSecond: number;
    burstsAllowed: number;
  };
}
```

**Advantages:**
- No local infrastructure required
- Automatic scaling
- Always up-to-date models
- Professional support

**Considerations:**
- API costs per request
- Network dependency
- Higher latency (cloud: 500ms-2s)
- Requires active Resemble AI subscription

## Configuration Schema

### SynthesisOptions Extension for Chatterbox

```typescript
export interface ChatterboxSynthesisOptions extends SynthesisOptions {
  // Core parameters
  voice?: string;           // Voice ID (e.g., "en_US_female_1")
  speed?: number;           // 0.5 (50%) to 2.0 (200%), default: 1.0
  language?: string;        // ISO 639-1 code (e.g., "en", "es", "ja")

  // Voice cloning (zero-shot)
  voiceCloning?: {
    enabled: boolean;                    // Enable voice cloning
    referenceAudio: Uint8Array;         // Reference audio (seconds)
    referenceDuration: number;           // Duration in milliseconds
    cloneName?: string;                  // Optional clone identifier
    similarity?: number;                 // 0.0 (varied) to 1.0 (very similar)
  };

  // Prosody and emotion
  prosody?: {
    emotionLevel?: 'neutral' | 'happy' | 'sad' | 'angry' | 'excited';
    expressiveness?: number;             // 0.0 to 1.0
    pauseLength?: 'short' | 'medium' | 'long';
  };

  // Advanced
  modelVariant?: 'base' | 'large' | 'xlarge';  // Model size variant
  useWatermark?: boolean;               // Enable PerTh watermark (default: true)
  samplingRate?: number;                // 16000, 22050, 44100 (default: 16000)
  format?: AudioFormat;                 // PCM_16, MP3, WAV
}
```

### Supported Languages (23 Total)

| Code  | Language            | Code  | Language            |
|-------|---------------------|-------|---------------------|
| en    | English             | ja    | Japanese            |
| es    | Spanish             | ko    | Korean              |
| fr    | French              | pt-BR | Portuguese (Brazil) |
| de    | German              | pt-PT | Portuguese (Portugal)|
| it    | Italian             | ru    | Russian             |
| nl    | Dutch               | tr    | Turkish             |
| pl    | Polish              | hi    | Hindi               |
| zh-CN | Chinese (Simplified)| ar    | Arabic              |
| zh-TW | Chinese (Traditional)| th   | Thai               |
| vi    | Vietnamese          | el    | Greek               |

### Voice Selection

```typescript
interface ChatterboxVoice {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  language: string;              // Primary language
  gender?: 'male' | 'female' | 'neutral';
  age?: 'child' | 'teen' | 'adult' | 'senior';
  characteristics?: string[];    // e.g., ["professional", "warm"]
}

// Pre-defined voices (example)
const PreDefinedVoices: Record<string, ChatterboxVoice> = {
  'en_US_female_1': {
    id: 'en_US_female_1',
    name: 'Rachel',
    language: 'en',
    gender: 'female',
    age: 'adult',
    characteristics: ['professional', 'warm'],
  },
  'en_GB_male_1': {
    id: 'en_GB_male_1',
    name: 'Oliver',
    language: 'en',
    gender: 'male',
    age: 'adult',
    characteristics: ['professional', 'formal'],
  },
  'es_ES_female_1': {
    id: 'es_ES_female_1',
    name: 'Carmen',
    language: 'es',
    gender: 'female',
    age: 'adult',
    characteristics: ['natural', 'conversational'],
  },
  // ... 20+ more voices
};
```

## Audio Normalization Pipeline

```
Input Text (UTF-8)
    │
    ├─► Text Preprocessing
    │   • Normalize unicode
    │   • Expand abbreviations
    │   • Handle numbers/punctuation
    │
    ├─► Language Detection (if not specified)
    │   • Auto-detect or use provided language
    │   • Validate against supported languages
    │
    ├─► Model Selection
    │   • Choose appropriate variant
    │   • Load from cache or download
    │   • Verify GPU availability
    │
    ├─► Voice Processing
    │   • If voice cloning:
    │     - Validate reference audio
    │     - Extract speaker embeddings
    │     - Create temporary voice clone
    │   • If predefined voice:
    │     - Load voice model weights
    │
    ├─► TTS Synthesis
    │   • Generate mel-spectrogram
    │   • Apply prosody/emotion
    │   • Vocoder to waveform
    │
    ├─► Audio Post-Processing
    │   • Apply speed adjustment
    │   • Watermarking (PerTh)
    │   • Format conversion (PCM_16 → MP3, WAV, etc.)
    │
    └─► AudioBuffer Output
        • Uint8Array audio data
        • Format metadata
        • Sample rate
        • Duration in ms
```

## Error Handling Strategy

### Provider-Level Errors

```typescript
export enum ChatterboxErrorCode {
  // Initialization
  MODEL_LOAD_FAILED = 'MODEL_LOAD_FAILED',
  GPU_NOT_AVAILABLE = 'GPU_NOT_AVAILABLE',
  INVALID_CONFIG = 'INVALID_CONFIG',

  // Voice Operations
  VOICE_NOT_FOUND = 'VOICE_NOT_FOUND',
  VOICE_CLONE_FAILED = 'VOICE_CLONE_FAILED',
  INVALID_REFERENCE_AUDIO = 'INVALID_REFERENCE_AUDIO',

  // Synthesis
  TEXT_TOO_LONG = 'TEXT_TOO_LONG',
  UNSUPPORTED_LANGUAGE = 'UNSUPPORTED_LANGUAGE',
  SYNTHESIS_TIMEOUT = 'SYNTHESIS_TIMEOUT',
  SYNTHESIS_FAILED = 'SYNTHESIS_FAILED',

  // Deployment
  DOCKER_UNREACHABLE = 'DOCKER_UNREACHABLE',
  API_ERROR = 'API_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
}

export class ChatterboxProviderError extends VoiceProviderError {
  constructor(
    message: string,
    public code: ChatterboxErrorCode,
    public details?: {
      language?: string;
      voice?: string;
      textLength?: number;
      retryable?: boolean;
    },
  ) {
    super(message, 'chatterbox', code);
    this.name = 'ChatterboxProviderError';
  }
}
```

### Retry Strategies

```typescript
// Retryable errors (automatic fallback/retry)
const RETRYABLE_ERRORS = [
  ChatterboxErrorCode.SYNTHESIS_TIMEOUT,
  ChatterboxErrorCode.GPU_NOT_AVAILABLE,
  ChatterboxErrorCode.DOCKER_UNREACHABLE,
  ChatterboxErrorCode.RATE_LIMITED,
];

// Non-retryable errors (fail immediately)
const NON_RETRYABLE_ERRORS = [
  ChatterboxErrorCode.UNSUPPORTED_LANGUAGE,
  ChatterboxErrorCode.INVALID_REFERENCE_AUDIO,
  ChatterboxErrorCode.VOICE_NOT_FOUND,
  ChatterboxErrorCode.TEXT_TOO_LONG,
];

// Circuit breaker opens after 3 consecutive failures
// Resets after 60 seconds
```

## Performance Characteristics

### Latency Profile

| Deployment | First Request | Subsequent Requests | Model Load |
|------------|----------------|-------------------|-----------|
| Docker     | 500-2000ms     | 100-500ms         | On start  |
| System (GPU) | 200-800ms     | 50-200ms          | On init   |
| System (CPU) | 2-8s          | 1-4s              | On init   |
| Cloud API  | 1-3s           | 800ms-2s          | N/A       |

### Memory Requirements

| Model Variant | VRAM (GPU)  | RAM (CPU) | Disk Space |
|--------------|------------|----------|-----------|
| Base         | 2-4GB      | 4-8GB    | 1-2GB     |
| Large        | 4-8GB      | 8-16GB   | 2-4GB     |
| XLarge       | 8-16GB     | 16-32GB  | 4-8GB     |

### Throughput

- **Docker:** 10-20 concurrent requests (configurable via worker pool)
- **System (GPU):** 2-5 concurrent requests (thread-safe synthesis)
- **System (CPU):** 1-2 concurrent requests (high latency per request)
- **Cloud API:** Depends on subscription tier

## Resource Requirements

### Minimum

```yaml
CPU: 2 cores (4 recommended)
RAM: 4GB (6GB recommended)
Storage: 3GB (models + cache)
GPU: Optional but strongly recommended
- NVIDIA: CUDA 11.8+, 2GB VRAM minimum
- Apple: M1/M2 with 4GB+ unified memory
```

### Recommended Production

```yaml
CPU: 8+ cores
RAM: 16GB
Storage: 10GB (multiple model variants + cache)
GPU: NVIDIA A10 or equivalent (24GB VRAM)
Network: 100Mbps for Docker registry pulls
```

## Testing Strategy

### Unit Tests

```typescript
// test/voice-providers/chatterbox.test.ts
describe('ChatterboxExecutor', () => {
  // Configuration
  describe('Configuration', () => {
    it('validates docker config', () => {});
    it('validates system config', () => {});
    it('rejects invalid language', () => {});
  });

  // Synthesis
  describe('Synthesis', () => {
    it('synthesizes text in supported language', async () => {});
    it('applies voice cloning', async () => {});
    it('applies prosody adjustments', async () => {});
    it('handles long text gracefully', async () => {});
  });

  // Health checks
  describe('Health Checks', () => {
    it('reports healthy status', async () => {});
    it('detects unavailable GPU', async () => {});
    it('validates docker connectivity', async () => {});
  });
});
```

### Integration Tests

```typescript
// test/voice-providers/chatterbox.docker.test.ts
describe('ChatterboxExecutor (Docker)', () => {
  it('initializes with docker deployment', async () => {});
  it('streams synthesis results', async () => {});
  it('recovers from transient failures', async () => {});
});

// test/voice-providers/chatterbox.system.test.ts
describe('ChatterboxExecutor (System)', () => {
  it('initializes with system deployment', async () => {});
  it('detects GPU availability', async () => {});
  it('falls back to CPU when GPU unavailable', async () => {});
});
```

### Live Tests

```bash
# Run with actual Chatterbox (Docker or System installation required)
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Run Docker tests
pnpm test:docker:live-models

# Verify streaming
pnpm test:live -- --grep "streaming"
```

## Integration with Orchestrator

### Registration

```typescript
// src/media/voice-providers/orchestrator.ts
import { ChatterboxExecutor } from './chatterbox.js';

// In orchestrator initialization
const chatterboxEntry: VoiceProviderEntry = {
  id: 'chatterbox',
  name: 'Chatterbox (Resemble AI)',
  type: 'tts',
  priority: 20,           // Lower than ElevenLabs (10), higher than Kokoro (30)
  deployment: 'docker',   // Recommended
  enabled: true,
  estimatedLatencyMs: 150,
  estimatedCostPerMonth: 0,
  maxConcurrentRequests: 10,
};
```

### Configuration Example

```typescript
// config/voice-providers.config.ts
export const voiceProvidersConfig: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: 'chatterbox-docker',
      name: 'Chatterbox (Docker)',
      type: 'tts',
      priority: 1,
      deployment: 'docker',
      enabled: true,
      metadata: {
        deploymentConfig: {
          mode: 'docker',
          docker: {
            image: 'resemble-ai/chatterbox:latest',
            port: 8000,
            gpuEnabled: true,
            healthCheck: {
              endpoint: '/health',
              intervalMs: 30000,
            },
          },
        } satisfies DockerDeploymentConfig,
      },
    },
    {
      id: 'chatterbox-system',
      name: 'Chatterbox (System)',
      type: 'tts',
      priority: 2,
      deployment: 'system',
      enabled: true,
      metadata: {
        deploymentConfig: {
          mode: 'system',
          system: {
            modelCachePath: '$HOME/.cache/huggingface',
          },
          gpuDetection: {
            enabled: true,
            fallbackToCPU: true,
          },
        } satisfies SystemDeploymentConfig,
      },
    },
  ],
  ttsFallbackChain: [
    'chatterbox-docker',
    'chatterbox-system',
    'kokoro-system',
    'elevenlabs-api',
  ],
};
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)

- [x] Architecture design (this document)
- [ ] Executor skeleton with deployment handlers
- [ ] Docker deployment handler
- [ ] Configuration schema
- [ ] Basic health checks

**File Structure:**
```
src/media/voice-providers/
├── chatterbox.ts              (~450 lines)
├── chatterbox.docker.ts       (~350 lines)
├── chatterbox.system.ts       (~400 lines)
├── chatterbox.service.ts      (~300 lines)
└── chatterbox.test.ts         (~500 lines)
```

### Phase 2: Core Features (Week 2-3)

- [ ] Basic text synthesis
- [ ] Voice selection (predefined voices)
- [ ] Language support (all 23 languages)
- [ ] Speed/format adjustments
- [ ] Error handling and retries
- [ ] Integration tests

### Phase 3: Advanced Features (Week 3-4)

- [ ] Voice cloning (zero-shot)
- [ ] Prosody/emotion control
- [ ] Watermarking verification
- [ ] Streaming synthesis
- [ ] Performance benchmarks
- [ ] Live tests with Docker/System deployment

### Phase 4: Production (Week 4-5)

- [ ] Documentation
- [ ] Example scripts
- [ ] Migration guide from other providers
- [ ] Performance optimization
- [ ] Security audit
- [ ] Community testing

## Code Examples

### Initialization

```typescript
import { ChatterboxExecutor } from './chatterbox.js';

// Docker deployment
const dockerConfig: DockerDeploymentConfig = {
  mode: 'docker',
  docker: {
    image: 'resemble-ai/chatterbox:latest',
    port: 8000,
    gpuEnabled: true,
    healthCheck: {
      endpoint: '/health',
      intervalMs: 30000,
    },
  },
};

const executor = new ChatterboxExecutor(dockerConfig);
await executor.initialize();
```

### Basic Synthesis

```typescript
// Simple synthesis
const audio = await executor.synthesize('Hello, world!', {
  voice: 'en_US_female_1',
  language: 'en',
  speed: 1.0,
  format: AudioFormat.PCM_16,
});

console.log(`Generated audio: ${audio.duration}ms, ${audio.data.length} bytes`);
```

### Voice Cloning

```typescript
// Load reference audio
const referenceAudio = fs.readFileSync('reference.wav');

const audio = await executor.synthesize(
  'This sounds like me!',
  {
    language: 'en',
    voiceCloning: {
      enabled: true,
      referenceAudio: new Uint8Array(referenceAudio),
      referenceDuration: 5000,  // 5 seconds
      similarity: 0.95,
    },
    prosody: {
      emotionLevel: 'happy',
      expressiveness: 0.8,
    },
  },
);
```

### Streaming Synthesis

```typescript
// Stream text and receive audio chunks
const textStream = createReadableStream([
  'The quick brown fox ',
  'jumps over the lazy dog.',
]);

for await (const audioChunk of executor.synthesizeStream(textStream, {
  voice: 'en_US_female_1',
})) {
  // Stream audio chunks to output
  console.log(`Received chunk: ${audioChunk.data.length} bytes`);
}
```

### Orchestrator Integration

```typescript
import { VoiceOrchestrator } from './orchestrator.js';

const orchestrator = new VoiceOrchestrator({
  config: voiceProvidersConfig,
  defaultMode: 'docker',
});

await orchestrator.initialize();

// Automatic fallback chain
const audio = await orchestrator.synthesize(
  'Hello world!',
  {
    voice: 'en_US_female_1',
    language: 'en',
  },
);

// Health monitoring
const health = await orchestrator.getHealthStatus();
console.log(health);
```

## Security Considerations

### Model Integrity

- Verify model hashes from official Resemble AI sources
- Use HTTPS for model downloads
- Store models in isolated directories with restricted permissions

### API Keys (Cloud Mode)

- Store in environment variables (never commit)
- Use `.env.local` pattern (excluded from git)
- Rotate keys periodically
- Rate-limit API access

### Audio Data

- Reference audio for cloning stored in memory (not persisted)
- Clear cloning cache after synthesis
- Support for audio sanitization (optional)

### Docker Security

- Use pinned image versions (never `latest` in production)
- Run container with limited privileges (`--security-opt=no-new-privileges`)
- Use volume mounts instead of bind mounts
- Network isolation (if possible)

## Monitoring & Metrics

### Key Metrics

```typescript
interface ChatterboxMetrics {
  // Performance
  avgSynthesisLatencyMs: number;
  p95SynthesisLatencyMs: number;
  p99SynthesisLatencyMs: number;

  // Quality
  successfulSynthesisCount: number;
  failedSynthesisCount: number;
  retryCount: number;

  // Resource
  gpuUtilizationPercent?: number;
  memoryUsageMB: number;
  activeSynthesisCount: number;

  // Feature usage
  voiceCloningUsageCount: number;
  languageDistribution: Record<string, number>;
  speedAdjustmentUsagePercent: number;
}
```

### Prometheus Metrics (Optional)

```typescript
// Expose metrics for monitoring dashboards
const synthesisLatency = new Histogram({
  name: 'chatterbox_synthesis_latency_ms',
  help: 'Synthesis latency in milliseconds',
  buckets: [50, 100, 200, 500, 1000],
});

const voiceCloningAttempts = new Counter({
  name: 'chatterbox_voice_cloning_total',
  help: 'Total voice cloning attempts',
});
```

## Comparison with Existing Providers

| Feature | Chatterbox | Kokoro | ElevenLabs | Whisper |
|---------|-----------|--------|-----------|---------|
| Type | TTS | TTS | TTS | STT |
| Languages | 23 | 1 | 30+ | 90+ |
| Voice Cloning | Yes (zero-shot) | No | Yes (API) | N/A |
| Open Source | Yes (MIT) | Yes | No | Yes |
| Watermarking | Yes (PerTh) | No | No | N/A |
| Deployment | Docker/System/Cloud | Docker/System | Cloud only | Docker/System |
| Latency (Docker) | 100-500ms | 100-300ms | 800ms-2s | N/A |
| Cost | $0 (self-hosted) | $0 (self-hosted) | $$ (API) | $0 (API) |
| Quality | High | High | Very High | N/A |
| Customization | High | Low | Limited | N/A |

## Troubleshooting Guide

### Common Issues

**Issue:** Docker container fails to start
```
Error: "Failed to pull image resemble-ai/chatterbox:latest"
Solution:
1. Check Docker daemon is running
2. Verify internet connectivity
3. Authenticate Docker (if private registry): docker login
4. Check available disk space (models are 1-3GB)
```

**Issue:** GPU not detected
```
Error: "CUDA not available, falling back to CPU"
Solution:
1. Verify NVIDIA drivers: nvidia-smi
2. Check Docker GPU passthrough: --gpus all
3. Verify PyTorch CUDA: python -c "import torch; print(torch.cuda.is_available())"
4. Check CUDA_VISIBLE_DEVICES environment variable
```

**Issue:** Voice cloning fails
```
Error: "Invalid reference audio format"
Solution:
1. Reference audio must be 16kHz, mono or stereo
2. Duration must be 1-30 seconds
3. Format: WAV, MP3, or OGG
4. Loudness: -20dBFS to 0dBFS recommended
```

**Issue:** Synthesis timeout
```
Error: "Synthesis exceeded timeout (30s)"
Solution:
1. Reduce text length (max ~500 characters recommended)
2. Increase timeout in configuration
3. Check system resources (CPU, RAM)
4. For GPU: ensure GPU memory not maxed out
```

## References

- **Chatterbox Repository:** https://github.com/resemble-ai/chatterbox
- **Hugging Face Model:** https://huggingface.co/resemble-ai/chatterbox
- **Documentation:** https://github.com/resemble-ai/chatterbox/wiki
- **Perceptual Watermarking (PerTh):** Resemble AI research paper
- **Existing Provider Architecture:** `src/media/voice-providers/kokoro.ts`

## Appendix A: Model Variants

### Base Model (Recommended for Most Use Cases)

- **Parameters:** ~250M
- **VRAM:** 2-4GB
- **Quality:** High
- **Latency:** 100-500ms (Docker)
- **Languages:** All 23

### Large Model (Higher Quality)

- **Parameters:** ~500M
- **VRAM:** 4-8GB
- **Quality:** Very High
- **Latency:** 200-800ms (Docker)
- **Languages:** All 23
- **Use Case:** Production applications requiring highest quality

### XLarge Model (Research/Premium)

- **Parameters:** ~1B
- **VRAM:** 8-16GB
- **Quality:** Exceptional
- **Latency:** 500ms-2s (Docker)
- **Languages:** All 23
- **Use Case:** Premium applications, voice cloning refinement

## Appendix B: Voice Cloning Details

### Zero-Shot Cloning Process

1. **Audio Normalization**
   - Resample to 16kHz
   - Normalize loudness to -6dBFS
   - Detect and remove silence edges

2. **Speaker Embedding Extraction**
   - Pass normalized audio through speaker encoder
   - Extract 256-dimensional embedding vector
   - Compare with existing speaker library

3. **Clone Generation**
   - Generate TTS with extracted embedding
   - Apply similarity scaling (0-1.0)
   - Cache clone for session duration (optional)

4. **Quality Assurance**
   - Verify output doesn't match copyrighted voices
   - Check for watermarking integrity
   - Measure speaker similarity (cosine distance)

### Best Practices

- **Optimal Duration:** 3-10 seconds of clean speech
- **Quality:** Studio-quality or clear mobile recording
- **Content:** Read any text (doesn't need to match synthesis text)
- **Multiple Speakers:** Use only primary speaker audio
- **Silence:** Minimal background noise
- **File Format:** WAV or MP3 (16-48kHz, mono or stereo)

## Appendix C: API Reference

### Docker Health Endpoint

```bash
GET /health HTTP/1.1
Host: localhost:8000

# Response
{
  "status": "healthy",
  "version": "1.2.0",
  "models_loaded": {
    "encoder": true,
    "decoder": true,
    "vocoder": true
  },
  "gpu_available": true,
  "queue_length": 2,
  "avg_latency_ms": 250
}
```

### Synthesis Endpoint (Direct)

```bash
POST /synthesize HTTP/1.1
Host: localhost:8000
Content-Type: application/json

{
  "text": "Hello, world!",
  "voice_id": "en_US_female_1",
  "speed": 1.0,
  "format": "pcm16"
}

# Response (streaming audio/wav)
```

---

**Document Status:** Ready for Implementation Review
**Next Steps:**
1. Architectural review with team
2. Dependency analysis and licensing compliance check
3. Begin Phase 1 implementation (executor skeleton)
4. Set up Docker integration test environment
