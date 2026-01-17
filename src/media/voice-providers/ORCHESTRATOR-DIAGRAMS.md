# Voice Orchestrator - Visual Diagrams & Flowcharts

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Clawdbot Application Layer                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  CLI Commands    ┌──────────────────────────────────────┐  Dashboard │
│  ├─ transcribe   │    VoiceOrchestrator (Entry Point)  │  ├─ Status  │
│  ├─ synthesize   ├──────────────────────────────────────┤  ├─ Metrics │
│  ├─ status       │ Core Operations:                     │  └─ Control │
│  ├─ config       │  • transcribe(audio, options)       │             │
│  └─ metrics      │  • synthesize(text, options)        │             │
│                  │  • transcribeStream(stream)         │             │
│                  │  • synthesizeStream(stream)         │             │
│                  │                                      │             │
│                  │ Management:                          │             │
│                  │  • getProviderStatus()              │             │
│                  │  • getMetrics(providerId)           │             │
│                  │  • switchProvider(type, id)         │             │
│                  │  • listAvailableProviders()         │             │
│                  ├──────────────────────────────────────┤             │
│                  │ Supporting Components:               │             │
│                  │  • HealthMonitor                     │             │
│                  │  • ProviderMetrics                   │             │
│                  │  • FallbackChain                     │             │
│                  └──────────────────────────────────────┘             │
│                      ↓                ↓                  ↓             │
│         ┌─────────────────────┬──────────────────┬──────────────┐    │
│         │ Registry Layer      │ Health Monitoring│ Metrics      │    │
│         │ (VoiceProvider      │ (Circuit Breaker)│ Collection   │    │
│         │  Registry)          │                  │              │    │
│         └─────────────────────┴──────────────────┴──────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
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

## Provider Selection Flowchart

```
┌─ Start: Transcribe/Synthesize Request
│
├─ Step 1: Provider Specified Explicitly?
│  ├─ Yes: Use specified provider
│  └─ No: Continue to step 2
│
├─ Step 2: Get Fallback Chain for Type (STT/TTS)
│  └─ Chain: [Provider1, Provider2, Provider3, ...]
│
├─ Step 3: Iterate Through Chain
│  │
│  ├─ For Each Provider:
│  │
│  │  ├─ Is Provider Initialized?
│  │  │  └─ No: Skip to next
│  │  │
│  │  ├─ Circuit Breaker Open?
│  │  │  ├─ Yes: Check if Half-Open (time to retry)
│  │  │  │   ├─ Yes: Continue to next check
│  │  │  │   └─ No: Skip to next provider
│  │  │  └─ No (Closed): Continue to next check
│  │  │
│  │  ├─ Last Health Check Passing?
│  │  │  └─ No: Skip to next (or perform new check)
│  │  │
│  │  ├─ Matches Capability Requirements?
│  │  │  ├─ Audio format supported?
│  │  │  ├─ Language supported?
│  │  │  ├─ Streaming required?
│  │  │  └─ Sample rate supported?
│  │  │     └─ No to any: Skip to next
│  │  │
│  │  ├─ Within Concurrent Request Limit?
│  │  │  └─ No: Skip to next
│  │  │
│  │  └─ Provider Selected ✓
│  │      └─ Execute Operation
│  │
│  ├─ All Providers Exhausted?
│  │  ├─ No: Continue to next provider
│  │  └─ Yes: Throw Error
│  │
│  └─ End: Return Result
│
└─ End: Success or Failure
```

## Error Handling & Fallback Flowchart

```
┌─ Execute Provider Operation
│
├─ Operation Succeeds?
│  ├─ Yes:
│  │  ├─ Record Success
│  │  ├─ Close Circuit Breaker (if Half-Open)
│  │  └─ Return Result ✓
│  │
│  └─ No: Provider Error
│     │
│     ├─ Record Failure
│     ├─ Update Circuit Breaker Failure Count
│     │
│     ├─ Failure Threshold Met?
│     │  ├─ Yes: Open Circuit Breaker
│     │  └─ No: Keep Closed
│     │
│     ├─ Allow Fallback?
│     │  ├─ No: Throw Error ✗
│     │  │
│     │  └─ Yes: Initiate Fallback
│     │     │
│     │     ├─ Call onFallback Callback
│     │     ├─ Error Type?
│     │     │  ├─ Timeout: Retry on same provider?
│     │     │  ├─ Transient: Try next provider
│     │     │  └─ Permanent: Skip provider, try next
│     │     │
│     │     ├─ More Providers in Chain?
│     │     │  ├─ Yes: Select Next Provider (recursive)
│     │     │  │        └─ Go to "Execute Provider Operation"
│     │     │  │
│     │     │  └─ No: All Providers Exhausted
│     │     │     └─ Throw Final Error ✗
│     │     │
│     │     └─ Recovery Success
│     │        ├─ Record Fallback Usage
│     │        └─ Return Result from Fallback Provider ✓
│     │
│     └─ End: Fallback Complete or Error
│
└─ End
```

## Circuit Breaker State Machine

```
                    ┌─────────────┐
                    │   CLOSED    │  ← Failures: 0
                    │  (Normal)   │     Circuit breaker on
                    └──────┬──────┘
                           │
               Consecutive failures ≥ threshold (default: 5)
                           │
                           ↓
                    ┌─────────────┐
                    │    OPEN     │  ← Failures: ≥ 5
                    │  (Broken)   │     All requests fail
                    │  Skip all   │     Circuit breaker tripped
                    └──────┬──────┘
                           │
              Timeout expires (default: 30s)
                           │
                           ↓
                    ┌─────────────┐
       ┌───────────→│ HALF-OPEN   │←─────────┐
       │            │  (Testing)  │          │
       │            │ Try 1 req   │          │
       │            └─────┬───────┘          │
       │                  │                   │
       │          ┌───────┴────────┐         │
       │          │                │         │
    Retry OK   Success         Failure    Timeout
    (limit ×2)  │                │          │
       │        │                │          │
       └─ Yes   └────TE Yes      └──────────┘
          to
       CLOSED    CLOSED
```

## Health Check Strategy Levels

```
Level 1: Metadata Check (fastest)
┌──────────────────────────────────┐
│ getCapabilities()                │
│ ✓ Returns provider capabilities  │
│ ✗ Exception thrown               │
│ Time: <1ms                       │
│ Coverage: Can provider respond?  │
└──────────────────────────────────┘
         ↓ (if fails, mark unhealthy)
         ↓ (if passes, continue to next)

Level 2: Echo Test (moderate)
┌──────────────────────────────────┐
│ Send test audio (STT)            │
│ Send test text (TTS)             │
│ ✓ Receives valid response        │
│ ✗ No response/error              │
│ Time: 10-100ms                   │
│ Coverage: Does it work?          │
└──────────────────────────────────┘
         ↓ (if fails, mark degraded)
         ↓ (if passes, continue to next)

Level 3: Latency Check (moderate+)
┌──────────────────────────────────┐
│ Measure operation latency        │
│ ✓ Latency < threshold (5000ms)   │
│ ✗ Latency > threshold            │
│ Time: 100-500ms                  │
│ Coverage: Is it reasonably fast? │
└──────────────────────────────────┘
         ↓ (if fails, mark degraded)
         ↓ (if passes, mark healthy)

Level 4: Full Round-Trip (thorough)
┌──────────────────────────────────┐
│ Full transcribe/synthesize test  │
│ ✓ Complete operation succeeds    │
│ ✗ Operation fails                │
│ Time: 500ms - 5s                 │
│ Coverage: Full provider test     │
└──────────────────────────────────┘
         ↓ (use for diagnostic)
```

## Metrics Collection Pipeline

```
Request Execution
    │
    ├─ START: Record timestamp, provider
    │    ↓
    ├─ EXECUTE: Call provider operation
    │    ├─ Success
    │    │   ├─ Record: latency, success=true
    │    │   └─ Update: metrics.requestsSuccessful++
    │    │
    │    └─ Failure
    │        ├─ Record: latency, error, success=false
    │        └─ Update: metrics.requestsFailed++
    │
    ├─ STORE: Add to history window
    │    └─ Maintain sliding window (max 1000)
    │
    ├─ AGGREGATE: Recalculate metrics (every 60s)
    │    ├─ Sort latencies
    │    ├─ Calculate percentiles (p50, p95, p99)
    │    ├─ Calculate error rate
    │    ├─ Calculate uptime
    │    └─ Update aggregated metrics
    │
    ├─ EXPORT: Send to dashboard (every 30s)
    │    └─ POST /api/voice/metrics
    │
    └─ RETENTION: Archive old records (30 days)
         └─ Clean up metrics older than retention period

Result: ProviderMetrics
├─ requestsTotal: 1,234
├─ requestsSuccessful: 1,210
├─ requestsFailed: 24
├─ errorRate: 0.0194 (1.94%)
├─ latencyMin: 45ms
├─ latencyMax: 8,234ms
├─ latencyAverage: 892ms
├─ latencyP95: 2,145ms
├─ latencyP99: 4,567ms
├─ uptime: 0.9806 (98.06%)
└─ lastSuccessAt: 2026-01-16T12:34:56Z
```

## Fallback Chain Execution Timeline

```
Time    Event                              Provider Status
────────────────────────────────────────────────────────────
T+0ms   Request: transcribe(audio)         -

T+10ms  Provider 1: faster-whisper-docker selected
        Execute: transcribe(audio)         ⏳ executing

T+50ms  Fast-timeout triggers (prefer fast provider)
        ❌ Provider 1 timeout              ✗ failed
        onFallback() called

T+60ms  Provider 2: faster-whisper-system selected
        Execute: transcribe(audio)         ⏳ executing

T+3200ms ✓ Provider 2 succeeds            ✓ success
        Result returned to caller
        Metrics recorded for both

T+3210ms Health check scheduled
        Mark faster-whisper-docker
        for circuit breaker monitoring

────────────────────────────────────────────────────────────
Total Time: 3,210ms
Attempts: 2 (1 failed, 1 succeeded)
Result: "what did you say?" (from Provider 2)
```

## Configuration Priority Chain

```
┌──────────────────────────────────────────────────────────┐
│ Step 1: LOAD DEFAULT CONFIGURATION                      │
│ ├─ Built-in defaults (orchestrator-config.ts)           │
│ └─ Result: OrchestratorConfig with all defaults         │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ Step 2: LOAD DEPLOYMENT CONFIGURATION                   │
│ ├─ If exists: deployment-config.json                    │
│ ├─ Merge: Override defaults                             │
│ └─ Result: Config + deployment overrides               │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ Step 3: LOAD USER CONFIGURATION                         │
│ ├─ If exists: ~/.clawdbot/config.yaml                   │
│ ├─ Parse: YAML to OrchestratorConfig                    │
│ ├─ Merge: Override steps 1-2                            │
│ └─ Result: Config + user overrides                      │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ Step 4: LOAD ENVIRONMENT OVERRIDES                      │
│ ├─ CLAWDBOT_VOICE_STT_PROVIDER                          │
│ ├─ CLAWDBOT_VOICE_DEPLOYMENT_MODE                      │
│ ├─ CLAWDBOT_VOICE_HEALTH_INTERVAL_MS                   │
│ ├─ Merge: Override steps 1-3                            │
│ └─ Result: Config + environment overrides              │
└───────────────────────┬──────────────────────────────────┘
                        ↓
┌──────────────────────────────────────────────────────────┐
│ Step 5: RUNTIME API UPDATES                             │
│ ├─ orchestrator.updateConfiguration()                   │
│ ├─ orchestrator.switchProvider()                        │
│ ├─ Dashboard UI changes                                 │
│ ├─ Merge: Override steps 1-4                            │
│ └─ Result: FINAL CONFIGURATION IN USE                  │
└──────────────────────────────────────────────────────────┘

Priority (highest to lowest):
1. Runtime API calls
2. Environment variables
3. User configuration file
4. Deployment configuration
5. Built-in defaults
```

## Provider State Lifecycle

```
┌─ Provider Registration
│  └─ State: REGISTERED
│
├─ Provider Initialization
│  ├─ await provider.initialize()
│  └─ State: INITIALIZING → INITIALIZED
│
├─ First Health Check
│  ├─ Metadata check
│  ├─ State: HEALTHY
│  └─ Circuit Breaker: CLOSED
│
├─ Normal Operation
│  ├─ Requests succeed
│  ├─ State: HEALTHY
│  └─ Circuit Breaker: CLOSED
│
├─ Failures Begin
│  ├─ Track failure count
│  ├─ State: HEALTHY (still)
│  └─ Circuit Breaker: CLOSED
│
├─ Threshold Exceeded
│  ├─ Failures ≥ 5 (default)
│  ├─ State: DEGRADED
│  └─ Circuit Breaker: OPEN
│
├─ Recovery Period
│  ├─ Wait 30s (default)
│  ├─ State: DEGRADED
│  └─ Circuit Breaker: HALF-OPEN (test mode)
│
├─ Recovery Test
│  ├─ Try single request
│  ├─ Success: Successes++
│  └─ Failure: Return to OPEN
│
├─ Full Recovery
│  ├─ Successes ≥ 2 (default)
│  ├─ State: HEALTHY
│  └─ Circuit Breaker: CLOSED
│
└─ Provider Shutdown
   ├─ Record final metrics
   ├─ await provider.shutdown()
   └─ State: SHUTDOWN (archived)
```

## Metrics Dashboard Layout

```
┌────────────────────────────────────────────────────────────────┐
│                   Voice Orchestrator Dashboard                 │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Overall Status: 🟢 READY                                        │
│ ├─ Uptime: 99.8%                                               │
│ ├─ Active Providers: 3/4                                       │
│ └─ Last Update: 2 seconds ago                                  │
│                                                                  │
├────────────────────────────────────────────────────────────────┤
│                    STT Providers                                 │
├─────────────────────┬──────────────┬─────────┬──────┬──────┤
│ Provider            │ State        │ Failures│ Error│ Latency
├─────────────────────┼──────────────┼─────────┼──────┼──────┤
│ faster-whisper-d... │ 🟢 HEALTHY   │ 0       │ 0.2% │ 245ms
│ faster-whisper-s... │ 🟢 HEALTHY   │ 0       │ 0.1% │ 342ms
│ whisper-api         │ 🟡 DEGRADED  │ 4       │ 2.8% │ 1.2s
└─────────────────────┴──────────────┴─────────┴──────┴──────┘
│
├────────────────────────────────────────────────────────────────┤
│                    TTS Providers                                 │
├─────────────────────┬──────────────┬─────────┬──────┬──────┤
│ Provider            │ State        │ Failures│ Error│ Latency
├─────────────────────┼──────────────┼─────────┼──────┼──────┤
│ kokoro              │ 🟢 HEALTHY   │ 0       │ 0.0% │ 187ms
│ elevenlabs          │ 🟢 HEALTHY   │ 0       │ 0.5% │ 432ms
└─────────────────────┴──────────────┴─────────┴──────┴──────┘
│
├────────────────────────────────────────────────────────────────┤
│ Fallback Chains                                                  │
├────────────────────────────────────────────────────────────────┤
│ STT:  faster-whisper-docker → faster-whisper-system → whisper  │
│ TTS:  kokoro → elevenlabs                                       │
└────────────────────────────────────────────────────────────────┘
│
├────────────────────────────────────────────────────────────────┤
│ Recent Events                                                    │
├────────────────────────────────────────────────────────────────┤
│ 12:34:45 ⚠ whisper-api: Circuit opened (5 failures)           │
│ 12:30:12 🔄 faster-whisper-docker: Circuit half-open test      │
│ 12:30:00 ✓ faster-whisper-system: Recovered from degraded      │
│ 12:25:33 🔗 Fallback to faster-whisper-system (timeout)        │
└────────────────────────────────────────────────────────────────┘
```

## Integration Points Summary

```
┌─────────────────────────────────────────────────────────┐
│           VoiceOrchestrator Integration Points          │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ CLI Integration (src/commands/voice/)                  │
│  ├─ voice transcribe                                    │
│  ├─ voice synthesize                                    │
│  ├─ voice status                                        │
│  ├─ voice config                                        │
│  └─ voice metrics                                       │
│       ↓ (each command calls orchestrator methods)      │
│                                                          │
│ Dashboard Integration (src/provider-web.ts)           │
│  ├─ GET /api/voice/status                              │
│  ├─ GET /api/voice/metrics                             │
│  ├─ POST /api/voice/transcribe                         │
│  ├─ POST /api/voice/synthesize                         │
│  └─ POST /api/voice/switch-provider                    │
│       ↓ (REST API wrapping orchestrator)               │
│                                                          │
│ Plugin System (extensions/voice-plugin/)              │
│  ├─ Custom provider registration                       │
│  ├─ Health check callbacks                             │
│  └─ Metrics reporting                                  │
│       ↓ (plugins register executors)                   │
│                                                          │
│ Voice Channels (src/media/voice-channels/)            │
│  ├─ Call handler (incoming audio)                      │
│  ├─ Response handler (outgoing audio)                  │
│  └─ Session management                                 │
│       ↓ (channels use orchestrator)                    │
│                                                          │
│ Configuration Layer (src/config/)                     │
│  ├─ Load configuration                                 │
│  ├─ Validate schemas                                   │
│  └─ Apply overrides                                    │
│       ↓ (config loaded at startup)                    │
│                                                          │
│ Monitoring & Logging                                  │
│  ├─ Health check results                               │
│  ├─ Error events                                       │
│  ├─ Metrics snapshots                                  │
│  └─ Provider switches                                  │
│       ↓ (sent to logging/monitoring service)           │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## Request Flow Sequence Diagram

```
User                CLI          Orchestrator        Provider    Health Monitor
 │                  │                  │                 │              │
 ├─ voice transcribe audio.wav          │                 │              │
 │                  │                   │                 │              │
 │                  ├─ transcribeCommand()                │              │
 │                  │                   │                 │              │
 │                  ├─ transcribe(audio) │                 │              │
 │                  │ ┌─────────────────→                 │              │
 │                  │ │ selectProvider() │                 │              │
 │                  │ │                  │                 │              │
 │                  │ │ isHealthy()?     │                 │              │
 │                  │ │ ────────────────────────────→      │              │
 │                  │ │                  │                 │ getStatus()  │
 │                  │ │←────────────────────────────       │              │
 │                  │ │  healthy: true   │                 │              │
 │                  │ │                  │                 │              │
 │                  │ │ provider=whisper │                 │              │
 │                  │ ├─ transcribe()    │                 │              │
 │                  │ │                  ├─────────────────→              │
 │                  │ │                  │  transcribe()   │              │
 │                  │ │                  │←─────────────────              │
 │                  │ │                  │  result: {...}  │              │
 │                  │ │                  │                 │              │
 │                  │ │ recordMetrics()  │                 │              │
 │                  │ │ latency: 245ms   │                 │              │
 │                  │ │ success: true    │                 │              │
 │                  │ │←────────────────────────────────────────→         │
 │                  │ │                  │                 │      record  │
 │                  │ │                  │                 │              │
 │                  │ └─ {text: "..."}   │                 │              │
 │                  ├─ displayResult()   │                 │              │
 │                  ├─ "what did you say?" │              │              │
 │                  │                   │                 │              │
```

## Performance Profile

```
Operation: transcribe(audio)
          └─ 3 seconds typical (with Faster-Whisper)

Timeline:
┌─────────────────────────────────────────────┐
│ T+0-10ms:   Provider selection              │
│   ├─ Get fallback chain
│   ├─ Check circuit breaker
│   ├─ Check health
│   └─ Select provider
│
│ T+10-15ms:  Metrics recording start
│   ├─ Record timestamp
│   └─ Create request context
│
│ T+15ms-3s:  Provider execution (2985ms)
│   └─ Call Faster-Whisper with audio
│
│ T+3s-3.010s: Metrics recording end
│   ├─ Record latency (2985ms)
│   ├─ Calculate percentiles
│   └─ Update aggregate metrics
│
│ T+3.010s:   Return to caller
│   └─ {text: "...", provider: "whisper", duration: 2985}
│
└─────────────────────────────────────────────┘

Orchestrator Overhead: 10-15ms (0.3% of total)
Provider Execution:   2985ms (99.7% of total)
---
Total Time:           3000ms

Budget:
├─ Provider selection:    <10ms ✓
├─ Metrics recording:     <5ms  ✓
├─ Fallback decision:     <50ms ✓
└─ Provider execution:    2985ms (85%)
```

