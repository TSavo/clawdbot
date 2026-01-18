# Voice Provider Deployment Configuration Guide

This guide explains how to configure voice providers (STT/TTS) with deployment modes supported by the existing deployment config system.

## Architecture

Voice providers can be deployed in three modes via the existing `deployment-config` system:

1. **Docker** - Containerized deployments with GPU support
2. **System** - Direct system/native installations
3. **Cloud** - Cloud-based service providers (API-only)

## Integration with Existing Deployment Config

Voice providers leverage the comprehensive deployment system defined in:
- `/src/config/zod-schema.deployment-config.ts` - Main deployment schema
- `/src/config/deployment-config.types.ts` - Type definitions
- `/src/config/deployment-config.utils.ts` - Utility functions
- `/src/config/deployment-config.presets.ts` - Preset configurations

## Voice Provider Entry Structure

```typescript
type VoiceProviderEntry = {
  id: string;                    // Unique provider ID
  name?: string;                 // Display name
  enabled?: boolean;             // Provider enabled/disabled
  priority?: number;             // Priority in fallback chain
  stt?: STTProviderConfig;       // Speech-to-text provider
  tts?: TTSProviderConfig;       // Text-to-speech provider
};
```

## STT Provider Configurations

### Whisper (Local)
```typescript
{
  id: "whisper-docker",
  stt: {
    type: "whisper",
    modelSize: "small",        // tiny, small, base, medium, large
    language: "en"
  }
}
```

**Deployment Considerations:**
- Docker: Use containerized Whisper with GPU runtime (nvidia/amd)
- System: Install locally via apt/brew/conda
- Cloud: Use OpenAI API (`type: "openai"`)

### Faster-Whisper (Optimized Local)
```typescript
{
  id: "faster-whisper-system",
  stt: {
    type: "faster-whisper",
    modelSize: "base",
    computeType: "float16",    // int8, float16, float32
    cpuThreads: 8,
    beamSize: 5
  }
}
```

**Deployment Considerations:**
- System: Use system Python with faster-whisper pip package
- Supports GPU: CUDA, MPS (macOS)
- Auto-download models to cache path

### Cloud STT Providers
```typescript
// OpenAI
{
  id: "openai-stt",
  stt: {
    type: "openai",
    service: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "whisper-1",
    language: "en"
  }
}

// Google Cloud Speech-to-Text
{
  id: "google-stt",
  stt: {
    type: "google",
    service: "google-cloud-speech",
    apiKey: process.env.GOOGLE_API_KEY
  }
}

// Azure
{
  id: "azure-stt",
  stt: {
    type: "azure",
    service: "azure-cognitive-services",
    apiKey: process.env.AZURE_API_KEY
  }
}
```

## TTS Provider Configurations

### Kokoro (Local)
```typescript
{
  id: "kokoro-docker",
  tts: {
    type: "kokoro",
    voice: "af",                 // af, am, ar, en, es, fr, etc.
    speed: 1.0,
    outputFormat: "wav"
  }
}
```

**Deployment Considerations:**
- Docker: GPU-accelerated containerized Kokoro
- System: Install from local model files
- Model cache: ~/.local/share/kokoro or custom path

### Piper (Local)
```typescript
{
  id: "piper-system",
  tts: {
    type: "piper",
    model: "en_US-lessac-medium",
    voice: "lessac",
    speed: 1.0,
    outputFormat: "wav"
  }
}
```

**Deployment Considerations:**
- System: Fast local model (~30-100MB models)
- Multi-language support
- CPU-based (no GPU required)

### Cloud TTS Providers
```typescript
// ElevenLabs
{
  id: "elevenlabs-cloud",
  tts: {
    type: "elevenlabs",
    service: "elevenlabs",
    voiceId: "21m00Tcm4TlvDq8ikWAM",
    apiKey: process.env.ELEVENLABS_API_KEY,
    speed: 1.0,
    outputFormat: "mp3_44100"
  }
}

// OpenAI
{
  id: "openai-tts",
  tts: {
    type: "openai",
    service: "openai",
    apiKey: process.env.OPENAI_API_KEY,
    model: "tts-1",
    voice: "alloy"            // alloy, echo, fable, onyx, nova, shimmer
  }
}

// Google Cloud Text-to-Speech
{
  id: "google-tts",
  tts: {
    type: "google",
    service: "google-cloud-tts",
    apiKey: process.env.GOOGLE_API_KEY,
    voice: "en-US-Neural2-A"
  }
}

// Azure Cognitive Services
{
  id: "azure-tts",
  tts: {
    type: "azure",
    service: "azure-cognitive-services",
    apiKey: process.env.AZURE_API_KEY,
    voice: "en-US-AriaNeural"
  }
}
```

## Deployment Strategy Configuration

Each provider entry can specify how to select and fallback between deployments:

```typescript
type DeploymentStrategy = {
  primaryStrategy?: "performance" | "cost" | "reliability" | "local-first";
  fallbackStrategy?: "round-robin" | "fastest-response" | "least-errors";
  autoSwitchThreshold?: number;        // 0-1, default 0.8
  minSuccessRatePercent?: number;      // 0-100, default 95
}
```

## Example Configurations

### Performance-Optimized (GPU)
```typescript
const performanceOptimized: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: "whisper-docker-gpu",
      stt: {
        type: "whisper",
        modelSize: "large"
      }
    },
    {
      id: "kokoro-docker-gpu",
      tts: {
        type: "kokoro",
        voice: "af"
      }
    }
  ],
  defaultSttProviderId: "whisper-docker-gpu",
  defaultTtsProviderId: "kokoro-docker-gpu"
};
```

### Cost-Optimized (Local + Cloud Fallback)
```typescript
const costOptimized: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: "faster-whisper-local",
      priority: 10,
      stt: {
        type: "faster-whisper",
        modelSize: "base"
      }
    },
    {
      id: "openai-fallback",
      priority: 0,
      stt: {
        type: "openai",
        service: "openai",
        apiKey: process.env.OPENAI_API_KEY
      }
    }
  ],
  fallbackChain: ["faster-whisper-local", "openai-fallback"]
};
```

### Hybrid (Realtime + Batch)
```typescript
const hybrid: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: "realtime-stt",
      priority: 10,
      stt: {
        type: "faster-whisper",
        modelSize: "small"
      }
    },
    {
      id: "batch-stt",
      priority: 5,
      stt: {
        type: "openai",
        service: "openai",
        apiKey: process.env.OPENAI_API_KEY
      }
    }
  ],
  fallbackChain: ["realtime-stt", "batch-stt"]
};
```

## Health Checks and Monitoring

The deployment config system supports health checks per provider:

```typescript
// In deployment configuration
healthCheck: {
  enabled: true,
  endpoint: "http://localhost:8000/health",  // Docker health endpoint
  timeoutMs: 5000,
  intervalMs: 30000,
  failureThreshold: 3,
  command: "faster-whisper --version"         // System command check
}
```

## Retry Policies

Configure retries for transient failures:

```typescript
// In deployment configuration
retries: {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  multiplier: 2.0,                  // Exponential backoff
  retryableErrors: [503, 504, "TIMEOUT"]
}
```

## Environment Variables

Sensitive data should use environment variables:

```bash
# OpenAI
export OPENAI_API_KEY="sk-..."

# Google Cloud
export GOOGLE_API_KEY="..."

# Azure
export AZURE_API_KEY="..."

# ElevenLabs
export ELEVENLABS_API_KEY="..."
```

Reference in config:
```typescript
apiKey: process.env.OPENAI_API_KEY
```

## Logging Configuration

Configure provider-level logging:

```typescript
// In deployment configuration
logging: {
  level: "debug",                    // trace, debug, info, warn, error, fatal
  verbose: true,
  filePath: "/var/log/voice-providers.log",
  maxFileSize: 10485760,            // 10MB
  maxFiles: 3,
  json: false
}
```

## Docker Deployment Mode

When deploying via Docker, the system supports:

```typescript
// From zod-schema.deployment-config
mode: "docker"
image: "openai/whisper"             // Docker image
tag: "latest"                       // Image tag
pullPolicy: "ifNotPresent"          // always, ifNotPresent, never
ports: { 8000: 8000 }               // Port mappings
volumes: { "/models": "/models" }   // Volume mounts
network: "bridge"                   // bridge, host, none
gpuRuntime: "nvidia"                // nvidia, amd
resources: {
  memoryMb: 4096,
  cpuLimit: 4
}
restartPolicy: "unless-stopped"     // no, always, onFailure, unlessStopped
```

## System Deployment Mode

When deploying via System, the system supports:

```typescript
// From zod-schema.deployment-config
mode: "system"
buildFirst: false                   // Build from Dockerfile
dockerfilePath: undefined
env: {
  "WHISPER_MODEL": "small",
  "LANGUAGE": "en"
}
```

## Cloud Deployment Mode

When deploying via Cloud, the system supports:

```typescript
// From zod-schema.deployment-config
mode: "cloud"
timeoutMs: 30000
retries: { ... }
logging: { ... }
healthCheck: { ... }
```

## Testing Deployments

Use the voice-providers utilities to test configurations:

```typescript
import { detectSystemCapabilities, validateProviderConfig } from
  "./voice-providers.utils.js";

// Check system capabilities
const capabilities = await detectSystemCapabilities();
console.log(capabilities.hasGpu);     // true/false
console.log(capabilities.gpuType);    // "cuda", "mps", etc.

// Validate provider config
const valid = await validateProviderConfig(providerEntry);
console.log(valid.success);
```

## Migration from Legacy

If migrating from legacy voice config:

1. Providers are automatically discovered
2. Existing STT/TTS configs remain compatible
3. Deployment info is now optional but recommended
4. Use `hasLegacyVoiceConfig()` to detect old format
5. Use `migrateLegacyVoiceConfig()` for schema updates

## See Also

- `src/config/zod-schema.deployment-config.ts` - Full deployment schema
- `src/config/deployment-config.types.ts` - TypeScript types
- `src/config/deployment-config.presets.ts` - Preset configurations
- `src/config/deployment-config.utils.ts` - Utility functions
- `src/config/voice-providers.utils.ts` - Voice provider utilities
- `src/config/voice-providers.migration.ts` - Migration utilities
