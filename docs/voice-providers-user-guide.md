# Voice Providers: End-User Getting Started Guide

**Audience:** End Users, Chat Users, Voice Callers
**Status:** Complete
**Last Updated:** January 2026

---

## Getting Started with Voice in Clawdbot

This guide helps you set up voice features and understand the different voice providers available.

**TL;DR:** During onboarding, Clawdbot asks if you want voice features. If yes, it automatically sets up quality cloud providers. You just need your OpenAI API key.

---

## Part 1: Initial Setup

### Step 1: Enable Voice During Onboarding

When you first run `clawdbot init`:

```
? Enable voice features (calls with speech recognition)?  (Y/n)
```

Select **Yes** to enable voice.

### Step 2: Choose Your Provider

Clawdbot offers two approaches:

**Option A: Quick Setup (Recommended for Most Users)**
- Uses cloud providers automatically
- Highest quality audio
- Just provide API keys
- Takes 5 minutes

**Option B: Advanced Setup**
- Choose between cloud and local
- More control over settings
- Takes 15-30 minutes

### Step 3: Provide API Keys

For cloud providers, you'll need API keys:

#### OpenAI API Key

1. Go to https://platform.openai.com/account/api-keys
2. Create a new API key
3. Copy the key (starts with `sk-`)
4. Paste into the setup wizard

That's it! You can now make and receive voice calls.

---

## Part 2: Understanding Providers

### Speech-to-Text (STT): What It Does

When someone calls you, their voice is converted to text. You can choose different providers:

#### Cloud Options

**OpenAI Realtime (Recommended)**
- ✅ Highest quality
- ✅ Fastest (0.2-0.5 seconds)
- ✅ No setup required
- ❌ Requires API key ($0.01 per call)
- ❌ Needs internet

**Google Cloud Speech-to-Text**
- ✅ High quality
- ✅ Very fast
- ✅ Supports many languages
- ❌ Requires API key
- ❌ Needs internet

#### Local Options

**Whisper (Local)** *(Requires Windows 10+ or Linux)*
- ✅ Free (no API costs)
- ✅ Works offline
- ✅ Complete privacy
- ❌ Slower (2-8 seconds)
- ❌ Needs GPU for speed
- ❌ More setup required

### Text-to-Speech (TTS): What It Does

When Clawdbot sends a response, it's converted to voice. You can choose:

#### Cloud Options

**OpenAI TTS (Recommended)**
- ✅ Natural sounding
- ✅ Fast (0.5-1 second)
- ✅ Multiple voices
- ❌ Requires API key ($0.015 per call)

**ElevenLabs**
- ✅ Very natural voice
- ✅ Voice cloning possible
- ✅ Supports 30+ languages
- ❌ More expensive ($0.30 per 1000 characters)

#### Local Options

**Kokoro (Local)**
- ✅ Free
- ✅ Works offline
- ✅ Good quality
- ❌ Slower than cloud
- ❌ Needs GPU

**Piper (Local)**
- ✅ Free
- ✅ 60+ voices
- ✅ Many languages
- ❌ Slower than cloud

---

## Part 3: Cost Comparison

### Typical Usage Costs (Per Month)

**Light User:** 10 calls/day

| Provider | Cost/Call | Total/Month |
|----------|-----------|------------|
| OpenAI Cloud | $0.025 | ~$7.50 |
| Local (Free) | $0 | $0 |
| Mixed (Hybrid) | $0 | $0 (if online works) |

**Heavy User:** 100 calls/day

| Provider | Cost/Call | Total/Month |
|----------|-----------|------------|
| OpenAI Cloud | $0.025 | ~$75 |
| Local (Free) | $0 | $0 |
| Mixed (Hybrid) | $0.01 | ~$30 |

**Hidden Costs:**
- GPU: $200-500 one-time, then $15/month electricity
- Internet: Usually included in existing connection

### Money-Saving Tips

1. **Use Free Local Models**
   ```bash
   clawdbot configure voice --provider whisper-local
   # Saves $75-300/month for heavy users
   ```

2. **Use Hybrid Mode**
   - Cloud works fine most of the time
   - Falls back to local if cloud fails
   - Average cost ~60% of cloud-only

3. **Get Volume Discounts**
   - OpenAI: 1M+ calls/month → $0.003/call
   - Contact sales for enterprise pricing

---

## Part 4: Configuration

### Quick Configuration

```bash
clawdbot configure voice
```

Follow the prompts to:
- Choose STT provider
- Choose TTS provider
- Select quality/speed tradeoffs

### Common Configurations

#### Option 1: Maximum Quality (Default)

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
      voice: "coral"  # Warm, natural voice
```

**Best for:** Professional calls, important meetings
**Cost:** ~$0.025 per call
**Speed:** Fast (< 1 second latency)

#### Option 2: Maximum Privacy (Offline)

```yaml
voice:
  stt:
    provider: "whisper-local"
    config:
      modelSize: "base"
      device: "cpu"

  tts:
    provider: "kokoro-local"
    config:
      voice: "af"  # Female American voice
```

**Best for:** Privacy-critical, no internet
**Cost:** $0 per call
**Speed:** Slower (2-5 seconds)
**Privacy:** 100% local, nothing sent online

#### Option 3: Balanced (Recommended)

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"
    fallback:
      providers:
        - "whisper-local"

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
    fallback:
      providers:
        - "kokoro-local"
```

**Best for:** Most users
**Cost:** ~$0.01/call (with fallback to free)
**Speed:** Fast when cloud available
**Reliability:** Works offline too

---

## Part 5: Platform-Specific Setup

### Windows 10/11

#### Quick Setup (5 minutes)

```bash
# Download & run installer
Invoke-WebRequest https://clawd.bot/install.ps1 | iex

# Start onboarding
clawdbot init
```

#### Using Cloud Providers (Recommended)

No special setup needed. Just provide API keys.

#### Using Local Models (Optional)

**Requirements:**
- 2GB RAM (minimum)
- 2GB disk space (for models)
- Optional: NVIDIA GPU (RTX 3060 or better for speed)

**Setup:**

```powershell
# Install Python 3.11+ (if not already installed)
# Available from https://www.python.org/downloads/

# Clawdbot automatically downloads models on first use
clawdbot configure voice --provider whisper-local

# First run will download ~500MB-1GB model
# This takes 5-10 minutes depending on internet speed
```

**Testing Local Voice:**

```bash
# Test STT
clawdbot debug voice-test --provider whisper-local --audio sample.wav

# Test TTS
clawdbot debug voice-test --provider kokoro-local --text "Hello world"
```

### Linux (Ubuntu 20.04+)

#### Installation

```bash
# Install via apt
curl https://clawd.bot/install.sh | bash

# Or via snap
sudo snap install clawdbot
```

#### Cloud Setup (Recommended)

```bash
clawdbot init
# Provide OpenAI API key
```

#### Local Model Setup

```bash
# Install dependencies
sudo apt-get install libportaudio2 python3-dev

# Configure local providers
clawdbot configure voice --provider whisper-local

# For NVIDIA GPU support (optional)
sudo apt-get install nvidia-cuda-toolkit
```

### macOS

macOS users on Clawdbot Mac app automatically get voice support via:
- OpenAI Realtime STT
- OpenAI TTS

No additional setup needed beyond providing API key.

---

## Part 6: Troubleshooting

### "I don't hear responses"

**Check:**
1. Is voice enabled? `clawdbot status`
2. Is audio working? Test speakers first
3. Is TTS provider healthy? `clawdbot debug voice-health`

**Fix:**
```bash
# Restart voice system
clawdbot restart

# Reset to defaults
clawdbot configure voice --reset-config

# Try different voice
clawdbot configure voice --tts-voice shimmer
```

### "Responses sound robotic"

**Possible causes:**
1. Provider limitation
2. Settings not optimized

**Fix:**
```yaml
# Slow down speech (more natural)
voice:
  tts:
    config:
      speed: 0.9  # Default: 1.0

# Try different voice
# Options: coral (bright), sage (calm), shimmer (energetic)
voice:
  tts:
    config:
      voice: "sage"

# Or use local provider (more natural for some uses)
voice:
  tts:
    provider: "kokoro-local"
```

### "Costs are too high"

**Switch to local:**
```bash
clawdbot configure voice --provider whisper-local --tts-provider kokoro-local
# Saves $200-300/month if you make 100+ calls/day
```

**Or use hybrid mode:**
```bash
clawdbot configure voice --mode hybrid
# Uses cloud 99% of the time (high quality)
# Falls back to local if cloud unavailable
# Average cost: ~60% of cloud-only
```

### "Transcription is inaccurate"

**Check audio quality:**
- Speak clearly
- Minimize background noise
- Move closer to microphone

**Try different model:**
```bash
clawdbot configure voice --stt-provider google-cloud-stt
# or
clawdbot configure voice --stt-model whisper-small  # More accurate than "tiny"
```

### "Voice is slow / has high latency"

**For cloud providers:**
- Check your internet speed (need 5+ Mbps)
- Try different cloud provider
- Check latency: `clawdbot debug voice-latency`

**For local providers:**
- Use GPU if available: `voice.stt.device: cuda`
- Use smaller model: `modelSize: tiny`
- Reduce other background tasks

---

## Part 7: Privacy & Security

### Where Does My Audio Go?

**Cloud Providers:**
- Audio sent to provider's servers (OpenAI, Google, etc.)
- Providers keep audio for 7-30 days for quality improvement
- Encrypted in transit (HTTPS)

**Local Providers:**
- Audio never leaves your computer
- Completely private
- No internet required

### Check Your Privacy Settings

```bash
# Show what data is being sent
clawdbot debug privacy-audit

# Output
✓ STT: Local processing (no external data)
✓ TTS: Cloud, encrypted, 30-day retention
⚠ Audio caching: Disabled
```

### Disable Data Collection

```yaml
voice:
  privacy:
    disableTelemetry: true
    disableMetrics: true
    disableAudioCaching: true
```

### Compliance Notes

- **GDPR:** If using cloud providers, data is processed in EU regions
- **HIPAA:** Use local providers for healthcare applications
- **SOC 2:** Enterprise cloud providers are certified

---

## Part 8: Advanced Customization

### Custom Voice Settings

```bash
# Adjust speech recognition sensitivity
clawdbot configure voice --stt-confidence 0.85

# Adjust silence detection
clawdbot configure voice --silence-duration 800ms

# Change language
clawdbot configure voice --language es  # Spanish
```

### Voice Cloning (ElevenLabs only)

```yaml
voice:
  tts:
    provider: "elevenlabs"
    config:
      voiceCloning:
        enabled: true
        trainingAudioUrl: "https://..."  # URL to sample audio
        voice: "my-custom-voice"
```

### Custom Models

For advanced users with local setup:

```bash
# Use custom Whisper model
voice:
  stt:
    provider: "whisper-local"
    config:
      modelPath: "/path/to/custom-model.pt"

# Use custom Kokoro voice
voice:
  tts:
    provider: "kokoro-local"
    config:
      voiceDir: "/path/to/custom-voices"
```

---

## Part 9: Getting Help

### Built-in Help

```bash
# Show voice-related help
clawdbot help voice

# Debug voice system
clawdbot debug voice-health

# Generate diagnostic report
clawdbot debug voice-report

# Show logs
clawdbot logs --service voice --tail 50
```

### Common Questions

**Q: Do I need a GPU?**
A: No, but it makes local providers 5-10x faster. Cloud providers don't need GPU.

**Q: Can I use voice offline?**
A: Yes, with local providers (Whisper, Kokoro). Cloud providers need internet.

**Q: How much does voice cost?**
A: Cloud: $0.01-0.30 per call. Local: Free.

**Q: How accurate is voice recognition?**
A: Cloud: 95%+. Local (Whisper): 85-92% depending on model size.

**Q: Can I use voice in groups?**
A: Yes, voice works with group calls and channels.

**Q: How do I change voices?**
A: `clawdbot configure voice` → select different voice

**Q: What languages are supported?**
A: Cloud: 90+. Local (Whisper): 99+. Cloud (TTS): 30+.

---

## Part 10: Feedback & Improvement

### Report Issues

```bash
# Create debug report
clawdbot debug voice-report

# Share with support
clawdbot share-diagnostics
```

### Request Features

- Cloud TTS voice quality
- Additional local models
- Language support
- Provider-specific features

Visit: https://github.com/clawdbot/clawdbot/issues

---

## Quick Reference

### Configuration File Location

```bash
# Config file
~/.clawdbot/config.yaml

# API keys (secure location)
~/.clawdbot/credentials/

# Logs
~/.clawdbot/logs/voice.log
```

### Essential Commands

```bash
# Setup
clawdbot init
clawdbot configure voice

# Test
clawdbot debug voice-health
clawdbot debug voice-test

# Manage
clawdbot restart
clawdbot logs

# Status
clawdbot status
```

### Performance Targets

| Metric | Target | Cloud | Local |
|--------|--------|-------|-------|
| STT Latency | < 1s | 0.2-0.5s | 2-5s |
| TTS Latency | < 1s | 0.5-1s | 1-2s |
| Accuracy | > 95% | 95%+ | 85-92% |
| Availability | 99.9% | 99%+ | 99%+ |
| Cost | Minimal | $0.025/call | Free |

---

## Next Steps

1. **Complete onboarding:** `clawdbot init`
2. **Test voice:** Make a test call
3. **Configure preferences:** `clawdbot configure voice`
4. **Enjoy:** Start using voice features!

---

## Support

- Documentation: https://docs.clawd.bot/voice
- GitHub Issues: https://github.com/clawdbot/clawdbot/issues
- Email: support@clawd.bot
- Community Discord: https://discord.gg/clawdbot

