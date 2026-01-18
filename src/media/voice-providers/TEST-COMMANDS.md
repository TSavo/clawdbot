# Quick Test Commands Reference

## Essential Commands

### Run All Voice Provider Tests
```bash
pnpm test src/media/voice-providers/
```

### Run Integration Tests Only
```bash
pnpm test src/media/voice-providers/orchestrator.integration.test.ts
```

### Run E2E Scenarios
```bash
pnpm test src/media/voice-providers/e2e.test.ts
```

### Coverage Report
```bash
pnpm test:coverage src/media/voice-providers/
```

### Watch Mode (Auto-rerun on changes)
```bash
pnpm test:watch src/media/voice-providers/
```

## Specific Test Scenarios

### Fallback Chain Tests
```bash
pnpm test orchestrator.integration.test.ts -t "Fallback Chain"
pnpm test e2e.test.ts -t "Fallback"
```

### Circuit Breaker Tests
```bash
pnpm test orchestrator.integration.test.ts -t "Circuit Breaker"
pnpm test e2e.test.ts -t "Scenario 3"
```

### Health Monitoring Tests
```bash
pnpm test orchestrator.integration.test.ts -t "Health Check"
pnpm test e2e.test.ts -t "Health"
```

### Performance Tests
```bash
pnpm test e2e.test.ts -t "Scenario 5"
pnpm test e2e.test.ts -t "Performance"
```

### Multi-Provider Tests
```bash
pnpm test orchestrator.integration.test.ts -t "Multi-Provider"
pnpm test e2e.test.ts -t "Scenario 1"
```

### Error Handling Tests
```bash
pnpm test e2e.test.ts -t "Scenario 8"
pnpm test e2e.test.ts -t "Error"
```

### Metrics & Monitoring Tests
```bash
pnpm test e2e.test.ts -t "Scenario 9"
pnpm test e2e.test.ts -t "Monitoring"
```

## Detailed Test Runs

### All Tests with Verbose Output
```bash
pnpm test src/media/voice-providers/ --reporter=verbose
```

### With Detailed Coverage Report
```bash
pnpm test:coverage src/media/voice-providers/ --reporter=verbose
```

### Specific File with Watch Mode
```bash
pnpm test:watch orchestrator.integration.test.ts
pnpm test:watch e2e.test.ts
```

### Run Single E2E Scenario
```bash
pnpm test e2e.test.ts -t "Normal Multi-Provider"
pnpm test e2e.test.ts -t "Degraded Provider"
pnpm test e2e.test.ts -t "Circuit Breaker"
pnpm test e2e.test.ts -t "Provider Recovery"
pnpm test e2e.test.ts -t "Performance Under Load"
pnpm test e2e.test.ts -t "Mixed STT/TTS"
pnpm test e2e.test.ts -t "Deployment Mode"
pnpm test e2e.test.ts -t "Error Handling"
pnpm test e2e.test.ts -t "Monitoring"
```

### Run Integration Test Suite
```bash
pnpm test orchestrator.integration.test.ts -t "Multi-Provider Initialization"
pnpm test orchestrator.integration.test.ts -t "Provider Selection Logic"
pnpm test orchestrator.integration.test.ts -t "Fallback Chain Execution"
pnpm test orchestrator.integration.test.ts -t "Metrics and Monitoring"
pnpm test orchestrator.integration.test.ts -t "Health Check Management"
pnpm test orchestrator.integration.test.ts -t "Streaming Operations"
pnpm test orchestrator.integration.test.ts -t "Configuration and State"
```

## Development Workflow

### Before Committing
```bash
# Full test suite
pnpm test src/media/voice-providers/

# Coverage check
pnpm test:coverage src/media/voice-providers/

# Linting
pnpm lint src/media/voice-providers/
```

### During Development
```bash
# Watch specific file
pnpm test:watch orchestrator.integration.test.ts

# Or watch entire directory
pnpm test:watch src/media/voice-providers/
```

### After Making Changes
```bash
# Run affected tests
pnpm test src/media/voice-providers/ --reporter=verbose

# Check coverage didn't drop
pnpm test:coverage src/media/voice-providers/
```

## CI/CD Integration

### GitHub Actions
```yaml
- name: Run Voice Provider Tests
  run: pnpm test src/media/voice-providers/

- name: Generate Coverage Report
  run: pnpm test:coverage src/media/voice-providers/
```

### Pre-commit Hook
```bash
#!/bin/bash
pnpm test src/media/voice-providers/ || exit 1
```

## Performance Profiling

### Collect Metrics
```bash
# Run with timing information
time pnpm test src/media/voice-providers/

# Detailed timing per test
pnpm test e2e.test.ts --reporter=verbose
```

### Memory Profiling
```bash
# Run with memory profiler
node --max-old-space-size=4096 ./node_modules/.bin/vitest \
  src/media/voice-providers/
```

## Debugging

### With Debug Output
```bash
# Set debug environment variable
DEBUG=* pnpm test orchestrator.integration.test.ts

# Or in test:
// Add to test file
vi.stubGlobal('console', {
  log: vi.fn(),
  debug: vi.fn((...args) => console.log('[DEBUG]', ...args)),
});
```

### Inspect Failed Test
```bash
# Run only failing test
pnpm test orchestrator.integration.test.ts -t "Test Name" --reporter=verbose

# Run with single process (easier to debug)
pnpm test orchestrator.integration.test.ts --single-process
```

### Show Test Output
```bash
pnpm test src/media/voice-providers/ --reporter=verbose --no-truncate
```

## Coverage Goals

### Check Current Coverage
```bash
pnpm test:coverage src/media/voice-providers/
```

### Expected Coverage
- Lines: >90%
- Branches: >85%
- Functions: >90%
- Statements: >90%

### Coverage by File
```bash
pnpm test:coverage src/media/voice-providers/ \
  --reporter=text-summary
```

## Test Organization

### By File
```
e2e-helpers.ts
  ├── Audio utilities
  ├── Assertions
  ├── Configurations
  └── Fixtures

test-mocks.ts
  ├── MockSTTProvider
  ├── MockTTSProvider
  ├── Simulation utilities
  └── Metrics collectors

orchestrator.integration.test.ts
  ├── Multi-Provider Initialization
  ├── Provider Selection Logic
  ├── Fallback Chain Execution
  ├── Metrics & Monitoring
  ├── Health Check Management
  ├── Streaming Operations
  └── Configuration & State

e2e.test.ts
  ├── Scenario 1-9
  ├── Provider workflows
  ├── Error scenarios
  └── Performance tests
```

### By Feature
```bash
# All fallback tests
pnpm test --grep "fallback|Fallback|FALLBACK"

# All circuit breaker tests
pnpm test --grep "circuit|Circuit|CIRCUIT"

# All health tests
pnpm test --grep "health|Health|HEALTH"

# All performance tests
pnpm test --grep "performance|Performance|PERFORMANCE"
```

## Useful Options

### Basic Options
```bash
pnpm test src/media/voice-providers/
  --reporter=verbose      # Detailed output
  --reporter=json         # JSON format
  --reporter=table        # Table format
  --no-coverage          # Skip coverage
  --timeout=60000        # Custom timeout
  --bail                 # Stop on first failure
```

### Watch Mode Options
```bash
pnpm test:watch src/media/voice-providers/
  --reporter=verbose
  --no-truncate
  --expand              # Show full output
```

### Coverage Options
```bash
pnpm test:coverage src/media/voice-providers/
  --reporter=html         # Generate HTML report
  --reporter=lcov        # For CodeCov
  --all                  # Include untested files
  --exclude-internal     # Skip internal modules
```

## Troubleshooting Commands

### Clear Cache
```bash
rm -rf node_modules/.vite
pnpm install
pnpm test src/media/voice-providers/
```

### Rebuild Tests
```bash
pnpm build
pnpm test src/media/voice-providers/
```

### Test Just Mocks
```bash
# Create simple test file to verify mocks work
cat > test-verify.ts << 'EOF'
import { MockSTTProvider, MockTTSProvider } from './test-mocks.ts';
import { createTestAudioBuffer } from './e2e-helpers.ts';

const stt = new MockSTTProvider('test-stt');
const tts = new MockTTSProvider('test-tts');
const audio = createTestAudioBuffer();

console.log('Mocks loaded successfully');
EOF

pnpm tsx test-verify.ts
```

### List All Tests
```bash
pnpm test --list src/media/voice-providers/
```

## Documentation Links

- [Test Infrastructure Guide](./TEST-INFRASTRUCTURE.md)
- [Test Summary](./TEST-INFRASTRUCTURE-SUMMARY.md)
- [Orchestrator Docs](./ORCHESTRATOR-QUICK-REFERENCE.md)
- [Integration Guide](./ORCHESTRATOR-INTEGRATION.md)

## Quick Stats

| Metric | Value |
|--------|-------|
| Total Test Files | 2 |
| Total Test Cases | 100+ |
| Total Lines of Test Code | 2,921 |
| Integration Tests | 50+ |
| E2E Scenarios | 50+ |
| Expected Coverage | >90% |
| Expected Run Time | <15s |
| External Dependencies | 0 |

## Example Workflow

```bash
# 1. Development
pnpm test:watch src/media/voice-providers/

# 2. Before commit
pnpm test src/media/voice-providers/
pnpm test:coverage src/media/voice-providers/
pnpm lint src/media/voice-providers/

# 3. Full verification
pnpm build
pnpm test src/media/voice-providers/ --reporter=verbose
pnpm test:coverage src/media/voice-providers/

# 4. Submit with confidence
git add src/media/voice-providers/
git commit -m "Add test infrastructure for VoiceOrchestrator"
git push origin feature/voice-orchestrator-tests
```
