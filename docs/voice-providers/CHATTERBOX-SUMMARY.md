# Chatterbox TTS Provider - Architectural Summary

**Completed:** January 16, 2026
**Status:** Ready for Implementation
**Deliverables:** 4 comprehensive documents + code templates

## What Was Delivered

### 1. CHATTERBOX-ARCHITECTURE.md (Primary Design Document)
**Location:** `/home/tsavo/clawd/clawdbot/docs/voice-providers/CHATTERBOX-ARCHITECTURE.md`

**Contents:**
- Executive summary of Chatterbox capabilities
- Provider integration model with system diagrams
- Detailed deployment strategies (Docker/System/Cloud)
- Configuration schema with all 23 languages
- Audio normalization pipeline
- Error handling strategy with retryable/non-retryable classification
- Performance characteristics and resource requirements
- Testing strategy and examples
- Security considerations
- Monitoring and metrics approach
- Comparison with existing providers (Whisper, Kokoro, ElevenLabs)
- Troubleshooting guide
- Code examples for initialization, synthesis, voice cloning, streaming, and orchestrator integration

**Key Sections:**
- Architecture Overview (system diagram)
- Executor Pattern explanation
- Three deployment strategies analyzed
- Configuration schema with voice cloning options
- Resource requirements (minimum and recommended)
- Live test examples
- API reference for Docker endpoints

### 2. CHATTERBOX-IMPLEMENTATION-GUIDE.md (Step-by-Step Guide)
**Location:** `/home/tsavo/clawd/clawdbot/docs/voice-providers/CHATTERBOX-IMPLEMENTATION-GUIDE.md`

**Contents:**
- Quick start section
- File structure (5 new TypeScript files, ~2000 LOC total)
- Step-by-step implementation with complete code templates:
  - **Step 1:** Base executor (~450 LOC)
  - **Step 2:** Docker handler (~350 LOC)
  - **Step 3:** System handler (~400 LOC)
  - **Step 4:** Service utilities (~300 LOC)
  - **Step 5:** Tests (~500 LOC)
- Configuration integration example
- Testing checklist
- Reference to existing provider files

**Ready-to-Use Code:**
- Full `ChatterboxExecutor` class with lifecycle management
- `ChatterboxDockerHandler` with HTTP API communication
- `ChatterboxSystemHandler` with Python subprocess management
- Service utilities for audio conversion, voice cloning, model management
- Comprehensive test suite with vitest

### 3. CHATTERBOX-INTEGRATION-CHECKLIST.md (Project Management)
**Location:** `/home/tsavo/clawd/clawdbot/docs/voice-providers/CHATTERBOX-INTEGRATION-CHECKLIST.md`

**Contents:**
- Pre-implementation checklist (design review, environment setup, dependencies)
- 7 implementation phases with checkboxes:
  - Phase 1: Foundation (weeks 1-2)
  - Phase 2: Core Features (weeks 2-3)
  - Phase 3: Advanced Features (weeks 3-4)
  - Phase 4: Orchestrator Integration (week 4)
  - Phase 5: Documentation & Polish (weeks 4-5)
  - Phase 6: Production Readiness (week 5)
  - Phase 7: Release & Communication (week 5)
- Integration points checklist
- Provider comparison matrix
- Rollout strategy
- Success criteria (functional, performance, quality, reliability, UX)
- Risk mitigation table
- Sign-off section

**Project Management Value:**
- 150+ checkboxes for granular tracking
- Detailed risk assessment
- Success metrics defined
- Rollout timeline (5 weeks total)

### 4. CHATTERBOX-SUMMARY.md (This Document)
**Location:** `/home/tsavo/clawd/clawdbot/docs/voice-providers/CHATTERBOX-SUMMARY.md`

## Architecture Highlights

### Design Pattern
Chatterbox follows the established `VoiceProviderExecutor` pattern used by Whisper, Kokoro, and ElevenLabs:

```
VoiceProviderExecutor (interface)
    ↓
ChatterboxExecutor (concrete implementation)
    ├── DockerHandler (HTTP to container)
    ├── SystemHandler (Python subprocess)
    └── CloudHandler (API integration)
```

### Three Deployment Modes

**Docker (Recommended for Production)**
```yaml
image: resemble-ai/chatterbox:latest
port: 8000
gpuEnabled: true
latency: 100-500ms
```

**System (Development/Local)**
```bash
pip install chatterbox-tts
python: 3.10+
latency: 50-200ms (GPU), 1-4s (CPU)
```

**Cloud (Optional Future)**
```
endpoint: https://api.resemble.ai/v2/tts
api_key: from Resemble AI
latency: 800ms-2s
```

### Key Capabilities

- **Languages:** 23 supported (en, es, fr, de, it, nl, pl, pt, ru, ja, ko, zh, vi, tr, ar, th, el, hi, and 5 more)
- **Voice Cloning:** Zero-shot (1-30 seconds of reference audio)
- **Prosody Control:** Emotion (happy, sad, angry, excited) + expressiveness
- **Watermarking:** PerTh watermarking survives MP3 compression
- **Speed Control:** 0.5x to 2.0x playback speed
- **Format Support:** PCM_16, MP3, WAV (extensible)

## Integration with Clawdbot

### Orchestrator Integration
```typescript
// Configuration
const chatterboxEntry: VoiceProviderEntry = {
  id: 'chatterbox-docker',
  name: 'Chatterbox (Docker)',
  type: 'tts',  // TTS-only provider
  priority: 20, // High priority
  deployment: 'docker',
  enabled: true,
};

// Fallback chain
ttsFallbackChain: [
  'chatterbox-docker',    // Primary
  'chatterbox-system',    // Secondary
  'kokoro-system',        // Tertiary
  'elevenlabs-api',       // Final fallback
]
```

### Usage from Application
```typescript
// Via orchestrator
const audio = await orchestrator.synthesize('Hello world!', {
  voice: 'en_US_female_1',
  language: 'en',
  speed: 1.0,
});

// With voice cloning
const audio = await orchestrator.synthesize('Custom voice text', {
  voiceCloning: {
    enabled: true,
    referenceAudio: referenceBuffer,
    referenceDuration: 5000,
  },
});

// With prosody
const audio = await orchestrator.synthesize('Excited message!', {
  prosody: {
    emotionLevel: 'excited',
    expressiveness: 0.8,
  },
});
```

## File Structure

**New Files to Create:**
```
src/media/voice-providers/
├── chatterbox.ts                (450 LOC) - Main executor
├── chatterbox.docker.ts         (350 LOC) - Docker handler
├── chatterbox.system.ts         (400 LOC) - System handler
├── chatterbox.service.ts        (300 LOC) - Utilities
└── chatterbox.test.ts           (500 LOC) - Tests
```

**Total New Code:** ~2000 lines of TypeScript

**Modified Files:**
- `src/media/voice-providers/orchestrator.ts` - Add factory method
- `src/config/voice-providers.config.ts` - Add Chatterbox entry
- `docs/voice-providers/` - Add 4 new markdown files

## Performance Profile

### Latency
| Deployment | First Request | Subsequent | Best For |
|-----------|----------------|-----------|----------|
| Docker | 500-2000ms | 100-500ms | Production |
| System GPU | 200-800ms | 50-200ms | Development |
| System CPU | 2-8s | 1-4s | Low-resource |
| Cloud API | 1-3s | 800ms-2s | Premium |

### Resource Usage
| Model | VRAM | RAM | Disk |
|-------|------|-----|------|
| Base | 2-4GB | 4-8GB | 1-2GB |
| Large | 4-8GB | 8-16GB | 2-4GB |
| XLarge | 8-16GB | 16-32GB | 4-8GB |

### Throughput
- Docker: 10-20 concurrent requests
- System (GPU): 2-5 concurrent requests
- System (CPU): 1-2 concurrent requests

## Error Handling

**13 Defined Error Codes:**
1. `MODEL_LOAD_FAILED` - Model download/loading failed
2. `GPU_NOT_AVAILABLE` - GPU not found, using CPU
3. `INVALID_CONFIG` - Configuration validation failed
4. `VOICE_NOT_FOUND` - Voice ID not recognized
5. `VOICE_CLONE_FAILED` - Voice cloning process failed
6. `INVALID_REFERENCE_AUDIO` - Reference audio format/duration invalid
7. `TEXT_TOO_LONG` - Text exceeds maximum length (5000 chars)
8. `UNSUPPORTED_LANGUAGE` - Language not in supported list (23)
9. `SYNTHESIS_TIMEOUT` - Synthesis exceeded timeout
10. `SYNTHESIS_FAILED` - General synthesis error
11. `DOCKER_UNREACHABLE` - Cannot connect to Docker container
12. `API_ERROR` - Cloud API error
13. `RATE_LIMITED` - Rate limit exceeded

**Retryable vs. Non-Retryable:**
- Retryable: Timeout, GPU unavailable, Docker unreachable, rate limited
- Non-retryable: Unsupported language, invalid voice, invalid audio, text too long

## Testing Strategy

### Unit Tests (~200 LOC)
- Configuration validation
- Input validation
- Capabilities reporting
- Error handling

### Integration Tests (~200 LOC)
- Docker handler HTTP communication
- System handler subprocess management
- Synthesis with various parameters
- Health check integration

### Live Tests (~100 LOC)
- Real Docker container synthesis
- Real Python subprocess synthesis
- GPU detection and fallback
- End-to-end orchestrator integration

## Security & Compliance

**Covered:**
- API keys in environment variables only (never hardcoded)
- Audio data not persisted without consent
- Docker image hash verification
- Input sanitization for text/audio/parameters
- Error messages don't leak sensitive information
- MIT license (fully open-source, no commercial restrictions)

## Migration Path from Other Providers

### From Kokoro
```typescript
// Kokoro supports only 1 language, limited voices
// Chatterbox: 23 languages, unlimited voice cloning

// Replace fallback chain entry
ttsFallbackChain: [
  'chatterbox-docker',  // Add this
  'kokoro-system',      // Keep as secondary
]
```

### From ElevenLabs
```typescript
// ElevenLabs: Cloud-only, $$cost, proprietary
// Chatterbox: Docker/System/Cloud, $0 self-hosted, open-source

// Both support voice cloning
// Chatterbox: zero-shot (no training required)
// ElevenLabs: more voice options, higher quality

// Recommended: Use both in fallback chain
ttsFallbackChain: [
  'elevenlabs-api',         // Primary (premium quality)
  'chatterbox-docker',      // Secondary (cost-effective)
  'kokoro-system',          // Tertiary (local fallback)
]
```

## Dependencies

**No new npm dependencies required:**
- Uses existing `node-fetch` (already in package.json)
- Uses existing `@types/node` for TypeScript
- Python subprocess (Chatterbox handles its own dependencies)

**Dependency Changes:**
- 0 new npm packages
- 0 updated versions
- 0 security concerns

## Estimated Implementation Timeline

- **Phase 1 (Foundation):** 2 weeks - Executor skeleton, error handling, tests
- **Phase 2 (Core):** 1 week - Docker/System handlers, synthesis
- **Phase 3 (Advanced):** 1 week - Voice cloning, prosody, formats
- **Phase 4 (Integration):** 3 days - Orchestrator, configuration
- **Phase 5 (Polish):** 3-4 days - Docs, linting, coverage
- **Phase 6 (Production):** 3-4 days - Performance testing, security audit
- **Phase 7 (Release):** 1-2 days - Release notes, announcement

**Total: 4-5 weeks**

## Comparison with Existing Providers

```
┌─────────────┬──────────┬────────┬──────────────┬──────────────┐
│ Feature     │ Whisper  │ Kokoro │ Chatterbox   │ ElevenLabs   │
├─────────────┼──────────┼────────┼──────────────┼──────────────┤
│ Type        │ STT      │ TTS    │ TTS          │ TTS          │
│ Languages   │ 90+      │ 1      │ 23           │ 30+          │
│ Quality     │ High     │ High   │ High         │ Very High    │
│ Cloning     │ N/A      │ No     │ Yes (0-shot) │ Yes (API)    │
│ Open Source │ Yes      │ Yes    │ Yes (MIT)    │ No           │
│ Cost        │ $0       │ $0     │ $0 (self)    │ $$           │
│ Deployment  │ Any      │ Any    │ Any          │ Cloud only   │
│ Latency     │ N/A      │ 100-   │ 100-500ms    │ 800ms-2s     │
│             │          │ 300ms  │ (Docker)     │              │
└─────────────┴──────────┴────────┴──────────────┴──────────────┘
```

## Next Steps

### Immediate (Week 1)
1. [ ] Review architecture with team
2. [ ] Validate Docker setup with test pull
3. [ ] Assign implementation team
4. [ ] Set up development branch

### Short-term (Weeks 2-4)
1. [ ] Implement Phase 1-4 per checklist
2. [ ] Weekly team syncs for blockers
3. [ ] Continuous testing and validation

### Medium-term (Week 5)
1. [ ] Complete production readiness
2. [ ] Security audit
3. [ ] Performance benchmarks

### Final (Week 5+)
1. [ ] Code review and sign-off
2. [ ] Merge to main
3. [ ] Release announcement
4. [ ] Monitor production metrics

## Documentation Links

- **Architecture:** `/docs/voice-providers/CHATTERBOX-ARCHITECTURE.md`
- **Implementation:** `/docs/voice-providers/CHATTERBOX-IMPLEMENTATION-GUIDE.md`
- **Checklist:** `/docs/voice-providers/CHATTERBOX-INTEGRATION-CHECKLIST.md`
- **Existing Patterns:**
  - Kokoro TTS: `src/media/voice-providers/kokoro.ts`
  - Docker Handler: `src/media/voice-providers/faster-whisper.docker.ts`
  - Orchestrator: `src/media/voice-providers/orchestrator.ts`

## Contact & Support

- **Architecture Owner:** System Architecture Designer
- **Implementation Lead:** (To be assigned)
- **QA Lead:** (To be assigned)
- **DevOps:** Docker setup and deployment
- **Security:** Audio data handling and API key management

## Appendix: Quick Reference

### Configuration Example
```typescript
const config: ChatterboxDeploymentConfig = {
  mode: 'docker',
  docker: {
    image: 'resemble-ai/chatterbox:latest',
    port: 8000,
    gpuEnabled: true,
    healthCheckInterval: 30000,
  },
};

const executor = new ChatterboxExecutor(config);
await executor.initialize();
```

### Docker Compose Example
```yaml
version: '3.8'
services:
  chatterbox:
    image: resemble-ai/chatterbox:latest
    ports:
      - "8000:8000"
    environment:
      CHATTERBOX_LOG_LEVEL: info
      CHATTERBOX_MODEL_PRECISION: fp16
    volumes:
      - chatterbox-models:/models
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]

volumes:
  chatterbox-models:
```

### Synthesis Example
```typescript
const audio = await executor.synthesize(
  'Hello, world!',
  {
    voice: 'en_US_female_1',
    language: 'en',
    speed: 1.0,
    format: AudioFormat.PCM_16,
    prosody: {
      emotionLevel: 'happy',
      expressiveness: 0.7,
    },
  },
);
```

---

**Document Status:** Complete and Ready for Implementation
**Last Updated:** January 16, 2026
**Total Documentation:** 4 markdown files, 15,000+ words, 150+ code examples
