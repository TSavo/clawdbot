# Voice Orchestrator Migration & Implementation Strategy

## Executive Summary

The Voice Orchestrator is a new coordination layer that **enhances** the existing `VoiceProviderRegistry` without breaking changes. It adds intelligent provider selection, health monitoring, circuit breaker patterns, and metrics collection while maintaining full backward compatibility.

### Timeline & Phases

```
Phase 1: Foundation (Week 1-2)
├── Create orchestrator.ts (main class)
├── Create orchestrator-config.ts (schemas)
├── Create health-monitor.ts (circuit breaker)
├── Create provider-metrics.ts (metrics collection)
└── Write unit tests

Phase 2: Integration (Week 3)
├── Update CLI commands (voice transcribe, synthesize, status)
├── Add API endpoints for dashboard
├── Create integration tests
└── Write documentation

Phase 3: Enhancement (Week 4)
├── Provider plugins integration
├── Dashboard components
├── Performance optimization
├── Monitoring integration

Phase 4: Rollout (Ongoing)
├── Gradual adoption in voice channels
├── Monitor metrics & health
├── Gather feedback
└── Iterate on optimization
```

## Component Architecture

### Existing Components (No Changes)

```
VoiceProviderRegistry (registry.ts)
├── Loads providers from config
├── Manages provider instances
├── Basic fallback chain
└── Health status queries

VoiceProviderExecutor (executor.ts)
├── STT: transcribe, transcribeStream
├── TTS: synthesize, synthesizeStream
└── Lifecycle: initialize, shutdown

Provider Implementations
├── Whisper
├── Faster-Whisper
├── Kokoro
└── [Future providers]
```

### New Orchestrator Layer

```
VoiceOrchestrator (orchestrator.ts)
├── Wraps VoiceProviderRegistry
├── Adds intelligent selection
├── Enhanced error handling
├── Metrics tracking
└── Health monitoring

Supporting Components
├── HealthMonitor (health-monitor.ts)
│   ├── Circuit breaker per provider
│   ├── Periodic health checks
│   └── Recovery strategies
│
├── ProviderMetrics (provider-metrics.ts)
│   ├── Request tracking
│   ├── Latency percentiles
│   └── Error rate calculation
│
└── FallbackChain (fallback-chain.ts)
    ├── Provider ordering
    ├── Error-based switching
    └── Retry logic
```

## Integration Strategy

### Step 1: Create Core Orchestrator Class

**File**: `src/media/voice-providers/orchestrator.ts` (~400 lines)

```typescript
import { VoiceProviderRegistry } from './registry.js'
import { HealthMonitor } from './health-monitor.js'
import { ProviderMetrics } from './provider-metrics.js'
import { OrchestratorConfig } from './orchestrator-config.js'

export class VoiceOrchestrator {
  private registry: VoiceProviderRegistry
  private healthMonitor: HealthMonitor
  private metricsCollector: ProviderMetrics

  constructor(configPath?: string) {
    this.registry = new VoiceProviderRegistry()
    this.healthMonitor = new HealthMonitor(this.registry)
    this.metricsCollector = new ProviderMetrics()
  }

  async initialize(): Promise<void> {
    // 1. Load configuration
    const config = await this.loadConfiguration()

    // 2. Initialize registry
    await this.registry.loadProviders(config.providers)

    // 3. Start health monitoring
    await this.healthMonitor.start(config.healthCheck)

    // 4. Initialize metrics collection
    this.metricsCollector.initialize(config.metrics)
  }

  // Core STT interface
  async transcribe(
    audio: AudioBuffer,
    options?: OrchestratorOptions
  ): Promise<TranscriptionResult> {
    // 1. Select provider
    const provider = await this.selectProvider('stt', options)

    // 2. Record start
    const metrics = this.metricsCollector.startRequest(provider.id)

    try {
      // 3. Execute with retry
      const result = await this.executeWithRetry(
        () => provider.transcribe(audio, options),
        options?.maxRetries
      )

      // 4. Record success
      this.metricsCollector.recordSuccess(metrics)

      return result
    } catch (error) {
      // 5. Record failure
      this.metricsCollector.recordFailure(metrics, error)

      // 6. Handle fallback
      if (options?.allowFallback) {
        return await this.executeWithFallback(
          'transcribe',
          () => provider.transcribe(audio, options),
          options
        )
      }

      throw error
    }
  }

  // Core TTS interface
  async synthesize(
    text: string,
    options?: OrchestratorOptions
  ): Promise<AudioBuffer> {
    // Similar pattern to transcribe
  }

  // Provider management
  async getProviderStatus(): Promise<ProviderStatusReport> {
    // Return orchestrator health status
  }

  async getMetrics(providerId?: string): Promise<ProviderMetrics> {
    // Return provider metrics
  }

  async switchProvider(
    type: 'stt' | 'tts',
    providerId: string
  ): Promise<void> {
    // Switch primary provider
  }

  // Lifecycle
  async shutdown(): Promise<void> {
    await this.healthMonitor.stop()
    await this.registry.shutdown()
  }

  // ... implementation details
}
```

### Step 2: Create Health Monitor

**File**: `src/media/voice-providers/health-monitor.ts` (~300 lines)

```typescript
export class HealthMonitor {
  private circuitBreakers: Map<string, CircuitBreaker>
  private healthCheckTasks: Map<string, NodeJS.Timeout>
  private lastStatus: Map<string, ProviderStatus>

  async start(config: HealthCheckConfig): Promise<void> {
    // Initialize circuit breakers
    // Schedule health checks
    // Start recovery mechanisms
  }

  async performHealthCheck(providerId: string): Promise<ProviderStatus> {
    // Execute health check strategies
    // Update circuit breaker state
    // Return status
  }

  getStatus(providerId: string): ProviderStatus | undefined {
    return this.lastStatus.get(providerId)
  }

  isHealthy(providerId: string): boolean {
    const status = this.lastStatus.get(providerId)
    return status?.state === 'healthy'
  }

  async stop(): Promise<void> {
    // Clear intervals
    // Shutdown gracefully
  }
}
```

### Step 3: Create Metrics Collection

**File**: `src/media/voice-providers/provider-metrics.ts` (~250 lines)

```typescript
export class ProviderMetrics {
  private historyWindow: RequestRecord[] = []
  private aggregatedMetrics: Map<string, AggregatedMetrics>

  recordRequest(providerId: string, record: RequestRecord): void {
    this.historyWindow.push({
      ...record,
      providerId,
      timestamp: Date.now(),
    })

    // Maintain sliding window
    if (this.historyWindow.length > this.maxHistorySize) {
      this.historyWindow.shift()
    }

    // Recalculate aggregates
    this.recalculateMetrics(providerId)
  }

  getMetrics(providerId?: string): ProviderMetrics {
    if (providerId) {
      return this.aggregatedMetrics.get(providerId)
    }
    // Return combined metrics
  }

  private recalculateMetrics(providerId: string): void {
    // Calculate: latency, error rate, success rate, etc.
  }
}
```

### Step 4: Update CLI Commands

**Files**: `src/commands/voice/*.ts`

#### New/Updated Commands

```bash
# Transcription
clawdbot voice transcribe <file>                    # NEW: Via orchestrator
  --provider whisper                                # NEW: Specify provider
  --preference fast|accurate|cheap                  # NEW: Selection strategy
  --verbose                                         # NEW: Show provider switches

# Synthesis
clawdbot voice synthesize <text>                    # NEW: Via orchestrator
  --provider kokoro                                 # NEW: Specify provider
  --output mp3|wav                                  # NEW: Output format

# Status & Monitoring
clawdbot voice status                               # ENHANCED: More details
  --detailed                                        # NEW: Metrics breakdown
  --json                                            # NEW: JSON output

clawdbot voice metrics                              # NEW: Detailed metrics
  --provider whisper                                # NEW: Per-provider
  --format table|json                               # NEW: Output format

clawdbot voice health-check                         # NEW: Manual health check
  --all                                             # NEW: Check all providers
  --fix                                             # NEW: Attempt recovery

# Configuration
clawdbot voice config                               # NEW: Show config
clawdbot voice config set stt-provider whisper      # NEW: Set primary
clawdbot voice config reset                         # NEW: Reset to defaults
```

#### Implementation Pattern

```typescript
// src/commands/voice/transcribe.ts
import { getVoiceOrchestrator } from '../../main.js'

export async function transcribeCommand(
  filePath: string,
  options: {
    provider?: string
    preference?: 'fast' | 'accurate' | 'cheap'
    output?: 'text' | 'json'
    verbose?: boolean
  }
): Promise<void> {
  const orchestrator = await getVoiceOrchestrator()

  // Load audio (file handling)
  const audioData = await loadAudioFile(filePath)

  // Transcribe via orchestrator
  const result = await orchestrator.transcribe(audioData, {
    providerId: options.provider,
    providerPreference: options.preference,
    trackMetrics: true,
    onProviderSwitch: options.verbose
      ? (from, to) => console.log(`Switched: ${from} → ${to}`)
      : undefined,
  })

  // Output result
  if (options.output === 'json') {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(result.text)
  }
}
```

### Step 5: Add Dashboard API Endpoints

**File**: `src/provider-web.ts` (or new `src/api/voice-api.ts`)

```typescript
// Express/web provider integration
app.get('/api/voice/status', async (req, res) => {
  const orchestrator = await getVoiceOrchestrator()
  const status = await orchestrator.getProviderStatus()
  res.json(status)
})

app.get('/api/voice/metrics/:providerId?', async (req, res) => {
  const orchestrator = await getVoiceOrchestrator()
  const metrics = await orchestrator.getMetrics(req.params.providerId)
  res.json(metrics)
})

app.post('/api/voice/transcribe', async (req, res) => {
  const orchestrator = await getVoiceOrchestrator()
  const result = await orchestrator.transcribe(req.body.audio, req.body.options)
  res.json(result)
})

app.post('/api/voice/synthesize', async (req, res) => {
  const orchestrator = await getVoiceOrchestrator()
  const audio = await orchestrator.synthesize(req.body.text, req.body.options)
  res.send(audio.data)
})

app.post('/api/voice/switch-provider', async (req, res) => {
  const orchestrator = await getVoiceOrchestrator()
  await orchestrator.switchProvider(req.body.type, req.body.providerId)
  res.json({ success: true })
})
```

## Backward Compatibility

### Existing Code Continues to Work

```typescript
// Old code using VoiceProviderRegistry directly
const registry = new VoiceProviderRegistry()
await registry.loadProviders(config)
const provider = await registry.getTranscriber()
const result = await provider.transcribe(audio)

// Still works! No changes needed.
```

### Gradual Adoption

```typescript
// Option A: Keep using registry
const provider = await registry.getTranscriber()
const result = await provider.transcribe(audio)

// Option B: Use orchestrator for enhanced features
const orchestrator = await getVoiceOrchestrator()
const result = await orchestrator.transcribe(audio, {
  allowFallback: true,
  trackMetrics: true,
  onProviderSwitch: (from, to) => console.log(`${from} → ${to}`),
})

// Both work side-by-side during migration
```

## Testing Strategy

### Unit Tests (Phase 1)

```typescript
// orchestrator.test.ts
describe('VoiceOrchestrator', () => {
  // Provider selection tests
  it('should select primary provider', async () => {})
  it('should respect provider priority', async () => {})
  it('should match capabilities', async () => {})

  // Fallback tests
  it('should fallback to next provider on error', async () => {})
  it('should respect fallback chain order', async () => {})
  it('should exhaust fallback chain properly', async () => {})

  // Circuit breaker tests
  it('should open circuit after threshold', async () => {})
  it('should transition to half-open', async () => {})
  it('should close on recovery', async () => {})

  // Metrics tests
  it('should track request latency', async () => {})
  it('should calculate error rates', async () => {})
  it('should aggregate percentiles', async () => {})

  // Health monitor tests
  it('should perform health checks', async () => {})
  it('should detect unhealthy providers', async () => {})
  it('should trigger recovery', async () => {})
})

// health-monitor.test.ts
describe('HealthMonitor', () => {
  // Circuit breaker tests
  // Health check strategy tests
  // Recovery mechanism tests
})

// provider-metrics.test.ts
describe('ProviderMetrics', () => {
  // Metric calculation tests
  // Window management tests
  // Aggregation tests
})
```

### Integration Tests (Phase 2)

```typescript
// orchestrator.integration.test.ts
describe('VoiceOrchestrator Integration', () => {
  it('should transcribe with real audio', async () => {
    // Load actual audio file
    // Transcribe via orchestrator
    // Verify result
  })

  it('should handle provider degradation', async () => {
    // Simulate provider latency increase
    // Verify fallback triggers
    // Verify metrics reflect degradation
  })

  it('should recover from circuit breaker trip', async () => {
    // Simulate provider failure
    // Verify circuit opens
    // Wait for timeout
    // Verify recovery attempt
  })
})

// cli.integration.test.ts
describe('Voice CLI Commands', () => {
  it('should transcribe via CLI', async () => {
    // Run: clawdbot voice transcribe test.wav
    // Verify output
  })

  it('should show provider status', async () => {
    // Run: clawdbot voice status
    // Verify all providers shown
    // Verify metrics displayed
  })

  it('should switch providers', async () => {
    // Run: clawdbot voice config set stt-provider X
    // Verify switch successful
    // Verify new provider used
  })
})
```

### Live Tests (Phase 2-3)

```bash
# Run with real providers
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# Docker-based tests
pnpm test:docker:live-models
```

## Performance Considerations

### Optimization Priorities

```
Priority 1 (Critical)
├── Provider selection latency <10ms
├── Metrics recording <5ms
└── Health check async (non-blocking)

Priority 2 (Important)
├── Avoid memory leaks in metrics window
├── Efficient circuit breaker state transitions
└── Lazy load provider capabilities

Priority 3 (Nice-to-have)
├── Caching of provider capabilities
├── Pre-warm health checks
└── Batch metric exports
```

### Latency Budget

```
Total Operation: 100-5000ms (depends on provider)

Orchestrator Overhead:
├── Provider selection: <10ms (5%)
├── Metrics recording: <5ms (5%)
├── Fallback decision: <50ms (5%)
├── Provider execution: 100-5000ms (85%)
└── Total orchestrator: <65ms (max 10%)
```

## Monitoring & Observability

### Key Metrics to Track

```
Per Provider:
├── requestsTotal
├── requestsSuccessful
├── requestsFailed
├── errorRate
├── averageLatencyMs
├── p95LatencyMs
├── p99LatencyMs
├── circuitBreakerState
└── lastHealthCheck

System-wide:
├── orchestratorStatus (ready/degraded/unavailable)
├── activeProviders
├── failedProviderSwitches
├── totalFallbacksTriggered
└── metricsCollectionOverhead
```

### Logging Configuration

```yaml
# ~/.clawdbot/config.yaml
voice:
  orchestrator:
    logging:
      level: info
      providers: true          # Log transcribe/synthesize
      healthChecks: true       # Log health check results
      fallbacks: true          # Log fallback events
      providerSwitches: true   # Log provider changes
      circuitBreaker: true     # Log circuit breaker changes
      metrics: false           # Log metrics collection (noisy)
```

## Rollout Plan

### Phase 1: Internal Testing (Week 1-2)

```
✓ Implement orchestrator core
✓ Write unit tests
✓ CLI command tests
✓ Run locally with all providers
✓ Performance validation
```

### Phase 2: Limited Rollout (Week 3)

```
□ Deploy to staging environment
□ Run integration tests
□ Monitor health and metrics
□ Gather feedback from QA
□ Document any issues
```

### Phase 3: Dashboard Integration (Week 3)

```
□ Add API endpoints
□ Create React components
□ Dashboard UI testing
□ Real-time metrics display
□ Provider switching UI
```

### Phase 4: Production Rollout (Week 4+)

```
□ Feature flag for orchestrator
□ Gradual rollout (10% → 50% → 100%)
□ Monitor error rates
□ Track performance metrics
□ Collect user feedback
□ Optimize based on findings
```

## Potential Issues & Mitigations

### Issue 1: Health Checks Interfere with Production Traffic

**Mitigation**: Async health checks, configurable intervals, separate thread pool

### Issue 2: Circuit Breaker Too Aggressive

**Mitigation**: Configurable thresholds, manual recovery, grace period

### Issue 3: Metrics Collection Memory Leak

**Mitigation**: Sliding window size limits, periodic cleanup, configurable retention

### Issue 4: Provider Selection Too Slow

**Mitigation**: Cache capabilities, pre-compute weights, lazy evaluation

### Issue 5: Fallback Chain Thrashing

**Mitigation**: Cooldown periods, max switches per operation, learning from history

## Success Criteria

### Functional Success

- [ ] All existing tests pass (backward compatibility)
- [ ] New orchestrator tests pass (>80% coverage)
- [ ] CLI commands work as documented
- [ ] Dashboard integration works
- [ ] Health monitoring detects issues
- [ ] Circuit breaker prevents cascading failures

### Performance Success

- [ ] Orchestrator overhead <10% of total latency
- [ ] Provider selection <10ms
- [ ] Metrics recording <5ms
- [ ] No memory leaks in production
- [ ] Health checks don't impact user operations

### Operational Success

- [ ] Automated monitoring alerts work
- [ ] Metrics exported to dashboard
- [ ] Admin can manually switch providers
- [ ] Fallback chains work as configured
- [ ] Recovery from failures automatic

## Future Enhancements

### Short Term (Post-Launch)

- [ ] Provider-specific optimizations
- [ ] ML-based provider selection
- [ ] Caching for frequent requests
- [ ] Batch operation support

### Medium Term (3-6 months)

- [ ] Multi-region provider selection
- [ ] Cost tracking and optimization
- [ ] Advanced health check strategies
- [ ] Provider capacity prediction

### Long Term (6+ months)

- [ ] Autonomous provider discovery
- [ ] Self-healing systems
- [ ] Predictive failover
- [ ] Global orchestration

## References

### Related Documents

- `ORCHESTRATOR-ARCHITECTURE.md` - Complete architecture design
- `ORCHESTRATOR-INTEGRATION.md` - Integration patterns and examples
- `orchestrator-config.ts` - Configuration schema

### Existing Components

- `registry.ts` - Provider registry (being wrapped)
- `executor.ts` - Provider interface (unchanged)
- `voice.ts` - CLI commands (being enhanced)

### Dependencies

- `zod` - Schema validation (existing)
- `vitest` - Testing framework (existing)
- `@clack/prompts` - CLI prompts (existing)

