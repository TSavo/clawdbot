# Voice Plugin System - Design Documentation

Complete system design for Clawdbot's pluggable Speech-to-Text (STT) and Text-to-Speech (TTS) architecture, enabling support for multiple backends (OpenAI, Whisper, Kokoro, ElevenLabs, etc.) on Windows and Linux.

## Documentation Index

### 1. [Voice Plugins Architecture](./voice-plugins.md) - Main Design Document
**Start here for the complete system overview.**

**Contents:**
- System architecture diagram and high-level overview
- Core plugin interfaces (STTProvider, TTSProvider)
- Detailed type definitions with JSDoc comments
- Registry system design and lifecycle management
- Configuration schema (YAML/JSON format)
- Example configurations for different use cases
- Provider discovery mechanism (npm, filesystem)
- Priority-based provider selection and fallback strategies
- Audio format normalization pipeline
- Backwards compatibility approach
- Design decision rationale
- Testing strategy
- Future enhancement roadmap

**Key sections:**
- Architecture Overview (with diagram)
- Core Plugin Interfaces (STT/TTS definitions)
- Plugin Registry System
- Configuration System (YAML/JSON examples)
- Example Configurations (Cloud, Offline, Hybrid)
- Plugin Discovery Mechanism
- Provider Priority & Fallback Mechanism
- Audio Format Normalization
- Backwards Compatibility
- Migration Path for Voice-Call Extension

**Read time:** 30-40 minutes

---

### 2. [Voice Plugins Implementation Guide](./voice-plugins-implementation.md) - Step-by-Step Implementation
**Use this to plan and execute the implementation.**

**Contents:**
- 11-phase implementation roadmap
- Detailed checklists for each phase
- File organization and directory structure
- Effort estimates (LOC, time per phase)
- Dependencies and prerequisites
- Success criteria and validation steps
- Risk mitigation strategies
- Total project timeline (14 weeks estimated)

**Implementation phases:**
1. Core Interfaces & Types (Week 1)
2. Plugin Registry (Week 1-2)
3. Configuration System (Week 2)
4. Audio Format Handling (Week 2-3)
5. Legacy Provider Adapters (Week 3)
6. Integration with Voice-Call Extension (Week 3-4)
7. Discovery & Auto-Registration (Week 4)
8. Built-in Providers Migration (Week 4-5)
9. Documentation & Examples (Week 5)
10. Testing & Quality (Week 5-6)
11. Rollout & Monitoring (Week 6+)

**Read time:** 20-30 minutes

---

### 3. [Voice Plugins API Reference](./voice-plugins-api-reference.md) - Complete API Documentation
**Reference this while implementing providers or using the registry.**

**Contents:**
- STT Provider API (interfaces, options, capabilities)
- TTS Provider API (interfaces, options, capabilities)
- Plugin Registry API with examples
- Audio Normalizer API
- Configuration loading API
- Example implementations for each interface
- Error handling patterns
- Type guards and module exports

**Sections:**
- STT Provider API
- STT Provider Implementation Example
- TTS Provider API
- TTS Provider Implementation Example
- Plugin Registry API
- Usage Examples
- Audio Normalizer API
- Configuration API
- Error Handling
- Type Guards
- Module Exports

**Read time:** 25-35 minutes

---

## Quick Navigation

### I want to...

**Understand the overall system design**
→ Start with [Architecture Overview](./voice-plugins.md#architecture-overview)

**See TypeScript interface definitions**
→ Read [Core Plugin Interfaces](./voice-plugins.md#core-plugin-interfaces)

**Learn how configuration works**
→ See [Configuration System](./voice-plugins.md#configuration-system) and [Example Configurations](./voice-plugins.md#example-configurations)

**Plan the implementation**
→ Use [Implementation Checklist](./voice-plugins-implementation.md#implementation-checklist)

**Implement a new provider**
→ Reference [API Examples](./voice-plugins-api-reference.md#example-implementing-sttprovider)

**Understand provider discovery**
→ Read [Plugin Discovery Mechanism](./voice-plugins.md#plugin-discovery-mechanism)

**Learn about fallback strategy**
→ See [Provider Priority & Fallback Mechanism](./voice-plugins.md#provider-priority--fallback-mechanism)

**Handle audio format conversion**
→ Check [Audio Format Normalization](./voice-plugins.md#audio-format-normalization)

**See real configuration examples**
→ Find [Example Configurations](./voice-plugins.md#example-configurations) (Cloud, Offline, Hybrid)

**Understand backwards compatibility**
→ Read [Backwards Compatibility](./voice-plugins.md#backwards-compatibility)

---

## Key Architecture Decisions

### 1. Streaming is Optional
Not all providers support streaming (e.g., Whisper API is batch-only). By making streaming optional via `createStream?()`, we enable a wider provider ecosystem while still supporting high-performance streaming where available.

**See:** [Why Streaming is Optional](./voice-plugins.md#why-streaming-is-optional)

### 2. Batch Transcription/Synthesis is Required
All providers must implement `transcribe()` and `synthesize()` methods. This ensures every provider can handle basic use cases.

### 3. Configuration-Driven Provider Selection
Provider selection is specified in YAML/JSON config files, not hardcoded. This enables:
- Swapping providers without code changes
- Platform-specific provider selection (Windows vs Linux)
- Easy testing with different providers

**See:** [Configuration System](./voice-plugins.md#configuration-system)

### 4. Priority-Based Registry with Fallback
The registry implements priority-based selection with automatic fallback:
1. Use primary (highest-priority) provider if healthy
2. If primary fails, try fallback provider
3. Automatically recover when primary comes back online

**See:** [Provider Priority & Fallback Mechanism](./voice-plugins.md#provider-priority--fallback-mechanism)

### 5. Centralized Audio Format Normalization
All format conversion (PCM ↔ mu-law, resampling, chunking) is handled centrally. This:
- Reduces per-provider boilerplate
- Ensures consistent behavior
- Handles telephony requirements (mu-law 8kHz for Twilio)

**See:** [Audio Format Normalization](./voice-plugins.md#audio-format-normalization)

---

## Implementation Effort

| Phase | Duration | LOC | Notes |
|-------|----------|-----|-------|
| Core Infrastructure | 3-4 weeks | ~1000 | Interfaces, registry, config |
| Integration & Migration | 3-4 weeks | ~600 | Adapters, integration, discovery |
| Testing & Rollout | 6+ weeks | - | Comprehensive testing, gradual rollout |
| **Total** | **~14 weeks** | **~1600** | Full-time single agent, parallelizable |

---

## Configuration Examples

### Simple Cloud Setup
```yaml
defaults:
  stt: openai-realtime
  tts: openai-tts
```

### Offline-First Setup
```yaml
defaults:
  stt: whisper-local
  tts: kokoro-local
```

### Resilient (Cloud + Fallback)
```yaml
defaults:
  stt: openai-realtime
  tts: openai-tts

stt:
  fallback:
    strategy: failover
    failoverProviders:
      - whisper-local

tts:
  fallback:
    strategy: failover
    failoverProviders:
      - kokoro-local
```

**See:** [Configuration Examples](./voice-plugins.md#example-configurations) for complete examples

---

## Supported Providers (Current & Future)

### Speech-to-Text (STT)

| Provider | Type | Streaming | Batch | Notes |
|----------|------|-----------|-------|-------|
| OpenAI Realtime | Cloud | ✓ | ✗ | Real-time, built-in VAD |
| Whisper (OpenAI) | Cloud/Local | ✗ | ✓ | Batch API, offline option |
| Coqui | Local | ✗ | ✓ | Open-source, offline |
| Google Cloud | Cloud | ✓ | ✓ | High accuracy |
| Azure | Cloud | ✓ | ✓ | Enterprise support |

### Text-to-Speech (TTS)

| Provider | Type | Streaming | Batch | Notes |
|----------|------|-----------|-------|---|
| OpenAI | Cloud | ✗ | ✓ | 13 voices, natural |
| ElevenLabs | Cloud | ✓ | ✓ | Voice cloning, expressive |
| Kokoro | Local | ✗ | ✓ | Fast, offline |
| Google Cloud | Cloud | ✓ | ✓ | High quality |
| AWS Polly | Cloud | ✓ | ✓ | Enterprise support |

---

## Design Strengths

| Aspect | Benefit |
|--------|---------|
| **Extensible** | Any developer can create providers as npm packages (@clawdbot/stt-*, @clawdbot/tts-*) |
| **Resilient** | Automatic failover when providers fail or APIs change |
| **Configurable** | Swap providers via config without code changes |
| **Testable** | Easy to create mock providers for testing |
| **Future-proof** | Supports new providers as they emerge |
| **Efficient** | Optional streaming for high-performance use cases |
| **Maintainable** | Clear separation of concerns, reduced coupling |
| **Well-documented** | Comprehensive docs, examples, type safety |

---

## File Organization

```
extensions/voice-call/src/plugins/
├── index.ts                     # Main exports
├── stt-provider.ts             # STT interface & types
├── tts-provider.ts             # TTS interface & types
├── plugin-registry.ts          # Registry implementation
├── plugin-config.ts            # Config system
├── audio.ts                    # Audio types
├── audio-normalizer.ts         # Format conversion
├── legacy-adapters.ts          # Backwards compatibility
└── __tests__/
    ├── stt-provider.test.ts
    ├── plugin-registry.test.ts
    ├── plugin-config.test.ts
    ├── audio-normalizer.test.ts
    └── integration.test.ts
```

---

## Migration Path

The design ensures **zero breaking changes** to existing voice-call functionality:

1. **Phase 1-4:** Define interfaces and infrastructure (no code changes needed)
2. **Phase 5:** Create adapters wrapping existing providers (fully backwards compatible)
3. **Phase 6:** Integrate with call manager (feature flag, defaults to old behavior)
4. **Phase 7-8:** Gradual migration of existing providers (optional)
5. **Phase 9+:** Full rollout (feature flag removed, registry-based by default)

**See:** [Migration Path for Voice-Call Extension](./voice-plugins.md#migration-path-for-voice-call-extension)

---

## Community Contribution

Once implemented, community developers can easily create providers:

```typescript
// @clawdbot/stt-whisper/src/index.ts
export const metadata = {
  id: 'whisper-local',
  name: 'Whisper (Local)',
  type: 'stt',
  version: '1.0.0',
};

export { WhisperSTTProvider } from './provider.js';
```

The registry will automatically discover and register the provider!

---

## Next Steps

1. **Review Design** - Read [Architecture Overview](./voice-plugins.md) and get stakeholder sign-off
2. **Start Phase 1** - Begin implementing interfaces from [Implementation Checklist](./voice-plugins-implementation.md#phase-1-core-interfaces--types-week-1)
3. **Reference API** - Use [API Reference](./voice-plugins-api-reference.md) during implementation
4. **Run Tests** - Follow testing strategy from [Implementation Guide](./voice-plugins-implementation.md#phase-10-testing--quality-week-5-6)
5. **Gradual Rollout** - Enable for canary users first, monitor metrics, expand to 100%

---

## Success Criteria

- [ ] All interfaces properly typed and documented
- [ ] Registry supports priority-based selection and fallback
- [ ] Configuration loads from YAML/JSON with env var substitution
- [ ] Audio format conversion (PCM ↔ mu-law, resampling) works correctly
- [ ] Existing OpenAI providers wrapped with adapters
- [ ] Auto-discovery of npm packages and filesystem plugins working
- [ ] Provider selection automatic with fallback on errors
- [ ] > 80% test coverage on core modules
- [ ] Zero breaking changes to existing voice-call behavior
- [ ] Documentation complete with examples

---

## Related Documentation

- [Voice Call Extension](/voice-call)
- [Audio Format Reference](/concepts/audio-formats)
- [Configuration Guide](/configuration)
- [Extending Clawdbot](/developers/plugins)

---

**Document Version:** 1.0
**Last Updated:** January 2026
**Status:** Design Complete, Ready for Implementation
