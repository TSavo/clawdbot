# Voice Provider System Integration Tests

Comprehensive integration tests for the voice provider system across all UX surfaces (Onboarding, CLI, Dashboard, E2E).

## Test Structure

### Mock Utilities (`mocks/`)
- **`providers.ts`** - `MockVoiceProvider` for testing provider interfaces
- **`config.ts`** - Configuration factories with sensible defaults
- **`plugins.ts`** - Mock STT/TTS providers for plugin system testing
- **`index.ts`** - Unified mock exports

### Test Files

#### `integration.config.test.ts` (Configuration & Schema)
**Coverage: 70%+**

Tests for configuration validation, schema parsing, and persistence:

- **E164 Phone Number Validation**
  - Valid/invalid number formats
  - Clear error messages

- **Provider Configuration**
  - Telnyx, Twilio, Plivo specific configs
  - Optional credential handling
  - Provider-specific options

- **Fallback Chains**
  - Multiple provider support
  - Fallback order configuration
  - Provider overrides

- **Configuration Persistence**
  - JSON serialization
  - Migration from old formats
  - Backward compatibility

#### `integration.provider.test.ts` (Provider System)
**Coverage: 70%+**

Tests for provider selection, error handling, and cross-provider consistency:

- **Provider Selection**
  - Provider switching
  - Credential storage

- **Error Handling**
  - Provider initialization failures
  - Timeout handling
  - Retry logic

- **Cross-Provider Consistency**
  - Event normalization
  - Call ID mapping (internal vs provider)
  - Provider-agnostic API

- **Webhook Handling**
  - Signature verification
  - Event parsing
  - Provider-specific formats

#### `integration.cli.test.ts` (CLI Commands)
**Coverage: 70%+**

Tests for all CLI voice commands:

- **clawdbot voice configure**
  - Provider selection
  - Phone numbers
  - Credentials
  - Inbound policy
  - Configuration validation

- **clawdbot voice status**
  - Provider status display
  - Call counts
  - Credential status
  - Fallback chain display

- **clawdbot voice test**
  - STT test execution
  - TTS test execution
  - Provider connectivity check
  - Error reporting

- **clawdbot voice providers**
  - Available providers list
  - Provider details
  - Fallback chain display

- **Error Handling**
  - Missing options
  - Invalid formats
  - Network errors
  - Authentication errors

#### `integration.onboarding.test.ts` (Onboarding Flow)
**Coverage: 70%+**

Tests for complete onboarding experience:

- **Provider Selection**
  - Available providers display
  - Selection validation
  - Credential testing

- **System Capability Detection**
  - GPU availability
  - Network connectivity
  - Audio device detection
  - Requirement reporting

- **Dependency Validation**
  - API key checks
  - Critical vs optional deps
  - Missing dependency handling

- **Configuration**
  - Phone numbers
  - Inbound policies
  - STT/TTS selection
  - Persistence

- **Backward Compatibility**
  - Legacy config loading
  - Pre-v2 format support
  - Non-breaking upgrades

#### `integration.dashboard.test.ts` (Dashboard Components)
**Coverage: 70%+**

Tests for dashboard UI components and integration:

- **Provider Selector**
  - Provider list display
  - Selection handling
  - Status indicators

- **Configuration Panel**
  - Current config display
  - Phone number editing
  - Provider-specific options
  - Unsaved changes tracking

- **Test Interface**
  - STT/TTS buttons
  - Test execution
  - Result display
  - Error handling

- **Status Display**
  - Call metrics
  - Provider status
  - Configuration status
  - Auto-update

- **Fallback Chain**
  - Chain display
  - Drag-and-drop reordering
  - Persistence
  - Validation

#### `integration.e2e.test.ts` (End-to-End Flows)
**Coverage: 70%+**

Tests for complete user journeys:

- **Onboarding Flow**
  - Full setup sequence
  - Configuration persistence
  - Capability detection

- **Configure → Dashboard → Use**
  - CLI configuration
  - Dashboard display
  - Provider usage
  - Cross-surface sync

- **Provider Switching**
  - Mid-session switching
  - Call state preservation
  - Seamless transition

- **Fallback Chain**
  - Fallback activation
  - Ordered retries
  - Visibility into attempts

- **Error Recovery**
  - Transient error recovery
  - Permanent failure handling
  - Retry logic

- **Settings Persistence**
  - Config persistence across restarts
  - Call log persistence
  - Import/export support

## Running Tests

### All tests
```bash
pnpm test
```

### Specific test file
```bash
pnpm test extensions/voice-call/src/__tests__/integration.config.test.ts
```

### Watch mode
```bash
pnpm test --watch
```

### Coverage
```bash
pnpm test:coverage
```

Coverage targets:
- **Lines**: 70%+
- **Functions**: 70%+
- **Branches**: 55%+
- **Statements**: 70%+

## Writing Tests

### Basic Structure

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MockVoiceProvider } from "./__tests__/mocks/providers.js";
import { createMockConfig } from "./__tests__/mocks/config.js";

describe("Feature", () => {
  let mockProvider: MockVoiceProvider;

  beforeEach(() => {
    mockProvider = new MockVoiceProvider();
  });

  it("should test behavior", () => {
    const config = createMockConfig();
    expect(config).toBeDefined();
  });
});
```

### Using Mock Utilities

```typescript
// Mock provider
const provider = new MockVoiceProvider();

// Configure mock behavior
provider.shouldFailInitiate = true;
provider.failureReason = "Test failure";

// Assert on mock calls
expect(provider.getCallCount()).toBe(1);
expect(provider.getLastInitiateCall()).toBeDefined();

// Reset for next test
provider.reset();
```

### Config Factories

```typescript
// Basic config
const config = createMockConfig();

// With overrides
const config = createMockConfig({
  provider: "telnyx",
  fromNumber: "+15550000000",
});

// Provider-specific
const config = createProviderConfig("twilio", {
  fromNumber: "+15550000000",
});
```

## Mock Reference

### MockVoiceProvider

```typescript
class MockVoiceProvider implements VoiceCallProvider {
  // Track calls
  initiateCallCalls: InitiateCallInput[];
  hangupCallCalls: HangupCallInput[];
  playTtsCalls: PlayTtsInput[];

  // Configure behavior
  shouldFailInitiate: boolean;
  failureReason: string;
  webhookVerificationResult: WebhookVerificationResult;
  webhookEvents: NormalizedEvent[];

  // Test helpers
  reset(): void;
  setWebhookEvents(events: NormalizedEvent[]): void;
  getCallCount(): number;
  getLastInitiateCall(): InitiateCallInput | undefined;
}
```

### Mock Plugins

```typescript
// STT Provider
const mockStt = new MockSTTProvider();
mockStt.shouldFail = false;
const session = await mockStt.createSession();

// TTS Provider
const mockTts = new MockTTSProvider();
mockTts.shouldFail = false;
const audio = await mockTts.synthesize("Hello world");

// Registry
const registry = createMockPluginRegistry();
registry.reset(); // Reset all mocks
```

## Test Scenarios

### Configuration Validation
- ✓ Valid E.164 phone numbers
- ✓ Invalid phone formats rejected
- ✓ Provider credentials validated
- ✓ Inbound policies validated
- ✓ Phone number arrays validated

### Provider Operations
- ✓ Call initiation
- ✓ Call hangup
- ✓ TTS playback
- ✓ STT listening
- ✓ Webhook parsing

### Error Handling
- ✓ Network timeouts
- ✓ Invalid credentials
- ✓ Missing dependencies
- ✓ Transient failures with retry
- ✓ Permanent failures

### Cross-Surface Integration
- ✓ CLI → Dashboard sync
- ✓ Dashboard → CLI sync
- ✓ Onboarding → Config persistence
- ✓ Config changes visibility
- ✓ Call state consistency

## Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Lines | 70% | — |
| Functions | 70% | — |
| Branches | 55% | — |
| Statements | 70% | — |

## Common Patterns

### Testing Async Operations

```typescript
it("should handle async operations", async () => {
  const result = await manager.initiateCall("+15550000001");
  expect(result.success).toBe(true);
});
```

### Testing Error Cases

```typescript
it("should handle errors", () => {
  mockProvider.shouldFailInitiate = true;
  expect(() => manager.initiateCall("+15550000001")).toThrow();
});
```

### Testing State Changes

```typescript
it("should update state", () => {
  let state = "initial";
  state = "changed";
  expect(state).toBe("changed");
});
```

### Testing Sequences

```typescript
it("should handle sequences", async () => {
  const id1 = (await manager.initiateCall("+15550000001")).callId;
  const id2 = (await manager.initiateCall("+15550000002")).callId;

  expect(manager.getCall(id1)).toBeDefined();
  expect(manager.getCall(id2)).toBeDefined();
});
```

## Debugging Tests

### Run single test
```bash
pnpm test -t "test name"
```

### Debug output
```bash
pnpm test -- --reporter=verbose
```

### Watch specific file
```bash
pnpm test integration.config.test.ts --watch
```

## Related Documentation

- [Voice Call System](../README.md)
- [Plugin System](../plugins/README.md)
- [Configuration](../config.ts)
- [CLI Commands](../cli.ts)
