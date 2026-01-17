# Voice Provider Integration Tests - Complete Guide

## Overview

Comprehensive integration test suite for the voice provider system covering all UX surfaces: Onboarding, CLI, Dashboard, and End-to-End flows. Tests are designed to achieve 70%+ coverage across lines, functions, branches, and statements.

## Test Files Summary

### 1. Configuration & Schema Tests
**File:** `integration.config.test.ts`
**Tests:** 60+ test cases
**Coverage:** 70%+

Core configuration validation and schema parsing:
- E164 phone number validation (valid/invalid formats)
- Provider-specific configuration (Telnyx, Twilio, Plivo)
- STT/TTS configuration and defaults
- Inbound policy validation
- Fallback chain configuration
- Configuration persistence and migration
- Backward compatibility

**Key Assertions:**
```typescript
- E164Schema validation
- VoiceCallConfigSchema parsing
- Provider configuration schema validation
- Migration from old v1 formats
- Default value provision
```

### 2. Provider System Tests
**File:** `integration.provider.test.ts`
**Tests:** 45+ test cases
**Coverage:** 70%+

Provider selection, switching, and error handling:
- Provider initialization and selection
- Provider switching mid-session
- Fallback chain management
- Error handling and recovery
- Webhook parsing and verification
- Cross-provider consistency
- Call ID mapping (internal vs provider)
- Provider state management

**Key Assertions:**
```typescript
- Provider credential storage
- Fallback chain execution
- Event normalization across providers
- Provider API consistency
- Error propagation
```

### 3. CLI Command Tests
**File:** `integration.cli.test.ts`
**Tests:** 50+ test cases
**Coverage:** 70%+

All CLI voice commands with proper validation:
- `clawdbot voice configure` - All options tested
- `clawdbot voice status` - Output validation
- `clawdbot voice test` - STT/TTS execution
- `clawdbot voice providers` - List accuracy
- Error handling and messages
- Output formatting and validation

**Commands Tested:**
```typescript
voice configure [--provider] [--from-number] [--to-number] [--inbound-policy]
voice status [--all] [--deep]
voice test [--stt|--tts] [--all]
voice providers [--format]
```

### 4. Onboarding Tests
**File:** `integration.onboarding.test.ts`
**Tests:** 55+ test cases
**Coverage:** 70%+

Complete onboarding flow from provider selection to configuration:
- Provider selection and validation
- System capability detection (GPU, network, audio devices)
- Dependency validation (OpenAI API key, provider credentials)
- Phone number configuration
- Inbound policy setup
- STT/TTS provider selection
- Configuration persistence
- Backward compatibility with existing onboarding
- Progress tracking
- Error handling and recovery

**Onboarding Steps:**
1. Provider selection
2. Capability detection
3. Dependency validation
4. Credentials entry
5. Phone numbers configuration
6. Inbound policy selection
7. STT/TTS configuration
8. Confirmation and persistence

### 5. Dashboard Component Tests
**File:** `integration.dashboard.test.ts`
**Tests:** 50+ test cases
**Coverage:** 70%+

Dashboard UI components and integration:
- Provider selector component
- Configuration panel (edit, validate, persist)
- Test interface (STT/TTS buttons, execution)
- Status display (calls, provider status, config status)
- Fallback chain reordering
- Inbound policy configuration
- STT/TTS voice selection
- Configuration sync with CLI
- Error display and recovery
- Unsaved changes tracking

**Components Tested:**
- Provider selector dropdown
- Config form with validation
- Test interface with progress
- Status dashboard
- Fallback chain drag-and-drop
- Policy selector with allowlist

### 6. End-to-End Tests
**File:** `integration.e2e.test.ts`
**Tests:** 40+ test cases
**Coverage:** 70%+

Complete user journeys across all surfaces:
- Full onboarding sequence
- Configure → Dashboard → Use flow
- Provider switching mid-session
- Fallback chain activation
- Error recovery and retries
- Settings persistence across restarts
- Cross-component consistency
- Concurrent updates from multiple surfaces

**Scenarios Tested:**
1. New user onboarding
2. Existing user reconfiguration
3. Provider failure and fallback
4. Error recovery
5. Multi-surface synchronization
6. Settings persistence
7. Call state management

## Mock Utilities

### MockVoiceProvider (`mocks/providers.ts`)

```typescript
class MockVoiceProvider implements VoiceCallProvider {
  // Track calls
  initiateCallCalls: InitiateCallInput[];
  hangupCallCalls: HangupCallInput[];
  playTtsCalls: PlayTtsInput[];

  // Configure behavior
  shouldFailInitiate: boolean;
  webhookEvents: NormalizedEvent[];

  // Test helpers
  reset(): void;
  getCallCount(): number;
  getLastInitiateCall(): InitiateCallInput | undefined;
}
```

### Configuration Factories (`mocks/config.ts`)

```typescript
// Basic config with defaults
const config = createMockConfig();

// With overrides
const config = createMockConfig({
  provider: "telnyx",
  fromNumber: "+15550000000",
});

// Provider-specific
const config = createProviderConfig("twilio");
```

### Mock Plugins (`mocks/plugins.ts`)

```typescript
// STT Provider
const stt = new MockSTTProvider();
stt.shouldFail = false;

// TTS Provider
const tts = new MockTTSProvider();
tts.shouldFail = false;

// Complete registry
const registry = createMockPluginRegistry();
registry.reset();
```

## Test Utilities

### Event Helpers (`test-utils.ts`)

```typescript
// Generate phone numbers
generatePhone(suffix: number): string

// Create mock events
createCallAnsweredEvent(callId, providerCallId): NormalizedEvent
createCallSpeakingEvent(callId, text): NormalizedEvent
createCallSpeechEvent(callId, transcript): NormalizedEvent
createCallEndedEvent(callId, reason): NormalizedEvent
createCallErrorEvent(callId, error): NormalizedEvent

// Create full lifecycle
createCallLifecycle(callId, providerCallId): NormalizedEvent[]

// Wait for conditions
waitFor(condition, timeout): Promise<void>
```

### Helpers for Assertions

```typescript
// Event logging
const logger = new EventLogger();
logger.log("type", data);
logger.getEventsByType("type");

// Performance tracking
const tracker = new PerformanceTracker();
tracker.start("operation");
tracker.end("operation");
tracker.getAverage("operation");
```

## Running Tests

### Execute all voice tests
```bash
pnpm test extensions/voice-call/src/__tests__
```

### Execute specific test file
```bash
pnpm test extensions/voice-call/src/__tests__/integration.config.test.ts
```

### Watch mode
```bash
pnpm test --watch extensions/voice-call/src/__tests__
```

### With coverage
```bash
pnpm test:coverage extensions/voice-call/src/__tests__
```

### Run specific test
```bash
pnpm test -t "should accept valid E.164 format numbers"
```

## Coverage Targets

| Metric | Target | Status |
|--------|--------|--------|
| Lines | 70% | - |
| Functions | 70% | - |
| Branches | 55% | - |
| Statements | 70% | - |

## Test Scenarios by Feature

### Configuration Management
- ✓ Schema validation for all provider types
- ✓ Phone number format validation
- ✓ Inbound policy validation
- ✓ Provider-specific option validation
- ✓ Fallback chain configuration
- ✓ Migration from old formats
- ✓ Config file loading & persistence

### Provider System
- ✓ Provider selection and initialization
- ✓ Provider switching (mid-session)
- ✓ Fallback chain activation
- ✓ Call initiation with different providers
- ✓ Error handling and recovery
- ✓ Webhook parsing and verification
- ✓ Event normalization across providers

### CLI Commands
- ✓ `voice configure` with all options
- ✓ `voice status` output validation
- ✓ `voice test` (STT/TTS execution)
- ✓ `voice providers` list accuracy
- ✓ Error handling and messages
- ✓ Option validation

### Onboarding
- ✓ Provider selection flow
- ✓ Capability detection
- ✓ Dependency validation
- ✓ Phone number entry
- ✓ Inbound policy configuration
- ✓ Configuration persistence
- ✓ Backward compatibility

### Dashboard
- ✓ Provider selector functional tests
- ✓ Config panel updates & persistence
- ✓ Test interface (STT/TTS) execution
- ✓ Status display accuracy
- ✓ Fallback chain reordering
- ✓ Inbound allowlist management
- ✓ Configuration sync with CLI

### End-to-End
- ✓ Full flow: Onboarding → Configure → Dashboard → Use
- ✓ Provider switching mid-session
- ✓ Fallback chain activation
- ✓ Error recovery
- ✓ Settings persistence
- ✓ Cross-component consistency

## Common Test Patterns

### Async Operations
```typescript
it("should handle async operations", async () => {
  const result = await manager.initiateCall("+15550000001");
  expect(result.success).toBe(true);
});
```

### Error Cases
```typescript
it("should handle errors", async () => {
  mockProvider.shouldFailInitiate = true;
  const result = await manager.initiateCall("+15550000001");
  expect(result.success).toBe(false);
});
```

### Configuration Validation
```typescript
it("should validate configuration", () => {
  const config = createMockConfig({
    fromNumber: "+15550000000",
  });
  expect(config.fromNumber).toMatch(/^\+/);
});
```

### Mock Behavior
```typescript
beforeEach(() => {
  mockProvider.reset();
  mockProvider.setWebhookEvents([...]);
});
```

## Debugging

### Debug specific test
```bash
pnpm test -t "test description" --reporter=verbose
```

### See stack traces
```bash
pnpm test -- --reporter=verbose
```

### Run with output
```bash
pnpm test -- --reporter=tap
```

## CI/CD Integration

Tests are configured to run with:
```bash
pnpm test:coverage
```

Coverage thresholds enforced:
- Lines: 70% minimum
- Functions: 70% minimum
- Branches: 55% minimum
- Statements: 70% minimum

## File Organization

```
extensions/voice-call/src/__tests__/
├── mocks/
│   ├── config.ts           # Configuration factories
│   ├── providers.ts        # MockVoiceProvider
│   ├── plugins.ts          # Mock STT/TTS providers
│   └── index.ts            # Unified exports
├── integration.config.test.ts          # Configuration tests
├── integration.provider.test.ts        # Provider system tests
├── integration.cli.test.ts             # CLI command tests
├── integration.onboarding.test.ts      # Onboarding tests
├── integration.dashboard.test.ts       # Dashboard tests
├── integration.e2e.test.ts             # E2E flow tests
├── test-utils.ts                       # Shared test utilities
├── README.md                           # Test structure guide
└── TESTING_GUIDE.md                    # This file
```

## Next Steps

1. Run full test suite: `pnpm test extensions/voice-call/src/__tests__`
2. Check coverage: `pnpm test:coverage extensions/voice-call/src/__tests__`
3. Add tests for new features
4. Integrate with CI/CD
5. Monitor coverage metrics

## References

- [Vitest Documentation](https://vitest.dev)
- [Voice Call System](../README.md)
- [Configuration Schema](../config.ts)
- [Provider Interfaces](../providers/base.ts)
