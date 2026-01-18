# Voice Provider Test Suite

Comprehensive testing framework for STT/TTS providers across all deployment modes (system, docker, cloud).

## Directory Structure

```
tests/
├── unit/
│   ├── stt-provider.unit.test.ts      # STT provider unit tests
│   └── tts-provider.unit.test.ts      # TTS provider unit tests
├── integration/
│   ├── modes.integration.test.ts      # Deployment mode integration tests
│   ├── system.integration.test.ts     # System mode specific tests
│   ├── docker.integration.test.ts     # Docker mode specific tests
│   └── cloud.integration.test.ts      # Cloud mode specific tests
├── e2e/
│   ├── provider-workflows.e2e.test.ts # Full workflow E2E tests
│   ├── fallback-chain.e2e.test.ts     # Fallback behavior tests
│   └── performance.e2e.test.ts        # Performance benchmarks
└── fixtures/
    ├── audio-samples/                 # Test audio files
    ├── config-samples/                # Sample configurations
    └── mock-responses/                # API mock responses
```

## Test Categories

### 1. Unit Tests

Unit tests verify isolated provider functionality without external dependencies.

**Coverage:**
- Provider initialization and configuration validation
- Metadata structure and capabilities
- Transcription/synthesis operations
- Error handling and edge cases
- Voice management (TTS)
- Audio resampling
- Shutdown and cleanup

**Run Unit Tests:**
```bash
pnpm test -- src/tests/unit
```

### 2. Integration Tests

Integration tests verify provider functionality with deployment modes and external systems.

**Coverage:**
- System mode: Package detection, installation, execution
- Docker mode: Container management, networking, health checks
- Cloud mode: API authentication, streaming, rate limiting
- Mode switching and compatibility
- Resource management per mode

**Run Integration Tests:**
```bash
pnpm test -- src/tests/integration
```

### 3. E2E Tests

End-to-end tests verify complete user workflows and multi-provider interactions.

**Coverage:**
- Provider initialization workflows
- Provider selection and switching
- Fallback chain activation
- Multi-provider operations
- Configuration persistence
- Performance measurement
- Error recovery

**Run E2E Tests:**
```bash
pnpm test -- src/tests/e2e
```

## Test Utilities

### Mock Providers

Located in `test-utils/mocks.ts`, provides factory functions for testing:

```typescript
import {
  createMockSTTProvider,
  createMockTTSProvider,
  createErrorSTTProvider,
  createErrorTTSProvider,
  createMockAudioBuffer,
  createMockWAVFile,
  createMockStream
} from '../test-utils/mocks.js';

// Create a mock STT provider
const sttProvider = createMockSTTProvider('test-stt');
await sttProvider.initialize();
const result = await sttProvider.transcribe(audioBuffer);

// Create a TTS provider that throws errors
const failingTTS = createErrorTTSProvider('test-tts', 'API key invalid');
await expect(failingTTS.initialize()).rejects.toThrow('API key invalid');

// Create test audio data
const wavFile = createMockWAVFile(1000, 16000); // 1s at 16kHz
```

### Audio Fixtures

Pre-generated test audio files in various formats:

```typescript
import { createMockWAVFile } from '../test-utils/audio-fixtures.js';

// Generate 2 seconds of audio at 44.1kHz
const audioBuffer = createMockWAVFile(2000, 44100);
```

### Configuration Fixtures

Sample provider configurations in `fixtures/config-samples/`:

```json
{
  "stt": {
    "provider": "deepgram",
    "mode": "cloud",
    "config": {
      "apiKey": "${DEEPGRAM_API_KEY}",
      "language": "en"
    }
  },
  "tts": {
    "provider": "elevenlabs",
    "mode": "cloud",
    "config": {
      "apiKey": "${ELEVENLABS_API_KEY}",
      "voice": "bella"
    }
  }
}
```

## Running Tests

### All Tests
```bash
pnpm test
```

### Specific Test Suite
```bash
pnpm test -- src/tests/unit/stt-provider.unit.test.ts
```

### With Coverage
```bash
pnpm test:coverage
```

### Watch Mode
```bash
pnpm test:watch
```

### Specific Pattern
```bash
pnpm test -- --grep "should transcribe"
```

## Coverage Targets

- **Statements:** >85%
- **Branches:** >80%
- **Functions:** >85%
- **Lines:** >85%

View current coverage:
```bash
pnpm test:coverage
```

## Live Tests

Tests with real provider credentials and systems. Requires environment variables.

### Prerequisites
- Valid provider API keys in environment
- Docker installed and running (for docker mode tests)
- Network connectivity for cloud provider tests

### Environment Variables
```bash
# STT Providers
DEEPGRAM_API_KEY=<key>
OPENAI_API_KEY=<key>

# TTS Providers
ELEVENLABS_API_KEY=<key>
KOKORO_MODEL_PATH=/path/to/model  # for local kokoro

# Docker Mode
DOCKER_HOST=unix:///var/run/docker.sock
```

### Run Live Tests
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test:live
```

### Run Specific Live Provider Test
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test:live -- --grep "Deepgram"
```

## Test Structure

### Unit Test Template
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMockSTTProvider } from '../../test-utils/mocks.js';

describe('STT Provider Unit Tests', () => {
  let provider;

  beforeEach(() => {
    provider = createMockSTTProvider('test-provider');
  });

  afterEach(async () => {
    if (provider.shutdown) {
      await provider.shutdown();
    }
  });

  it('should initialize successfully', async () => {
    await provider.initialize({ apiKey: 'test-key' });
    expect(provider).toBeDefined();
  });
});
```

### Integration Test Template
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('System Mode Integration', () => {
  it('should detect installed packages', async () => {
    const mockDetect = vi.fn().mockResolvedValue({
      installed: true,
      version: '1.0.0'
    });

    const result = await mockDetect('whisper');
    expect(result.installed).toBe(true);
  });
});
```

### E2E Test Template
```typescript
import { describe, it, expect, vi } from 'vitest';

describe('Provider Workflow E2E', () => {
  it('should complete initialization workflow', async () => {
    // Setup
    const mockInit = vi.fn().mockResolvedValue({ success: true });

    // Execute
    const result = await mockInit();

    // Verify
    expect(result.success).toBe(true);
  });
});
```

## Writing New Tests

### For a New STT Provider
1. Add unit tests in `unit/stt-provider.unit.test.ts` - use existing test patterns
2. Add integration tests in `integration/` for each supported mode
3. Add E2E test in `e2e/provider-workflows.e2e.test.ts` for full workflows
4. Create mock provider in `test-utils/mocks.ts`

### For a New TTS Provider
1. Add unit tests in `unit/tts-provider.unit.test.ts`
2. Test voice management, synthesis, streaming
3. Test audio resampling if supported
4. Add mode-specific integration tests

### For Mode-Specific Tests
1. Add to appropriate `integration/*.integration.test.ts`
2. Test deployment-specific functionality
3. Verify resource management
4. Test error handling per mode

## Best Practices

### Mocking
- Use `vi.fn()` for spy/mock functions
- Use provided mock factories for providers
- Keep mocks simple and focused

### Assertions
- One logical assertion per test
- Use descriptive test names
- Test both success and failure paths

### Setup/Teardown
- Initialize providers in `beforeEach`
- Shutdown in `afterEach`
- Clean up resources
- Reset mocks between tests

### Coverage
- Aim for >85% coverage
- Focus on critical paths
- Test error conditions
- Test edge cases

### Performance
- Unit tests: <100ms each
- Integration tests: <1s each
- E2E tests: <5s each

## Debugging Tests

### Run Single Test
```bash
pnpm test -- --grep "test name"
```

### Run with Debug Output
```bash
DEBUG=* pnpm test
```

### Run in Watch Mode with Debugging
```bash
pnpm test:watch
```

### Inspect Test Failure
```bash
pnpm test -- --reporter=verbose
```

## CI/CD Integration

Tests run in CI pipeline:
```bash
# Unit tests
pnpm test -- src/tests/unit

# Integration tests (requires docker)
pnpm test -- src/tests/integration

# E2E tests
pnpm test -- src/tests/e2e

# Coverage report
pnpm test:coverage
```

## Contributing

When adding new provider functionality:
1. Write tests first (TDD)
2. Update relevant test files
3. Ensure >85% coverage on new code
4. Follow existing test patterns
5. Add documentation for complex tests

## Troubleshooting

### Tests Timing Out
- Increase timeout: `it('test', async () => {...}, { timeout: 10000 })`
- Check for hanging promises
- Verify mock implementations complete

### Mock Not Working
- Ensure mock is defined before test
- Check mock implementation matches interface
- Verify `vi.fn()` is called correctly

### Docker Mode Tests Failing
- Verify Docker daemon is running: `docker ps`
- Check Docker socket permissions
- Verify test images are available

### Live Tests Failing
- Verify API keys are set
- Check network connectivity
- Verify provider quotas/limits
- Check rate limiting

## Related Documentation

- [Provider Integration Guide](../docs/provider-integration.md)
- [Deployment Mode Guide](../docs/deployment-modes.md)
- [API Reference](../docs/api-reference.md)
