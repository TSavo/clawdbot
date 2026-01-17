# Voice Orchestrator - Quick Reference

## At a Glance

The Voice Orchestrator is a coordination layer that manages STT (Speech-to-Text) and TTS (Text-to-Speech) providers with intelligent routing, health monitoring, fallback chains, and metrics collection.

## Core Concept

```
User Request
    ↓
VoiceOrchestrator
├── Select Best Provider (priority, health, load)
├── Execute Operation (transcribe/synthesize)
├── Handle Errors (automatic fallback)
├── Track Metrics (latency, errors)
└── Return Result
```

## Quick Start Code

```typescript
// Initialize
const orchestrator = new VoiceOrchestrator()
await orchestrator.initialize()

// Transcribe
const result = await orchestrator.transcribe(audioBuffer, {
  providerId: 'faster-whisper',      // Optional: specific provider
  providerPreference: 'fast',        // Or: 'accurate', 'cheap'
  allowFallback: true,               // Automatic fallback on error
})
console.log(result.text)

// Synthesize
const audio = await orchestrator.synthesize('Hello world', {
  voice: 'natural',
  speed: 1.0,
})

// Cleanup
await orchestrator.shutdown()
```

## Key Files

| File | Purpose | Status |
|------|---------|--------|
| `orchestrator.ts` | Main class (to create) | 📝 To Do |
| `orchestrator-config.ts` | Configuration schema | ✅ Done |
| `health-monitor.ts` | Circuit breaker (to create) | 📝 To Do |
| `provider-metrics.ts` | Metrics collection (to create) | 📝 To Do |
| `fallback-chain.ts` | Fallback logic (to create) | 📝 To Do |
| `registry.ts` | Provider registry (existing) | ℹ️ Enhanced |

## Configuration

### Local Development
```yaml
voice:
  orchestrator:
    deploymentMode: docker
    sttFallbackChain: [faster-whisper-docker]
    ttsFallbackChain: [kokoro-system]
```

### Production
```yaml
voice:
  orchestrator:
    deploymentMode: hybrid
    sttFallbackChain: [openai-whisper, faster-whisper-system]
    ttsFallbackChain: [elevenlabs-api, kokoro-system]
```

## CLI Commands

```bash
# Show status
clawdbot voice status --detailed

# Transcribe
clawdbot voice transcribe audio.wav --preference fast

# Synthesize
clawdbot voice synthesize "Hello" --provider kokoro

# Manage config
clawdbot voice config set stt-provider faster-whisper

# Check health
clawdbot voice health-check --all
```

## API Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `transcribe(audio, options?)` | Convert audio to text | TranscriptionResult |
| `transcribeStream(stream, options?)` | Stream transcription | AsyncIterable<Chunk> |
| `synthesize(text, options?)` | Convert text to audio | AudioBuffer |
| `synthesizeStream(stream, options?)` | Stream synthesis | AsyncIterable<AudioBuffer> |
| `getProviderStatus()` | Get all provider status | ProviderStatusReport |
| `getMetrics(providerId?)` | Get provider metrics | ProviderMetrics |
| `switchProvider(type, id)` | Switch primary provider | Promise<void> |
| `listAvailableProviders(type?)` | List providers | ProviderInfo[] |

## Error Handling

```typescript
try {
  const result = await orchestrator.transcribe(audio)
} catch (error) {
  if (error instanceof VoiceProviderError) {
    console.log(`Provider ${error.provider}: ${error.message}`)
  }
}
```

## Fallback Chain

### How It Works

```
Request
  ↓
Try Provider 1 (faster-whisper-docker)
  ├─ Success → Return result
  └─ Error → Try Provider 2
    ↓
Try Provider 2 (faster-whisper-system)
  ├─ Success → Return result
  └─ Error → Try Provider 3
    ↓
Try Provider 3 (whisper-api)
  ├─ Success → Return result
  └─ Error → Throw error
```

## Health Monitoring

### Circuit Breaker States

```
CLOSED       → Normal operation
OPEN         → Provider is broken, skip it
HALF-OPEN    → Test recovery
CLOSED       → Provider recovered
```

### What Gets Checked

```
✓ Metadata check     (<1ms)   → getCapabilities()
✓ Echo test         (10ms)    → Send test audio/text
✓ Latency check     (100ms)   → Measure response time
✓ Full test         (500ms)   → Complete operation
```

## Metrics Tracked

| Metric | What It Means |
|--------|---------------|
| requestsTotal | Total requests made |
| errorRate | Percentage of failed requests |
| averageLatencyMs | Average response time |
| p95LatencyMs | 95th percentile latency |
| p99LatencyMs | 99th percentile latency |
| uptime | Percentage available |

## Provider Selection Logic

```
1. Is provider enabled?                 ✓
2. Is circuit breaker closed?           ✓
3. Was last health check passing?       ✓
4. Match capabilities (language, format)? ✓
5. Within concurrent limit?             ✓
6. Apply preference (fast/accurate)?    ✓
7. Select provider                      ✓
```

## Dashboard Integration

### Endpoints

```
GET  /api/voice/status                # Overall orchestrator status
GET  /api/voice/metrics               # All provider metrics
POST /api/voice/transcribe            # Transcribe via API
POST /api/voice/synthesize            # Synthesize via API
POST /api/voice/switch-provider       # Switch active provider
```

### Components

```typescript
// React hook
const { controller, status } = useVoiceController()

// Show provider status
<VoiceProviderStatusPanel />

// Fallback chain visualization
<FallbackChainVisualization />
```

## Testing Patterns

### Unit Test
```typescript
it('should fallback on provider error', async () => {
  const result = await orchestrator.transcribe(audio)
  expect(result.provider).toBe('fallback-provider')
})
```

### Integration Test
```bash
CLAWDBOT_LIVE_TEST=1 pnpm test:live
```

### CLI Test
```bash
clawdbot voice transcribe test.wav
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| All providers unhealthy | Check network, restart orchestrator |
| Too many fallbacks | Increase circuit breaker timeout |
| High latency | Switch to faster provider preference |
| Memory leak in metrics | Check history size limit |
| Provider never recovers | Manually switch provider |

## Performance Budget

```
Total operation: 100-5000ms

Orchestrator overhead: <65ms (max 10%)
├── Provider selection:    <10ms (5%)
├── Metrics recording:     <5ms  (5%)
└── Fallback decision:     <50ms (5%)

Provider execution: 100-5000ms (85%)
```

## Configuration Priority

```
1. Default values (lowest priority)
2. deployment-config.json
3. ~/.clawdbot/config.yaml
4. Environment variables (CLAWDBOT_VOICE_*)
5. Runtime API calls (highest priority)
```

## Integration Checklist

- [ ] Create `orchestrator.ts` main class
- [ ] Create `health-monitor.ts` circuit breaker
- [ ] Create `provider-metrics.ts` metrics
- [ ] Create `fallback-chain.ts` fallback logic
- [ ] Update CLI commands
- [ ] Add dashboard API endpoints
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Update documentation
- [ ] Performance testing

## Deployment Phases

```
Week 1-2: Foundation (core components + tests)
Week 3:   Integration (CLI + dashboard)
Week 4:   Enhancement (plugins + optimization)
Ongoing:  Rollout (10% → 50% → 100%)
```

## Reference Documents

| Document | Purpose | Lines |
|----------|---------|-------|
| ORCHESTRATOR-ARCHITECTURE.md | Complete design | 2,500 |
| orchestrator-config.ts | Configuration schema | 400 |
| ORCHESTRATOR-INTEGRATION.md | Integration patterns | 1,800 |
| ORCHESTRATOR-MIGRATION.md | Rollout plan | 1,200 |
| ORCHESTRATOR-SUMMARY.md | Overview | 600 |
| ORCHESTRATOR-QUICK-REFERENCE.md | This file | 300 |

## Key Decision Points

1. **Wrap vs Replace**: Wraps existing registry → backward compatible
2. **Config Source**: Multi-source with priority → deployment flexible
3. **Health Strategy**: Layered checks → fast + reliable
4. **Circuit Breaker**: Standard pattern → production proven
5. **Fallback Length**: 3-5 max → balances flexibility vs latency
6. **Error Handling**: Automatic fallback → resilient by default

## Success Criteria

✓ All tests pass (>80% coverage)
✓ Backward compatible
✓ <10% orchestrator overhead
✓ Fallback chain works reliably
✓ Health monitoring accurate
✓ Metrics collected correctly
✓ CLI commands work
✓ Dashboard integration complete
✓ Documentation clear
✓ Ready for production

## Next Action

1. **Review** this design document
2. **Get feedback** from team
3. **Create prototype** of orchestrator.ts
4. **Write tests** for core logic
5. **Integrate** with CLI and dashboard
6. **Deploy** following 4-week plan

## Contact & Questions

- Architecture: See ORCHESTRATOR-ARCHITECTURE.md
- Implementation: See ORCHESTRATOR-MIGRATION.md
- Integration: See ORCHESTRATOR-INTEGRATION.md
- Configuration: See orchestrator-config.ts

---

**Total Design Documentation**: ~6,500 lines across 6 files
**Total Code to Create**: ~1,200 lines (orchestrator.ts, health-monitor.ts, provider-metrics.ts, fallback-chain.ts)
**Total Configuration Schema**: 400 lines (orchestrator-config.ts)

