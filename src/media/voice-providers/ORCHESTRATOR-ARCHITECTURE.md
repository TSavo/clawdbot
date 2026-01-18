# Voice Orchestrator Architecture

## Overview

The Voice Orchestrator is the central coordination layer for all STT (Speech-to-Text) and TTS (Text-to-Speech) operations in Clawdbot. It manages provider lifecycle, health monitoring, intelligent fallback chains, and presents a unified interface to CLI commands, plugins, and dashboard components.

### Key Responsibilities

- **Provider Lifecycle Management**: Initialize, configure, monitor, and shutdown providers
- **Intelligent Provider Selection**: Route requests to best available provider based on capabilities and health
- **Error Handling & Fallback**: Automatic fallback to next provider on failure with circuit breaker pattern
- **Health Monitoring**: Continuous health checks with configurable intervals and recovery strategies
- **Unified Interfaces**: Single API for both STT and TTS operations across all providers
- **Performance Metrics**: Track latency, error rates, and usage statistics per provider
- **Configuration Management**: Load from deployment config, environment overrides, and runtime updates

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                       Orchestrator Layer                         │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │            VoiceOrchestrator (Main Entry Point)            │ │
│  │  - transcribe(audio, options?)                             │ │
│  │  - synthesize(text, options?)                              │ │
│  │  - transcribeStream(stream, options?)                      │ │
│  │  - synthesizeStream(stream, options?)                      │ │
│  │  - getProviderStatus()                                     │ │
│  │  - getMetrics()                                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│           ↓                                    ↓                  │
│  ┌─────────────────────┐          ┌───────────────────────────┐ │
│  │  Health Monitor     │          │   Provider Registry       │ │
│  │                     │          │                           │ │
│  │  - health checks    │          │  - tracks providers      │ │
│  │  - circuit breaker  │          │  - capabilities          │ │
│  │  - retry logic      │          │  - metrics               │ │
│  └─────────────────────┘          └───────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
              ↓              ↓              ↓              ↓
    ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
    │  Whisper    │ │   Faster-    │ │   Kokoro     │ │  ElevenLabs  │
    │  (STT)      │ │   Whisper    │ │   (TTS)      │ │  (TTS)       │
    │             │ │   (STT)      │ │              │ │              │
    │ ┌─────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │ │ ┌──────────┐ │
    │ │Executor │ │ │ │Executor  │ │ │ │Executor  │ │ │ │Executor  │ │
    │ └─────────┘ │ │ └──────────┘ │ │ └──────────┘ │ │ └──────────┘ │
    └─────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
           ↓              ↓              ↓              ↓
    ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌──────────────┐
    │ System/  │  │ Docker or  │  │ System   │  │  Cloud API   │
    │ Cloud    │  │ System     │  │ Service  │  │              │
    └──────────┘  └────────────┘  └──────────┘  └──────────────┘
```

## Component Hierarchy

```
VoiceOrchestrator
├── ConfigManager
│   ├── Load deployment-config.json
│   ├── Load ~/.clawdbot/config.yaml
│   ├── Apply environment overrides
│   └── Validate configuration
│
├── ProviderRegistry (enhanced from existing registry.ts)
│   ├── Load providers by priority
│   ├── Track capabilities
│   ├── Manage lifecycle
│   └── Report metrics
│
├── HealthMonitor
│   ├── Periodic health checks
│   ├── Circuit breaker per provider
│   ├── Exponential backoff
│   └── Recovery strategy
│
├── LoadBalancer
│   ├── Select provider by criteria
│   ├── Apply weights/preferences
│   ├── Track usage statistics
│   └── Handle provider switching
│
└── FallbackChain
    ├── STT chain (ordered by priority)
    ├── TTS chain (ordered by priority)
    ├── Error-based switching
    └── Circuit breaker recovery
```

## File Structure

```
src/media/voice-providers/
├── orchestrator.ts                 # Main VoiceOrchestrator class
├── orchestrator-config.ts          # Configuration schemas & types
├── orchestrator.test.ts            # Unit tests
├── health-monitor.ts               # Health checking & circuit breaker
├── provider-metrics.ts             # Metrics collection & reporting
├── fallback-chain.ts               # Fallback chain management
│
├── registry.ts                     # Enhanced ProviderRegistry
├── executor.ts                     # Provider interface (existing)
│
├── whisper.ts                      # Whisper implementation
├── faster-whisper.ts               # Faster-Whisper implementation
├── kokoro.ts                       # Kokoro implementation
├── [future-providers].ts           # Other providers
│
├── deployment-handlers.ts          # Docker/System deployment
└── [documentation files]
```

## Core Interfaces

### VoiceOrchestrator API

```typescript
class VoiceOrchestrator {
  // Initialization
  constructor(configPath?: string, deploymentConfig?: DeploymentConfig)
  async initialize(): Promise<void>
  async shutdown(): Promise<void>

  // STT Operations (Speech-to-Text)
  async transcribe(
    audio: AudioBuffer,
    options?: TranscribeOptions & OrchestratorOptions
  ): Promise<TranscriptionResult>

  async transcribeStream(
    audioStream: ReadableStream<AudioBuffer>,
    options?: TranscribeOptions & OrchestratorOptions
  ): AsyncIterable<TranscriptionChunk>

  // TTS Operations (Text-to-Speech)
  async synthesize(
    text: string,
    options?: SynthesisOptions & OrchestratorOptions
  ): Promise<AudioBuffer>

  async synthesizeStream(
    textStream: ReadableStream<string>,
    options?: SynthesisOptions & OrchestratorOptions
  ): AsyncIterable<AudioBuffer>

  // Provider Management
  async getProviderStatus(): Promise<ProviderStatusReport>
  async getMetrics(providerId?: string): Promise<ProviderMetrics>
  async switchProvider(
    type: 'stt' | 'tts',
    providerId: string
  ): Promise<void>
  async getPrimaryProvider(type: 'stt' | 'tts'): Promise<ProviderInfo>
  async listAvailableProviders(type?: 'stt' | 'tts'): Promise<ProviderInfo[]>

  // Configuration
  async updateConfiguration(config: Partial<OrchestratorConfig>): Promise<void>
  async getConfiguration(): Promise<OrchestratorConfig>
}
```

### OrchestratorOptions

```typescript
interface OrchestratorOptions {
  // Provider selection
  providerId?: string                    // Use specific provider
  providerPreference?: 'fast' | 'accurate' | 'cheap'
  allowFallback?: boolean               // Default: true
  fallbackTimeout?: number              // ms before fallback

  // Timeout & retry
  timeout?: number                      // Overall operation timeout
  maxRetries?: number                   // Default: 2
  retryBackoffMs?: number               // Default: 100

  // Metrics & reporting
  trackMetrics?: boolean                // Default: true
  onProviderSwitch?: (from: string, to: string) => void
  onFallback?: (provider: string, error: Error) => void

  // Streaming
  chunkSize?: number                    // For batch operations
  flushInterval?: number                // ms for streaming
}
```

### ProviderStatusReport

```typescript
interface ProviderStatusReport {
  timestamp: number
  orchestratorStatus: 'ready' | 'degraded' | 'unavailable'
  sttProviders: ProviderStatus[]
  ttsProviders: ProviderStatus[]
  fallbackChains: {
    stt: string[]  // Ordered provider IDs
    tts: string[]
  }
}

interface ProviderStatus {
  id: string
  type: 'stt' | 'tts'
  state: 'healthy' | 'degraded' | 'unhealthy'
  healthCheckAt: number
  capabilities: ProviderCapabilities
  circuitBreaker: {
    state: 'closed' | 'open' | 'half-open'
    failureCount: number
    lastFailureAt?: number
    nextRetryAt?: number
  }
  metrics: ProviderMetrics
}

interface ProviderMetrics {
  requestsTotal: number
  requestsSuccessful: number
  requestsFailed: number
  requestsSkipped: number  // Circuit breaker
  averageLatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  errorRate: number        // 0-1
  lastSuccessAt?: number
  lastErrorAt?: number
  lastError?: string
}
```

## Configuration Schema

### orchestrator-config.ts

```typescript
// Main orchestrator configuration
interface OrchestratorConfig {
  enabled: boolean
  deploymentMode: 'docker' | 'system' | 'cloud' | 'hybrid'
  providers: ProviderConfig[]
  sttFallbackChain: string[]     // Provider IDs in order
  ttsFallbackChain: string[]
  defaultPreferences: {
    sttPreference?: 'fast' | 'accurate' | 'cheap'
    ttsPreference?: 'fast' | 'accurate' | 'natural'
  }
  healthCheck: HealthCheckConfig
  circuitBreaker: CircuitBreakerConfig
  metrics: MetricsConfig
  logging: LoggingConfig
}

interface HealthCheckConfig {
  enabled: boolean
  intervalMs: number              // Default: 60000 (1 min)
  initialDelayMs: number          // Default: 5000
  timeoutMs: number               // Default: 5000
  unhealthyThreshold: number      // Failures before unhealthy
  strategies: {
    echo?: boolean                // Send test audio
    metadata?: boolean            // Check capabilities
    latency?: boolean            // Measure latency
  }
}

interface CircuitBreakerConfig {
  enabled: boolean
  failureThreshold: number        // Failures to open (default: 5)
  successThreshold: number        // Successes to close (default: 2)
  timeoutMs: number              // Half-open timeout (default: 30000)
  backoffMultiplier: number      // Exponential backoff (default: 2)
  maxBackoffMs: number           // Max backoff (default: 300000)
}

interface MetricsConfig {
  enabled: boolean
  historySize: number            // Keep last N requests
  aggregationIntervalMs: number  // Percentile recalc interval
  exportInterval?: number        // Export to dashboard
  retentionDays?: number
}

interface LoggingConfig {
  level: 'trace' | 'debug' | 'info' | 'warn' | 'error'
  providers: boolean             // Log provider operations
  healthChecks: boolean
  fallbacks: boolean
  metrics: boolean
  providerSwitches: boolean
}

// Per-provider priority & preferences
interface ProviderConfig {
  id: string
  priority: number               // Lower = higher priority
  enabled: boolean
  type: 'stt' | 'tts' | 'both'
  // ... provider-specific config from existing schema
}
```

## Configuration Loading Priority

```
1. Default values (built-in)
   ↓
2. deployment-config.json (from deployment)
   ↓
3. ~/.clawdbot/config.yaml (user config)
   ↓
4. Environment variables (CLAWDBOT_VOICE_* prefix)
   ↓
5. Runtime updates (API calls)
   ↓
Final Configuration
```

## Provider Selection Algorithm

### Selection Criteria (in order)

```
1. Provider Availability
   - Is provider initialized?
   - Circuit breaker state (not open)
   - Health check passed

2. Provider Capability Match
   - Audio format support
   - Language support
   - Streaming capability (if needed)
   - Sample rate compatibility

3. Preferences
   - providerId (explicit override)
   - providerPreference (fast/accurate/cheap)
   - Priority weight (from config)
   - Recent success rate

4. Load Distribution
   - Current request load per provider
   - Concurrent session limit
   - Geographic preference (if applicable)

5. Fallback Chain
   - Use next provider on failure
   - Apply exponential backoff
   - Circuit breaker prevents cascading failures
```

### Pseudo-code

```typescript
async selectProvider(
  type: 'stt' | 'tts',
  options: OrchestratorOptions
): Promise<VoiceProviderExecutor> {
  // 1. Explicit provider requested
  if (options.providerId) {
    const provider = this.registry.getProvider(options.providerId)
    if (provider && await this.isProviderAvailable(provider))
      return provider
    throw new VoiceProviderError(`Provider ${options.providerId} not available`)
  }

  // 2. Get fallback chain for type (stt/tts)
  const chain = this.config.fallbackChain(type)

  // 3. Iterate through chain
  for (const providerId of chain) {
    const provider = this.registry.getProvider(providerId)

    // Check availability
    if (!provider || !await this.isProviderAvailable(provider))
      continue

    // Check capability match
    if (!this.matchesCapabilities(provider, options))
      continue

    // Check load
    if (this.exceeds ConcurrentLimit(provider))
      continue

    return provider
  }

  // No provider available
  throw new VoiceProviderError(
    `No ${type.toUpperCase()} provider available in fallback chain`,
    'orchestrator'
  )
}

async isProviderAvailable(provider): Promise<boolean> {
  // Check circuit breaker
  if (this.circuitBreaker.isOpen(provider.id))
    return false

  // Check health (if recent)
  const health = this.healthMonitor.getLastStatus(provider.id)
  if (health && !health.healthy)
    return false

  // Assume available
  return true
}
```

## Error Handling & Fallback Strategy

### Error Classification

```
ErrorType                  Action              Fallback?
────────────────────────────────────────────────────────
PROVIDER_INIT_ERROR       Disable provider    Yes
PROVIDER_UNAVAILABLE      Log warning         Yes
PROVIDER_TIMEOUT          Retry, then fallback Yes
UNSUPPORTED_FORMAT        Fail fast           No
INVALID_INPUT             Fail fast           No
NETWORK_ERROR             Retry, then fallback Yes
RATE_LIMITED              Exponential backoff  Yes
RESOURCE_EXHAUSTED        Backoff            Yes
UNKNOWN_ERROR             Retry once, fallback Yes
```

### Fallback Decision Tree

```
Request Received
    ↓
Select Primary Provider
    ↓
[Attempt Operation]
    ├─ Success → Return result
    ├─ Timeout → Retry logic
    ├─ Circuit Breaker Open → Skip to next
    ├─ Provider Error → Record failure
    └─ Unknown Error → Record failure
    ↓
Error Threshold Met?
    ├─ No → Retry on same provider
    └─ Yes → Fallback to next provider
    ↓
Next Provider Available?
    ├─ Yes → Attempt with next provider
    └─ No → Check if half-open in recovery
    ↓
Exhausted Fallback Chain?
    ├─ Yes → Throw VoiceProviderError
    └─ No → Continue to next in chain
    ↓
Success from Fallback
    ├─ Record recovery
    ├─ Emit onFallback callback
    ├─ Update metrics
    └─ Return result
```

### Retry Logic

```typescript
interface RetryConfig {
  maxRetries: number                    // Default: 2
  backoffMs: number                     // Initial: 100ms
  backoffMultiplier: number             // Default: 2
  maxBackoffMs: number                  // Default: 5000
  jitterFactor: number                  // Default: 0.1
}

async executeWithRetry(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error

      if (attempt < config.maxRetries) {
        // Calculate backoff with jitter
        const backoff = Math.min(
          config.backoffMs * Math.pow(config.backoffMultiplier, attempt),
          config.maxBackoffMs
        )
        const jitter = backoff * (0.5 + Math.random() * config.jitterFactor)

        await sleep(backoff + jitter)
      }
    }
  }

  throw lastError
}
```

## Health Monitoring

### Health Check Strategies

```typescript
interface HealthCheckStrategy {
  name: string
  intervalMs: number
  timeoutMs: number
  test: (provider: VoiceProviderExecutor) => Promise<boolean>
}

// Built-in strategies
const strategies = {
  metadata: async (provider) => {
    // Quick: Just check getCapabilities()
    try {
      provider.getCapabilities()
      return true
    } catch {
      return false
    }
  },

  echo: async (provider) => {
    // Moderate: Send small audio, get text back
    if (provider.type !== 'stt') return true
    try {
      const testAudio = generateToneAudio(1000, 100)  // 1kHz, 100ms
      const result = await provider.transcribe(testAudio, {
        timeout: 5000
      })
      return result.text.length >= 0  // Just needs to complete
    } catch {
      return false
    }
  },

  latency: async (provider) => {
    // Comprehensive: Measure latency, flag if degraded
    const start = Date.now()
    try {
      await provider.isHealthy()
      const latency = Date.now() - start
      return latency < 5000  // Threshold configurable
    } catch {
      return false
    }
  }
}
```

### Circuit Breaker State Machine

```
                       ┌─────────────┐
                       │   CLOSED    │ (Normal operation)
                       └──────┬──────┘
                              │
                    Failure threshold met
                              │
                       ┌──────▼──────┐
                       │    OPEN     │ (All requests fail)
                       └──────┬──────┘
                              │
                    Timeout elapsed
                              │
                    ┌──────────▼──────────┐
                    │   HALF-OPEN        │ (Test single request)
                    └─┬──────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
    Success            Error/Timeout
          │                       │
    ┌─────▼────┐          ┌─────▼────┐
    │  CLOSED   │          │  OPEN    │
    └──────────┘          └──────────┘
```

### Health Monitor Implementation

```typescript
class HealthMonitor {
  private circuitBreakers: Map<string, CircuitBreaker>
  private healthChecks: Map<string, HealthCheckTask>
  private lastStatus: Map<string, ProviderStatus>

  async startHealthChecks(): Promise<void> {
    for (const provider of this.providers) {
      this.scheduleHealthCheck(provider.id)
    }
  }

  async performHealthCheck(providerId: string): Promise<ProviderStatus> {
    const provider = this.registry.getProvider(providerId)
    const cb = this.circuitBreakers.get(providerId)

    try {
      // Run selected strategy with timeout
      const strategies = this.config.healthCheck.strategies
      let isHealthy = true

      if (strategies.metadata) {
        isHealthy = await this.checkMetadata(provider)
      }

      if (strategies.echo && isHealthy) {
        isHealthy = await this.checkEcho(provider)
      }

      if (strategies.latency && isHealthy) {
        isHealthy = await this.checkLatency(provider)
      }

      if (isHealthy) {
        cb.recordSuccess()
      } else {
        cb.recordFailure()
      }

      const status: ProviderStatus = {
        id: providerId,
        state: cb.isClosed() ? 'healthy' : 'unhealthy',
        circuitBreaker: cb.getState(),
        // ... metrics
      }

      this.lastStatus.set(providerId, status)
      return status
    } catch (error) {
      cb.recordFailure()
      // Return unhealthy status
    }
  }

  getLastStatus(providerId: string): ProviderStatus | undefined {
    return this.lastStatus.get(providerId)
  }

  isProviderHealthy(providerId: string): boolean {
    const status = this.lastStatus.get(providerId)
    return status?.state === 'healthy'
  }
}
```

## Metrics Collection & Reporting

### Metrics Tracked Per Provider

```typescript
interface ProviderMetrics {
  // Counters
  requestsTotal: number
  requestsSuccessful: number
  requestsFailed: number
  requestsRetried: number
  requestsSkipped: number      // Circuit breaker
  fallbacksTriggered: number

  // Latency (in milliseconds)
  latencyMin: number
  latencyMax: number
  latencyAverage: number
  latencyP50: number
  latencyP95: number
  latencyP99: number

  // Errors
  errorCounts: Map<string, number>  // By error type
  lastError?: {
    type: string
    message: string
    timestamp: number
  }

  // Availability
  uptime: number                     // Percentage
  lastHealthCheck: number            // Timestamp
  lastSuccessAt?: number
  lastFailureAt?: number

  // Circuit Breaker
  circuitBreakerTrips: number
  circuitBreakerRecoveries: number

  // Resource usage (if applicable)
  memoryUsageMb?: number
  cpuUsagePercent?: number
}
```

### Metrics Aggregation

```typescript
class ProviderMetrics {
  private historyWindow: RequestRecord[]  // Last N requests
  private aggregatedMetrics: ProviderMetrics

  recordRequest(record: RequestRecord): void {
    this.historyWindow.push(record)
    if (this.historyWindow.length > this.maxHistorySize) {
      this.historyWindow.shift()
    }
    this.recalculateAggregates()
  }

  private recalculateAggregates(): void {
    const latencies = this.historyWindow.map(r => r.latencyMs)
    latencies.sort((a, b) => a - b)

    this.aggregatedMetrics = {
      requestsTotal: this.historyWindow.length,
      requestsSuccessful: this.historyWindow.filter(r => r.success).length,
      requestsFailed: this.historyWindow.filter(r => !r.success).length,
      latencyMin: Math.min(...latencies),
      latencyMax: Math.max(...latencies),
      latencyAverage: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      latencyP95: latencies[Math.floor(latencies.length * 0.95)],
      latencyP99: latencies[Math.floor(latencies.length * 0.99)],
      errorRate: this.aggregatedMetrics.requestsFailed / this.aggregatedMetrics.requestsTotal,
      // ... other calculations
    }
  }

  getMetrics(): ProviderMetrics {
    return this.aggregatedMetrics
  }

  exportMetrics(): MetricsSnapshot {
    // For dashboard export
    return {
      timestamp: Date.now(),
      metrics: this.aggregatedMetrics,
      history: this.historyWindow.slice(-100),  // Last 100 requests
    }
  }
}
```

## Integration Points

### CLI Integration

#### Commands

```bash
# Status & info
clawdbot voice status                          # Show all providers status
clawdbot voice status --detailed               # Include metrics
clawdbot voice providers                       # List available providers
clawdbot voice providers --type stt            # Filter by type

# Operations
clawdbot voice transcribe <audio-file>         # Transcribe
clawdbot voice transcribe <audio-file> --provider whisper
clawdbot voice synthesize <text>               # Synthesize
clawdbot voice synthesize <text> --provider kokoro

# Configuration
clawdbot voice config                          # Show current config
clawdbot voice config --set stt-provider faster-whisper
clawdbot voice config --set tts-provider kokoro
clawdbot voice config --reset                  # Reset to defaults

# Health & diagnostics
clawdbot voice health-check                    # Run manual health check
clawdbot voice health-check --all              # Check all providers
clawdbot voice metrics                         # Show metrics
clawdbot voice metrics --provider whisper      # Per-provider metrics
```

#### Implementation Pattern

```typescript
// src/commands/voice/transcribe.ts
export async function transcribeCommand(
  filePath: string,
  options: {
    provider?: string
    preference?: 'fast' | 'accurate' | 'cheap'
    output?: 'text' | 'json'
  }
): Promise<void> {
  const orchestrator = VoiceOrchestrator.getInstance()
  const audio = await loadAudioFile(filePath)

  const result = await orchestrator.transcribe(audio, {
    providerId: options.provider,
    providerPreference: options.preference,
    trackMetrics: true,
  })

  if (options.output === 'json') {
    console.log(JSON.stringify(result, null, 2))
  } else {
    console.log(result.text)
  }
}

// src/commands/voice/status.ts
export async function statusCommand(
  options: { detailed?: boolean }
): Promise<void> {
  const orchestrator = VoiceOrchestrator.getInstance()
  const status = await orchestrator.getProviderStatus()

  // Format and display status report
  displayStatusReport(status, options.detailed)
}
```

### Plugin Integration

#### Provider Registration

```typescript
// Plugin setup
interface VoiceProviderPlugin {
  id: string
  name: string
  version: string

  // Register provider with orchestrator
  register(orchestrator: VoiceOrchestrator): Promise<void>

  // Lifecycle callbacks
  onHealthCheck?(): Promise<boolean>
  onLoad?(): Promise<void>
  onUnload?(): Promise<void>

  // Health reporting
  reportHealth?(details: HealthCheckDetails): Promise<ProviderStatus>
}

// Example plugin registration
class KokoroTTSPlugin implements VoiceProviderPlugin {
  async register(orchestrator: VoiceOrchestrator): Promise<void> {
    // Load configuration
    const config = await orchestrator.getConfiguration()

    // Create executor
    const executor = new KokoroExecutor(config.providers.kokoro)
    await executor.initialize()

    // Register with orchestrator
    orchestrator.registerProvider('kokoro-tts', executor, {
      type: 'tts',
      priority: 2,
      capabilities: executor.getCapabilities(),
    })

    // Set up health reporting
    orchestrator.healthMonitor.registerStrategy('kokoro', async () => {
      return await this.reportHealth()
    })
  }

  async reportHealth(): Promise<boolean> {
    // Custom health check logic
    return true
  }
}
```

### Dashboard Integration

#### API Endpoints

```typescript
// Express/web provider integration
app.get('/api/voice/status', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const status = await orchestrator.getProviderStatus()
  res.json(status)
})

app.get('/api/voice/metrics/:providerId?', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const metrics = await orchestrator.getMetrics(req.params.providerId)
  res.json(metrics)
})

app.get('/api/voice/providers', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const type = req.query.type as 'stt' | 'tts' | undefined
  const providers = await orchestrator.listAvailableProviders(type)
  res.json(providers)
})

app.post('/api/voice/transcribe', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const { audio, options } = req.body
  try {
    const result = await orchestrator.transcribe(audio, options)
    res.json(result)
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/voice/synthesize', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const { text, options } = req.body
  try {
    const audio = await orchestrator.synthesize(text, options)
    res.send(audio.data)  // Return audio buffer
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})

app.post('/api/voice/switch-provider', async (req, res) => {
  const orchestrator = VoiceOrchestrator.getInstance()
  const { type, providerId } = req.body
  try {
    await orchestrator.switchProvider(type, providerId)
    res.json({ success: true })
  } catch (error) {
    res.status(500).json({ error: error.message })
  }
})
```

#### Dashboard Components

```typescript
// React component for provider status display
export function VoiceProviderDashboard() {
  const [status, setStatus] = useState<ProviderStatusReport>()
  const [selectedProvider, setSelectedProvider] = useState<string>()

  useEffect(() => {
    const poll = setInterval(async () => {
      const resp = await fetch('/api/voice/status')
      setStatus(await resp.json())
    }, 5000)

    return () => clearInterval(poll)
  }, [])

  return (
    <div>
      <h2>Voice Orchestrator Status</h2>

      {/* Overall status */}
      <StatusIndicator status={status?.orchestratorStatus} />

      {/* Provider cards */}
      <div className="providers-grid">
        {status?.sttProviders.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            metrics={/* fetch from /api/voice/metrics/:id */}
            onSwitch={() => switchProvider('stt', provider.id)}
          />
        ))}
        {status?.ttsProviders.map(provider => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            metrics={/* fetch from /api/voice/metrics/:id */}
            onSwitch={() => switchProvider('tts', provider.id)}
          />
        ))}
      </div>

      {/* Fallback chain visualization */}
      <FallbackChainVisualization
        sttChain={status?.fallbackChains.stt}
        ttsChain={status?.fallbackChains.tts}
      />

      {/* Detailed metrics for selected provider */}
      {selectedProvider && (
        <MetricsDetailPanel providerId={selectedProvider} />
      )}
    </div>
  )
}
```

## Fallback Chain Visualization

### Configuration Example

```yaml
# ~/.clawdbot/config.yaml
voice:
  orchestrator:
    deploymentMode: hybrid

    # STT providers in priority order
    sttFallbackChain:
      - faster-whisper-docker     # Primary: Fast, GPU-accelerated
      - faster-whisper-system     # Secondary: CPU fallback
      - whisper-cloud             # Tertiary: Cloud API

    # TTS providers in priority order
    ttsFallbackChain:
      - kokoro-local              # Primary: Fast, local
      - elevenlabs-api            # Secondary: Better quality
      - google-tts-api            # Tertiary: Backup

    # Provider-specific settings
    providers:
      - id: faster-whisper-docker
        type: stt
        priority: 1
        enabled: true
        deployment: docker
        stt:
          type: faster-whisper
          modelSize: small
          computeType: int8
          language: en

      - id: kokoro-local
        type: tts
        priority: 1
        enabled: true
        deployment: system
        tts:
          type: local
          model: kokoro
          voice: default
```

### Visualization

```
STT Pipeline:
faster-whisper-docker [✓ HEALTHY]
    ↓ (on failure)
faster-whisper-system [✓ HEALTHY]
    ↓ (on failure)
whisper-cloud [? CHECKING]
    ↓ (on failure)
[ALL PROVIDERS EXHAUSTED] → Error

TTS Pipeline:
kokoro-local [✓ HEALTHY]
    ↓ (on failure)
elevenlabs-api [✓ HEALTHY]
    ↓ (on failure)
google-tts-api [⚠ DEGRADED - High latency]
    ↓ (on failure)
[ALL PROVIDERS EXHAUSTED] → Error
```

## Usage Examples

### Basic Usage

```typescript
// Initialize orchestrator
const orchestrator = new VoiceOrchestrator()
await orchestrator.initialize()

// Simple transcribe
const audio = await loadAudioFile('speech.wav')
const result = await orchestrator.transcribe(audio)
console.log(result.text)

// Simple synthesize
const audioBuffer = await orchestrator.synthesize('Hello, world!')
await saveAudioFile('output.wav', audioBuffer)

// Shutdown
await orchestrator.shutdown()
```

### Advanced Usage with Options

```typescript
// Transcribe with preference
const result = await orchestrator.transcribe(audio, {
  providerId: 'faster-whisper-docker',
  timeout: 30000,
  maxRetries: 3,
  trackMetrics: true,
  onFallback: (provider, error) => {
    console.log(`Falling back from ${provider}: ${error.message}`)
  },
})

// Synthesize with streaming
const textStream = createTextStream()
const audioChunks: AudioBuffer[] = []

for await (const chunk of orchestrator.synthesizeStream(textStream, {
  voice: 'natural',
  speed: 1.0,
  onProviderSwitch: (from, to) => {
    console.log(`Switched TTS: ${from} → ${to}`)
  },
})) {
  audioChunks.push(chunk)
}

const fullAudio = concatenateAudioBuffers(audioChunks)
```

### Monitoring & Metrics

```typescript
// Get provider status
const status = await orchestrator.getProviderStatus()
console.log(`Orchestrator status: ${status.orchestratorStatus}`)

for (const provider of status.sttProviders) {
  console.log(`${provider.id}: ${provider.state}`)
  console.log(`  Circuit breaker: ${provider.circuitBreaker.state}`)
  console.log(`  Error rate: ${(provider.metrics.errorRate * 100).toFixed(2)}%`)
}

// Get detailed metrics
const metrics = await orchestrator.getMetrics('faster-whisper-docker')
console.log(`Latency p95: ${metrics.latencyP95}ms`)
console.log(`Success rate: ${((1 - metrics.errorRate) * 100).toFixed(2)}%`)

// Manually switch providers
await orchestrator.switchProvider('stt', 'faster-whisper-system')

// Get available providers
const providers = await orchestrator.listAvailableProviders('stt')
for (const provider of providers) {
  console.log(`${provider.id} (${provider.state})`)
}
```

## Backward Compatibility

### Existing Registry Migration

The enhanced orchestrator **wraps** the existing `VoiceProviderRegistry`:

```typescript
class VoiceOrchestrator {
  private registry: VoiceProviderRegistry

  constructor(configPath?: string) {
    this.registry = new VoiceProviderRegistry()
  }

  // Delegate to registry if no special orchestration needed
  async getTranscriber(providerId?: string): Promise<VoiceProviderExecutor> {
    return await this.registry.getTranscriber(providerId)
  }

  async transcribeWithFallback(...): Promise<TranscriptionResult> {
    // Use enhanced fallback with circuit breaker & metrics
    return await this.executeWithFallback('transcribe', ...)
  }
}
```

### Existing Voice Channels Integration

Voice channels continue using the provider interface directly:

```typescript
// voice-channels/call-handler.ts (no changes needed)
const transcriber = await this.registry.getTranscriber()
const result = await transcriber.transcribe(audio)

// OR use orchestrator for better error handling
const orchestrator = VoiceOrchestrator.getInstance()
const result = await orchestrator.transcribe(audio, {
  allowFallback: true,
  timeout: 30000,
})
```

## Testing Strategy

### Unit Tests

```typescript
// orchestrator.test.ts
describe('VoiceOrchestrator', () => {
  it('should select provider by priority', async () => { })
  it('should fall back to next provider on error', async () => { })
  it('should open circuit breaker after threshold', async () => { })
  it('should recover from circuit breaker', async () => { })
  it('should measure and report metrics', async () => { })
  it('should handle streaming operations', async () => { })
  it('should respect timeout options', async () => { })
})
```

### Integration Tests

```typescript
// orchestrator.integration.test.ts
describe('VoiceOrchestrator Integration', () => {
  it('should transcribe real audio with multiple providers', async () => { })
  it('should synthesize text with different voices', async () => { })
  it('should track metrics across providers', async () => { })
  it('should handle provider health degradation', async () => { })
})
```

### CLI Tests

```bash
# Test CLI commands
bun test:cli voice status
bun test:cli voice transcribe test.wav
bun test:cli voice synthesize "Hello"
```

## Performance Considerations

### Optimization Strategies

```
1. Provider Selection
   - Cache provider availability (TTL: 100ms)
   - Pre-warm frequently used providers
   - Async health checks (don't block requests)

2. Fallback Chain
   - Limit chain length (default: 3)
   - Skip unhealthy providers (circuit breaker)
   - Timeout detection to fast-fail

3. Streaming
   - Buffer chunks efficiently
   - Use backpressure for flow control
   - Parallelize provider calls when possible

4. Metrics
   - Use sliding window (not append-only)
   - Aggregate in background worker
   - Export metrics asynchronously

5. Caching
   - Cache audio normalization (if identical)
   - Cache provider capabilities
   - Cache health check results (with TTL)
```

### Latency Targets

```
Operation              Target          Budget
────────────────────────────────────────────
Provider selection    <10ms           5%
Transcribe (audio)    100-5000ms      85%
Synthesize (text)     100-3000ms      85%
Fallback decision      <50ms          5%
Metrics recording     <5ms            5%
```

## Future Enhancements

### Phase 2

- [ ] Multi-region provider selection
- [ ] Cost-based routing (cheap vs high-quality)
- [ ] Caching layer for frequently synthesized text
- [ ] Batch operation support
- [ ] Provider-specific telemetry integration

### Phase 3

- [ ] Machine learning-based provider selection
- [ ] Dynamic fallback chain optimization
- [ ] Real-time load balancing
- [ ] Provider resource prediction
- [ ] Custom provider plugin system

## Deployment Checklist

- [ ] Create `orchestrator.ts` (main class)
- [ ] Create `orchestrator-config.ts` (schemas)
- [ ] Create `health-monitor.ts` (circuit breaker)
- [ ] Create `provider-metrics.ts` (metrics)
- [ ] Create `fallback-chain.ts` (fallback logic)
- [ ] Update `registry.ts` (enhanced wrapper)
- [ ] Create CLI commands (`voice status`, `voice transcribe`, etc.)
- [ ] Add API endpoints (dashboard integration)
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
- [ ] Add example configurations
- [ ] Performance testing & optimization

## References

### Related Files

- `src/media/voice-providers/registry.ts` - Provider registry (existing)
- `src/media/voice-providers/executor.ts` - Provider interface (existing)
- `src/commands/voice.ts` - Voice CLI commands (existing)
- `src/config/zod-schema.voice-providers.ts` - Voice config schema
- `deployment-handlers.ts` - Docker/System deployment logic
- `src/media/voice-channels/` - Voice channels (consumers)

### Key Decision Documents

- [ADR: Provider Selection Strategy](./ADR-provider-selection.md) (to be created)
- [ADR: Circuit Breaker Pattern](./ADR-circuit-breaker.md) (to be created)
- [ADR: Health Monitoring](./ADR-health-monitoring.md) (to be created)

