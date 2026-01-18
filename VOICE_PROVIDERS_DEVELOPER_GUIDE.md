# Voice Providers Developer Guide

This guide explains the voice providers system architecture for developers integrating with the pluggable STT/TTS provider system.

## System Overview

The voice providers system is built with these principles:
- **Modular**: Each provider type is independent
- **Extensible**: Easy to add new providers
- **Type-safe**: Full TypeScript support
- **Backwards compatible**: Migrates legacy configuration
- **Testable**: Comprehensive test coverage

## Architecture Diagram

```
┌─────────────────────────────────────────────┐
│         User Interface Layer                │
├──────────────────────────┬──────────────────┤
│  CLI Commands            │  Onboarding      │
│  • voice status          │  • Setup wizard  │
│  • voice providers       │  • Prompts       │
│  • voice test            │  • Defaults      │
│  • configure voice       │                  │
└──────────────────────────┴──────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    Configuration & Loading Layer            │
├──────────────────────────┬──────────────────┤
│  voice-providers.loader  │  voice-providers │
│  • Load config           │  .migration      │
│  • Initialize providers  │  • Legacy        │
│  • Validate config       │    migration     │
│  • Status queries        │  • Validation    │
└──────────────────────────┴──────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    Utilities & Detection Layer              │
├──────────────────────────┬──────────────────┤
│  voice-providers.utils   │  voice-providers │
│  • System detection      │  .types          │
│  • Recommendations       │  • Type defs     │
│  • Dependency checks     │  • Interfaces    │
│  • Validation            │                  │
└──────────────────────────┴──────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    Schema & Types Layer                     │
├──────────────────────────┬──────────────────┤
│  zod-schema.voice-       │  voice-providers │
│  providers               │  .index          │
│  • Zod schemas           │  • Public API    │
│  • Type definitions      │  • Exports       │
└──────────────────────────┴──────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│    Voice-Call Plugin Integration            │
├──────────────────────────┬──────────────────┤
│  STT Operations          │  TTS Operations  │
│  • Transcribe audio      │  • Synthesize    │
│  • Handle fallbacks      │  • Handle errors │
│  • Manage state          │                  │
└──────────────────────────┴──────────────────┘
```

## Module Responsibilities

### Schema Layer (`zod-schema.voice-providers.ts`)

**Responsibility**: Define the shape and constraints of voice configuration

**Exports**:
```typescript
// Discriminated unions for type safety
export const STTProviderConfigSchema   // Local | Cloud STT
export const TTSProviderConfigSchema   // Local | Cloud TTS

// Root configuration
export const VoiceProvidersConfigSchema  // Complete config

// Types inferred from schemas
export type STTProviderConfig
export type TTSProviderConfig
export type VoiceProviderEntry
export type VoiceProvidersConfig
```

**Usage**:
```typescript
// Validate user input
const parsed = VoiceProvidersConfigSchema.parse(userInput);

// Create new configs programmatically
const config: VoiceProvidersConfig = {
  enabled: true,
  providers: [...]
};
```

### Types Layer (`voice-providers.types.ts`)

**Responsibility**: Define TypeScript interfaces for operations

**Exports**:
```typescript
interface SystemCapability       // Device capabilities
interface DependencyInfo         // Package information
interface ProviderAvailability   // Provider viability
interface ProviderInitResult     // Initialization outcome
```

**Usage**:
```typescript
const capabilities: SystemCapability = detectSystemCapabilities();
const availability: ProviderAvailability = isLocalProviderAvailable(...);
```

### Utilities Layer (`voice-providers.utils.ts`)

**Responsibility**: Core utilities for detection and validation

**Key Functions**:
```typescript
// System detection
detectSystemCapabilities()           // Detect GPU/CPU/memory
getRecommendedProviders(caps?)       // ML recommendations

// Dependency management
checkPackageInstalled(name)          // Check npm package
getProviderDependencies(type, model) // Get required deps
getInstallCommand(pkg)               // Get install command

// Validation and migration
validateProviderConfig(config)       // Validate provider
migrateLegacyVoiceConfig(old)        // Migrate old format
```

**Usage**:
```typescript
// Detect and recommend
const caps = detectSystemCapabilities();
if (caps.hasGpu) {
  const recs = getRecommendedProviders(caps);
  console.log("Recommended:", recs);
}

// Check dependencies
const deps = getProviderDependencies("stt", "faster-whisper");
const allInstalled = deps.every(d => d.installed);
```

### Migration Layer (`voice-providers.migration.ts`)

**Responsibility**: Handle backwards compatibility and config merging

**Key Functions**:
```typescript
// Legacy detection
hasLegacyVoiceConfig(cfg)              // Check for old config
hasNewVoiceProvidersConfig(cfg)        // Check for new config

// Migration
migrateLegacyTTSConfig(cfg)            // Migrate old TTS
applyVoiceProvidersMigration(cfg)      // Apply migration

// Utilities
getProvidersInPriorityOrder(config)    // Sort by priority
getFirstAvailableSTTProvider(config)   // Get primary STT
getFirstAvailableTTSProvider(config)   // Get primary TTS
```

**Usage**:
```typescript
// Check and migrate
if (hasLegacyVoiceConfig(config)) {
  config = applyVoiceProvidersMigration(config);
}

// Get providers by priority
const providers = getProvidersInPriorityOrder(voiceConfig);
for (const provider of providers) {
  console.log(`Provider ${provider.id} (priority ${provider.priority})`);
}
```

### Loader Layer (`voice-providers.loader.ts`)

**Responsibility**: Load, validate, and initialize providers

**Key Functions**:
```typescript
// Loading
loadVoiceProvidersConfig(cfg)          // Load and validate
updateSystemCapabilities(config)       // Update system info

// Initialization
initializeVoiceProviders(config, opts) // Setup providers

// Queries
getVoiceProviderStatus(config)         // Get status
hasAvailableSTTProvider(config)        // Check STT
hasAvailableTTSProvider(config)        // Check TTS
resolveProviderById(config, id)        // Get provider
```

**Usage**:
```typescript
// Load configuration
const { config, valid, errors } = loadVoiceProvidersConfig(clawdbotConfig);
if (!valid) {
  console.error("Config errors:", errors);
  return;
}

// Initialize
const results = await initializeVoiceProviders(config);
for (const result of results) {
  if (result.success) {
    console.log(`Provider ${result.providerId} initialized`);
  } else {
    console.error(`Provider failed:`, result.error);
  }
}

// Query status
const status = getVoiceProviderStatus(config);
console.log(`STT available: ${status.hasSTT}`);
console.log(`TTS available: ${status.hasTTS}`);
```

### Public API Layer (`voice-providers.index.ts`)

**Responsibility**: Export the public API

**Usage**:
```typescript
// Import from single location
import {
  type VoiceProvidersConfig,
  detectSystemCapabilities,
  loadVoiceProvidersConfig,
  initializeVoiceProviders,
} from "../config/voice-providers.index.js";
```

## Integration Patterns

### 1. Reading Configuration

```typescript
import { loadVoiceProvidersConfig } from "../config/voice-providers.index.js";

async function getVoiceConfig(clawdbotConfig: ClawdbotConfig) {
  const { config, valid, errors } = loadVoiceProvidersConfig(clawdbotConfig);

  if (!valid) {
    logger.warn("Voice config validation errors:", errors);
  }

  return config;
}
```

### 2. Detecting Recommendations

```typescript
import {
  detectSystemCapabilities,
  getRecommendedProviders,
} from "../config/voice-providers.index.js";

async function showRecommendations() {
  const caps = detectSystemCapabilities();
  const recs = getRecommendedProviders(caps);

  console.log(`System: ${caps.totalMemoryGb}GB RAM, GPU: ${caps.hasGpu}`);
  for (const rec of recs) {
    console.log(`  - ${rec.type}: ${rec.provider}`);
  }
}
```

### 3. Migrating Legacy Config

```typescript
import {
  hasLegacyVoiceConfig,
  applyVoiceProvidersMigration,
} from "../config/voice-providers.index.js";

function migrateIfNeeded(config: ClawdbotConfig): ClawdbotConfig {
  if (hasLegacyVoiceConfig(config)) {
    logger.info("Migrating legacy voice config...");
    return applyVoiceProvidersMigration(config);
  }
  return config;
}
```

### 4. Initializing Providers

```typescript
import {
  loadVoiceProvidersConfig,
  initializeVoiceProviders,
} from "../config/voice-providers.index.js";

async function setupProviders(clawdbotConfig: ClawdbotConfig) {
  const { config, valid } = loadVoiceProvidersConfig(clawdbotConfig);

  if (!valid) {
    throw new Error("Invalid voice configuration");
  }

  const results = await initializeVoiceProviders(config, {
    logger: console,
  });

  return results.filter(r => r.success);
}
```

### 5. Provider Fallback Chain

```typescript
import {
  getProvidersInPriorityOrder,
  getFirstAvailableSTTProvider,
} from "../config/voice-providers.index.js";

async function transcribeWithFallback(audio: Buffer, config: VoiceProvidersConfig) {
  const providers = getProvidersInPriorityOrder(config).filter(p => p.stt);

  for (const provider of providers) {
    try {
      return await transcribeWithProvider(provider, audio);
    } catch (error) {
      logger.warn(`Provider ${provider.id} failed, trying next...`, error);
    }
  }

  throw new Error("All STT providers failed");
}
```

## CLI Integration

### Adding New Commands

```typescript
// In a new file or existing command handler

import { configureVoiceCommand } from "./voice.js";
import { createClackPrompter } from "../wizard/clack-prompter.js";

export async function handleVoiceCommand(args: string[]) {
  const config = await loadClawdbotConfig();
  const prompter = createClackPrompter();

  const updated = await configureVoiceCommand(config, prompter);
  await writeConfigFile(CONFIG_PATH, updated);
}
```

### Integration with Program

```typescript
// In CLI program setup

program.command("voice")
  .option("--status", "Show voice status")
  .option("--providers", "List providers")
  .option("--test", "Test providers")
  .action(async (options) => {
    if (options.status) {
      await voiceStatusCommand();
    } else if (options.providers) {
      await voiceProvidersCommand();
    } else if (options.test) {
      await voiceTestCommand();
    } else {
      // Show interactive menu
      await handleVoiceCommand([]);
    }
  });
```

## Testing Patterns

### Schema Validation

```typescript
import { VoiceProvidersConfigSchema } from "../config/zod-schema.voice-providers.js";

it("should validate voice config", () => {
  const config = {
    enabled: true,
    providers: [{
      id: "test",
      stt: { type: "local", model: "faster-whisper" }
    }]
  };

  expect(() => VoiceProvidersConfigSchema.parse(config)).not.toThrow();
});
```

### Utility Testing

```typescript
import { detectSystemCapabilities } from "../config/voice-providers.utils.js";

it("should detect system capabilities", () => {
  const caps = detectSystemCapabilities();
  expect(caps.cpuThreads).toBeGreaterThan(0);
  expect(caps.totalMemoryGb).toBeGreaterThan(0);
});
```

### Migration Testing

```typescript
import { migrateLegacyTTSConfig } from "../config/voice-providers.migration.js";

it("should migrate legacy config", () => {
  const legacy = {
    gateway: { talk: { voiceId: "rachel" } }
  };

  const migrated = migrateLegacyTTSConfig(legacy);
  expect(migrated.providers).toHaveLength(1);
  expect(migrated.providers?.[0]?.tts?.voiceId).toBe("rachel");
});
```

## Error Handling

### Configuration Errors

```typescript
const { config, valid, errors } = loadVoiceProvidersConfig(cfg);
if (!valid) {
  errors.forEach(err => {
    logger.error(`Configuration error: ${err}`);
  });
  return null;
}
```

### Provider Initialization Errors

```typescript
const results = await initializeVoiceProviders(config);
for (const result of results) {
  if (!result.success) {
    logger.error(
      `Provider ${result.providerId} failed: ${result.error?.message}`
    );
    result.warnings.forEach(w => logger.warn(w));
  }
}
```

### Dependency Errors

```typescript
const deps = getProviderDependencies("stt", "faster-whisper");
const missing = deps.filter(d => !d.installed);
if (missing.length > 0) {
  const commands = missing.map(d => getInstallCommand(d.npmPackage!));
  logger.error(`Missing dependencies:\n${commands.join("\n")}`);
}
```

## Performance Considerations

### Lazy Loading
```typescript
// Load system capabilities only when needed
let cachedCapabilities: SystemCapability | null = null;

function getCapabilities(): SystemCapability {
  if (!cachedCapabilities) {
    cachedCapabilities = detectSystemCapabilities();
  }
  return cachedCapabilities;
}
```

### Caching Recommendations
```typescript
// Cache provider recommendations
const recommendationCache = new Map<string, ProviderRecommendation>();

function getRecommendations(capabilities: SystemCapability) {
  const key = JSON.stringify(capabilities);
  if (recommendationCache.has(key)) {
    return recommendationCache.get(key)!;
  }

  const recs = getRecommendedProviders(capabilities);
  recommendationCache.set(key, recs);
  return recs;
}
```

## Extension Points

### Adding Custom Providers

Future implementation can support custom provider plugins:

```typescript
interface CustomProvider {
  id: string;
  type: "stt" | "tts";
  initialize(): Promise<void>;
  transcribe?(audio: Buffer): Promise<string>;
  synthesize?(text: string): Promise<Buffer>;
}

function registerCustomProvider(provider: CustomProvider) {
  // Add to provider registry
}
```

### Provider Plugins

```typescript
// Example: Custom TTS provider
class MyTTSProvider implements TTSProvider {
  async synthesize(text: string): Promise<Buffer> {
    // Custom implementation
  }
}

registerCustomProvider({
  id: "my-tts",
  type: "tts",
  initialize: async () => { /* setup */ }
});
```

## Documentation Links

- [User Guide](/docs/voice-providers.md) - End-user documentation
- [API Reference](./voice-providers.index.ts) - Public API exports
- [Schema Reference](./zod-schema.voice-providers.ts) - Configuration schema
- [Tests](./voice-providers.test.ts) - Test examples

## Contributing

When adding new features:
1. Add schema updates to `zod-schema.voice-providers.ts`
2. Add type definitions to `voice-providers.types.ts`
3. Add utilities to `voice-providers.utils.ts`
4. Add tests to `voice-providers.test.ts`
5. Export from `voice-providers.index.ts`
6. Update user documentation
7. Add CLI commands if user-facing

## Common Tasks

### Add New STT Provider
1. Add to `STTProviderConfigSchema`
2. Update `getProviderDependencies()`
3. Update `getRecommendedProviders()`
4. Add tests
5. Document in user guide

### Add New TTS Provider
1. Add to `TTSProviderConfigSchema`
2. Update `getProviderDependencies()`
3. Update recommendations
4. Add tests
5. Update documentation

### Add CLI Command
1. Add function to `voice.ts`
2. Export from module
3. Register in CLI program
4. Add to help text
5. Test integration
