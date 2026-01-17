# Voice Provider Deployment Configuration Schema

## Overview

A comprehensive, production-ready TypeScript schema for configuring voice provider deployments across three modes: Docker, System, and Cloud. This schema provides:

- **Type Safety**: Full TypeScript support with Zod validation
- **Mode Discrimination**: Single `mode` field determines config structure
- **Provider Agnostic**: Works for any voice provider (STT/TTS)
- **15+ Presets**: Pre-configured templates for common providers
- **20+ Utilities**: Helper functions for validation, merging, and analysis
- **Complete Documentation**: User guides and architectural documentation

## Quick Start

### Installation

Files are located in `/src/config/`:

```typescript
import type { DeploymentConfig } from './deployment-config.types';
import { WHISPER_DOCKER_PRESET } from './deployment-config.presets';
import { validateDeploymentConfig } from './deployment-config.utils';
```

### Basic Usage

```typescript
// Use a preset
const config = WHISPER_DOCKER_PRESET;

// Customize it
const customized = {
  ...config,
  priority: 20,
  env: { CUDA_VISIBLE_DEVICES: '0' }
};

// Validate
const result = validateDeploymentConfig(customized);
if (result.valid) {
  // Use validated config
  await providerRegistry.load([result.config]);
}
```

### Deployment Modes

#### Docker Mode

Run provider in a containerized environment:

```typescript
const config: DockerDeploymentConfig = {
  id: 'whisper-docker',
  type: 'whisper',
  mode: 'docker',
  image: 'openai/whisper:latest',
  ports: { 8000: 8000 },
  resources: {
    memoryMb: 4096,
    cpuLimit: 2
  },
  healthCheck: {
    enabled: true,
    endpoint: 'http://localhost:8000/health'
  }
};
```

#### System Mode

Use system-installed binary or package:

```typescript
const config: SystemDeploymentConfig = {
  id: 'whisper-system',
  type: 'whisper',
  mode: 'system',
  binary: 'whisper',
  packageManager: ['pip', 'brew'],
  models: {
    path: '~/.cache/whisper',
    autoDownload: true
  }
};
```

#### Cloud Mode

Connect to remote API service:

```typescript
const config: CloudDeploymentConfig = {
  id: 'openai-api',
  type: 'openai',
  mode: 'cloud',
  provider: 'openai',
  endpoint: 'https://api.openai.com/v1',
  auth: { type: 'bearer' },
  rateLimit: { requestsPerMinute: 3500 }
};
```

## Available Presets

### STT Providers

| Provider | Docker | System | Cloud |
|----------|--------|--------|-------|
| Whisper | ✓ | ✓ | - |
| Faster-Whisper | ✓ | ✓ | - |
| OpenAI | - | - | ✓ |
| Google Cloud | - | - | ✓ |
| Azure | - | - | ✓ |

### TTS Providers

| Provider | Docker | System | Cloud |
|----------|--------|--------|-------|
| Kokoro | ✓ | ✓ | - |
| Piper | - | ✓ | - |
| OpenAI | - | - | ✓ |
| Google Cloud | - | - | ✓ |
| Azure | - | - | ✓ |
| ElevenLabs | - | - | ✓ |

### Get Presets

```typescript
import {
  getDeploymentPreset,
  listDeploymentPresets,
  getPresetsByMode,
  getPresetsByType
} from './deployment-config.presets';

// By ID
const preset = getDeploymentPreset('whisper-docker');

// List all
const all = listDeploymentPresets();

// Filter by mode
const dockerPresets = getPresetsByMode('docker');

// Filter by type
const whisperPresets = getPresetsByType('whisper');
```

## Core Features

### 1. Health Checks

Unified health monitoring across all modes:

```typescript
healthCheck: {
  enabled: true,
  endpoint: 'http://localhost:8000/health',  // HTTP endpoint
  command: 'whisper --version',              // CLI command
  timeoutMs: 5000,
  intervalMs: 30000,
  failureThreshold: 3
}
```

### 2. Retry Policies

Exponential backoff with error classification:

```typescript
retries: {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 30000,
  multiplier: 2,
  retryableErrors: ['TIMEOUT', 429, 'ECONNRESET']
}
```

### 3. Environment Variables

Built-in interpolation support:

```typescript
// Configuration
{
  endpoint: "${OPENAI_ENDPOINT:https://api.openai.com/v1}",
  auth: {
    headers: {
      Authorization: "Bearer ${OPENAI_API_KEY}"
    }
  }
}

// Resolution
const resolved = resolveConfigEnvironment(config, process.env);
```

Supported formats:
- `$VAR` - Simple reference
- `${VAR}` - Braced reference
- `${VAR:default}` - With default value

### 4. Type-Safe Mode Discrimination

Use type guards for safe access:

```typescript
if (isDockerConfig(config)) {
  console.log(config.image);  // Type-safe
}

if (isSystemConfig(config)) {
  console.log(config.binary); // Type-safe
}

if (isCloudConfig(config)) {
  console.log(config.endpoint); // Type-safe
}
```

### 5. Configuration Merging

Shallow and deep merge support:

```typescript
import { mergeDeploymentConfigs } from './deployment-config.utils';

const base = WHISPER_DOCKER_PRESET;
const custom = mergeDeploymentConfigs(base, {
  priority: 20,
  env: { CUDA_VISIBLE_DEVICES: '0' },
  resources: { memoryMb: 8192 }
});
```

## Validation

### Full Validation

```typescript
const result = validateDeploymentConfig(config);
if (result.valid) {
  // config is fully typed and validated
  const deploymentConfig: DeploymentConfig = result.config!;
} else {
  // Detailed error messages
  result.errors?.forEach(err => console.error(err));
}
```

### Mode-Specific Validation

```typescript
const result = validateDeploymentConfigByMode(config, 'docker');
if (!result.valid) {
  console.error('Docker config invalid:', result.errors);
}
```

## Utilities

### Configuration Analysis

```typescript
// Check completeness
if (isCompleteConfig(config)) {
  console.log('Config has all required fields');
}

// Estimate requirements
const req = estimateDeploymentRequirements(config);
console.log(`Needs ${req.recommendedMemoryMb}MB RAM`);
console.log(`Needs ${req.cpuCoresNeeded} CPU cores`);
console.log(`Network required: ${req.networkRequired}`);

// Get summary
const summary = summarizeDeploymentConfig(config);
console.log(JSON.stringify(summary, null, 2));
```

### Config Conversion

```typescript
// Convert to environment variables
const envVars = configToEnvVars(config, 'VOICE_PROVIDER_');

// Convert to string
const formatted = formatDeploymentConfig(config);
console.log(formatted);
```

## Plugin Integration

Voice providers inherit from `BaseVoiceProviderExecutor`:

```typescript
export class MyProviderExecutor extends BaseVoiceProviderExecutor {
  constructor(private config: DeploymentConfig) {
    super();
  }

  async initialize(): Promise<void> {
    if (isDockerConfig(this.config)) {
      // Docker initialization
    } else if (isSystemConfig(this.config)) {
      // System initialization
    } else if (isCloudConfig(this.config)) {
      // Cloud initialization
    }
  }

  async transcribe(audio: AudioBuffer): Promise<TranscriptionResult> {
    // Use this.config.mode to determine behavior
  }
}
```

## File Structure

```
src/config/
├── deployment-config.types.ts              # TypeScript interfaces (470 lines)
├── zod-schema.deployment-config.ts         # Zod schemas (321 lines)
├── deployment-config.presets.ts            # 15+ presets (762 lines)
├── deployment-config.utils.ts              # 20+ utilities (475 lines)
├── deployment-config.index.ts              # Public API (80 lines)
├── deployment-config.test.ts               # 40+ tests (555 lines)
├── DEPLOYMENT-CONFIG.md                    # User guide (643 lines)
├── DEPLOYMENT-CONFIG-ARCHITECTURE.md       # Architecture (615 lines)
└── DEPLOYMENT-CONFIG-README.md             # This file
```

## Examples

### Multi-Provider Fallback

```typescript
const config: VoiceProvidersConfig = {
  enabled: true,
  providers: [
    {
      id: 'faster-whisper-docker',
      deploymentConfig: FASTER_WHISPER_DOCKER_PRESET
    },
    {
      id: 'whisper-system',
      deploymentConfig: WHISPER_SYSTEM_PRESET
    },
    {
      id: 'openai-api',
      deploymentConfig: OPENAI_STT_CLOUD_PRESET
    }
  ],
  fallbackChain: ['faster-whisper-docker', 'whisper-system', 'openai-api']
};
```

### Cloud Provider with Budget

```typescript
const customOpenAI = mergeDeploymentConfigs(
  OPENAI_TTS_CLOUD_PRESET,
  {
    budget: {
      monthlyLimit: 100,
      dailyLimit: 10,
      alertThreshold: 5
    },
    quota: {
      alertThreshold: 80
    },
    rateLimit: {
      requestsPerMinute: 100,
      maxConcurrent: 5
    }
  }
);
```

### Custom Docker Provider

```typescript
const customConfig: DockerDeploymentConfig = {
  id: 'custom-provider',
  type: 'custom',
  mode: 'docker',
  image: 'my-registry.com/custom-provider:latest',
  tag: 'v1.0.0',
  ports: { 5000: 5000 },
  volumes: {
    '/models': '/tmp/models'
  },
  resources: {
    memoryMb: 8192,
    cpuLimit: 4,
    memoryRequestMb: 4096,
    cpuRequest: 2
  },
  healthCheck: {
    enabled: true,
    endpoint: 'http://localhost:5000/health',
    intervalMs: 30000
  },
  logging: {
    level: 'info',
    verbose: false
  }
};
```

## API Reference

### Types

- `DeploymentConfig` - Union of all config types
- `DockerDeploymentConfig` - Docker-specific config
- `SystemDeploymentConfig` - System-specific config
- `CloudDeploymentConfig` - Cloud-specific config
- `BaseDeploymentConfig` - Shared configuration
- `HealthCheckConfig` - Health monitoring
- `RetryPolicy` - Retry configuration
- `LoggingConfig` - Logging settings

### Functions

**Validation**
- `validateDeploymentConfig(config)` - Full validation
- `validateDeploymentConfigByMode(config, mode)` - Mode-specific

**Type Guards**
- `isDockerConfig(config)` - Check Docker
- `isSystemConfig(config)` - Check System
- `isCloudConfig(config)` - Check Cloud

**Merging**
- `mergeDeploymentConfigs(base, overrides)` - Shallow merge
- `deepMergeDeploymentConfigs(base, overrides)` - Deep merge
- `applyProviderOverrides(base, overrides)` - Apply overrides

**Environment**
- `resolveEnvVariables(value, env)` - Resolve vars
- `resolveConfigEnvironment(config, env)` - Resolve config
- `configToEnvVars(config, prefix)` - To env vars

**Analysis**
- `summarizeDeploymentConfig(config)` - Get summary
- `isCompleteConfig(config)` - Check completeness
- `estimateDeploymentRequirements(config)` - Resource estimation
- `formatDeploymentConfig(config)` - Pretty-print

**Discovery**
- `getDeploymentPreset(id)` - Get by ID
- `listDeploymentPresets()` - List all
- `getPresetsByMode(mode)` - Filter by mode
- `getPresetsByType(type)` - Filter by type

## Testing

Run tests:
```bash
pnpm test src/config/deployment-config.test.ts
```

Coverage includes:
- Docker config validation (5 tests)
- System config validation (3 tests)
- Cloud config validation (5 tests)
- Type guards (3 tests)
- Configuration merging (2 tests)
- Environment variable resolution (4 tests)
- Presets (5 tests)
- Completeness checks (2 tests)
- Resource estimation (3 tests)
- Plus 8 more specialized tests

## Documentation

- **DEPLOYMENT-CONFIG.md** - Complete user guide
  - Architecture overview
  - Configuration reference
  - Provider examples
  - API reference
  - Plugin integration
  - Error handling

- **DEPLOYMENT-CONFIG-ARCHITECTURE.md** - Technical deep dive
  - Architecture overview
  - Type system
  - Provider support matrix
  - Core features
  - Design decisions
  - Future enhancements

## Contributing

When adding a new provider:

1. Create a preset in `deployment-config.presets.ts`
2. Add validation tests in `deployment-config.test.ts`
3. Update documentation with the new provider
4. Export in `deployment-config.index.ts`

## License

Same as Clawdbot project

