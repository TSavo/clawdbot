# Voice Orchestrator - Complete Design Documentation

## Overview

This directory contains the complete design for the **Voice Orchestrator/Coordinator**, a production-ready coordination layer for managing STT (Speech-to-Text) and TTS (Text-to-Speech) providers in Clawdbot.

The orchestrator provides:
- **Intelligent provider selection** based on capabilities, health, and user preferences
- **Automatic fallback chains** with circuit breaker pattern for reliability
- **Health monitoring** with configurable check strategies
- **Metrics collection** for performance tracking and optimization
- **Unified APIs** for both STT and TTS operations
- **Full backward compatibility** with existing provider implementations
- **Clear integration points** for CLI, plugins, and dashboard

## Documentation Structure

### 1. Start Here: ORCHESTRATOR-QUICK-REFERENCE.md
**Quick lookup guide** (337 lines)

Best for: Quick answers, code snippets, common tasks

Contains:
- Core concept overview
- Quick start code examples
- CLI commands reference
- API method summary
- Configuration examples
- Troubleshooting guide
- Deployment phases checklist

**Read this first** for a 5-minute overview.

---

### 2. ORCHESTRATOR-ARCHITECTURE.md
**Complete technical design** (1,310 lines)

Best for: Understanding how everything works together

Contains:
- System architecture with ASCII diagrams
- Component hierarchy and interactions
- Complete file structure
- Core interfaces and APIs
- Configuration schema overview
- Provider selection algorithm with pseudo-code
- Error handling and fallback strategy
- Health monitoring with circuit breaker state machine
- Metrics collection and reporting
- Integration points (CLI, plugins, dashboard)
- Fallback chain visualization
- Usage examples (basic and advanced)
- Performance considerations
- Testing strategy
- Future enhancements

**Read this for detailed technical understanding.**

---

### 3. orchestrator-config.ts
**Zod-based configuration schema** (627 lines)

Best for: Understanding configuration options and creating configs

Contains:
- All configuration types with Zod schemas
- Enums (DeploymentMode, ProviderPreference, etc.)
- Configuration builder functions
- Four pre-built configuration presets:
  - Local development
  - Production cloud-first
  - Cost-optimized
  - High-availability
- Validation utilities

**Use this as the source of truth for configuration.**

---

### 4. ORCHESTRATOR-INTEGRATION.md
**Practical integration patterns** (1,017 lines)

Best for: Implementing integrations with your code

Contains:
- Quick start initialization pattern
- CLI integration patterns (3 complete examples):
  - Simple transcription command
  - Provider status command
  - Configuration management command
- Plugin registration pattern
- Dashboard integration with React examples
- Voice channel integration examples
- Error handling best practices
- Configuration file examples (local + production)
- Testing patterns (unit + integration)
- Monitoring & metrics export

**Read this when implementing the orchestrator.**

---

### 5. ORCHESTRATOR-MIGRATION.md
**Implementation and rollout strategy** (729 lines)

Best for: Planning implementation and rollout

Contains:
- Executive summary with 4-phase timeline
- Component architecture (what changes, what doesn't)
- Step-by-step integration strategy:
  1. Create core orchestrator class
  2. Create health monitor
  3. Create metrics collection
  4. Update CLI commands
  5. Add dashboard API endpoints
- Backward compatibility strategy
- Testing strategy (unit, integration, live)
- Performance considerations
- Monitoring & observability plan
- 4-week rollout phases
- Potential issues & mitigations
- Success criteria

**Read this before starting implementation.**

---

### 6. ORCHESTRATOR-SUMMARY.md
**High-level overview and reference** (535 lines)

Best for: Getting the big picture

Contains:
- Overview of all design documents
- Key design decisions explained
- API summary
- CLI commands list
- Dashboard API endpoints
- Performance targets
- Testing coverage breakdown
- Configuration examples
- Backward compatibility notes
- Future extensions roadmap
- How to use this design
- File locations

**Read this for context and navigation.**

---

### 7. ORCHESTRATOR-QUICK-REFERENCE.md
**Cheat sheet and quick lookup** (337 lines)

Best for: Quick answers and reference

Contains:
- One-page concepts
- Quick start code
- Key files table
- CLI commands quick reference
- API methods table
- Fallback chain diagram
- Health monitoring summary
- Metrics list
- Common issues & solutions
- Performance budget
- Integration checklist
- Reference to other documents

**Keep this open while working.**

---

## Reading Guide by Role

### For Architects / Tech Leads
1. ORCHESTRATOR-QUICK-REFERENCE.md (5 min)
2. ORCHESTRATOR-ARCHITECTURE.md (30 min)
3. ORCHESTRATOR-SUMMARY.md (10 min)

**Total: ~45 minutes**

### For Implementers / Developers
1. ORCHESTRATOR-QUICK-REFERENCE.md (5 min)
2. ORCHESTRATOR-INTEGRATION.md (20 min)
3. ORCHESTRATOR-MIGRATION.md (15 min)
4. orchestrator-config.ts (10 min)
5. ORCHESTRATOR-ARCHITECTURE.md (reference as needed)

**Total: ~50 minutes + reference**

### For DevOps / Operations
1. ORCHESTRATOR-QUICK-REFERENCE.md (5 min)
2. ORCHESTRATOR-ARCHITECTURE.md (sections: health monitoring, metrics, logging)
3. ORCHESTRATOR-MIGRATION.md (section: monitoring & observability)
4. orchestrator-config.ts (examples)

**Total: ~30 minutes**

### For QA / Testing
1. ORCHESTRATOR-QUICK-REFERENCE.md (5 min)
2. ORCHESTRATOR-INTEGRATION.md (section: testing patterns)
3. ORCHESTRATOR-MIGRATION.md (section: testing strategy)
4. ORCHESTRATOR-ARCHITECTURE.md (section: testing strategy)

**Total: ~20 minutes**

## Document Map

```
Your Question                          Best Document(s)
─────────────────────────────────────────────────────────
"How does it work?"                    ORCHESTRATOR-ARCHITECTURE.md
"How do I use it?"                     ORCHESTRATOR-INTEGRATION.md
"How do I configure it?"               orchestrator-config.ts
"When do I deploy it?"                 ORCHESTRATOR-MIGRATION.md
"Where's the code?"                    ORCHESTRATOR-SUMMARY.md
"Quick answer?"                        ORCHESTRATOR-QUICK-REFERENCE.md
"Give me the 30-second version"        ORCHESTRATOR-SUMMARY.md
"Show me working code"                 ORCHESTRATOR-INTEGRATION.md
"What are the APIs?"                   ORCHESTRATOR-ARCHITECTURE.md
"What's the performance target?"       ORCHESTRATOR-QUICK-REFERENCE.md
"How do I test it?"                    ORCHESTRATOR-MIGRATION.md
"What can fail?"                       ORCHESTRATOR-ARCHITECTURE.md
"How do I monitor it?"                 ORCHESTRATOR-MIGRATION.md
"What's backward compatible?"          ORCHESTRATOR-MIGRATION.md
"Show me CLI commands"                 ORCHESTRATOR-QUICK-REFERENCE.md
"Show me dashboard integration"        ORCHESTRATOR-INTEGRATION.md
"What configuration presets exist?"    orchestrator-config.ts
```

## File Structure

```
src/media/voice-providers/
├── README-ORCHESTRATOR.md              (This file)
├── ORCHESTRATOR-ARCHITECTURE.md        (1,310 lines) - Main design
├── ORCHESTRATOR-INTEGRATION.md         (1,017 lines) - Implementation patterns
├── ORCHESTRATOR-MIGRATION.md           (729 lines)   - Rollout plan
├── ORCHESTRATOR-SUMMARY.md             (535 lines)   - Overview
├── ORCHESTRATOR-QUICK-REFERENCE.md     (337 lines)   - Cheat sheet
│
├── orchestrator-config.ts              (627 lines)   - Configuration schema [CREATED]
│
├── orchestrator.ts                     [TO CREATE ~400 lines]
├── health-monitor.ts                   [TO CREATE ~300 lines]
├── provider-metrics.ts                 [TO CREATE ~250 lines]
├── fallback-chain.ts                   [TO CREATE ~200 lines]
│
├── registry.ts                         (existing - enhanced)
├── executor.ts                         (existing - unchanged)
│
└── [other provider implementations]
```

## Total Documentation

| Document | Lines | Focus |
|----------|-------|-------|
| ORCHESTRATOR-ARCHITECTURE.md | 1,310 | Technical deep-dive |
| ORCHESTRATOR-INTEGRATION.md | 1,017 | Implementation patterns |
| ORCHESTRATOR-MIGRATION.md | 729 | Rollout strategy |
| ORCHESTRATOR-SUMMARY.md | 535 | Overview & reference |
| ORCHESTRATOR-QUICK-REFERENCE.md | 337 | Quick lookup |
| README-ORCHESTRATOR.md | 300 | This navigation guide |
| orchestrator-config.ts | 627 | Configuration schema |
| **Total** | **~5,000** | **Complete design** |

## Key Concepts

### Provider Selection

```
Request
  ├─ Provider explicitly specified? → Use it
  ├─ Prefer local/fast/accurate/cheap?
  ├─ Is provider healthy? (circuit breaker check)
  ├─ Does it support needed capability?
  ├─ Within concurrent limit?
  └─ Select provider
```

### Fallback Chain

```
Try Provider 1 → Success? Return
              → Error? Try Provider 2 → Success? Return
                                    → Error? Try Provider 3
                                                → ...
```

### Circuit Breaker

```
CLOSED (normal)
  └─ Too many failures → OPEN

OPEN (broken)
  └─ Timeout expires → HALF-OPEN

HALF-OPEN (testing)
  ├─ Success → CLOSED
  └─ Failure → OPEN
```

### Health Checks

```
Level 1: Metadata (<1ms)      → Can it talk?
Level 2: Echo (10ms)          → Does it work?
Level 3: Latency (100ms)      → Is it fast?
Level 4: Full test (500ms+)   → Complete test?
```

## Quick Start Implementation

### Phase 1: Core (Week 1-2)
```bash
# Create configuration schema
cp orchestrator-config.ts src/media/voice-providers/

# Create core components
touch src/media/voice-providers/orchestrator.ts
touch src/media/voice-providers/health-monitor.ts
touch src/media/voice-providers/provider-metrics.ts
touch src/media/voice-providers/fallback-chain.ts

# Write unit tests
touch src/media/voice-providers/orchestrator.test.ts
```

### Phase 2: Integration (Week 3)
```bash
# Add CLI commands
src/commands/voice/*.ts

# Add dashboard API
src/api/voice-api.ts

# Write integration tests
src/media/voice-providers/orchestrator.integration.test.ts
```

### Phase 3: Rollout (Week 4+)
```bash
# Deploy with feature flag
# Monitor metrics
# Gather feedback
# Iterate on optimization
```

## Configuration by Use Case

### I want fast transcription
```yaml
sttFallbackChain: [faster-whisper-docker]  # GPU accelerated
defaultPreferences:
  sttPreference: fast
```

### I want accurate transcription
```yaml
sttFallbackChain: [openai-whisper, faster-whisper-system]  # High quality
defaultPreferences:
  sttPreference: accurate
```

### I want cheap transcription
```yaml
sttFallbackChain: [faster-whisper-system]  # No GPU cost
defaultPreferences:
  sttPreference: cheap
```

### I want reliable transcription
```yaml
sttFallbackChain: [openai-whisper, faster-whisper-system, whisper-api]
healthCheck:
  strategies: {metadata: true, echo: true, latency: true}
circuitBreaker:
  failureThreshold: 3
  timeoutMs: 15000
```

## Commands Reference

```bash
# Show current providers and health
clawdbot voice status --detailed

# Transcribe audio file
clawdbot voice transcribe recording.wav --preference accurate

# Synthesize text to speech
clawdbot voice synthesize "Hello world" --provider kokoro

# Check health of all providers
clawdbot voice health-check --all

# Show performance metrics
clawdbot voice metrics --format json

# Switch default provider
clawdbot voice config set stt-provider faster-whisper
```

## API Usage

```typescript
// Initialize
const orchestrator = new VoiceOrchestrator()
await orchestrator.initialize()

// Transcribe with automatic fallback
const result = await orchestrator.transcribe(audioBuffer, {
  allowFallback: true,
  trackMetrics: true,
  onProviderSwitch: (from, to) => console.log(`${from} → ${to}`),
})

// Get provider status
const status = await orchestrator.getProviderStatus()

// Switch provider
await orchestrator.switchProvider('stt', 'openai-whisper')

// Cleanup
await orchestrator.shutdown()
```

## Dashboard Integration

```typescript
// React component
export function VoiceControlPanel() {
  const { controller, status } = useVoiceController()

  return (
    <div>
      <h2>Voice Orchestrator</h2>
      <ProviderStatusGrid providers={status?.sttProviders} />
      <ProviderStatusGrid providers={status?.ttsProviders} />
      <FallbackChainVisualization chain={status?.fallbackChains} />
    </div>
  )
}
```

## Performance

```
Operation                   Target          Budget
────────────────────────────────────────────────────
Provider selection         <10ms           5%
Metrics recording          <5ms            5%
Fallback decision          <50ms           5%
Provider execution         100-5000ms      85%
Total overhead             <65ms           10% max
```

## Testing

```bash
# Unit tests
pnpm test orchestrator.test.ts

# Integration tests
CLAWDBOT_LIVE_TEST=1 pnpm test:live

# CLI tests
bun run clawdbot voice transcribe test.wav

# Coverage report
pnpm test:coverage
```

## Monitoring

```bash
# View orchestrator status
GET /api/voice/status

# View provider metrics
GET /api/voice/metrics

# Export metrics
GET /api/voice/metrics/:providerId?format=prometheus
```

## Troubleshooting

| Problem | Solution | Doc |
|---------|----------|-----|
| All providers unhealthy | Check network, restart | QUICK-REF |
| Too many fallbacks | Increase timeouts | MIGRATION |
| High latency | Switch preference | ARCHITECTURE |
| Memory leak | Check history limit | MIGRATION |
| Config not loading | Check priority order | ARCHITECTURE |

## Next Steps

1. **Review** ORCHESTRATOR-QUICK-REFERENCE.md (5 min)
2. **Read** ORCHESTRATOR-ARCHITECTURE.md (30 min)
3. **Plan** implementation using ORCHESTRATOR-MIGRATION.md
4. **Start coding** following ORCHESTRATOR-INTEGRATION.md
5. **Deploy** with 4-week rollout plan

## Related Files

- `registry.ts` - Existing provider registry (being enhanced)
- `executor.ts` - Provider interface (no changes)
- Voice provider implementations (Whisper, Faster-Whisper, Kokoro, etc.)
- `src/commands/voice/*.ts` - CLI commands
- `src/provider-web.ts` - Web API

## Links to Design Documents

- **Architecture**: [ORCHESTRATOR-ARCHITECTURE.md](./ORCHESTRATOR-ARCHITECTURE.md)
- **Integration**: [ORCHESTRATOR-INTEGRATION.md](./ORCHESTRATOR-INTEGRATION.md)
- **Migration**: [ORCHESTRATOR-MIGRATION.md](./ORCHESTRATOR-MIGRATION.md)
- **Summary**: [ORCHESTRATOR-SUMMARY.md](./ORCHESTRATOR-SUMMARY.md)
- **Quick Reference**: [ORCHESTRATOR-QUICK-REFERENCE.md](./ORCHESTRATOR-QUICK-REFERENCE.md)
- **Configuration**: [orchestrator-config.ts](./orchestrator-config.ts)

## Summary

The Voice Orchestrator is a comprehensive, production-ready design for managing voice providers in Clawdbot. This documentation provides:

- **Complete architecture** (1,310 lines)
- **Integration patterns** (1,017 lines)
- **Implementation strategy** (729 lines)
- **Configuration schema** (627 lines)
- **Quick reference** (337 lines)

**Total: ~5,000 lines of design documentation**

All documents are in `/home/tsavo/clawd/clawdbot/src/media/voice-providers/`

Start with ORCHESTRATOR-QUICK-REFERENCE.md for a 5-minute overview.

