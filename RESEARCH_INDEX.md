# Voice Channel Architecture Research - Document Index

Complete research on integrating 11labs TTS and building Discord-like voice channels for Clawdbot.

## Research Documents

### 1. **RESEARCH_SUMMARY.md** ← Start Here
- **Purpose:** Executive summary of all findings
- **Length:** ~800 words
- **Contains:**
  - Key findings (11labs status, architecture mismatch)
  - What exists vs what's needed
  - Implementation order
  - Risk assessment
  - Quick metrics

**Read this first to understand scope.**

---

### 2. **RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md**
- **Purpose:** Deep technical research (full report)
- **Length:** ~4,000 words
- **Contains:**
  - Current 11labs integration details
  - Clawdbot communication patterns
  - Real-time vs batch differences
  - Audio handling patterns
  - Session architecture
  - Provider integration patterns
  - Architecture diagrams
  - Critical gaps analysis
  - Recommended architecture
  - Code examples and references

**Read this for complete technical understanding.**

---

### 3. **docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md**
- **Purpose:** Implementation architecture guide
- **Length:** ~2,000 words
- **Contains:**
  - Architecture overview with diagrams
  - Current vs new architecture comparison
  - Integration points for 11labs
  - Integration points for voice channels
  - WebSocket protocol definition
  - Session key format
  - Performance considerations
  - Testing strategy
  - Rollout plan

**Read this before starting implementation.**

---

### 4. **docs/VOICE_CHANNEL_QUICK_START.md**
- **Purpose:** Developer quick reference
- **Length:** ~1,500 words
- **Contains:**
  - What exists (existing code structure)
  - What's missing (must build)
  - Code examples (11labs TTS provider)
  - Voice channel structure (skeleton)
  - Audio mixing explanation
  - WebSocket handling pattern
  - Session key format
  - Development checklist
  - Testing instructions
  - Debugging tips

**Read this to start coding.**

---

## Quick Navigation

### If you want to...

**...understand what needs to be done**
→ Read: RESEARCH_SUMMARY.md

**...understand the current architecture**
→ Read: RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md (sections 1-7)

**...understand the new architecture**
→ Read: RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md (sections 8-12)

**...start implementing 11labs TTS**
→ Read: docs/VOICE_CHANNEL_QUICK_START.md (section "Add 11labs TTS")

**...start building voice channels**
→ Read: docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md + docs/VOICE_CHANNEL_QUICK_START.md

**...make architectural decisions**
→ Read: RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md (sections 13-15)

**...estimate timeline/resources**
→ Read: RESEARCH_SUMMARY.md (Implementation Order) or docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md (Rollout Plan)

---

## Key Findings Summary

### 11labs TTS Integration
- **Status:** Configuration exists but not actively used
- **Effort:** LOW (1-2 weeks)
- **Location:** `/extensions/speech-plugins/src/providers/`
- **Pattern:** Inherit existing TTSProvider interface
- **Benefit:** 20-30% latency improvement over OpenAI TTS

### Voice Channels Architecture
- **Status:** Requires new implementation
- **Effort:** MEDIUM-HIGH (4-6 weeks)
- **Blocker:** Audio mixing (most complex)
- **Reuse:** Session management, WebSocket patterns, STT/TTS providers
- **New:** ChannelManager, AudioMixer, BroadcastHandler, PresenceManager

### Session Model
- **Current:** `agent:id:context:extra` (proven)
- **For channels:** `agent:id:channel:room-id` (extends existing)
- **For voice calls:** Unchanged
- **Benefit:** Leverages proven federation system

---

## File Locations

### Research Documents (Root)
```
/home/tsavo/clawd/clawdbot/
├─ RESEARCH_SUMMARY.md                          ← Start here
├─ RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md      ← Full technical details
├─ RESEARCH_INDEX.md                            ← This file
└─ docs/
   ├─ VOICE_CHANNELS_INTEGRATION_GUIDE.md       ← Implementation guide
   └─ VOICE_CHANNEL_QUICK_START.md              ← Developer guide
```

### Current Voice Infrastructure (Reference)
```
/home/tsavo/clawd/clawdbot/
├─ src/
│  ├─ config/
│  │  ├─ types.voice.ts                         ← Voice config types
│  │  └─ zod-schema.voice-providers.ts          ← Validation schemas
│  ├─ commands/voice.ts                         ← CLI commands
│  └─ routing/session-key.ts                    ← Session management
├─ extensions/
│  ├─ voice-call/src/
│  │  ├─ manager.ts                             ← CallManager (2-party)
│  │  ├─ media-stream.ts                        ← WebSocket audio
│  │  ├─ webhook.ts                             ← Webhook handler
│  │  ├─ types.ts                               ← Call events
│  │  └─ providers/                             ← Telnyx, Twilio, Plivo
│  └─ speech-plugins/src/
│     ├─ interfaces/tts-provider.ts             ← TTS contract (add 11labs here)
│     ├─ interfaces/stt-provider.ts             ← STT contract
│     └─ providers/                             ← Implementation
└─ docs/
   ├─ VOICE_CHANNELS_INTEGRATION_GUIDE.md
   └─ VOICE_CHANNEL_QUICK_START.md
```

---

## Implementation Roadmap

### Phase 1: 11labs TTS (Weeks 1-2)
1. Create ElevenLabsTTSProvider class
2. Implement synthesize() and synthesizeStream()
3. Register in provider registry
4. Test in existing voice calls
5. Benchmark vs OpenAI

### Phase 2: Voice Channel Skeleton (Weeks 3-4)
1. Create VoiceChannelManager
2. Implement presence tracking
3. Basic WebSocket broadcast
4. Session key model
5. Permission system

### Phase 3: Audio Mixer (Weeks 5-6)
1. Evaluate audio libraries
2. Implement AudioMixer class
3. Integration testing
4. Performance optimization
5. Stress testing (N users)

### Phase 4: Release (Week 7+)
1. UI for channel management
2. Documentation
3. Recording support
4. Security review
5. General availability

---

## Key Decision Points

### 1. Audio Mixing Library
Choose from:
- `ffmpeg-fluent` (proven, versatile)
- `audio-concat` (lightweight)
- `libav.js` (WebAssembly)
- Custom native module (performance)

**Impact:** Affects latency, CPU usage, memory footprint

### 2. Broadcast vs Selective
- **Broadcast:** Same mixed audio to all → simple, ~50-100ms latency
- **Selective:** Each gets custom mix (e.g., no self) → complex, lower latency

**Recommendation:** Start with broadcast

### 3. Persistence Model
- **Ephemeral channels:** Auto-delete when empty (simpler)
- **Persistent channels:** Stored, recreatable (more Discord-like)

**Recommendation:** Start ephemeral, add persistence later

### 4. Recording Storage
- **No recording** (simpler MVP)
- **Optional recording** (record to disk/S3)
- **Always recording** (compliance requirement)

**Recommendation:** Optional recording post-MVP

---

## Metrics to Validate

### 11labs TTS
- [ ] Latency: 20-30% faster than OpenAI TTS-1
- [ ] Quality: User preference test (A/B test if possible)
- [ ] Reliability: 99%+ uptime
- [ ] Cost: Compare to OpenAI per minute of synthesis

### Voice Channels
- [ ] Latency: <100ms (microphone → speaker)
- [ ] CPU: <25% per user on reference hardware
- [ ] Memory: <50MB per 5-user channel
- [ ] Concurrent users: Support 8+ with minimal quality degradation
- [ ] Network: Handles 10% packet loss gracefully

---

## Risk Mitigation

### High Risk: Audio Mixing Performance
- **Mitigation:** Benchmark early with real data
- **Fallback:** Use simpler mixing algorithm if needed
- **Test:** 2→4→8→16 user stress tests

### High Risk: WebSocket Scalability
- **Mitigation:** Proven patterns from voice calls
- **Fallback:** Can use same handler as existing
- **Test:** Hammer with N concurrent connections

### Medium Risk: Latency Sensitivity
- **Mitigation:** Profile early, optimize before release
- **Fallback:** Accept higher latency, add UI feedback
- **Test:** User feedback on 50ms increments

---

## Success Criteria

### 11labs TTS Integration
- [ ] ✓ Works in existing voice calls
- [ ] ✓ Latency measured and better than OpenAI
- [ ] ✓ Configuration optional (OpenAI remains default)
- [ ] ✓ No breaking changes to existing code

### Voice Channels MVP
- [ ] ✓ 2-4 users can join a channel
- [ ] ✓ All hear mixed audio simultaneously
- [ ] ✓ Presence updates in real-time
- [ ] ✓ WebSocket reconnection works
- [ ] ✓ Permissions enforced
- [ ] ✓ <100ms latency validated

### Full Release
- [ ] ✓ 8+ concurrent users tested
- [ ] ✓ Recording infrastructure working
- [ ] ✓ UI for channel management
- [ ] ✓ Mobile app support
- [ ] ✓ Documentation complete

---

## Questions? Refer to:

| Question | Document |
|----------|----------|
| How do I start? | RESEARCH_SUMMARY.md |
| What's the architecture? | RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md |
| How do I implement? | docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md |
| Where's the code? | docs/VOICE_CHANNEL_QUICK_START.md |
| What's the timeline? | RESEARCH_SUMMARY.md (Recommended Implementation Order) |
| What are risks? | RESEARCH_SUMMARY.md (Risk Assessment) |
| File structure? | RESEARCH_INDEX.md (this file) |

---

**Research Completed:** January 16, 2026
**Status:** Complete - Ready for Architecture Review & Implementation
**Research Agent:** Claude Code Research Agent (Haiku 4.5)

For questions or clarifications, reference the appropriate document above.
