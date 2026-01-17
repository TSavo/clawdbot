# Voice Channel Research - Executive Summary

**Research Completed:** January 16, 2026
**Researcher:** Claude Code Research Agent
**Status:** Complete - Ready for Design Phase

## Key Findings

### 1. 11labs Integration Status
- **Current:** Configured in schema but NOT actively used in voice calls
- **Using Instead:** OpenAI TTS (default in voice calls)
- **Where 11labs Can Integrate:** TTS provider abstraction layer already exists
- **Impact:** Can plug in 11labs as alternative with minimal changes

### 2. Architecture Mismatch
- **Current:** Clawdbot has **phone call infrastructure** (2-party telephony)
- **Needed:** **Discord-like voice channels** (N-party real-time)
- **Implication:** Can't just reuse CallManager; need new ChannelManager

### 3. What Already Exists (Reusable)
✓ Session management (agent context federation)
✓ STT/TTS provider abstraction (11labs fits here)
✓ WebSocket patterns (media stream handling)
✓ State persistence (calls saved to disk)
✓ Audio format support (encoding/resampling)
✓ Event routing infrastructure

### 4. What's Missing (Must Build)
✗ Multi-user audio mixing (core blocker)
✗ Presence tracking (who's in channel)
✗ Broadcast pattern (send to N clients)
✗ Channel discovery (list/search)
✗ Permission model (roles: admin/speaker/listener)
✗ Real-time sync (all users get same state)

---

## Where Each Component Integrates

```
┌─────────────────────────────────────────────────────────┐
│ 11labs TTS Integration                                  │
├─────────────────────────────────────────────────────────┤
│ Location: /extensions/speech-plugins/src/providers/    │
│ Status: Can implement immediately                       │
│ Impact: Replace OpenAI TTS in voice calls              │
│ Effort: Low (interface already designed)                │
│ Timeline: 1-2 weeks                                     │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Voice Channels Framework                                │
├─────────────────────────────────────────────────────────┤
│ Location: New /extensions/voice-channels/              │
│ Components:                                             │
│   • VoiceChannelManager (orchestration)                │
│   • AudioMixer (N-user mixing)                         │
│   • BroadcastHandler (WebSocket to all)                │
│   • PresenceManager (presence tracking)                │
│ Status: Design phase                                    │
│ Effort: Medium-High (new audio mixing needed)          │
│ Timeline: 4-6 weeks                                     │
└─────────────────────────────────────────────────────────┘
```

---

## Critical Decision: Audio Mixing

**This is the main technical blocker for voice channels.**

### Current Architecture (Voice Calls)
```
Phone A → WebSocket → clawdbot → TTS synthesis → WebSocket → Phone B
(Simple point-to-point)
```

### Needed for Voice Channels
```
User A (microphone)  ┐
User B (microphone)  ├─→ AudioMixer ─→ Mix stream ─→ Broadcast to all
User C (microphone)  ┘
                      (Each user receives: everyone except self)
```

### Technical Requirements
- Real-time (must handle continuous streams)
- Low-latency (~50ms acceptable)
- Multiple quality modes (8kHz for voice, 16kHz+ for quality)
- VAD (voice activity detection) optional
- Echo cancellation (if using speakers)

### Library Options
- `ffmpeg-fluent` (proven, widely used)
- `audio-concat` (lightweight)
- `libav.js` (WebAssembly, client-side compatible)
- Custom native module (performance-optimal)

---

## Recommended Implementation Order

### Week 1-2: 11labs TTS (Easy Win)
```
1. Create ElevenLabsTTSProvider
2. Inherit TTSProvider interface
3. Add to provider registry
4. Test in voice calls
5. Benchmark vs OpenAI
```

**Why first?** Quick, low-risk, delivers value for existing voice calls

### Week 3-4: Voice Channel Skeleton
```
1. Create ChannelManager
2. Implement presence tracking
3. Basic WebSocket broadcast (without audio mixing yet)
4. Session key model
5. Permission system
```

**Why next?** Non-audio components can be tested independently

### Week 5-6: Audio Mixer Implementation
```
1. Choose audio library
2. Implement AudioMixer class
3. Integrate with ChannelManager
4. Performance testing
5. Stress test with N users
```

**Why last?** Most complex component, but other pieces ready

### Week 7: Polish & Release
```
1. UI/UX for channel management
2. Recording infrastructure
3. Documentation
4. Performance optimization
5. General availability
```

---

## Session Architecture for Voice Channels

### Existing Session Keys
```
"agent:main:main"                  ← default agent session
"agent:main:slack:dm:user123"      ← Slack DM context
"agent:main:slack:group:channel"   ← Slack channel context
```

### New Session Keys (Channels)
```
"agent:main:channel:room-id"       ← participating in channel
"agent:main:channel:room-id:listener" ← with role
"agent:main:channel:room-id:admin"    ← with role
```

### Key Benefits
- Same federation model as voice calls
- Persistence via existing infrastructure
- Multi-agent support (different agents in different channels)
- Familiar session key structure for users/developers

---

## Risk Assessment

### High Risk
- **Audio mixing performance** - Must handle N users in real-time
  - Mitigation: Start with 2-4 users, stress test gradually

- **Memory per channel** - N audio streams in memory
  - Mitigation: Stream processing, not all-in-memory mixing

### Medium Risk
- **WebSocket scalability** - Many concurrent connections
  - Mitigation: Use existing WebSocket patterns (proven in voice calls)

- **Latency sensitivity** - Users perceive >100ms negatively
  - Mitigation: Benchmark early, optimize before release

### Low Risk
- **11labs integration** - Interface already exists
  - Mitigation: Well-defined contract, can test independently

- **Session management** - Proven system
  - Mitigation: Just extend existing, no redesign needed

---

## 11labs-Specific Advantages

### Latency
- 11labs: ~200-300ms (streaming can start at 50-100ms)
- OpenAI TTS-1: ~400-500ms
- Improvement: 20-30% faster

### Quality
- 11labs: High-fidelity voices, streaming optimized
- Natural prosody, better emotion handling
- Better for interactive (voice channels) vs batch (announcements)

### Cost
- 11labs: ~$0.30 per 100k characters
- OpenAI: ~$0.015 per 1k tokens (cheaper for short utterances)
- For long-running channels: 11labs may be cost-competitive

### API Maturity
- 11labs: Purpose-built for voice AI
- OpenAI: Multi-modal platform
- 11labs streaming specifically designed for real-time apps

---

## Files Delivered

### Research Reports
1. **`RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md`** (This Repo)
   - Comprehensive 15-section architecture research
   - Current vs needed patterns
   - Integration points detailed
   - 4,000+ words

2. **`docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md`** (This Repo)
   - Quick reference implementation guide
   - Code examples and interfaces
   - WebSocket protocol definition
   - Performance considerations
   - Rollout timeline

3. **`RESEARCH_SUMMARY.md`** (This File)
   - Executive summary
   - Key findings distilled
   - Risk assessment
   - Recommendations prioritized

---

## Next Steps

### For Stakeholders
1. Review research documents
2. Confirm 11labs TTS is priority
3. Decide on voice channels timeline
4. Allocate resources for audio mixing evaluation

### For Implementation Team
1. **Immediate:** Extract ElevenLabs provider implementation checklist
2. **Short-term:** Set up ChannelManager skeleton and tests
3. **Medium-term:** Audio mixing library evaluation/POC
4. **Long-term:** Full voice channel rollout

### For Architecture Review
1. Validate session key model for channels
2. Confirm WebSocket broadcast approach
3. Review audio mixing architecture
4. Approve provider plugin pattern

---

## Key Metrics to Track

### 11labs TTS
- Latency vs OpenAI (benchmark)
- Cost per call minute
- Quality perception (user feedback)
- API reliability/uptime

### Voice Channels
- Per-user CPU usage
- Memory per channel
- Audio quality (SNR, latency)
- Concurrent user limits
- Jitter/packet loss resilience

---

## Conclusions

1. **11labs can be integrated now** with minimal risk/effort
   - Use existing TTS provider interface
   - 1-2 week implementation
   - Improves latency for voice calls

2. **Voice channels need new architecture**
   - Can't reuse CallManager
   - Audio mixing is the blocker
   - 4-6 week full implementation

3. **Clawdbot has solid foundation**
   - Session management proven
   - WebSocket patterns established
   - Provider abstraction works
   - Only missing audio mixing + coordination layer

4. **Recommended approach:**
   - Do 11labs TTS first (quick win, low risk)
   - Build voice channels incrementally
   - Test with small groups before scaling
   - Leverage existing infrastructure where possible

---

## Document References

All research organized in:
- `/home/tsavo/clawd/clawdbot/RESEARCH_VOICE_CHANNELS_ARCHITECTURE.md` - Full research
- `/home/tsavo/clawd/clawdbot/docs/VOICE_CHANNELS_INTEGRATION_GUIDE.md` - Implementation guide
- Code locations verified at:
  - `/extensions/voice-call/src/` - Existing voice call system
  - `/extensions/speech-plugins/src/` - STT/TTS providers
  - `/src/routing/session-key.ts` - Session management
  - `/src/config/types.voice.ts` - Configuration types

---

**Research Agent:** Claude Haiku 4.5
**Research Date:** January 16, 2026
**Status:** ✓ Complete and Ready for Review
