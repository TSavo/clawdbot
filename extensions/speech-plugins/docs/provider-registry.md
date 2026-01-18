# Unified Provider Registry

The Unified Provider Registry provides comprehensive discovery, validation, and configuration management for all speech providers (STT/TTS) across all deployment modes (system, docker, cloud).

## Overview

The registry enables:
- **Discovery**: Find all available providers and their capabilities
- **Validation**: Check if a provider is available in a specific deployment mode
- **Configuration**: Generate configuration templates for onboarding and plugin-installer
- **Dependency Management**: List required dependencies and environment variables
- **Mode Support Matrix**: View availability across all deployment modes

## Providers

### STT (Speech-to-Text)

| Provider | System | Docker | Cloud | Best For |
|----------|--------|--------|-------|----------|
| **Whisper** | ✓ | ✓ | ✗ | Local, offline transcription |
| **Faster Whisper** | ✓ | ✓ | ✗ | GPU-accelerated local transcription |
| **Deepgram** | ✗ | ✗ | ✓ | High-accuracy cloud transcription |

### TTS (Text-to-Speech)

| Provider | System | Docker | Cloud | Best For |
|----------|--------|--------|-------|----------|
| **Kokoro** | ✓ | ✓ | ✗ | Fast, natural local synthesis |
| **ElevenLabs** | ✗ | ✗ | ✓ | Premium voices, voice cloning |
| **Cartesia AI** | ✗ | ✗ | ✓ | Ultra-realistic voices |
| **Chatterbox** | ✓ | ✓ | ✗ | VITS-based synthesis |

## Usage

### Basic Discovery

```typescript
import { getProviderRegistry } from '@speech-plugins';

const registry = getProviderRegistry();

// Get all providers
const allProviders = registry.getAllProviders();

// Get only STT providers
const sttProviders = registry.getSTTProviders();

// Get only TTS providers
const ttsProviders = registry.getTTSProviders();

// Get specific provider
const whisper = registry.getProvider('whisper-stt');
```

### Filter by Deployment Mode

```typescript
const registry = getProviderRegistry();

// Get all providers available in system mode
const systemProviders = registry.getProvidersByMode('system');

// Get STT providers available in Docker
const dockerSTT = registry.getSTTProvidersByMode('docker');

// Get TTS providers available in cloud
const cloudTTS = registry.getTTSProvidersByMode('cloud');
```

### Validate Provider Availability

```typescript
const registry = getProviderRegistry();

// Check if provider is available in a mode
const validation = registry.validateProvider('whisper-stt', 'system');
if (validation.valid) {
  console.log('Provider is ready');
} else {
  console.log('Provider not available:', validation.errors);
}

// Quick check if provider is ready
const ready = registry.isProviderReady('deepgram-stt', 'cloud');
```

### Get Dependencies

```typescript
const registry = getProviderRegistry();

// Get system dependencies
const deps = registry.getProviderDependencies('whisper-stt', 'system');
// ['whisper.cpp', 'ffmpeg']

// Get environment variables required
const envVars = registry.getProviderEnvVars('deepgram-stt', 'cloud');
// ['DEEPGRAM_API_KEY']
```

### Discover Provider Capabilities

```typescript
const registry = getProviderRegistry();

const discovery = registry.discoverProvider('whisper-stt');
console.log(discovery.status); // 'ready'
console.log(discovery.availableModes); // ['system', 'docker']

const provider = discovery.provider;
console.log(provider.capabilities.formats); // ['wav', 'mp3', 'opus', ...]
console.log(provider.capabilities.languages); // ['en', 'es', 'fr', ...]
```

### Mode Support Matrix

```typescript
const registry = getProviderRegistry();

const matrix = registry.generateModeSupportMatrix();

// Check support for each provider/mode combo
const whisperSupport = matrix.stt['whisper-stt'];
console.log(whisperSupport.system); // true
console.log(whisperSupport.docker); // true
console.log(whisperSupport.cloud); // false
```

### Generate Configuration Template

```typescript
const registry = getProviderRegistry();

// Get template for onboarding
const template = registry.getProviderTemplate('whisper-stt', 'system');
// {
//   id: 'whisper-stt',
//   name: 'Whisper',
//   type: 'stt',
//   mode: 'system',
//   enabled: true,
//   priority: 1,
//   dependencies: ['whisper.cpp', 'ffmpeg']
// }

// Docker template
const dockerTemplate = registry.getProviderTemplate('whisper-stt', 'docker');
// {
//   ...
//   docker: {
//     image: 'openai/whisper',
//     tag: 'latest'
//   }
// }

// Cloud template
const cloudTemplate = registry.getProviderTemplate('deepgram-stt', 'cloud');
// {
//   ...
//   apiKeys: ['DEEPGRAM_API_KEY']
// }
```

### Export Registry as JSON

```typescript
const registry = getProviderRegistry();

const json = registry.toJSON();
// {
//   providers: [...],
//   stt: [...],
//   tts: [...],
//   modeMatrix: { ... },
//   timestamp: '2026-01-17T...'
// }

// Use in frontend or config
saveRegistrySnapshot(json);
```

### List Provider IDs

```typescript
const registry = getProviderRegistry();

const allIds = registry.listProviderIds();
const sttIds = registry.listSTTProviderIds();
const ttsIds = registry.listTTSProviderIds();
```

## Deployment Modes

### System Mode

Local execution using binaries installed on the system.

**Requirements:**
- Binary installed on system PATH or specified binaryPath
- System dependencies (ffmpeg, Python, etc.)
- Appropriate permissions

**Benefits:**
- No container overhead
- Direct system access
- Offline capability

**Providers:**
- Whisper STT
- Faster Whisper STT
- Kokoro TTS
- Chatterbox TTS

### Docker Mode

Containerized execution using Docker images.

**Requirements:**
- Docker installed and running
- Image pulled or available
- Port mappings configured
- Volume mounts (if needed)

**Benefits:**
- Isolated environment
- Consistent across machines
- Easy GPU acceleration
- Better resource management

**Providers:**
- Whisper STT
- Faster Whisper STT (with GPU)
- Kokoro TTS
- Chatterbox TTS

### Cloud Mode

API-based execution using cloud services.

**Requirements:**
- API credentials (API key)
- Network connectivity
- API rate limits and quotas

**Benefits:**
- No local infrastructure
- Scalable
- Latest models automatically
- Professional support

**Providers:**
- Deepgram STT
- ElevenLabs TTS
- Cartesia AI TTS

## Provider Metadata

Each provider in the registry includes:

```typescript
interface ProviderMetadata {
  id: string;                    // Unique identifier
  name: string;                  // Display name
  type: 'stt' | 'tts';          // Provider type
  description: string;           // Description
  version: string;              // Version number
  modes: {                       // Mode availability
    system?: ModeConfig;
    docker?: ModeConfig;
    cloud?: ModeConfig;
  };
  capabilities?: {              // Feature capabilities
    formats?: string[];
    languages?: string[];
    voices?: Array<{ id, name }>;
    features?: string[];
  };
  priority?: number;            // Selection priority
}
```

## Integration with Onboarding

The registry integrates with the onboarding wizard to provide:

1. **Provider Selection**: List available providers for the selected mode
2. **Dependency Checking**: Verify required dependencies are installed
3. **Configuration**: Generate configuration templates
4. **Validation**: Validate configuration before saving
5. **Environment Setup**: List required environment variables

## Integration with Plugin-Installer

The plugin-installer uses the registry to:

1. **Discovery**: Find all discoverable providers
2. **Installation**: Install provider dependencies
3. **Configuration**: Apply provider settings
4. **Testing**: Validate provider works correctly
5. **Management**: Update or remove providers

## Testing

The registry includes comprehensive tests:

```bash
# Run registry tests
pnpm test provider-registry.test.ts

# Run all speech plugin tests
pnpm test --include="**/speech-plugins/**"
```

## Registry Snapshot

The registry can be exported as a JSON snapshot for use by frontend UIs, CLI tools, and configuration systems:

```typescript
const registry = getProviderRegistry();
const snapshot = registry.toJSON();

// Save to file
fs.writeFileSync('provider-registry.json', JSON.stringify(snapshot, null, 2));
```

## Architecture

The registry follows a hierarchical structure:

```
UnifiedProviderRegistry
├── STT Providers
│   ├── Whisper (system, docker)
│   ├── Faster Whisper (system, docker)
│   └── Deepgram (cloud)
├── TTS Providers
│   ├── Kokoro (system, docker)
│   ├── ElevenLabs (cloud)
│   ├── Cartesia (cloud)
│   └── Chatterbox (system, docker)
└── Discovery & Validation
    ├── Mode Support Matrix
    ├── Dependency Tracking
    ├── Capability Discovery
    └── Configuration Templates
```

## Best Practices

1. **Use Singleton Pattern**: Use `getProviderRegistry()` for the global instance
2. **Check Mode Availability**: Always validate before using a provider
3. **Fallback Chains**: Use priority to determine fallback order
4. **Environment Variables**: Set required API keys before using cloud providers
5. **Dependency Management**: Install system dependencies before system mode providers

## Examples

### Provider Selection Flow

```typescript
const registry = getProviderRegistry();

// 1. Determine available modes
const availableModes = ['system']; // user environment

// 2. Get available providers for mode
const providers = registry.getProvidersByMode('system');

// 3. Present to user with priorities
const sorted = providers
  .filter(p => p.type === 'stt')
  .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

// 4. User selects provider
const selected = sorted[0];

// 5. Get configuration template
const config = registry.getProviderTemplate(selected.id, 'system');

// 6. Generate onboarding UI from template
showOnboarding(config);
```

### Dependency Installation

```typescript
const registry = getProviderRegistry();

async function installProvider(providerId: string, mode: 'system' | 'docker' | 'cloud') {
  // Check availability
  const validation = registry.validateProvider(providerId, mode);
  if (!validation.valid) {
    throw new Error(`Provider not available: ${validation.errors.join(', ')}`);
  }

  // Get dependencies
  const deps = registry.getProviderDependencies(providerId, mode);

  // Get environment variables
  const envVars = registry.getProviderEnvVars(providerId, mode);

  // Install dependencies
  for (const dep of deps) {
    await installDependency(dep);
  }

  // Check environment variables
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      console.warn(`Missing environment variable: ${envVar}`);
    }
  }

  // Validate provider is ready
  const ready = registry.isProviderReady(providerId, mode);
  return ready;
}
```

## API Reference

### UnifiedProviderRegistry

Main registry class with all discovery and validation methods.

**Methods:**
- `getAllProviders()`: Get all providers
- `getSTTProviders()`: Get STT providers
- `getTTSProviders()`: Get TTS providers
- `getProvider(id)`: Get specific provider
- `getProvidersByMode(mode)`: Filter by deployment mode
- `getSTTProvidersByMode(mode)`: Filter STT by mode
- `getTTSProvidersByMode(mode)`: Filter TTS by mode
- `validateProvider(id, mode)`: Validate availability
- `isProviderReady(id, mode)`: Check readiness
- `getProviderDependencies(id, mode)`: Get dependencies
- `getProviderEnvVars(id, mode)`: Get environment variables
- `discoverProvider(id)`: Discover capabilities
- `generateModeSupportMatrix()`: Generate support matrix
- `getProviderTemplate(id, mode)`: Generate configuration
- `toJSON()`: Export as JSON
- `listProviderIds()`: List all IDs
- `listSTTProviderIds()`: List STT IDs
- `listTTSProviderIds()`: List TTS IDs

### Factory Functions

- `getProviderRegistry()`: Get singleton instance
- `createProviderRegistry()`: Create fresh instance
