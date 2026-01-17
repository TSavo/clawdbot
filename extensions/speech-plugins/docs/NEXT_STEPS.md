# Next Steps for Provider Implementation

This document outlines the next steps to complete the voice provider plugin integration and implement actual provider functionality.

## Current Status

✅ **Completed**:
- Plugin registry interface and implementation
- Deployment configuration (system/docker/cloud)
- Provider plugin exports and identifiers
- Default provider configurations
- JSON Schema validation
- Comprehensive documentation
- Integration guide with examples

⏳ **In Progress**:
- Provider implementations (being developed by other agents)

❌ **Remaining**:
- Deployment mode executors
- Provider factory implementations
- Real API client implementations
- Integration tests with real providers

## Implementation Roadmap

### Phase 1: Deployment Mode Executors (Priority: High)

Create executor classes for each deployment mode that handle provider instantiation.

#### 1.1 System Mode Executor

**File**: `src/deployment/system-executor.ts`

```typescript
export class SystemExecutor {
  async execute(
    binaryPath: string,
    args: string[],
    options?: {
      workingDir?: string;
      env?: Record<string, string>;
    },
  ): Promise<{ stdout: string; stderr: string }> {
    // Use child_process.spawn to execute binary
    // Handle environment variables
    // Capture stdout/stderr
    // Handle errors
  }
}
```

**Tasks**:
- [ ] Implement binary execution with child_process
- [ ] Handle environment variable injection
- [ ] Implement working directory support
- [ ] Add timeout handling
- [ ] Add error handling and logging
- [ ] Write unit tests with mock binaries

#### 1.2 Docker Mode Executor

**File**: `src/deployment/docker-executor.ts`

```typescript
export class DockerExecutor {
  async run(
    image: string,
    tag: string,
    options?: {
      containerName?: string;
      volumes?: Array<{ host: string; container: string }>;
      ports?: Array<{ host: number; container: number }>;
      env?: Record<string, string>;
    },
  ): Promise<string> {
    // Use dockerode or docker CLI
    // Handle volume mounts
    // Handle port mappings
    // Start/stop containers
  }
}
```

**Tasks**:
- [ ] Choose Docker client (dockerode vs CLI)
- [ ] Implement container lifecycle (create, start, stop, remove)
- [ ] Implement volume mounting with path expansion
- [ ] Implement port mapping
- [ ] Add container health checking
- [ ] Add error handling for Docker errors
- [ ] Write integration tests (requires Docker)

#### 1.3 Cloud Mode Executor

**File**: `src/deployment/cloud-executor.ts`

```typescript
export class CloudExecutor {
  async request(
    endpoint: string,
    options: {
      method: string;
      headers?: Record<string, string>;
      body?: Buffer | string;
      timeout?: number;
    },
  ): Promise<{ status: number; headers: Record<string, string>; body: Buffer }> {
    // Use fetch or axios
    // Handle authentication
    // Handle retries
    // Handle rate limiting
  }
}
```

**Tasks**:
- [ ] Choose HTTP client (fetch vs axios)
- [ ] Implement API key authentication
- [ ] Add retry logic with exponential backoff
- [ ] Add rate limiting
- [ ] Add timeout handling
- [ ] Add error handling for HTTP errors
- [ ] Write unit tests with mock HTTP responses

### Phase 2: Provider Factory Implementations (Priority: High)

Implement factories that create provider instances based on deployment config.

#### 2.1 STT Provider Factory

**File**: `src/providers/stt/factory.ts`

```typescript
import type { ProviderFactory } from "../../registry/plugin-registry.js";
import type { STTProvider } from "../../interfaces/stt-provider.js";

export class STTProviderFactory implements ProviderFactory<STTProvider> {
  async create(
    deployment: DeploymentConfig,
    config?: Record<string, unknown>,
  ): Promise<STTProvider> {
    switch (deployment.mode) {
      case "system":
        return this.createSystemProvider(deployment.system!, config);
      case "docker":
        return this.createDockerProvider(deployment.docker!, config);
      case "cloud":
        return this.createCloudProvider(deployment.cloud!, config);
    }
  }

  private async createSystemProvider(
    system: SystemDeploymentConfig,
    config?: Record<string, unknown>,
  ): Promise<STTProvider> {
    // Create STT provider that uses SystemExecutor
  }

  private async createDockerProvider(
    docker: DockerDeploymentConfig,
    config?: Record<string, unknown>,
  ): Promise<STTProvider> {
    // Create STT provider that uses DockerExecutor
  }

  private async createCloudProvider(
    cloud: CloudDeploymentConfig,
    config?: Record<string, unknown>,
  ): Promise<STTProvider> {
    // Create STT provider that uses CloudExecutor
  }
}
```

**Tasks**:
- [ ] Implement STTProviderFactory
- [ ] Integrate with existing provider implementations
- [ ] Add provider type detection (Whisper, Deepgram, etc.)
- [ ] Add configuration validation per provider
- [ ] Write unit tests with all deployment modes

#### 2.2 TTS Provider Factory

**File**: `src/providers/tts/factory.ts`

Similar to STT factory but for TTS providers.

**Tasks**:
- [ ] Implement TTSProviderFactory
- [ ] Integrate with existing TTS provider implementations
- [ ] Add provider type detection (Kokoro, CartesiaAI, ElevenLabs, Chatterbox)
- [ ] Add configuration validation per provider
- [ ] Write unit tests with all deployment modes

### Phase 3: Real API Client Implementations (Priority: Medium)

Implement real API clients for cloud providers.

#### 3.1 Deepgram Client

**File**: `src/clients/deepgram-client.ts`

```typescript
export class DeepgramClient {
  constructor(private apiKey: string, private endpoint: string) {}

  async transcribe(
    audioBuffer: Buffer,
    options: {
      model?: string;
      language?: string;
      punctuate?: boolean;
      diarize?: boolean;
    },
  ): Promise<DeepgramResponse> {
    // POST to Deepgram API
    // Handle authentication
    // Parse response
  }

  async transcribeStream(
    stream: ReadableStream,
    callbacks: STTStreamCallback,
  ): Promise<void> {
    // WebSocket connection to Deepgram
    // Stream audio
    // Handle partial results
  }
}
```

**Tasks**:
- [ ] Implement HTTP transcription
- [ ] Implement WebSocket streaming
- [ ] Add error handling for API errors
- [ ] Add response parsing
- [ ] Write integration tests (requires API key)

#### 3.2 CartesiaAI Client

**File**: `src/clients/cartesia-client.ts`

```typescript
export class CartesiaClient {
  constructor(private apiKey: string, private endpoint: string) {}

  async synthesize(
    text: string,
    options: {
      modelId: string;
      voiceId: string;
      outputFormat: {
        container: string;
        encoding: string;
        sampleRate: number;
      };
    },
  ): Promise<Buffer> {
    // POST to CartesiaAI API
    // Handle authentication
    // Return audio buffer
  }

  async synthesizeStream(
    text: string,
    callbacks: TTSStreamCallback,
    options: CartesiaOptions,
  ): Promise<void> {
    // Stream TTS from CartesiaAI
    // Handle audio chunks
  }
}
```

**Tasks**:
- [ ] Implement synthesis API
- [ ] Implement streaming API
- [ ] Add voice list fetching
- [ ] Add error handling
- [ ] Write integration tests (requires API key)

#### 3.3 ElevenLabs Client

Similar to CartesiaAI but for ElevenLabs API.

**Tasks**:
- [ ] Implement synthesis API
- [ ] Implement streaming API
- [ ] Add voice list fetching
- [ ] Add voice cloning support
- [ ] Write integration tests (requires API key)

### Phase 4: Registry Integration (Priority: High)

Update the registry to use the provider factories.

**File**: `src/registry/plugin-registry.ts` (update existing)

```typescript
import { STTProviderFactory } from "../providers/stt/factory.js";
import { TTSProviderFactory } from "../providers/tts/factory.js";

export class SimplePluginRegistry implements PluginRegistry {
  private sttFactory = new STTProviderFactory();
  private ttsFactory = new TTSProviderFactory();

  async loadFromConfig(configPath: string): Promise<void> {
    // ... existing code ...

    // Create providers from configuration
    for (const pluginConfig of configData.providers) {
      if (!pluginConfig.enabled) continue;

      const provider =
        pluginConfig.type === "stt"
          ? await this.sttFactory.create(pluginConfig.deployment, pluginConfig.config)
          : await this.ttsFactory.create(pluginConfig.deployment, pluginConfig.config);

      if (pluginConfig.type === "stt") {
        await this.registerSTTProvider(provider as STTProvider);
      } else {
        await this.registerTTSProvider(provider as TTSProvider);
      }
    }
  }
}
```

**Tasks**:
- [ ] Update loadFromConfig to use factories
- [ ] Add provider initialization after creation
- [ ] Add error handling for factory errors
- [ ] Update tests to verify factory integration

### Phase 5: Integration Tests (Priority: Medium)

Write end-to-end integration tests with real providers.

#### 5.1 System Mode Integration Tests

**File**: `src/integration/system-mode.test.ts`

```typescript
describe("System Mode Integration", () => {
  it("should transcribe audio with Whisper binary", async () => {
    const registry = new SimplePluginRegistry();
    await registry.loadFromConfig("./config/default-providers.json");

    const provider = registry.getSTTProvider("whisper-system");
    const result = await provider!.transcribe(audioBuffer, {
      format: "wav",
      language: "en",
    });

    expect(result[0].text).toBeTruthy();
  });
});
```

**Tasks**:
- [ ] Write tests for Whisper system mode
- [ ] Write tests for Kokoro system mode
- [ ] Add tests for error cases (binary not found, etc.)
- [ ] Skip tests if binaries not available (optional tests)

#### 5.2 Docker Mode Integration Tests

**File**: `src/integration/docker-mode.test.ts`

**Tasks**:
- [ ] Write tests for Faster-Whisper docker mode
- [ ] Write tests for Chatterbox docker mode
- [ ] Add tests for container lifecycle
- [ ] Skip tests if Docker not available

#### 5.3 Cloud Mode Integration Tests

**File**: `src/integration/cloud-mode.test.ts`

**Tasks**:
- [ ] Write tests for Deepgram cloud mode
- [ ] Write tests for CartesiaAI cloud mode
- [ ] Write tests for ElevenLabs cloud mode
- [ ] Skip tests if API keys not available
- [ ] Use environment variables for API keys

### Phase 6: Documentation Updates (Priority: Low)

Update existing documentation with implementation details.

**Tasks**:
- [ ] Update README with factory usage
- [ ] Add deployment mode executor documentation
- [ ] Add troubleshooting for each deployment mode
- [ ] Add performance benchmarks
- [ ] Add API client documentation

## Priority Order

1. **Phase 1 & 2 (High Priority)**: Deployment executors and provider factories
   - These are blocking for the entire integration
   - Should be implemented first

2. **Phase 4 (High Priority)**: Registry integration
   - Connects everything together
   - Required for end-to-end functionality

3. **Phase 3 (Medium Priority)**: Real API clients
   - Can be implemented in parallel with Phase 1 & 2
   - Required for cloud mode providers

4. **Phase 5 (Medium Priority)**: Integration tests
   - Should follow implementation phases
   - Can be done incrementally as providers are implemented

5. **Phase 6 (Low Priority)**: Documentation updates
   - Can be done last
   - Should reflect actual implementation details

## Dependencies

### External Dependencies

May need to add:
- `dockerode` for Docker API (or use CLI)
- `@deepgram/sdk` for Deepgram client (or use HTTP client)
- `ws` for WebSocket support (streaming)
- `axios` or use built-in `fetch` for HTTP clients

### Development Dependencies

- Add integration test configuration in `vitest.config.ts`
- Add environment variable handling for API keys
- Add Docker test setup/teardown

## Testing Strategy

### Unit Tests
- Mock all external dependencies (file system, network, Docker)
- Test configuration validation
- Test provider registration and lookup
- Test event listeners
- Test error handling

### Integration Tests
- Test with real binaries (system mode)
- Test with real Docker containers (docker mode)
- Test with real APIs (cloud mode)
- Use environment variable flags to skip tests when resources unavailable
- Example: `SKIP_DOCKER_TESTS=1 pnpm test`

### End-to-End Tests
- Test full pipeline from configuration to transcription/synthesis
- Test fallback chains
- Test provider hot-swapping
- Test concurrent requests

## Configuration for Testing

**File**: `config/test-providers.json`

Create a test configuration with mock providers:

```json
{
  "providers": [
    {
      "id": "test-whisper-system",
      "type": "stt",
      "module": "@clawdbot/speech-plugins/providers/whisper",
      "deployment": {
        "mode": "system",
        "system": {
          "binaryPath": "/usr/local/bin/whisper-test",
          "workingDir": "/tmp/whisper-test"
        }
      },
      "config": {
        "model": "tiny"
      },
      "enabled": true,
      "priority": 100
    }
  ]
}
```

## Checklist

### Deployment Mode Implementation
- [ ] SystemExecutor class
- [ ] DockerExecutor class
- [ ] CloudExecutor class
- [ ] Unit tests for all executors

### Provider Factories
- [ ] STTProviderFactory class
- [ ] TTSProviderFactory class
- [ ] Integration with existing providers
- [ ] Unit tests for factories

### API Clients
- [ ] DeepgramClient class
- [ ] CartesiaClient class
- [ ] ElevenLabsClient class
- [ ] Unit tests for clients

### Registry Integration
- [ ] Update loadFromConfig to use factories
- [ ] Add provider initialization
- [ ] Update tests

### Integration Tests
- [ ] System mode tests
- [ ] Docker mode tests
- [ ] Cloud mode tests
- [ ] End-to-end pipeline tests

### Documentation
- [ ] Update README with implementation details
- [ ] Add deployment executor documentation
- [ ] Add API client documentation
- [ ] Add troubleshooting guide

## Timeline Estimate

- **Phase 1**: 2-3 days (deployment executors)
- **Phase 2**: 2-3 days (provider factories)
- **Phase 3**: 3-4 days (API clients)
- **Phase 4**: 1 day (registry integration)
- **Phase 5**: 2-3 days (integration tests)
- **Phase 6**: 1 day (documentation)

**Total**: ~11-17 days for complete implementation

## Getting Help

- Review existing provider implementations in `src/providers/stt/` and `src/providers/tts/`
- Check the integration guide: `docs/INTEGRATION_GUIDE.md`
- Review configuration examples: `config/voice-providers.example.json`
- See testing guide: `TESTING.md`

## Success Criteria

The implementation is complete when:

1. ✅ All provider factories are implemented
2. ✅ All deployment executors are implemented
3. ✅ Registry can load configuration and create providers
4. ✅ All cloud API clients are functional
5. ✅ Integration tests pass for all modes
6. ✅ Documentation is updated
7. ✅ Real-world usage examples work end-to-end

## Contact

For questions or clarifications about the implementation:
- Review the architecture in `docs/INTEGRATION_SUMMARY.md`
- Check the plugin registry interface in `src/interfaces/plugin-registry.ts`
- See deployment config types in `src/providers/index.ts`
