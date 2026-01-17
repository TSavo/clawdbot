# Voice Providers: Quick Reference Card

**Status:** Integration Ready | **Date:** January 2026

---

## Files to Read (in Order)

### 5-Minute Overview
1. `docs/VOICE_INTEGRATION_SUMMARY.md` - This index

### 30-Minute Planning
1. `docs/VOICE_INTEGRATION_RESEARCH.md` - Strategy & timeline
2. `docs/voice-plugins.md` - Architecture overview

### Full Implementation
1. `docs/voice-providers-integration.md` - Integration guide
2. `src/config/zod-schema.voice-providers.ts` - Config schemas (to create)
3. `src/commands/onboard-voice-providers.ts` - Onboarding (to create)

### Deployment & Support
1. `docs/voice-providers-admin-guide.md` - Admin guide
2. `docs/voice-providers-user-guide.md` - User guide
3. `docs/voice-providers-faq.md` - FAQ

---

## Key Commands

```bash
# User getting started
clawdbot init
# → Answer voice setup questions

# User configure
clawdbot configure voice
# → Select provider, API key, test

# Admin diagnostics
clawdbot debug voice-health
# → Show provider status

# Developer testing
clawdbot debug voice-test --provider openai-realtime
# → Test specific provider
```

---

## Integration Checklist (Quick)

**Configuration (Day 1)**
- [ ] Add Zod schemas
- [ ] Create config loader
- [ ] Add gateway endpoints

**Onboarding (Days 2-3)**
- [ ] Create onboarding command
- [ ] Integrate into wizard
- [ ] Test flow

**CLI (Days 4-5)**
- [ ] Create configure command
- [ ] Add to main menu
- [ ] Test all options

**Web UI (Days 6-7)**
- [ ] Create React components
- [ ] Add API integration
- [ ] Test forms

**Testing (Days 8-10)**
- [ ] E2E tests
- [ ] Manual testing
- [ ] Bug fixes

---

## Architecture in One Diagram

```
┌─────────────────────────────────────────────────┐
│                  User Interface                  │
│  Onboarding | CLI Configure | Web Dashboard    │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────v──────────────────────────────┐
│         Configuration System (Zod)              │
│  Load → Validate → Store → Apply               │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────v──────────────────────────────┐
│      Voice Provider Plugin Registry            │
│  STT Registry | TTS Registry | Fallback       │
└──────────────────┬──────────────────────────────┘
                   │
┌──────────────────v──────────────────────────────┐
│           Provider Implementations             │
│ Cloud (OpenAI) | Local (Whisper, Kokoro)      │
└──────────────────────────────────────────────────┘
```

---

## Files to Create

```
src/config/
  zod-schema.voice-providers.ts         150-200 LOC
  voice-config.ts                       100-150 LOC

src/commands/
  onboard-voice-providers.ts            250-350 LOC
  voice-provider-prompt.ts              150-200 LOC
  configure-voice.ts                    300-400 LOC

src/gateway/server-methods/
  voice.ts                              150-200 LOC

ui/src/ui/controllers/
  config.voice-providers.ts             200-300 LOC

ui/src/ui/components/
  VoiceProviderSettings.tsx             200-300 LOC

tests/
  voice-*.test.ts                       500+ LOC
```

**Total:** ~2000 lines of implementation code

---

## Configuration Template

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"
      model: "gpt-4o-transcribe"
    fallback:
      strategy: "failover"
      providers:
        - "whisper-local"

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
      voice: "coral"
    fallback:
      providers:
        - "kokoro-local"
```

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| Provider not found | Install with `npm install @clawdbot/stt-whisper` |
| API key invalid | Check $OPENAI_API_KEY, regenerate at platform.openai.com |
| High latency | Use GPU: `device: cuda` or cloud provider |
| Poor quality | Use larger model: `modelSize: small` |
| Cost too high | Switch to local: `provider: whisper-local` |
| Offline needed | Configure local providers (Whisper + Kokoro) |

---

## Testing Commands

```bash
# Check health
clawdbot debug voice-health

# Test STT
clawdbot debug voice-test --provider openai-realtime --audio sample.wav

# Test TTS
clawdbot debug voice-test --provider openai-tts --text "Hello"

# Monitor latency
clawdbot debug voice-latency --provider openai-realtime

# Generate report
clawdbot debug voice-report > diagnostics.json
```

---

## User Personas & Needs

| Persona | Needs | Solution |
|---------|-------|----------|
| **New User** | Easy setup, works out-of-box | Cloud providers, defaults |
| **Power User** | Control, customization | Local models, hybrid mode |
| **Privacy User** | No external data | Fully local providers |
| **Admin** | Monitoring, scaling, reliability | Hybrid setup, fallback |
| **Developer** | Integration, extensibility | Plugin system, docs |

---

## Cost Models

**Cloud-First:** $0.025/call
- 100 calls/day = $75/month
- Volume discount available

**Hybrid:** $0.010/call (with fallback)
- 100 calls/day = $30/month
- Works offline too

**Local:** $0/call
- One-time GPU cost $200-500
- Monthly electricity $15

---

## Deployment Models

**Quick (5 min):** Cloud only
```yaml
voice:
  stt: openai-realtime
  tts: openai-tts
```

**Balanced (30 min):** Hybrid
```yaml
voice:
  stt: openai-realtime + whisper-local fallback
  tts: openai-tts + kokoro-local fallback
```

**Advanced (2 hours):** Fully local
```yaml
voice:
  stt: whisper-local
  tts: kokoro-local
```

---

## Timeline

| Phase | Duration | Deliverable |
|-------|----------|------------|
| Foundation | 2 days | Config + gateway |
| Onboarding | 2 days | Wizard integration |
| CLI | 2 days | Configure command |
| Web UI | 3 days | Dashboard forms |
| Testing | 3 days | E2E + manual tests |
| **Total** | **4-6 weeks** | **Production-ready** |

(Assumes 1-2 developers, part-time other tasks)

---

## Documentation Map

```
START HERE ➜ VOICE_INTEGRATION_SUMMARY.md

├─ I'm implementing ➜ VOICE_INTEGRATION_RESEARCH.md
│                    ➜ voice-providers-integration.md
│
├─ I'm deploying ➜ voice-providers-admin-guide.md
│
├─ I'm supporting users ➜ voice-providers-faq.md
│                        ➜ voice-providers-user-guide.md
│
├─ I need architecture ➜ VOICE_PLUGIN_DESIGN.md
│                       ➜ voice-plugins.md
│
└─ I need reference ➜ voice-plugins-api-reference.md
```

---

## Quick Links

| Need | File |
|------|------|
| Big picture | `VOICE_INTEGRATION_RESEARCH.md` |
| How to integrate | `voice-providers-integration.md` |
| How to deploy | `voice-providers-admin-guide.md` |
| How to use | `voice-providers-user-guide.md` |
| Troubleshooting | `voice-providers-faq.md` |
| API reference | `voice-plugins-api-reference.md` |

---

## Status

✅ Plugin system: Complete
✅ Audio utilities: Complete
✅ Local providers: Complete
✅ Tests (186+): Complete
✅ Documentation: Complete
⏳ Implementation: Ready to start
⏳ Integration: 4-6 weeks estimated

---

## Next Step

**Read:** `docs/VOICE_INTEGRATION_RESEARCH.md` (30 min)

**Then:** Start with Phase 1 (Foundation) tasks

