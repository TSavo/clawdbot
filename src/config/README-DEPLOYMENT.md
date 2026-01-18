# Voice Provider Deployment Configuration - Quick Reference

## What Changed

This implementation provides comprehensive deployment configuration support for voice providers by leveraging the existing deployment config system. No schema changes were required to voice providers themselves.

## Key Files

### New Documentation
| File | Purpose | Lines |
|------|---------|-------|
| `VOICE-PROVIDERS-DEPLOYMENT-GUIDE.md` | Complete guide for deployment configuration | 444 |
| `DEPLOYMENT-IMPLEMENTATION-SUMMARY.md` | Technical implementation overview | 300+ |
| `README-DEPLOYMENT.md` | This file - Quick reference | - |

### Core Deployment System (Existing)
| File | Purpose |
|------|---------|
| `zod-schema.deployment-config.ts` | Main deployment configuration schema |
| `deployment-config.types.ts` | TypeScript type definitions |
| `deployment-config.utils.ts` | Utility functions |
| `deployment-config.presets.ts` | Pre-configured presets |

### Voice Provider System (Unchanged)
| File | Purpose |
|------|---------|
| `zod-schema.voice-providers.ts` | Voice provider schemas |
| `types.voice.ts` | Voice provider types |
| `voice-providers.utils.ts` | Voice provider utilities |
| `voice-providers.migration.ts` | Migration utilities |

## Quick Start

### Define a Voice Provider with Deployment

```typescript
import type { VoiceProviderEntry } from "./zod-schema.voice-providers.js";

// Whisper STT with Docker
const provider: VoiceProviderEntry = {
  id: "whisper-docker",
  name: "Whisper (Docker)",
  enabled: true,
  priority: 10,
  stt: {
    type: "whisper",
    modelSize: "base",
    language: "en"
  }
};

// Deployment configuration handled by deployment-config system:
// - Mode: docker, system, or cloud
// - GPU support, resource limits, health checks, retries all supported
```

### Configuration Modes

```typescript
// Docker mode
{
  id: "whisper-docker",
  stt: { type: "whisper", modelSize: "small" }
  // Deployment via zod-schema.deployment-config.ts with docker mode
}

// System mode
{
  id: "faster-whisper-system",
  stt: { type: "faster-whisper", modelSize: "base", computeType: "float16" }
  // Deployment via system mode with native installation
}

// Cloud mode
{
  id: "openai-cloud",
  stt: { type: "openai", service: "openai", apiKey: process.env.OPENAI_API_KEY }
  // Deployment via cloud mode with API timeout/retry/rate-limit
}
```

## Supported Providers

### STT Providers
- **Whisper** - Basic OpenAI Whisper
- **Faster-Whisper** - Optimized Whisper with compute options
- **OpenAI** - Cloud API
- **Google Cloud** - Cloud API
- **Azure** - Cloud API

### TTS Providers
- **Kokoro** - Local neural TTS
- **Piper** - Local lightweight TTS
- **ElevenLabs** - Cloud premium voice
- **OpenAI** - Cloud TTS
- **Google Cloud** - Cloud API
- **Azure** - Cloud API

## Deployment Modes

### Docker
```
GPU: nvidia, amd
Port mapping: supported
Volume mounts: supported
Resource limits: CPU, memory
Restart policies: no, always, onFailure, unless-stopped
```

### System
```
GPU: CUDA, MPS
Model cache: configurable
CPU threads: configurable
Python path: configurable
Auto-download: supported
```

### Cloud
```
API timeout: configurable
Retries: exponential backoff
Rate limiting: per minute
Batch processing: supported
Health checks: via endpoint
```

## Common Configuration Patterns

### Performance-First (GPU)
```typescript
// Use large models with GPU acceleration
{ stt: { type: "whisper", modelSize: "large" } }
{ tts: { type: "kokoro", voice: "af" } }
```

### Cost-Optimized (Local -> Cloud)
```typescript
// Use system models, fallback to cloud
const providers = [
  { id: "local", priority: 10, stt: { type: "faster-whisper" } },
  { id: "cloud", priority: 0, stt: { type: "openai" } }
];
```

### Hybrid (Realtime + Batch)
```typescript
// Fast response: local, Batch processing: cloud
const providers = [
  { id: "realtime", priority: 10, stt: { type: "faster-whisper" } },
  { id: "batch", priority: 5, stt: { type: "openai" } }
];
```

## Health Checks

Via deployment-config system:
```typescript
healthCheck: {
  enabled: true,
  endpoint: "http://localhost:8000/health",  // Docker
  timeoutMs: 5000,
  intervalMs: 30000,
  failureThreshold: 3
}
```

## Retry Policies

Via deployment-config system:
```typescript
retries: {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  multiplier: 2.0,                    // Exponential backoff
  retryableErrors: [503, 504, "TIMEOUT"]
}
```

## Environment Variables

```bash
# STT/TTS APIs
export OPENAI_API_KEY="sk-..."
export GOOGLE_API_KEY="..."
export AZURE_API_KEY="..."
export ELEVENLABS_API_KEY="..."
```

## Utilities

```typescript
import {
  detectSystemCapabilities,
  getRecommendedProviders,
  validateProviderConfig
} from "./voice-providers.utils.js";

// Check system for GPU, CPU, memory
const caps = await detectSystemCapabilities();

// Get recommended providers for system
const recommended = await getRecommendedProviders(caps);

// Validate provider configuration
const valid = await validateProviderConfig(provider);
```

## Testing

```bash
# Run voice provider tests
pnpm test src/config/voice-providers.test.ts

# Check types
npx tsc --noEmit src/config/zod-schema.voice-providers.ts
```

## Migration

From legacy voice config:

```typescript
import {
  hasLegacyVoiceConfig,
  migrateLegacyVoiceConfig,
  validateVoiceProvidersConfig
} from "./voice-providers.migration.js";

if (hasLegacyVoiceConfig(config)) {
  const migrated = migrateLegacyVoiceConfig(config);
  await validateVoiceProvidersConfig(migrated);
}
```

## References

- **Full Guide**: `VOICE-PROVIDERS-DEPLOYMENT-GUIDE.md`
- **Implementation**: `DEPLOYMENT-IMPLEMENTATION-SUMMARY.md`
- **Schema**: `zod-schema.deployment-config.ts`
- **Types**: `deployment-config.types.ts`
- **Examples**: See example configs in VOICE-PROVIDERS-DEPLOYMENT-GUIDE.md

## Architecture Benefits

✅ Unified deployment configuration system
✅ Comprehensive health checking and monitoring
✅ Fault tolerance with automatic retries
✅ Resource management (CPU, GPU, memory)
✅ Centralized logging and observability
✅ Type-safe configuration with TypeScript
✅ Backward compatible with existing configs
✅ Extensible for new providers and modes
✅ Production-ready enterprise features

## Next Steps

1. Read `VOICE-PROVIDERS-DEPLOYMENT-GUIDE.md` for detailed examples
2. Choose deployment mode (Docker, System, or Cloud)
3. Configure provider with deployment details
4. Set up health checks and retry policies
5. Validate configuration with utilities
6. Test with real providers

---

For more information, see the comprehensive guide at `VOICE-PROVIDERS-DEPLOYMENT-GUIDE.md`
