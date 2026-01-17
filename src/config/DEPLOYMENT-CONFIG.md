# Deployment Configuration Schema for Voice Providers

Complete guide for configuring voice provider deployments across Docker, System, and Cloud modes.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Base Configuration](#base-configuration)
4. [Docker Mode](#docker-mode)
5. [System Mode](#system-mode)
6. [Cloud Mode](#cloud-mode)
7. [Provider Examples](#provider-examples)
8. [Validation & Usage](#validation--usage)
9. [API Reference](#api-reference)

## Overview

The deployment configuration schema provides a unified way to configure voice providers (STT/TTS) across three deployment modes:

- **Docker**: Run provider in containerized environment
- **System**: Use system-installed binary or package
- **Cloud**: Connect to remote API service

Each mode has specific configuration options while sharing common settings like health checks, retries, and logging.

## Architecture

### Type Hierarchy

```
DeploymentConfig (Union type)
├── DockerDeploymentConfig
├── SystemDeploymentConfig
└── CloudDeploymentConfig

All extend:
└── BaseDeploymentConfig
    ├── retries: RetryPolicy
    ├── healthCheck: HealthCheckConfig
    └── logging: LoggingConfig
```

### Key Design Principles

1. **Mode Discrimination**: Use `mode` field to determine config structure
2. **Type Safety**: Zod schemas provide runtime validation
3. **Provider Agnostic**: Schema works for any voice provider
4. **Provider Overrides**: Override specific provider settings via `ProviderDeploymentOverrides`
5. **Environment Resolution**: Support env var interpolation like `${CUDA_VISIBLE_DEVICES}`

## Base Configuration

Configuration properties common to all deployment modes.

### Properties

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | `string` | Required | Unique provider identifier (e.g., "whisper-docker") |
| `name` | `string` | Optional | Human-readable name |
| `type` | `string` | Required | Provider type (whisper, faster-whisper, kokoro, etc.) |
| `mode` | `"docker" \| "system" \| "cloud"` | Required | Deployment mode |
| `enabled` | `boolean` | `true` | Whether to enable this provider |
| `priority` | `number` | `0` | Priority in fallback chain (higher = first) |
| `timeoutMs` | `number` | `30000` | Request timeout in milliseconds |
| `retries` | `RetryPolicy` | See below | Retry configuration |
| `healthCheck` | `HealthCheckConfig` | See below | Health check settings |
| `logging` | `LoggingConfig` | See below | Logging configuration |
| `tags` | `Record<string, string>` | `{}` | Custom metadata tags |
| `env` | `Record<string, string>` | `{}` | Environment variables |

### RetryPolicy

Automatic retry configuration for transient failures.

```typescript
{
  maxRetries: 3,              // Max retry attempts
  initialDelayMs: 500,        // Initial backoff (ms)
  maxDelayMs: 30000,          // Max backoff (ms)
  multiplier: 2,              // Exponential backoff multiplier
  retryableErrors: [          // Error codes to retry on
    "TIMEOUT",
    "ECONNRESET",
    429                       // HTTP 429 (rate limit)
  ]
}
```

### HealthCheckConfig

Health monitoring and readiness probes.

```typescript
{
  enabled: true,              // Enable health checks
  endpoint: "http://localhost:8000/health",  // HTTP endpoint
  timeoutMs: 5000,           // Health check timeout
  intervalMs: 30000,         // Check interval
  failureThreshold: 3,       // Failed checks before unhealthy
  successThreshold: 1,       // Successful checks before healthy
  command: "whisper --help", // Alternative: shell command
  expectedExitCode: 0        // Expected exit code for commands
}
```

### LoggingConfig

Logging behavior and verbosity.

```typescript
{
  level: "info",              // Log level: trace, debug, info, warn, error, fatal
  verbose: false,             // Enable verbose request/response logging
  filePath: "/var/log/voice", // Log file path (optional)
  maxFileSize: 10485760,      // Max log file size (10MB)
  maxFiles: 3,                // Max rotated log files
  json: false                 // Use JSON structured logging
}
```

## Docker Mode

Deploy provider in a Docker container.

### Configuration

```typescript
interface DockerDeploymentConfig extends BaseDeploymentConfig {
  mode: "docker";
  image: string;              // Docker image name (required)
  tag?: string;               // Image tag
  pullPolicy?: "always" | "ifNotPresent" | "never";
  ports: Record<number, number>;  // Port mapping (internal: external)
  volumes?: Record<string, string>;  // Volume mounts (container: host)
  network?: string;           // Docker network (default: "bridge")
  command?: string[];         // Container startup command
  args?: string[];            // Container startup arguments
  buildFirst?: boolean;       // Build before running
  dockerfilePath?: string;    // Dockerfile path for build
  resources?: {
    memoryMb?: number;        // Memory limit (MB)
    cpuLimit?: number;        // CPU limit (cores)
    memoryRequestMb?: number; // Memory request (MB)
    cpuRequest?: number;      // CPU request (cores)
  };
  restartPolicy?: "no" | "always" | "onFailure" | "unlessStopped";
  maxRetryCount?: number;     // Restart retry count (onFailure)
  logging?: {
    driver?: string;          // Docker logging driver
    options?: Record<string, string>;
  };
  security?: {
    privileged?: boolean;     // Run as privileged
    user?: string;            // Container user
    capAdd?: string[];        // Linux capabilities to add
    capDrop?: string[];       // Linux capabilities to drop
  };
  containerHealthCheck?: {    // Container-level health check
    command: string[];
    intervalMs?: number;
    timeoutMs?: number;
    retries?: number;
    startPeriodMs?: number;
  };
  additionalFlags?: Record<string, string | boolean>;
}
```

### Example: Whisper via Docker

```typescript
const whisperDockerConfig: DockerDeploymentConfig = {
  id: "whisper-docker",
  name: "Whisper (Docker)",
  type: "whisper",
  mode: "docker",
  image: "openai/whisper",
  tag: "latest",
  pullPolicy: "ifNotPresent",
  ports: { 8000: 8000 },
  volumes: {
    "/root/.cache": "/tmp/whisper-cache"
  },
  resources: {
    memoryMb: 4096,
    cpuLimit: 2,
    memoryRequestMb: 2048,
    cpuRequest: 1
  },
  restartPolicy: "onFailure",
  healthCheck: {
    enabled: true,
    endpoint: "http://localhost:8000/health",
    intervalMs: 30000
  }
};
```

## System Mode

Deploy provider as system binary or package.

### Configuration

```typescript
interface SystemDeploymentConfig extends BaseDeploymentConfig {
  mode: "system";
  binary: string;             // Binary name (required)
  packageManager?: ("npm" | "pip" | "brew" | "apt" | "dnf" | "pacman")[];
  npmPackage?: string;        // NPM package name
  pypiPackage?: string;       // PyPI package name
  brewFormula?: string;       // Homebrew formula
  aptPackage?: string;        // APT package name
  searchPaths?: string[];     // Paths to search for binary
  versionConstraint?: string; // Version requirement (e.g., ">=1.0.0")
  systemDependencies?: {
    name: string;
    packageManager: string;
    required: boolean;
    optional?: boolean;
  }[];
  installationInstructions?: {
    title?: string;
    command?: string;          // Install command
    manualSteps?: string[];    // Manual installation steps
    documentationUrl?: string;
  };
  cliFlags?: {
    defaults?: Record<string, string | boolean | number>;
    wrapper?: string;         // CLI wrapper command
    cwd?: string;             // Working directory
  };
  environmentSetup?: Record<string, string>;
  models?: {
    path: string;             // Model directory path
    autoDownload?: boolean;   // Auto-download missing models
    predownload?: string[];   // Pre-download specific models
    sources?: Record<string, string>;
  };
  capabilityCheck?: {
    command: string;          // Verification command
    successIndicator?: string; // Success pattern (regex/substring)
  };
}
```

### Example: Whisper via System

```typescript
const whisperSystemConfig: SystemDeploymentConfig = {
  id: "whisper-system",
  name: "Whisper (System)",
  type: "whisper",
  mode: "system",
  binary: "whisper",
  packageManager: ["pip", "brew"],
  pypiPackage: "openai-whisper",
  brewFormula: "whisper",
  searchPaths: ["/usr/local/bin", "~/.local/bin"],
  systemDependencies: [
    {
      name: "ffmpeg",
      packageManager: "apt",
      required: true
    }
  ],
  installationInstructions: {
    command: "pip install openai-whisper",
    documentationUrl: "https://github.com/openai/whisper"
  },
  models: {
    path: "~/.cache/whisper",
    autoDownload: true,
    predownload: ["base", "small"]
  },
  capabilityCheck: {
    command: "whisper --version",
    successIndicator: "version"
  }
};
```

## Cloud Mode

Deploy provider as API service.

### Configuration

```typescript
interface CloudDeploymentConfig extends BaseDeploymentConfig {
  mode: "cloud";
  provider: string;           // API provider name (required)
  endpoint: string;           // API endpoint URL (required)
  apiVersion?: string;        // API version
  auth?: {
    type: "apiKey" | "oauth2" | "bearer" | "custom";
    keyField?: string;        // API key header/field name
    oauth2?: {                // OAuth2 configuration
      tokenEndpoint: string;
      authorizeEndpoint: string;
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
    headers?: Record<string, string>;  // Custom auth headers
  };
  rateLimit?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    maxConcurrent?: number;
    queueStrategy?: "fifo" | "prioritize";
  };
  quota?: {
    enabled?: boolean;
    monthlyCharacterLimit?: number;
    monthlyRequestLimit?: number;
    costPer1kUnits?: number;
    alertThreshold?: number;  // Percentage (default: 80)
  };
  fallbackEndpoints?: {
    url: string;
    priority?: number;
  }[];
  transforms?: {
    requestTransform?: (payload: any) => any;
    responseTransform?: (response: any) => any;
    responseSchema?: Record<string, any>;
  };
  availableModels?: string[];
  availableVoices?: string[];
  modelFallbacks?: Record<string, string>;
  voiceFallbacks?: Record<string, string>;
  regions?: {
    default: string;
    endpoints?: Record<string, string>;
    preferredRegions?: string[];
  };
  budget?: {
    monthlyLimit?: number;
    dailyLimit?: number;
    alertThreshold?: number;
  };
  cache?: {
    enabled?: boolean;
    ttlSeconds?: number;
    maxEntries?: number;
  };
}
```

### Example: OpenAI Whisper API

```typescript
const openaiSttConfig: CloudDeploymentConfig = {
  id: "openai-stt-api",
  name: "OpenAI Whisper (Cloud)",
  type: "openai",
  mode: "cloud",
  provider: "openai",
  endpoint: "https://api.openai.com/v1",
  auth: {
    type: "bearer"
    // API key loaded from env or config
  },
  rateLimit: {
    requestsPerMinute: 3500
  },
  quota: {
    enabled: true,
    costPer1kUnits: 0.002
  },
  availableModels: ["whisper-1"],
  timeoutMs: 60000
};
```

### Example: ElevenLabs TTS API

```typescript
const elevenLabsConfig: CloudDeploymentConfig = {
  id: "elevenlabs-api",
  name: "ElevenLabs (Cloud)",
  type: "elevenlabs",
  mode: "cloud",
  provider: "elevenlabs",
  endpoint: "https://api.elevenlabs.io/v1",
  auth: {
    type: "apiKey",
    keyField: "xi-api-key"
  },
  rateLimit: {
    requestsPerMinute: 60,
    maxConcurrent: 5
  },
  quota: {
    monthlyCharacterLimit: 100000,
    costPer1kUnits: 0.002,
    alertThreshold: 80
  },
  availableVoices: [
    "bella", "rachel", "daniel", "sam", "jessica"
  ],
  cache: {
    enabled: true,
    ttlSeconds: 3600,
    maxEntries: 1000
  }
};
```

## Provider Examples

All provider presets are available in `deployment-config.presets.ts`:

| Provider | STT | TTS | Modes | Notes |
|----------|-----|-----|-------|-------|
| Whisper | ✓ | - | Docker, System | Local, offline-capable |
| Faster-Whisper | ✓ | - | Docker, System | Optimized, local |
| Kokoro | - | ✓ | Docker, System | High-quality local |
| Piper | - | ✓ | System | Lightweight, multi-language |
| OpenAI | ✓ | ✓ | Cloud | Premium API |
| Google Cloud | ✓ | ✓ | Cloud | Regional support |
| Azure | ✓ | ✓ | Cloud | Enterprise |
| ElevenLabs | - | ✓ | Cloud | Premium voices |

## Validation & Usage

### Import Types and Utilities

```typescript
import type { DeploymentConfig } from "./deployment-config.types";
import { validateDeploymentConfig, mergeDeploymentConfigs } from "./deployment-config.utils";
import { WHISPER_DOCKER_PRESET } from "./deployment-config.presets";
```

### Validate Configuration

```typescript
const config = {...};
const result = validateDeploymentConfig(config);

if (result.valid) {
  console.log("Config is valid:", result.config);
} else {
  console.error("Validation errors:", result.errors);
}
```

### Get Preset

```typescript
import { getDeploymentPreset } from "./deployment-config.presets";

const whisperPreset = getDeploymentPreset("whisper-docker");
```

### Merge Configurations

```typescript
import { mergeDeploymentConfigs } from "./deployment-config.utils";

const customConfig = mergeDeploymentConfigs(whisperPreset, {
  priority: 20,
  env: {
    CUDA_VISIBLE_DEVICES: "0,1"
  }
});
```

### Type Guards

```typescript
import { isDockerConfig, isSystemConfig, isCloudConfig } from "./deployment-config.utils";

if (isDockerConfig(config)) {
  console.log("Docker image:", config.image);
}
```

### Estimate Requirements

```typescript
import { estimateDeploymentRequirements } from "./deployment-config.utils";

const requirements = estimateDeploymentRequirements(config);
console.log(`Needs ${requirements.recommendedMemoryMb}MB RAM`);
```

## API Reference

### Key Functions

#### `validateDeploymentConfig(config: unknown)`
Validates configuration against schema. Returns `{ valid, config?, errors? }`.

#### `validateDeploymentConfigByMode(config, mode)`
Validates config for specific deployment mode.

#### `isDockerConfig(config) / isSystemConfig(config) / isCloudConfig(config)`
Type guard functions for discriminated unions.

#### `mergeDeploymentConfigs(baseConfig, overrides)`
Shallow merge with structure preservation.

#### `deepMergeDeploymentConfigs(baseConfig, overrides, depth)`
Deep merge with specified recursion depth.

#### `applyProviderOverrides(baseConfig, overrides)`
Apply `ProviderDeploymentOverrides` to configuration.

#### `resolveEnvVariables(value, env)`
Resolve `${VAR}` and `${VAR:default}` patterns.

#### `resolveConfigEnvironment(config, env)`
Resolve all env variables in entire config.

#### `configToEnvVars(config, prefix)`
Convert config to environment variables.

#### `summarizeDeploymentConfig(config)`
Get configuration summary for logging.

#### `isCompleteConfig(config)`
Check if config has all required fields.

#### `getRequiredFields(mode)`
Get list of required fields for deployment mode.

#### `estimateDeploymentRequirements(config)`
Estimate memory, CPU, network, and disk needs.

#### `getDeploymentPreset(presetId)`
Get preset configuration by ID.

#### `listDeploymentPresets()`
List all available preset configurations.

#### `getPresetsByMode(mode)`
Filter presets by deployment mode.

#### `getPresetsByType(type)`
Filter presets by provider type.

## Plugin Integration

Voice provider plugins inherit from `BaseVoiceProviderExecutor` and use deployment config:

```typescript
export class MyProviderExecutor extends BaseVoiceProviderExecutor {
  private config: DeploymentConfig;

  constructor(config: DeploymentConfig) {
    super();
    this.config = config;
  }

  async initialize(): Promise<void> {
    // Use config.mode to determine initialization path
    if (isDockerConfig(this.config)) {
      // Docker-specific init
    } else if (isSystemConfig(this.config)) {
      // System-specific init
    } else if (isCloudConfig(this.config)) {
      // Cloud-specific init
    }
  }

  getCapabilities(): ProviderCapabilities {
    return {
      supportedFormats: [AudioFormat.PCM_16, AudioFormat.OPUS],
      maxConcurrentSessions: 10,
      // ... other capabilities
    };
  }
}
```

## Environment Variables

Configuration supports environment variable interpolation:

```typescript
const config: CloudDeploymentConfig = {
  id: "openai-api",
  endpoint: "${OPENAI_API_ENDPOINT:https://api.openai.com/v1}",
  auth: {
    type: "bearer",
    headers: {
      Authorization: "Bearer ${OPENAI_API_KEY}"
    }
  }
};

// Resolve with actual environment variables
const resolved = resolveConfigEnvironment(config, process.env);
```

Supported formats:
- `$VAR` - Simple reference
- `${VAR}` - Braced reference
- `${VAR:default}` - With default value

## Error Handling

All utilities provide detailed error information:

```typescript
const result = validateDeploymentConfig(config);
if (!result.valid) {
  result.errors?.forEach(err => {
    console.error(`Validation error: ${err}`);
  });
}
```

Common validation issues:
- Missing required fields (id, type, mode)
- Mode-specific field validation
- Invalid URL formats for Cloud endpoints
- Invalid port ranges for Docker

## Migration from Old Config

If migrating from older configuration format:

```typescript
// Old config
const oldConfig = { ... };

// Validate as new config
const result = validateDeploymentConfig(oldConfig);

// If invalid, map old fields to new structure
const newConfig: DeploymentConfig = {
  id: oldConfig.providerId,
  type: oldConfig.type,
  mode: "docker", // Determine from oldConfig
  // ... map other fields
};
```

