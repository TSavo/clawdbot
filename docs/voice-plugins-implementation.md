# Voice Plugin System - Implementation Guide

This document provides step-by-step implementation checklists for building out the pluggable STT/TTS architecture.

## Implementation Checklist

### Phase 1: Core Interfaces & Types (Week 1)

**Goal:** Define the plugin interface contracts without implementation.

- [ ] Create `extensions/voice-call/src/plugins/` directory structure
- [ ] Define STT Provider interface (`stt-provider.ts`)
  - [ ] `STTOptions` - transcription configuration
  - [ ] `STTPartial` - streaming partial result
  - [ ] `STTStream` - streaming session
  - [ ] `STTCapabilities` - provider metadata
  - [ ] `STTAudioFormat` - supported formats
  - [ ] `STTProvider` - main interface with `transcribe()` and `createStream?()`
- [ ] Define TTS Provider interface (`tts-provider.ts`)
  - [ ] `TTSOptions` - synthesis configuration
  - [ ] `TTSStream` - streaming session
  - [ ] `TTSCapabilities` - provider metadata
  - [ ] `TTSAudioFormat` - supported formats
  - [ ] `TTSVoiceMetadata` - voice information
  - [ ] `TTSProvider` - main interface with `synthesize()` and `createStream?()`
- [ ] Create type exports (`plugins/index.ts`)
- [ ] Add unit tests for type definitions (ensure all types are correctly defined)
- [ ] Document interface contracts in JSDoc comments
- [ ] **Estimate:** 200-250 LOC

### Phase 2: Plugin Registry (Week 1-2)

**Goal:** Implement provider registration, discovery, and health checking.

- [ ] Create registry interface (`plugin-registry.ts`)
  - [ ] `register(id, provider, priority)` - add provider
  - [ ] `unregister(id)` - remove provider
  - [ ] `get(id)` - retrieve by ID
  - [ ] `getPrimary()` - highest-priority provider
  - [ ] `getFallback()` - second-highest priority
  - [ ] `list()` - list all providers
  - [ ] `setDefault(id)` - set default provider
  - [ ] `getActive()` / `setActive()` - get/set currently used provider
  - [ ] `healthCheck()` - run health checks on all
  - [ ] `discover(options)` - auto-discover providers
  - [ ] `shutdown()` - cleanup
- [ ] Implement `STTRegistry` class
  - [ ] In-memory provider map with priority sorting
  - [ ] Cache health check results with TTL
  - [ ] Event emission (provider-registered, provider-failed, etc.)
- [ ] Implement `TTSRegistry` class (similar to STT)
- [ ] Add discovery mechanism
  - [ ] Discover built-in providers
  - [ ] Scan npm packages matching @clawdbot/stt-*, @clawdbot/tts-*
  - [ ] Load from filesystem directory (if env var set)
- [ ] Unit tests
  - [ ] Test registration/unregistration
  - [ ] Test priority ordering
  - [ ] Test health checks
  - [ ] Test provider discovery
  - [ ] Test failover logic
- [ ] **Estimate:** 300-400 LOC + 200-300 LOC tests

### Phase 3: Configuration System (Week 2)

**Goal:** Load provider configuration from YAML/JSON files.

- [ ] Create configuration types (`plugin-config.ts`)
  - [ ] `VoicePluginConfig` - top-level config
  - [ ] `STTProviderConfig` - per-provider STT config
  - [ ] `TTSProviderConfig` - per-provider TTS config
  - [ ] `FallbackConfig` - failover strategy
  - [ ] `AudioConfig` - format settings
  - [ ] `PlatformConfig` - Windows/Linux specific
- [ ] Implement config loader
  - [ ] Load YAML from `~/.clawdbot/voice-providers.yaml`
  - [ ] Load JSON from `CLAWDBOT_VOICE_PLUGINS_CONFIG` env var
  - [ ] Support environment variable substitution (`${OPENAI_API_KEY}`)
  - [ ] Validate config against schema (Zod or similar)
  - [ ] Handle missing/partial configs gracefully
  - [ ] Support platform-specific overrides (detect Windows vs Linux)
- [ ] Create example configs
  - [ ] `examples/voice-providers.openai.yaml` - Cloud-only setup
  - [ ] `examples/voice-providers.offline.yaml` - Local-only setup
  - [ ] `examples/voice-providers.hybrid.yaml` - Cloud + fallback
  - [ ] `examples/voice-providers.elevenlabs.yaml` - ElevenLabs setup
- [ ] Unit tests
  - [ ] Test YAML parsing
  - [ ] Test JSON parsing
  - [ ] Test env var substitution
  - [ ] Test config validation
  - [ ] Test schema errors
  - [ ] Test fallback to defaults
- [ ] **Estimate:** 200-250 LOC + 150-200 LOC tests

### Phase 4: Audio Format Handling (Week 2-3)

**Goal:** Implement audio format conversion and normalization.

- [ ] Create audio types (`audio.ts`)
  - [ ] `AudioFormat` - format descriptor (PCM, WAV, mu-law, etc.)
  - [ ] `AudioFormatHint` - hint for format detection
  - [ ] `AudioEffect` - effects (gain, filters, etc.)
- [ ] Implement `AudioNormalizer` class
  - [ ] `detect(buffer, hint)` - detect format from bytes
  - [ ] `convert(buffer, from, to)` - format conversion
  - [ ] `resample(buffer, fromRate, toRate, method)` - sample rate conversion
  - [ ] `chunk(buffer, chunkSizeMs, sampleRate)` - split into frames
  - [ ] `apply(buffer, effects)` - apply audio effects
- [ ] Implement format-specific converters
  - [ ] PCM ↔ WAV (add/strip WAV header)
  - [ ] PCM ↔ mu-law (G.711 encoding)
  - [ ] Resampling (linear, cubic, sinc)
  - [ ] Byte-order handling (LE, BE)
- [ ] Handle edge cases
  - [ ] Mono/stereo conversion
  - [ ] Bit depth scaling (16-bit → 8-bit, etc.)
  - [ ] Empty buffer handling
  - [ ] Malformed audio detection
- [ ] Unit tests
  - [ ] Test PCM ↔ mu-law conversion
  - [ ] Test resampling accuracy
  - [ ] Test chunking alignment
  - [ ] Test format detection
  - [ ] Test error handling
  - [ ] Performance tests (ensure < 100ms for typical audio)
- [ ] **Estimate:** 250-350 LOC + 200-250 LOC tests

### Phase 5: Legacy Provider Adapters (Week 3)

**Goal:** Wrap existing OpenAI providers to implement new interfaces.

- [ ] Create adapter types (`legacy-adapters.ts`)
  - [ ] `LegacySTTAdapter` - wraps `OpenAIRealtimeSTTProvider`
  - [ ] `LegacyTTSAdapter` - wraps `OpenAITTSProvider`
- [ ] Implement `LegacySTTAdapter`
  - [ ] Implement `STTProvider` interface
  - [ ] Map `transcribe()` to legacy streaming session
  - [ ] Wrap legacy `createSession()` as new `STTStream`
  - [ ] Provide capabilities metadata
  - [ ] Support health checks
- [ ] Implement `LegacyTTSAdapter`
  - [ ] Implement `TTSProvider` interface
  - [ ] Map `synthesize()` to legacy provider
  - [ ] Provide capabilities metadata
  - [ ] Support `synthesizeForTwilio()` conversion
- [ ] Update provider exports
  - [ ] Export both legacy and adapter versions
  - [ ] Support gradual migration
- [ ] Unit tests
  - [ ] Test adapter functionality
  - [ ] Test backwards compatibility
  - [ ] Test error handling
- [ ] **Estimate:** 150-200 LOC + 100-150 LOC tests

### Phase 6: Integration with Voice-Call Extension (Week 3-4)

**Goal:** Update call manager to use registry instead of hardcoded providers.

- [ ] Update `extensions/voice-call/src/manager.ts`
  - [ ] Initialize registries on startup
  - [ ] Load config from disk
  - [ ] Auto-discover providers
  - [ ] Run health checks periodically
  - [ ] Use registry for provider selection
  - [ ] Implement automatic failover
  - [ ] Add feature flag for new behavior
- [ ] Update media stream handling
  - [ ] Use `AudioNormalizer` for format conversion
  - [ ] Handle provider-specific format preferences
  - [ ] Add audio format logging for debugging
- [ ] Update call lifecycle
  - [ ] Call `provider.createStream()` for streaming
  - [ ] Call `provider.transcribe()` for batch
  - [ ] Call `provider.synthesize()` for TTS
  - [ ] Implement retry logic with backoff
  - [ ] Emit events for provider changes
- [ ] Error handling & logging
  - [ ] Log provider selection decisions
  - [ ] Log format conversions
  - [ ] Log provider failures
  - [ ] Log fallback activations
- [ ] Integration tests
  - [ ] Test provider selection
  - [ ] Test failover to fallback
  - [ ] Test audio format conversions
  - [ ] Test backwards compatibility
- [ ] **Estimate:** 150-200 LOC + 100-150 LOC tests

### Phase 7: Discovery & Auto-Registration (Week 4)

**Goal:** Implement automatic provider discovery from npm and filesystem.

- [ ] NPM package discovery
  - [ ] Query npm for packages matching @clawdbot/stt-*, @clawdbot/tts-*
  - [ ] Load package.json and check for "clawd-plugin" metadata
  - [ ] Load module and call provider factory function
  - [ ] Register with registry
  - [ ] Handle load failures gracefully
- [ ] Filesystem discovery
  - [ ] Scan `CLAWDBOT_VOICE_PLUGINS_DIR` for plugin packages
  - [ ] Load local packages same way as npm
  - [ ] Support symlinks for development
- [ ] Package metadata format
  - [ ] Define plugin metadata schema
  - [ ] Version compatibility checking
  - [ ] Dependency validation
- [ ] Provider health on startup
  - [ ] Run health checks before activation
  - [ ] Skip unhealthy providers
  - [ ] Log discovery results
- [ ] Unit tests
  - [ ] Test npm package discovery (mock npm)
  - [ ] Test filesystem discovery
  - [ ] Test metadata validation
  - [ ] Test graceful failure handling
- [ ] **Estimate:** 200-250 LOC + 150-200 LOC tests

### Phase 8: Built-in Providers Migration (Week 4-5)

**Goal:** Refactor existing OpenAI providers to implement new interfaces directly.

- [ ] Refactor `stt-openai-realtime.ts`
  - [ ] Implement `STTProvider` interface directly
  - [ ] Add capabilities metadata
  - [ ] Add `healthCheck()` method
  - [ ] Add `shutdown()` method
  - [ ] Implement batch `transcribe()` method
  - [ ] Keep existing `createStream()` implementation
- [ ] Refactor `tts-openai.ts`
  - [ ] Implement `TTSProvider` interface directly
  - [ ] Add capabilities metadata
  - [ ] Add voice list caching
  - [ ] Update `synthesize()` signature
  - [ ] Add `getVoices()` method
- [ ] Remove legacy adapters (after validation)
- [ ] Update imports and exports
- [ ] Integration tests
  - [ ] Test refactored providers still work
  - [ ] Test registry usage
  - [ ] Test backwards compatibility
- [ ] **Estimate:** 100-150 LOC changes

### Phase 9: Documentation & Examples (Week 5)

**Goal:** Create comprehensive documentation and example plugins.

- [ ] Update main docs
  - [ ] Add voice-plugins.md (comprehensive design doc)
  - [ ] Update voice-call README with plugin info
  - [ ] Add configuration examples
- [ ] Create example providers
  - [ ] `examples/stt-mock.ts` - simple mock provider
  - [ ] `examples/tts-mock.ts` - simple mock provider
  - [ ] Document plugin development guide
- [ ] Create community provider templates
  - [ ] `@clawdbot/stt-whisper` template
  - [ ] `@clawdbot/tts-elevenlabs` template
- [ ] API documentation
  - [ ] JSDoc all interfaces
  - [ ] Document error codes
  - [ ] Provide troubleshooting guide
- [ ] **Estimate:** 100-200 LOC + 2000+ words docs

### Phase 10: Testing & Quality (Week 5-6)

**Goal:** Ensure comprehensive test coverage and quality.

- [ ] Unit test coverage
  - [ ] Aim for > 80% coverage on core modules
  - [ ] Test error cases and edge cases
  - [ ] Test resource cleanup
  - [ ] Test concurrent operations
- [ ] Integration tests
  - [ ] Test full provider lifecycle
  - [ ] Test registry with multiple providers
  - [ ] Test fallover scenarios
  - [ ] Test config loading and validation
- [ ] Performance tests
  - [ ] Benchmark audio format conversion
  - [ ] Measure provider discovery time
  - [ ] Test latency under load
- [ ] Compatibility tests
  - [ ] Test on Windows and Linux
  - [ ] Test with different Node.js versions
  - [ ] Test with different provider configurations
- [ ] Run full test suite
  - [ ] `pnpm test` passes
  - [ ] `pnpm lint` passes
  - [ ] `pnpm build` succeeds
  - [ ] `pnpm test:coverage` meets thresholds
- [ ] **Estimate:** 400-600 LOC tests

### Phase 11: Rollout & Monitoring (Week 6+)

**Goal:** Release with gradual rollout and monitoring.

- [ ] Pre-release validation
  - [ ] Test with real OpenAI API
  - [ ] Test with real Twilio calls
  - [ ] Test config loading from ~/.clawdbot
  - [ ] Test backwards compatibility
- [ ] Gradual rollout
  - [ ] Enable for canary users first
  - [ ] Monitor error rates and latency
  - [ ] Collect feedback from early adopters
- [ ] Monitoring setup
  - [ ] Add metrics for provider usage
  - [ ] Add metrics for failover events
  - [ ] Add metrics for audio format conversions
  - [ ] Add metrics for provider errors
- [ ] Documentation
  - [ ] Create migration guide for users
  - [ ] Add troubleshooting section
  - [ ] Document new configuration options
- [ ] Cleanup
  - [ ] Remove feature flags once stable
  - [ ] Archive old docs
  - [ ] Update changelog

## File Structure

```
extensions/voice-call/src/
├── plugins/
│   ├── index.ts                 # Exports
│   ├── stt-provider.ts          # STT interface & types
│   ├── tts-provider.ts          # TTS interface & types
│   ├── plugin-registry.ts       # Registry implementation
│   ├── plugin-config.ts         # Config loading & validation
│   ├── audio.ts                 # Audio types
│   ├── audio-normalizer.ts      # Format conversion
│   ├── legacy-adapters.ts       # Backwards compatibility
│   └── __tests__/
│       ├── stt-provider.test.ts
│       ├── tts-provider.test.ts
│       ├── plugin-registry.test.ts
│       ├── plugin-config.test.ts
│       ├── audio-normalizer.test.ts
│       ├── legacy-adapters.test.ts
│       └── integration.test.ts
├── providers/
│   ├── index.ts                 # Updated exports
│   ├── stt-openai-realtime.ts   # Refactored
│   ├── tts-openai.ts            # Refactored
│   ├── base.ts                  # (existing voice call base)
│   └── ... (other providers)
└── config/
    └── voice-providers.yaml     # Example config
```

## Estimated Total Effort

| Phase | LOC | Tests | Weeks | Total |
|-------|-----|-------|-------|-------|
| 1: Interfaces | 200-250 | 50 | 1 | 1w |
| 2: Registry | 300-400 | 200-300 | 1.5 | 1w |
| 3: Config | 200-250 | 150-200 | 1 | 1w |
| 4: Audio | 250-350 | 200-250 | 1.5 | 1w |
| 5: Adapters | 150-200 | 100-150 | 1 | 1w |
| 6: Integration | 150-200 | 100-150 | 1.5 | 1w |
| 7: Discovery | 200-250 | 150-200 | 1 | 1w |
| 8: Migration | 100-150 | 50-100 | 1 | 1w |
| 9: Docs | 100-200 | 0 | 1 | 1w |
| 10: Testing | 0 | 400-600 | 1.5 | 1.5w |
| 11: Rollout | 0 | 0 | 1+ | 1w+ |
| **TOTAL** | **~2000** | **~1500** | **~14** | **~14 weeks** |

Note: Timeline assumes 1 agent full-time. Can be parallelized with multiple agents.

## Dependencies

- TypeScript 5.x
- Node 22+
- Existing: `ws` (WebSocket), `openai` SDK
- New (optional): YAML parser (e.g., `js-yaml`)
- New (optional): Validation schema (e.g., `zod`)

## Success Criteria

- [ ] All interfaces properly typed and documented
- [ ] Registry supports priority-based selection and failover
- [ ] Configuration loads from YAML/JSON with env var substitution
- [ ] Audio format conversion works correctly (PCM ↔ mu-law, resampling)
- [ ] Existing OpenAI providers wrapped with backwards compatibility
- [ ] Auto-discovery of npm packages and filesystem plugins working
- [ ] Provider selection automatic with fallback on errors
- [ ] > 80% test coverage on core modules
- [ ] Zero breaking changes to existing voice-call behavior
- [ ] Documentation complete with migration guide

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Breaking changes | Use adapters for backwards compatibility; feature flag during rollout |
| Audio format bugs | Comprehensive unit tests; early real-world testing with Twilio |
| Provider discovery issues | Start with built-in providers; npm discovery optional |
| Performance regression | Benchmark before/after; cache health checks |
| Config migration | Support both old hardcoded and new config-based approaches |

---

See [Voice Plugins Architecture](/voice-plugins) for design details.
