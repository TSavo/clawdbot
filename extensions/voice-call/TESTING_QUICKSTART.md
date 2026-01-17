# Voice Provider Integration Tests - Quick Start

## Quick Navigation

- **📋 Full Test Suite:** 300+ test cases across 6 integration test files
- **🎯 Coverage Target:** 70%+ (lines, functions, statements) + 55%+ (branches)
- **📁 Location:** `/extensions/voice-call/src/__tests__/`

## Running Tests in 30 Seconds

```bash
# Run all voice provider tests
pnpm test extensions/voice-call/src/__tests__

# With coverage report
pnpm test:coverage extensions/voice-call/src/__tests__

# Watch mode during development
pnpm test --watch extensions/voice-call/src/__tests__
```

## What's Tested

### 1. Configuration & Schema (60+ tests)
```bash
pnpm test integration.config.test.ts
```
- Phone number validation (E.164 format)
- Provider configurations (Telnyx, Twilio, Plivo)
- Inbound policies and allowlists
- Configuration persistence and migration

### 2. Provider System (45+ tests)
```bash
pnpm test integration.provider.test.ts
```
- Provider selection and switching
- Fallback chains
- Error handling and recovery
- Call ID mapping and webhook parsing

### 3. CLI Commands (50+ tests)
```bash
pnpm test integration.cli.test.ts
```
- `voice configure` - All options
- `voice status` - Output validation
- `voice test` - STT/TTS execution
- `voice providers` - List accuracy

### 4. Onboarding (55+ tests)
```bash
pnpm test integration.onboarding.test.ts
```
- Provider selection
- Capability detection
- Dependency validation
- Configuration persistence
- Backward compatibility

### 5. Dashboard (50+ tests)
```bash
pnpm test integration.dashboard.test.ts
```
- Provider selector component
- Configuration panel
- Test interface (STT/TTS)
- Status display
- Fallback chain reordering

### 6. End-to-End (40+ tests)
```bash
pnpm test integration.e2e.test.ts
```
- Complete user journeys
- Multi-surface synchronization
- Error recovery
- Settings persistence

## File Structure

```
extensions/voice-call/src/__tests__/
├── 📄 integration.config.test.ts      # Configuration tests
├── 📄 integration.provider.test.ts    # Provider system
├── 📄 integration.cli.test.ts         # CLI commands
├── 📄 integration.onboarding.test.ts  # Onboarding flow
├── 📄 integration.dashboard.test.ts   # Dashboard UI
├── 📄 integration.e2e.test.ts         # End-to-end flows
├── 📄 test-utils.ts                   # Shared utilities
├── 📁 mocks/
│   ├── 📄 providers.ts                # MockVoiceProvider
│   ├── 📄 config.ts                   # Config factories
│   ├── 📄 plugins.ts                  # Mock STT/TTS
│   └── 📄 index.ts                    # Exports
├── 📖 README.md                       # Test structure
├── 📖 TESTING_GUIDE.md                # Complete guide
└── VOICE_TESTS_SUMMARY.md             # Delivery summary
```

## Using Mocks

### Mock Provider
```typescript
import { MockVoiceProvider } from "./mocks/providers.js";

const provider = new MockVoiceProvider();

// Configure behavior
provider.shouldFailInitiate = true;
provider.failureReason = "Connection error";

// Assert on calls
expect(provider.getCallCount()).toBe(1);

// Reset for next test
provider.reset();
```

### Mock Configuration
```typescript
import { createMockConfig, createProviderConfig } from "./mocks/config.js";

// Basic config
const config = createMockConfig();

// With overrides
const config = createMockConfig({
  provider: "telnyx",
  fromNumber: "+15550000000",
});

// Provider-specific
const config = createProviderConfig("twilio");
```

### Mock Plugins
```typescript
import { createMockPluginRegistry } from "./mocks/plugins.js";

const registry = createMockPluginRegistry();
registry.stt.shouldFail = false;
registry.tts.shouldFail = false;
registry.reset();
```

## Test Utilities

```typescript
import {
  generatePhone,
  createCallAnsweredEvent,
  EventLogger,
  PerformanceTracker,
} from "./test-utils.js";

// Generate mock phone
const phone = generatePhone(123); // "+15550000123"

// Create mock events
const event = createCallAnsweredEvent(callId, providerId);

// Track events
const logger = new EventLogger();
logger.log("event-type", data);
expect(logger.count("event-type")).toBe(1);

// Track performance
const tracker = new PerformanceTracker();
tracker.start("operation");
// ... operation ...
const duration = tracker.end("operation");
console.log(tracker.report());
```

## Common Commands

```bash
# Run single test file
pnpm test integration.config.test.ts

# Run tests matching pattern
pnpm test -t "should accept valid E.164"

# Run with verbose output
pnpm test integration.config.test.ts -- --reporter=verbose

# Generate coverage report
pnpm test:coverage

# Watch mode (auto-rerun on change)
pnpm test --watch

# Watch specific file
pnpm test --watch integration.config.test.ts
```

## Debugging Tips

### Check which tests exist
```bash
pnpm test -- --list integration.config.test.ts
```

### Debug specific test
```bash
pnpm test -t "specific test name" -- --reporter=verbose
```

### See test output
```bash
pnpm test -- --reporter=tap
```

### Check coverage gaps
```bash
pnpm test:coverage
```

## Integration with CI/CD

Tests are configured to run with Vitest v8 coverage provider:

```bash
# Run tests with coverage thresholds
pnpm test:coverage

# Coverage targets
- Lines: 70%
- Functions: 70%
- Branches: 55%
- Statements: 70%
```

## Test Scenarios at a Glance

| Feature | Coverage |
|---------|----------|
| Phone number validation | ✓ Valid/invalid formats |
| Provider selection | ✓ Switch, fallback, errors |
| CLI commands | ✓ All 4 main commands |
| Onboarding | ✓ Full flow + persistence |
| Dashboard | ✓ Components + sync |
| E2E flows | ✓ Complete user journeys |
| Error handling | ✓ Timeouts, invalid creds, recovery |
| Cross-surface sync | ✓ CLI ↔ Dashboard ↔ Onboarding |

## What to Test When Adding Features

1. **New Configuration Option**
   - Add test to `integration.config.test.ts`
   - Validate schema, defaults, persistence
   - Test in onboarding and CLI

2. **New CLI Command**
   - Add tests to `integration.cli.test.ts`
   - Test all options and error cases
   - Verify output format

3. **New Provider**
   - Add to `integration.provider.test.ts`
   - Test initialization, calls, webhooks
   - Add to fallback chain tests

4. **Dashboard Changes**
   - Update `integration.dashboard.test.ts`
   - Test component interaction
   - Verify sync with CLI

5. **Onboarding Changes**
   - Update `integration.onboarding.test.ts`
   - Test new steps
   - Verify backward compatibility

## Documentation

- **Full Guide:** `src/__tests__/TESTING_GUIDE.md`
- **Test Structure:** `src/__tests__/README.md`
- **Test Summary:** `VOICE_TESTS_SUMMARY.md`

## Next Steps

1. Run `pnpm test extensions/voice-call/src/__tests__` to verify all tests pass
2. Check coverage: `pnpm test:coverage extensions/voice-call/src/__tests__`
3. Add tests for any new features
4. Integrate into CI/CD pipeline
5. Monitor coverage metrics

## Support

For detailed information:
- Test structure: See `src/__tests__/README.md`
- Complete guide: See `src/__tests__/TESTING_GUIDE.md`
- Mock usage: See `src/__tests__/mocks/`
- Utilities: See `src/__tests__/test-utils.ts`

---

**Total Coverage:** 300+ tests across 6 integration test files
**Target:** 70%+ on lines, functions, and statements
**Current Status:** Ready to run
