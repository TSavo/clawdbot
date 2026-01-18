# Voice Orchestrator - Design Summary

## Overview

This is a comprehensive design for the **Voice Orchestrator/Coordinator**, the central coordination layer for all STT (Speech-to-Text) and TTS (Text-to-Speech) operations in Clawdbot. The orchestrator manages provider lifecycle, intelligent routing, health monitoring, fallback chains, and metrics collection.

## Design Documents Delivered

### 1. ORCHESTRATOR-ARCHITECTURE.md
**Comprehensive technical architecture document** (~2,500 lines)

Contains:
- Complete system architecture with ASCII diagrams
- Component hierarchy and interactions
- File structure and organization
- Core interfaces (VoiceOrchestrator API, OrchestratorOptions, ProviderStatusReport)
- Configuration schema overview
- Configuration loading priority
- Provider selection algorithm with pseudo-code
- Error handling and fallback strategy
- Health monitoring with circuit breaker state machine
- Metrics collection and reporting
- Integration points (CLI, plugins, dashboard)
- Fallback chain visualization
- Usage examples (basic and advanced)
- Backward compatibility strategy
- Testing strategy
- Performance considerations
- Future enhancements
- Deployment checklist

**Key Features**:
- Detailed error classification and fallback decision tree
- Health check strategies (metadata, echo, latency, full round-trip)
- Circuit breaker implementation with state transitions
- Request retry logic with exponential backoff and jitter
- Provider metrics tracking (latency percentiles, error rates, etc.)
- Dashboard integration API endpoints
- React component patterns for provider monitoring
- Fallback chain visualization example

### 2. orchestrator-config.ts
**Zod-based configuration schema** (~400 lines)

Provides:
- **DeploymentMode enum**: docker, system, cloud, hybrid
- **ProviderPreference enum**: fast, accurate, cheap, balanced
- **HealthCheckConfigSchema**: Configurable health check intervals, strategies, thresholds
- **CircuitBreakerConfigSchema**: Failure/success thresholds, backoff configuration
- **MetricsConfigSchema**: History size, aggregation intervals, retention
- **LoggingConfigSchema**: Log level, component-specific logging flags
- **RetryConfigSchema**: Max retries, exponential backoff with jitter
- **DefaultPreferencesSchema**: STT/TTS preferences, local prioritization
- **ProviderRegistryConfigSchema**: Per-provider configuration
- **OrchestratorConfigSchema**: Main configuration with all subsystems
- **OrchestratorRuntimeOptionsSchema**: Runtime options for individual operations

**Utilities**:
- `createDefaultOrchestratorConfig()`: Builder with sensible defaults
- `ConfigurationExamples`: Pre-built configs for:
  - Local development (Docker + System)
  - Production cloud-first with fallback
  - Cost-optimized (all local)
  - High-availability (aggressive health checks)
- `validateOrchestratorConfig()`: Async validation with Zod
- `validateRuntimeOptions()`: Runtime option validation

### 3. ORCHESTRATOR-INTEGRATION.md
**Practical integration patterns and code examples** (~1,800 lines)

Includes:
- **Quick Start**: Initialization and shutdown patterns
- **CLI Integration Patterns**:
  - Pattern 1: Simple transcription command with options
  - Pattern 2: Provider status command with detailed metrics
  - Pattern 3: Configuration management command
  - Each includes full command definition and handler implementation
- **Plugin Integration Pattern**:
  - VoiceProviderPlugin interface
  - Provider registration with orchestrator
  - Health reporting callbacks
  - Example Kokoro TTS plugin implementation
- **Dashboard Integration Pattern**:
  - VoiceController class for React
  - useVoiceController React hook
  - VoiceProviderStatusPanel component with grid layout
- **Voice Channel Integration**:
  - VoiceCallHandler with orchestrator
  - Incoming audio transcription
  - Outgoing voice synthesis
- **Error Handling Best Practices**:
  - Comprehensive error handler wrapper
  - Error classification and logging
  - User-friendly error messages
- **Configuration File Examples**:
  - Local development YAML
  - Production deployment YAML
- **Testing Patterns**:
  - Unit test examples (provider selection, fallback, metrics)
  - Integration test examples
  - CLI command testing
- **Monitoring & Metrics Export**:
  - Metrics export to monitoring service
  - Dashboard polling patterns
  - Telemetry integration

### 4. ORCHESTRATOR-MIGRATION.md
**Implementation strategy and rollout plan** (~1,200 lines)

Details:
- **Executive Summary** with 4-phase timeline
- **Component Architecture**:
  - Existing components (no changes)
  - New orchestrator layer
  - Supporting components (HealthMonitor, ProviderMetrics, FallbackChain)
- **Integration Strategy** with 5 implementation steps:
  1. Create core orchestrator class
  2. Create health monitor
  3. Create metrics collection
  4. Update CLI commands with new/updated commands
  5. Add dashboard API endpoints
- **Backward Compatibility**:
  - Existing code continues working
  - Gradual adoption strategies
- **Testing Strategy**:
  - Unit tests organized by topic
  - Integration tests
  - Live tests with real providers
- **Performance Considerations**:
  - Optimization priorities
  - Latency budget breakdown
- **Monitoring & Observability**:
  - Key metrics to track
  - Logging configuration
- **Rollout Plan**: 4-week plan with phases
- **Potential Issues & Mitigations**: 5 identified risks with solutions
- **Success Criteria**:
  - Functional success (8 criteria)
  - Performance success (5 criteria)
  - Operational success (5 criteria)
- **Future Enhancements**: Short/medium/long term

## File Structure

```
src/media/voice-providers/
├── orchestrator.ts                      [TO BE CREATED]
│   └── VoiceOrchestrator class (~400 lines)
│       ├── constructor(configPath?, deploymentConfig?)
│       ├── initialize()
│       ├── shutdown()
│       ├── transcribe(audio, options?)
│       ├── transcribeStream(stream, options?)
│       ├── synthesize(text, options?)
│       ├── synthesizeStream(stream, options?)
│       ├── getProviderStatus()
│       ├── getMetrics(providerId?)
│       ├── switchProvider(type, providerId)
│       ├── listAvailableProviders(type?)
│       ├── getConfiguration()
│       └── updateConfiguration(config)
│
├── orchestrator-config.ts               [CREATED]
│   ├── Enums (DeploymentMode, ProviderPreference)
│   ├── Schema classes
│   ├── Configuration types
│   ├── createDefaultOrchestratorConfig()
│   ├── ConfigurationExamples (4 presets)
│   └── Validation utilities
│
├── health-monitor.ts                    [TO BE CREATED]
│   └── HealthMonitor class (~300 lines)
│       ├── start(config)
│       ├── stop()
│       ├── performHealthCheck(providerId)
│       ├── getStatus(providerId)
│       └── isHealthy(providerId)
│
├── provider-metrics.ts                  [TO BE CREATED]
│   └── ProviderMetrics class (~250 lines)
│       ├── initialize(config)
│       ├── recordRequest(providerId, record)
│       ├── getMetrics(providerId?)
│       ├── recalculateMetrics(providerId)
│       └── exportMetrics()
│
├── fallback-chain.ts                    [TO BE CREATED]
│   └── FallbackChain class (~200 lines)
│       ├── selectProvider(type, options)
│       ├── executeWithFallback(operation, options)
│       ├── isProviderAvailable(provider)
│       └── recordFallback(provider, error)
│
├── registry.ts                          [ENHANCED - EXISTING]
│   └── Update to work with orchestrator
│
├── executor.ts                          [NO CHANGES - EXISTING]
│
├── ORCHESTRATOR-ARCHITECTURE.md         [CREATED - 2,500 lines]
├── orchestrator-config.ts               [CREATED - 400 lines]
├── ORCHESTRATOR-INTEGRATION.md          [CREATED - 1,800 lines]
├── ORCHESTRATOR-MIGRATION.md            [CREATED - 1,200 lines]
└── ORCHESTRATOR-SUMMARY.md              [CREATED - THIS FILE]
```

## Key Design Decisions

### 1. Provider Registry vs Orchestrator

| Aspect | Registry | Orchestrator |
|--------|----------|--------------|
| Purpose | Static provider registration | Runtime selection & coordination |
| Lifecycle | Load providers once | Monitor continuously |
| Selection | Basic (first available) | Intelligent (priority, health, load) |
| Errors | No fallback | Automatic fallback chain |
| Monitoring | None | Health checks + metrics |
| Wrapping | N/A | Wraps registry |

**Decision**: Orchestrator wraps registry, preserving backward compatibility while adding advanced features.

### 2. Configuration Source Priority

```
1. Default values (built-in)
   ↓
2. deployment-config.json (deployment preset)
   ↓
3. ~/.clawdbot/config.yaml (user config)
   ↓
4. Environment variables (CLAWDBOT_VOICE_* prefix)
   ↓
5. Runtime API calls (dynamic updates)
   ↓
Final Configuration
```

**Decision**: Multi-source loading with clear priority, enabling deployment flexibility and runtime optimization.

### 3. Health Monitoring Strategy

| Strategy | Cost | Coverage | Use When |
|----------|------|----------|----------|
| Metadata | <1ms | Low | First check |
| Echo | 10-100ms | Medium | Regular check |
| Latency | 100-500ms | High | Detailed check |
| Full | 500ms+ | Very High | Diagnostic |

**Decision**: Use layered strategies (metadata + echo by default), optional latency/full for high-availability.

### 4. Circuit Breaker Configuration

| Phase | Feature | Default |
|-------|---------|---------|
| CLOSED | Normal operation | Fail after 5 failures |
| OPEN | All requests fail | Try again after 30s |
| HALF-OPEN | Test single request | Close if 2 succeed |

**Decision**: Standard circuit breaker pattern with exponential backoff for production reliability.

### 5. Fallback Chain Length

**Decision**: Keep chain short (3-5 providers max) to:
- Limit fallback latency (each provider adds time)
- Avoid exhausting all options during temporary issues
- Force clear separation between primary and backup

### 6. Error Handling

| Error Type | Action | Fallback? |
|------------|--------|-----------|
| TIMEOUT | Retry, then fallback | Yes |
| PROVIDER_ERROR | Record failure | Yes |
| UNSUPPORTED_FORMAT | Fail fast | No |
| RATE_LIMITED | Exponential backoff | Yes |
| CIRCUIT_BREAKER_OPEN | Skip provider | Yes |

**Decision**: Automatic fallback for transient errors, fail-fast for permanent issues.

## API Summary

### Main Interface: VoiceOrchestrator

```typescript
class VoiceOrchestrator {
  // Initialization
  constructor(configPath?: string)
  async initialize(): Promise<void>
  async shutdown(): Promise<void>

  // STT (Speech-to-Text)
  async transcribe(audio: AudioBuffer, options?: OrchestratorOptions): Promise<TranscriptionResult>
  async transcribeStream(stream: ReadableStream<AudioBuffer>, options?: OrchestratorOptions): AsyncIterable<TranscriptionChunk>

  // TTS (Text-to-Speech)
  async synthesize(text: string, options?: SynthesisOptions & OrchestratorOptions): Promise<AudioBuffer>
  async synthesizeStream(stream: ReadableStream<string>, options?: SynthesisOptions & OrchestratorOptions): AsyncIterable<AudioBuffer>

  // Management
  async getProviderStatus(): Promise<ProviderStatusReport>
  async getMetrics(providerId?: string): Promise<ProviderMetrics>
  async switchProvider(type: 'stt' | 'tts', providerId: string): Promise<void>
  async listAvailableProviders(type?: 'stt' | 'tts'): Promise<ProviderInfo[]>
  async getPrimaryProvider(type: 'stt' | 'tts'): Promise<ProviderInfo>
  async getConfiguration(): Promise<OrchestratorConfig>
  async updateConfiguration(config: Partial<OrchestratorConfig>): Promise<void>
}
```

### Runtime Options

```typescript
interface OrchestratorRuntimeOptions {
  providerId?: string                    // Explicit provider
  providerPreference?: 'fast' | 'accurate' | 'cheap' | 'balanced'
  allowFallback?: boolean
  fallbackTimeoutMs?: number
  timeoutMs?: number
  maxRetries?: number
  trackMetrics?: boolean
  onProviderSwitch?: (from: string, to: string) => void
  onFallback?: (provider: string, error: Error) => void
  onHealthUpdate?: (providerId: string, status: ProviderStatus) => void
}
```

## CLI Commands

```bash
# Status & Info
clawdbot voice status [--detailed] [--json]
clawdbot voice providers [--type stt|tts]
clawdbot voice metrics [--provider <id>] [--format table|json]
clawdbot voice health-check [--all] [--fix]

# Operations
clawdbot voice transcribe <file> [--provider <id>] [--preference fast|accurate|cheap]
clawdbot voice synthesize <text> [--provider <id>] [--output mp3|wav]

# Configuration
clawdbot voice config [show|set|reset] [key] [value]
```

## Dashboard API Endpoints

```
GET    /api/voice/status                 # Orchestrator status
GET    /api/voice/providers              # List providers
GET    /api/voice/metrics                # All metrics
GET    /api/voice/metrics/:providerId    # Per-provider metrics
POST   /api/voice/transcribe             # Transcribe via API
POST   /api/voice/synthesize             # Synthesize via API
POST   /api/voice/switch-provider        # Switch provider
```

## Performance Targets

```
Operation                       Target              Notes
────────────────────────────────────────────────────────
Provider selection              <10ms               5% of total
Metrics recording              <5ms                5% of total
Transcribe (audio)             100-5000ms          85% (provider-dependent)
Synthesize (text)              100-3000ms          85% (provider-dependent)
Fallback decision              <50ms               5% of total
Health check                   <5s (async)         Non-blocking
Circuit breaker overhead       <1ms                Negligible

Memory Usage:
  Orchestrator instance        ~10-20MB            Cached configs + metrics
  Metrics window (1000 items)  ~5MB                Sliding window
  Health monitor               ~2MB                Per-provider state
```

## Testing Coverage

```
Unit Tests (orchestrator.test.ts):
├── Provider selection (5+ tests)
├── Fallback chain (5+ tests)
├── Circuit breaker (5+ tests)
├── Metrics collection (5+ tests)
├── Health monitoring (5+ tests)
├── Error handling (5+ tests)
└── Configuration (5+ tests)

Integration Tests (orchestrator.integration.test.ts):
├── Real audio transcription
├── Real text synthesis
├── Provider degradation handling
├── Circuit breaker recovery
├── Fallback chain execution
├── Metrics accuracy
└── Health check accuracy

CLI Tests:
├── voice transcribe
├── voice synthesize
├── voice status
├── voice config
└── voice metrics

Target Coverage: >80% lines, >75% branches
```

## Configuration Examples

### Local Development
```yaml
deploymentMode: docker
sttFallbackChain: [faster-whisper-docker]
ttsFallbackChain: [kokoro-system]
```

### Production
```yaml
deploymentMode: hybrid
sttFallbackChain: [openai-whisper, faster-whisper-system]
ttsFallbackChain: [elevenlabs-api, kokoro-system]
defaultPreferences:
  sttPreference: accurate
  ttsPreference: natural
```

### Cost-Optimized
```yaml
deploymentMode: system
sttFallbackChain: [faster-whisper-system]
ttsFallbackChain: [kokoro-system]
defaultPreferences:
  sttPreference: cheap
  ttsPreference: balanced
```

### High-Availability
```yaml
healthCheck:
  intervalMs: 30000
  strategies: {metadata: true, echo: true, latency: true}
circuitBreaker:
  failureThreshold: 3
  timeoutMs: 15000
```

## Backward Compatibility

- Existing `VoiceProviderRegistry` code works unchanged
- Existing provider implementations (Whisper, Faster-Whisper, Kokoro) work unchanged
- New orchestrator wraps registry, doesn't replace it
- Gradual adoption: use registry directly or switch to orchestrator
- No breaking changes to existing APIs

## Future Extensions

### Phase 2: Enhancements
- Multi-region provider selection
- Cost-based routing
- Caching for frequent requests
- Batch operations

### Phase 3: Advanced
- ML-based provider selection
- Predictive failover
- Autonomous provider discovery
- Global orchestration

### Phase 4: Intelligence
- Self-healing systems
- Capacity prediction
- Dynamic threshold adjustment
- Provider learning

## How to Use This Design

### For Implementation
1. Start with `orchestrator-config.ts` (schema definitions)
2. Implement `orchestrator.ts` (main class) following architecture doc
3. Implement `health-monitor.ts` (circuit breaker + health checks)
4. Implement `provider-metrics.ts` (metrics collection)
5. Implement `fallback-chain.ts` (fallback logic)
6. Update CLI commands using integration patterns
7. Add dashboard API endpoints
8. Write tests using testing patterns

### For Integration
- Reference `ORCHESTRATOR-INTEGRATION.md` for code examples
- Follow patterns for CLI, plugins, dashboard, voice channels
- Use configuration examples as templates

### For Deployment
- Follow rollout plan in `ORCHESTRATOR-MIGRATION.md`
- Monitor health and metrics endpoints
- Adjust configuration based on production data
- Use CLI commands for operational tasks

## File Locations

| Document | Location |
|----------|----------|
| Architecture | `/home/tsavo/clawd/clawdbot/src/media/voice-providers/ORCHESTRATOR-ARCHITECTURE.md` |
| Config Schema | `/home/tsavo/clawd/clawdbot/src/media/voice-providers/orchestrator-config.ts` |
| Integration | `/home/tsavo/clawd/clawdbot/src/media/voice-providers/ORCHESTRATOR-INTEGRATION.md` |
| Migration | `/home/tsavo/clawd/clawdbot/src/media/voice-providers/ORCHESTRATOR-MIGRATION.md` |
| This Summary | `/home/tsavo/clawd/clawdbot/src/media/voice-providers/ORCHESTRATOR-SUMMARY.md` |

## Next Steps

1. **Review Design**: Get stakeholder feedback on architecture
2. **Refine Schema**: Adjust configuration schema based on feedback
3. **Create Prototype**: Implement core orchestrator class
4. **Write Tests**: Unit tests for orchestrator components
5. **Integration**: Add CLI commands and dashboard endpoints
6. **Validation**: Integration tests with real providers
7. **Documentation**: Update user-facing docs
8. **Rollout**: Follow 4-week rollout plan

## Summary

The Voice Orchestrator is a comprehensive, production-ready coordination layer for voice operations. It provides:

- **Intelligent provider selection** based on capabilities, health, and preferences
- **Automatic fallback chains** with circuit breaker pattern
- **Health monitoring** with configurable strategies
- **Metrics collection** with latency percentiles and error rates
- **Unified APIs** for STT and TTS operations
- **Full backward compatibility** with existing code
- **Clear integration points** for CLI, plugins, and dashboard
- **Extensible architecture** for future providers and strategies

The design prioritizes:
- **Reliability**: Multiple providers, automatic fallback, health monitoring
- **Performance**: Minimal orchestrator overhead, efficient metrics
- **Flexibility**: Multiple deployment modes, configurable strategies
- **Simplicity**: Clean APIs, sensible defaults, easy integration
- **Observability**: Rich metrics, detailed logging, dashboard integration

