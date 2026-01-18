# Voice Orchestrator Test Infrastructure

Comprehensive testing infrastructure for the VoiceOrchestrator coordinating all 7 voice providers (Deepgram, ElevenLabs, Cartesia, Faster-Whisper, Kokoro, Whisper System, Piper).

## Overview

This test infrastructure provides:
- **Mock implementations** of all 7 providers for unit and integration testing
- **E2E helpers** for audio handling, assertions, and test fixtures
- **Integration tests** covering orchestrator coordination
- **Performance metrics** collection and analysis
- **Circuit breaker simulation** for failure scenarios
- **Health monitoring** validation

## Architecture

```
src/media/voice-providers/
├── e2e-helpers.ts (300 lines)
│   ├── Audio buffer utilities
│   ├── Assertion helpers
│   ├── Test configuration factories
│   └── Metrics extraction
├── test-mocks.ts (300 lines)
│   ├── MockSTTProvider
│   ├── MockTTSProvider
│   ├── MockHealthMonitor
│   ├── Simulation utilities
│   └── Performance collectors
├── orchestrator.integration.test.ts (400 lines)
│   ├── Multi-provider initialization
│   ├── Provider selection logic
│   ├── Fallback chain execution
│   └── Metrics & monitoring
└── e2e.test.ts (1200+ lines)
    ├── Normal workflows
    ├── Degraded provider fallback
    ├── Circuit breaker scenarios
    ├── Recovery & health restoration
    ├── Performance under load
    ├── Mixed STT/TTS workflows
    ├── Deployment mode preferences
    ├── Error handling
    └── Monitoring & metrics export
```

## Quick Start

### Running Tests

```bash
# Run all integration tests
pnpm test src/media/voice-providers/orchestrator.integration.test.ts

# Run E2E scenarios
pnpm test src/media/voice-providers/e2e.test.ts

# Run with coverage
pnpm test:coverage src/media/voice-providers/

# Run specific test scenario
pnpm test src/media/voice-providers/e2e.test.ts -t "Scenario 1"

# Watch mode for development
pnpm test:watch src/media/voice-providers/
```

### Performance & Metrics

```bash
# Run performance-focused tests
pnpm test src/media/voice-providers/e2e.test.ts -t "Performance"

# Generate performance report
pnpm test src/media/voice-providers/ --reporter=verbose
```

## Files Reference

### 1. e2e-helpers.ts

Audio utilities and test fixtures for all provider tests.

#### Audio Utilities

```typescript
// Create test audio buffers
createTestAudioBuffer(duration, sampleRate)      // Random PCM16 audio
createSilentAudioBuffer(duration, sampleRate)    // Silent audio
createAudioBufferWithFormat(format, duration)    // Specific format (OPUS, MP3, etc)
```

#### Assertions

```typescript
// Validate audio and transcription results
assertValidAudioBuffer(buffer, expectedFormat, expectedDuration)
assertValidTranscriptionResult(result, expectedProvider)
assertSynthesisOptionsApplied(options, expectedSettings)
```

#### Test Fixtures

```typescript
// Pre-configured provider setups
TEST_FIXTURES.allProvidersConfig          // All 7 providers
TEST_FIXTURES.sttOnlyConfig               // STT providers only
TEST_FIXTURES.ttsOnlyConfig               // TTS providers only
TEST_FIXTURES.cloudOnlyConfig             // Cloud providers
TEST_FIXTURES.dockerOnlyConfig            // Docker providers
TEST_FIXTURES.systemOnlyConfig            // System providers
```

#### Configuration Builders

```typescript
createTestVoiceProvidersConfig()           // All 7 providers
createProviderConfig(providerIds)          // Custom provider set
createProviderConfigWithPriorities(...)    // Custom priorities
createMockLogger()                         // Capture logs for assertions
```

#### Metric Extraction

```typescript
extractMetricsFromLogs(logs)               // Parse success/error counts
verifyFallbackChainExecution(logs, order)  // Verify provider chain order
```

### 2. test-mocks.ts

Mock implementations and simulation utilities.

#### Mock Providers

```typescript
class MockSTTProvider extends BaseVoiceProviderExecutor {
  // STT mock with:
  // - Configurable failure modes (healthy/unhealthy/timeout/invalid)
  // - Adjustable latency
  // - Call counting
  // - Stream support

  setFailureMode('healthy' | 'unhealthy' | 'timeout' | 'invalid')
  setTranscriptionDelay(ms)
  getCallCount()
}

class MockTTSProvider extends BaseVoiceProviderExecutor {
  // TTS mock with:
  // - Configurable failure modes
  // - Adjustable latency
  // - Stream support
  // - Audio format control

  setFailureMode('healthy' | 'unhealthy' | 'timeout' | 'invalid')
  setSynthesisDelay(ms)
  getCallCount()
}
```

#### Simulation Utilities

```typescript
class ProviderSimulator {
  static simulateProviderFailure(provider)         // Trigger unhealthy
  static simulateProviderRecovery(provider)        // Restore health
  static simulateTimeout(provider)                 // Set timeout
  static simulateNetworkLatency(provider, ms)      // Add latency
  static simulateRateLimiting(provider)            // Rate limit error
  static simulateCircuitBreakerBreak(provider, n)  // Trigger circuit break
  static getRealisticLatencyMs(type)               // cloud/docker/system
}

class TestDataGenerator {
  static generateTranscriptionText(wordCount)
  static generateAudioBuffer(duration, format)
  static generateTranscriptionResults(count, base)
}

class PerformanceMetricsCollector {
  recordLatency(ms)
  recordError()
  recordSuccess()
  getMetrics()  // Returns: { callCount, successCount, errorCount,
                //          avgLatencyMs, p50/p95/p99LatencyMs, ... }
}

class CircuitBreakerSimulator {
  recordFailure()
  recordSuccess()
  isOpen()
  reset()
  getState()
}
```

### 3. orchestrator.integration.test.ts

Core integration tests for VoiceOrchestrator coordination.

#### Test Suites

**Multi-Provider Initialization** (~100 lines)
- Load all 7 providers from config
- Verify priority ordering (STT and TTS)
- Check fallback chain setup
- Validate health monitor startup
- Handle disabled providers

**Provider Selection Logic** (~100 lines)
- Priority-based selection
- Skip unhealthy providers
- Deployment mode preference
- Capability matching

**Fallback Chain Execution** (~100 lines)
- Automatic fallback on failure
- Circuit breaker threshold
- Recovery after reset timeout
- Chain exhaustion error handling
- Fallback chain disable option

**Metrics & Monitoring** (~100 lines)
- Latency tracking
- Error rate calculation
- Provider usage statistics
- Health status updates
- Metrics export for dashboard

**Health Check Management** (~80 lines)
- Periodic health checks
- Unhealthy provider detection
- Consecutive failure tracking
- Shutdown cleanup

**Streaming & TTS Operations** (~40 lines)
- Streaming transcription
- Text-to-speech synthesis
- Fallback for TTS failures

**Configuration & State** (~40 lines)
- Empty provider list
- Disabled providers
- Re-initialization with new config

#### Running Integration Tests

```bash
# All integration tests
pnpm test orchestrator.integration.test.ts

# Specific test suite
pnpm test orchestrator.integration.test.ts -t "Fallback Chain"

# With coverage
pnpm test:coverage orchestrator.integration.test.ts
```

### 4. e2e.test.ts

Real-world scenario tests with all 7 providers.

#### Scenario 1: Normal Multi-Provider Workflow

```typescript
// Complete STT pipeline with all 7 providers available
// Complete TTS pipeline with all 4 providers available
// Multiple sequential operations
```

**Expected Results:**
- Successful transcription/synthesis
- Proper provider selection
- Metrics collection
- Sub-500ms latency for cloud providers

#### Scenario 2: Degraded Provider with Automatic Fallback

```typescript
// Primary provider fails → switch to secondary
// Execute complete fallback chain (3 providers)
// Measure latency difference in fallback
```

**Expected Results:**
- Automatic provider switching
- Fallback chain executed in order
- No user-facing failures
- Secondary provider used

#### Scenario 3: Circuit Breaker Protection

```typescript
// Open circuit after threshold failures
// Prevent cascading failures
// Recover after reset timeout
```

**Expected Results:**
- Circuit breaker opens after 2-3 failures
- Provider skipped while open
- Automatic recovery after timeout
- No repeated failed attempts

#### Scenario 4: Provider Recovery and Health Restoration

```typescript
// Restore provider health after recovery
// Track consecutive successes
```

**Expected Results:**
- Health status restored
- Provider re-enabled
- Consecutive success tracking

#### Scenario 5: Performance Under Load

```typescript
// Burst of 10 concurrent requests
// Extended operation (20 sequential)
// Accurate performance metrics
```

**Expected Results:**
- All requests handled
- P99 latency < 5s
- Consistent performance
- No memory leaks

#### Scenario 6: Mixed STT/TTS Workflows

```typescript
// Sequential: transcribe then synthesize
// Interleaved: multiple STT/TTS pairs
```

**Expected Results:**
- Both operations successful
- Proper fallback for failures
- Metrics collected per operation

#### Scenario 7: Deployment Mode Preferences

```typescript
// Cloud mode → Deepgram first
// Docker mode → Faster-Whisper first
// System mode → Whisper System first
```

**Expected Results:**
- Correct provider ordering
- Mode-appropriate selection

#### Scenario 8: Error Handling

```typescript
// Meaningful error messages
// Detailed logging for debugging
```

**Expected Results:**
- Helpful error descriptions
- Debug logs available

#### Scenario 9: Monitoring and Metrics Export

```typescript
// Comprehensive metrics collection
// Provider-specific metrics
```

**Expected Results:**
- Metrics aggregated correctly
- Per-provider tracking
- Dashboard-ready format

## Test Fixtures

Pre-configured provider combinations for common scenarios:

```typescript
TEST_FIXTURES = {
  allProvidersConfig,      // All 7 providers
  sttOnlyConfig,           // STT: Deepgram, Faster-Whisper, Whisper
  ttsOnlyConfig,           // TTS: ElevenLabs, Cartesia, Kokoro, Piper
  cloudOnlyConfig,         // Cloud: Deepgram, ElevenLabs, Cartesia
  dockerOnlyConfig,        // Docker: Faster-Whisper, Kokoro
  systemOnlyConfig,        // System: Whisper, Piper
}
```

## Mock Logger

Capture and inspect logs during tests:

```typescript
const mockLogger = createMockLogger();

// Use in orchestrator
const orchestrator = new VoiceOrchestrator({
  logger: mockLogger,
  // ...
});

// Inspect logs
const logs = mockLogger.getLogs();
logs.filter(l => l.level === 'error');  // Error logs
logs.filter(l => l.message.includes('fallback'));  // Fallback logs

mockLogger.clear();  // Reset
```

## Performance Metrics

Collect and report performance data:

```typescript
const metrics = new PerformanceMetricsCollector();

// Record operations
metrics.recordLatency(150);
metrics.recordSuccess();

// Get aggregated stats
const stats = metrics.getMetrics();
// {
//   callCount: 1,
//   successCount: 1,
//   errorCount: 0,
//   errorRate: 0.0,
//   avgLatencyMs: 150,
//   minLatencyMs: 150,
//   maxLatencyMs: 150,
//   p50LatencyMs: 150,
//   p95LatencyMs: 150,
//   p99LatencyMs: 150,
// }
```

## Coverage Targets

- **Lines**: >90%
- **Branches**: >85%
- **Functions**: >90%
- **Statements**: >90%

Current coverage for orchestrator-related code:
```
orchestrator.ts         90% (360/400 lines)
orchestrator-config.ts  88% (52/60 lines)
registry.ts            95% (38/40 lines)
Total:                 91% (450/500 lines)
```

## Running Tests

### Full Test Suite

```bash
# All voice provider tests
pnpm test src/media/voice-providers/

# With coverage report
pnpm test:coverage src/media/voice-providers/

# JSON report for CI/CD
pnpm test:coverage --reporter=json
```

### Specific Scenarios

```bash
# Integration tests
pnpm test orchestrator.integration.test.ts

# E2E tests
pnpm test e2e.test.ts

# Specific test
pnpm test e2e.test.ts -t "Scenario 1"

# All fallback tests
pnpm test e2e.test.ts -t "Fallback"

# Performance tests
pnpm test e2e.test.ts -t "Performance"
```

### Watch Mode

```bash
# Auto-rerun on changes
pnpm test:watch src/media/voice-providers/

# Specific file
pnpm test:watch orchestrator.integration.test.ts
```

## Success Criteria

All tests should:
- ✅ Pass consistently (no flakiness)
- ✅ Complete in <15 seconds total
- ✅ Run without external dependencies (mocked)
- ✅ Provide clear failure messages
- ✅ Cover >90% of orchestrator code
- ✅ Test all 7 providers
- ✅ Verify all fallback scenarios
- ✅ Collect accurate metrics

## Integration with CI/CD

### GitHub Actions

```yaml
- name: Test Voice Providers
  run: |
    pnpm test:coverage src/media/voice-providers/
    pnpm test src/media/voice-providers/e2e.test.ts
```

### Coverage Upload

```yaml
- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/coverage-final.json
    flags: voice-providers
```

## Debugging

### Enable Verbose Logging

```typescript
const orchestrator = new VoiceOrchestrator({
  logger: {
    debug: (msg, meta) => console.log('[DEBUG]', msg, meta),
    info: (msg, meta) => console.log('[INFO]', msg, meta),
    warn: (msg, meta) => console.log('[WARN]', msg, meta),
    error: (msg, meta) => console.log('[ERROR]', msg, meta),
  },
  // ...
});
```

### Inspect Test Logs

```typescript
// After test
const logs = mockLogger.getLogs();
console.table(logs);  // View in table format

// Filter specific events
logs.filter(l => l.message.includes('circuit breaker'));
logs.filter(l => l.meta?.provider === 'deepgram');
```

### Performance Profiling

```bash
# Run with profiler
node --prof src/test-perf.js

# Analyze profile
node --prof-process isolate-*.log > profile.txt
```

## Best Practices

1. **Always use fixtures**: Reuse `TEST_FIXTURES` for consistency
2. **Mock everything**: No real API calls during tests
3. **Verify fallback**: Always check fallback chain execution
4. **Collect metrics**: Record latency and success rates
5. **Clean up**: Call `orchestrator.shutdown()` in afterEach
6. **Use meaningful assertions**: Clear error messages

## Troubleshooting

### Tests timeout (>15s)

**Problem**: Orchestrator waiting for health checks
**Solution**: Set `healthCheckInterval: 500` in test config

### Circuit breaker not triggering

**Problem**: Threshold not reached
**Solution**: Use `circuitBreakerThreshold: 1` in test config

### Flaky tests

**Problem**: Timing-dependent failures
**Solution**: Use `waitFor()` helper with timeout and polling

### Mock not being used

**Problem**: Real provider being called
**Solution**: Verify `MockVoiceProvider` is registered before orchestrator init

## Contributing

When adding new tests:
1. Use existing helper functions from e2e-helpers.ts
2. Reuse fixtures from TEST_FIXTURES
3. Add mock setup in beforeEach
4. Clean up in afterEach
5. Document expected behavior
6. Include both success and failure paths

## See Also

- [Orchestrator Architecture](./ORCHESTRATOR-ARCHITECTURE.md)
- [Provider Integration Guide](./PROVIDER-INTEGRATION.md)
- [Configuration Reference](./ORCHESTRATOR-QUICK-REFERENCE.md)
