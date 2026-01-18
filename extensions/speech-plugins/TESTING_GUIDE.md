# Voice Provider Testing Guide

Complete guide for testing STT/TTS providers across all deployment modes.

## Quick Start

### Run All Tests
```bash
cd extensions/speech-plugins
pnpm test
```

### Run Specific Test Suite
```bash
# Unit tests only
pnpm test -- src/tests/unit

# Integration tests only
pnpm test -- src/tests/integration

# E2E tests only
pnpm test -- src/tests/e2e
```

### Run Tests in Watch Mode
```bash
pnpm test:watch
```

### Generate Coverage Report
```bash
pnpm test:coverage
```

## Test Organization

### Unit Tests (`src/tests/unit/`)

Tests isolated provider functionality without external systems.

**Files:**
- `stt-provider.unit.test.ts` - STT provider core functionality
- `tts-provider.unit.test.ts` - TTS provider core functionality

**What's Tested:**
- Configuration validation
- Initialization logic
- Metadata and capabilities
- Transcription/synthesis operations
- Error handling
- Edge cases (empty input, invalid format, etc.)
- Resource cleanup

**Example:**
```bash
pnpm test -- src/tests/unit/stt-provider.unit.test.ts
```

### Integration Tests (`src/tests/integration/`)

Tests provider functionality with deployment modes and external systems.

**Files:**
- `modes.integration.test.ts` - All deployment mode integration

**Coverage:**
- **System Mode:**
  - Package detection and installation
  - Command execution and streaming
  - Resource management
  - Timeout handling

- **Docker Mode:**
  - Container launch and configuration
  - Health checks and auto-restart
  - Network isolation
  - Resource limits
  - Volume mounting

- **Cloud Mode:**
  - API authentication and token refresh
  - Streaming API requests
  - Rate limiting and backoff
  - Error handling

**Example:**
```bash
pnpm test -- src/tests/integration/modes.integration.test.ts --grep "System Mode"
```

### E2E Tests (`src/tests/e2e/`)

Tests complete user workflows and multi-provider interactions.

**Files:**
- `provider-workflows.e2e.test.ts` - Full workflow scenarios

**Workflows Tested:**
- Provider initialization and configuration
- Provider selection and switching
- Fallback chain activation
- Multi-provider transcription/synthesis
- Configuration persistence
- Error recovery

**Example:**
```bash
pnpm test -- src/tests/e2e/provider-workflows.e2e.test.ts
```

## Test Categories

### By Provider Type

#### STT Provider Tests
```bash
pnpm test -- --grep "STT"
```

Tests for Speech-to-Text providers:
- Whisper, Faster-Whisper, Deepgram
- Transcription accuracy
- Language detection
- Confidence scores
- Streaming support

#### TTS Provider Tests
```bash
pnpm test -- --grep "TTS"
```

Tests for Text-to-Speech providers:
- Kokoro, Piper, ElevenLabs, CartesiaAI
- Voice synthesis
- Voice selection
- Audio formats
- Speech rate and pitch adjustment

### By Deployment Mode

#### System Mode
```bash
pnpm test -- --grep "System Mode"
```

- Local package installation
- Command-line execution
- Process management
- Resource limits

#### Docker Mode
```bash
pnpm test -- --grep "Docker"
```

- Container orchestration
- Network management
- Health monitoring
- Automatic recovery

#### Cloud Mode
```bash
pnpm test -- --grep "Cloud"
```

- API authentication
- Streaming requests
- Rate limiting
- Error recovery

## Running Live Tests

Live tests use real provider credentials and external systems.

### Setup

1. **Set Environment Variables:**
```bash
export DEEPGRAM_API_KEY=your_key
export OPENAI_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key
```

2. **For Docker Mode Tests:**
```bash
docker daemon --storage-driver overlay2
```

3. **For Cloud Mode Tests:**
- Verify network connectivity
- Check API quotas/limits
- Ensure credentials are valid

### Run Live Tests
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test:live
```

### Run Specific Live Provider Test
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test -- --grep "Deepgram"
```

### Run Live Tests for Specific Mode
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test -- --grep "Cloud Mode"
```

## Test Coverage

### Current Coverage Targets
- **Statements:** >85%
- **Branches:** >80%
- **Functions:** >85%
- **Lines:** >85%

### View Coverage
```bash
pnpm test:coverage
```

### Coverage by Category
```bash
# STT provider coverage
pnpm test:coverage -- src/tests/unit/stt-provider.unit.test.ts

# TTS provider coverage
pnpm test:coverage -- src/tests/unit/tts-provider.unit.test.ts

# Integration coverage
pnpm test:coverage -- src/tests/integration
```

### Coverage Report Locations
- HTML Report: `./coverage/index.html`
- LCOV Report: `./coverage/lcov.info`
- Terminal Output: Console output during test run

## Test Utilities

### Mock Factories

Located in `src/test-utils/mocks.ts`:

```typescript
// Create mock providers
createMockSTTProvider(id?: string): STTProvider
createMockTTSProvider(id?: string): TTSProvider

// Create error-throwing providers
createErrorSTTProvider(id: string, errorMessage: string): STTProvider
createErrorTTSProvider(id: string, errorMessage: string): TTSProvider

// Create test audio data
createMockAudioBuffer(durationMs?: number, sampleRate?: number): Buffer
createMockWAVFile(durationMs?: number, sampleRate?: number): Buffer
createMockStream(data: Buffer): NodeJS.ReadableStream
```

### Using Mocks in Tests

```typescript
import { createMockSTTProvider } from '../test-utils/mocks.js';

describe('STT Provider', () => {
  let provider;

  beforeEach(() => {
    provider = createMockSTTProvider('test-provider');
  });

  it('should transcribe audio', async () => {
    await provider.initialize();
    const result = await provider.transcribe(audioBuffer);
    expect(result).toBeDefined();
  });
});
```

## Common Test Patterns

### Testing Initialization
```typescript
it('should initialize with valid config', async () => {
  const provider = createMockSTTProvider('test');
  await provider.initialize({ apiKey: 'test-key' });
  expect(provider).toBeDefined();
});
```

### Testing Error Handling
```typescript
it('should throw on invalid config', async () => {
  const provider = createErrorSTTProvider('test', 'Invalid API key');
  await expect(provider.initialize()).rejects.toThrow('Invalid API key');
});
```

### Testing Async Operations
```typescript
it('should transcribe audio asynchronously', async () => {
  const provider = createMockSTTProvider('test');
  await provider.initialize();

  const result = await provider.transcribe(audioBuffer);
  expect(result).toBeDefined();
});
```

### Testing Streaming
```typescript
it('should support streaming', async () => {
  const provider = createMockSTTProvider('test');
  await provider.initialize();

  const onCompleteSpy = vi.fn();
  await provider.transcribeStream(stream, { onComplete: onCompleteSpy });

  expect(onCompleteSpy).toHaveBeenCalled();
});
```

## Debugging Tests

### Enable Debug Output
```bash
DEBUG=* pnpm test
```

### Run Single Test
```bash
pnpm test -- --grep "exact test name"
```

### Run Tests in a File
```bash
pnpm test -- src/tests/unit/stt-provider.unit.test.ts
```

### Watch Mode with Filtering
```bash
pnpm test:watch -- --grep "pattern"
```

### Inspect Test Results
```bash
pnpm test -- --reporter=verbose
```

## Performance Testing

### Measure Test Speed
```bash
pnpm test -- --reporter=verbose
```

### Identify Slow Tests
```bash
pnpm test -- --reporter=verbose | sort -k3 -n
```

### Benchmark Providers
```bash
pnpm test -- src/tests/e2e --grep "Performance"
```

## CI/CD Integration

Tests are designed for CI/CD pipelines:

```bash
# In CI environment
pnpm test                    # Run all tests
pnpm test:coverage          # Generate coverage report
pnpm test:mutation          # Run mutation testing (optional)
```

### GitHub Actions Example
```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '22'
      - run: pnpm install
      - run: pnpm test
      - run: pnpm test:coverage
```

## Troubleshooting

### Tests Hanging
- Check for unclosed promises
- Verify mocks have implementations
- Increase timeout: `{ timeout: 20000 }`
- Check for infinite loops

### Mock Not Working
- Ensure mock defined before test
- Verify vi.fn() syntax
- Check mock implementation matches interface
- Reset mocks: `vi.clearAllMocks()`

### Docker Tests Failing
- Verify Docker is running: `docker ps`
- Check socket permissions
- Verify test images exist
- Check network configuration

### Cloud API Tests Failing
- Verify API keys are set
- Check network connectivity
- Confirm API quotas available
- Check for rate limiting

### Coverage Too Low
- Add missing test cases
- Test error paths
- Test edge cases
- Verify assertions are correct

## Best Practices

### Writing Tests
1. **Follow AAA Pattern:**
   - Arrange: Set up test data
   - Act: Execute the code
   - Assert: Verify results

2. **Use Descriptive Names:**
   - `should initialize with valid config`
   - `should throw on missing API key`
   - `should transcribe audio buffer`

3. **Test One Thing Per Test:**
   - Single logical assertion
   - Focused behavior verification
   - Clear pass/fail criteria

4. **Use Test Utilities:**
   - Mock factories for providers
   - Test data builders
   - Fixture loading helpers

### Test Organization
1. Organize by feature/module
2. Group related tests with describe()
3. Use beforeEach/afterEach for setup
4. Keep tests independent

### Performance
1. Keep unit tests fast (<100ms)
2. Mock external calls
3. Avoid real network calls
4. Use vi.fn() for spies/mocks

## Adding New Tests

### For New STT Provider
1. Add unit tests in `stt-provider.unit.test.ts`
2. Test all capabilities (formats, sample rates, languages)
3. Test streaming if supported
4. Test error conditions

### For New TTS Provider
1. Add unit tests in `tts-provider.unit.test.ts`
2. Test voice management
3. Test synthesis with various options
4. Test streaming and resampling

### For New Deployment Mode
1. Add integration tests in `modes.integration.test.ts`
2. Test mode-specific functionality
3. Test resource management
4. Test error handling

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Provider API Reference](./src/interfaces/)
- [Test Utilities](./src/test-utils/)
- [Mock Providers](./src/test-utils/mocks.ts)

## Support

For issues or questions:
1. Check test output for error details
2. Review similar test examples
3. Check Vitest documentation
4. Review provider implementation code
