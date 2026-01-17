# Voice Providers: FAQ & Troubleshooting

**Status:** Complete
**Last Updated:** January 2026

---

## Frequently Asked Questions

### General Questions

#### Q: Which voice provider should I use?

**A:** Start with OpenAI (cloud-first). It offers:
- Highest quality
- Fastest response
- Minimal setup

If you need **lower costs** or **privacy**, use local providers (Whisper + Kokoro).

For **reliability**, use hybrid mode (cloud primary + local fallback).

#### Q: Do I need internet for voice to work?

**A:** Only if you use cloud providers (OpenAI, Google, ElevenLabs).

Local providers (Whisper, Kokoro, Piper) work completely offline.

#### Q: What's the difference between batch and streaming?

**A:**
- **Batch:** Send entire audio → get result (use for recorded messages)
- **Streaming:** Send audio chunks → get live results (use for real-time calls)

Cloud providers support both. Local providers support batch primarily.

#### Q: Can I use multiple providers?

**A:** Yes! Configure providers in priority order:

```yaml
voice:
  stt:
    provider: "openai-realtime"      # Primary
    fallback:
      providers:
        - "whisper-local"             # Fallback 1
        - "google-cloud-stt"          # Fallback 2
```

#### Q: How much GPU do I need?

**A:**
- **Local STT (Whisper):** 2-4GB VRAM (RTX 3060 or better)
- **Local TTS (Kokoro):** 1-2GB VRAM (even older GPUs work)
- **Cloud:** No GPU needed

### Setup & Installation

#### Q: I'm getting "provider not found" error

**A:** The provider package isn't installed.

```bash
# Install provider package
npm install @clawdbot/stt-whisper

# Or auto-discover
clawdbot voice --discover-providers

# Or reset to defaults
clawdbot configure voice --reset-config
```

#### Q: Can I install voice providers manually?

**A:** Yes, place in `~/.clawdbot/voice-plugins/`:

```bash
mkdir -p ~/.clawdbot/voice-plugins
cd ~/.clawdbot/voice-plugins

# Extract provider package
tar -xzf @clawdbot-stt-whisper.tgz

# Clawdbot auto-discovers on next start
clawdbot restart
```

#### Q: How do I set the API key securely?

**A:** Don't put it in config files. Use environment variables:

```bash
# Linux/macOS
export OPENAI_API_KEY="sk-..."
export ELEVENLABS_API_KEY="..."

# Windows PowerShell
$env:OPENAI_API_KEY="sk-..."

# Docker (use secrets)
docker secret create openai-key ./key.txt
```

Verify setup:
```bash
echo $OPENAI_API_KEY  # Should show key
clawdbot debug voice-health  # Should show "connected"
```

### Configuration Questions

#### Q: Where is the voice configuration file?

**A:** `~/.clawdbot/config.yaml`

```yaml
voice:
  stt:
    provider: "openai-realtime"
  tts:
    provider: "openai-tts"
```

For local configs, also check:
- `~/.clawdbot/voice-providers.yaml` (voice-specific)
- Environment variables
- System config in `/etc/clawdbot/`

#### Q: How do I change the default provider?

**A:** Edit config or use CLI:

```bash
clawdbot configure voice --stt-provider whisper-local
clawdbot configure voice --tts-provider kokoro-local
```

Or edit YAML:
```yaml
voice:
  stt:
    provider: "whisper-local"
  tts:
    provider: "kokoro-local"
```

#### Q: Can I use different providers for STT and TTS?

**A:** Yes, they're independent:

```yaml
voice:
  stt:
    provider: "openai-realtime"  # Cloud STT
  tts:
    provider: "kokoro-local"     # Local TTS
```

#### Q: How do I configure fallback providers?

**A:**

```yaml
voice:
  stt:
    provider: "openai-realtime"
    fallback:
      strategy: "failover"           # or "priority", "round-robin"
      maxRetries: 2
      retryDelayMs: 1000
      providers:
        - "whisper-local"
        - "google-cloud-stt"
```

Fallback strategies:
- **failover:** Try secondary only if primary fails
- **priority:** Try providers in priority order
- **round-robin:** Alternate between providers

### Performance Questions

#### Q: Why is voice recognition taking 5+ seconds?

**A:** Could be multiple causes:

1. **Network latency:**
   ```bash
   ping api.openai.com
   traceroute api.openai.com
   ```

2. **CPU bottleneck (local providers):**
   ```bash
   top  # Check CPU usage
   nvidia-smi  # Check GPU usage

   # Fix: Use smaller model or GPU
   clawdbot configure voice --stt-model tiny
   clawdbot configure voice --device cuda
   ```

3. **Model loading:**
   - First transcription loads model (slow)
   - Subsequent calls are faster
   - Pre-load models at startup: `clawdbot debug voice-preload`

#### Q: How can I make voice faster?

**A:** Options:

1. **Use cloud providers:**
   ```yaml
   voice:
     stt:
       provider: "openai-realtime"    # Fast
     # vs
       provider: "whisper-local"      # Slower
   ```

2. **Use GPU for local:**
   ```yaml
   voice:
     stt:
       config:
         device: "cuda"      # vs "cpu"
   ```

3. **Use smaller models:**
   ```yaml
   voice:
     stt:
       config:
         modelSize: "tiny"   # Fast but less accurate
         # vs
         modelSize: "base"   # Balanced
   ```

4. **Enable caching:**
   ```bash
   clawdbot configure voice --enable-cache
   ```

#### Q: My GPU is sitting idle during voice calls

**A:** GPU might not be detected. Check:

```bash
nvidia-smi  # Should show GPU info

# Test detection
clawdbot debug voice-test --device-check

# Force GPU usage
clawdbot configure voice --device cuda --force
```

#### Q: Can I run multiple concurrent calls?

**A:** Yes, configure concurrent streams:

```yaml
voice:
  stt:
    config:
      maxConcurrentStreams: 5
  tts:
    config:
      maxConcurrentStreams: 3
```

On CPU, use lower numbers (2-3). On GPU, can use higher (5-10).

### Quality & Accuracy

#### Q: Transcription keeps mishearing words

**A:** Try these fixes:

1. **Improve audio quality:**
   - Speak more clearly
   - Reduce background noise
   - Move closer to microphone

2. **Use more accurate model:**
   ```bash
   clawdbot configure voice --stt-model small
   # vs
   clawdbot configure voice --stt-model tiny
   ```

3. **Adjust sensitivity:**
   ```yaml
   voice:
     stt:
       config:
         confidenceThreshold: 0.8     # Filter low-confidence results
         vadThreshold: 0.7             # More aggressive noise removal
   ```

4. **Try different provider:**
   ```bash
   clawdbot configure voice --stt-provider google-cloud-stt
   ```

#### Q: TTS voice sounds robotic or unnatural

**A:** Try these:

1. **Slow down speech:**
   ```yaml
   voice:
     tts:
       config:
         speed: 0.9  # Default: 1.0
   ```

2. **Try different voice:**
   ```yaml
   # OpenAI options: coral, sage, shimmer, onyx, nova, fable
   voice:
     tts:
       config:
         voice: "sage"
   ```

3. **Use local provider:**
   ```yaml
   voice:
     tts:
       provider: "kokoro-local"  # Sometimes more natural
   ```

4. **Add voice instructions (ElevenLabs):**
   ```yaml
   voice:
     tts:
       config:
         instructions: "Speak in a warm, conversational tone"
   ```

#### Q: Language support - can I use other languages?

**A:** Yes, specify language:

```yaml
voice:
  stt:
    config:
      language: "es"  # Spanish
      # or: "fr", "de", "zh", "ja", etc.
```

Cloud providers support 90+ languages. Local (Whisper) supports 99+.

### Cost Questions

#### Q: How much does voice cost?

**A:** Depends on provider:

| Provider | STT Cost | TTS Cost | Total/Call |
|----------|----------|----------|-----------|
| OpenAI Cloud | $0.010 | $0.015 | $0.025 |
| Google Cloud | $0.004 | $0.010 | $0.014 |
| ElevenLabs | $0 | $0.0003/char | varies |
| Local (Free) | $0 | $0 | $0 |
| Hybrid | ~$0.010 | ~$0.010 | ~$0.020 |

**Example:** 100 calls/day at $0.025 = ~$75/month

#### Q: How can I reduce costs?

**A:** Options:

1. **Switch to local providers:**
   ```bash
   clawdbot configure voice --provider whisper-local --tts-provider kokoro-local
   # Cost: $0/month (after initial GPU cost)
   ```

2. **Use hybrid mode:**
   ```bash
   clawdbot configure voice --mode hybrid
   # Cost: ~$30-40/month (cloud + occasional fallback)
   ```

3. **Reduce call volume:**
   - Batch transcriptions
   - Cache TTS results
   - Reduce unnecessary calls

4. **Negotiate with provider:**
   - OpenAI: 1M+ calls/month gets volume discount
   - Contact sales for enterprise pricing

#### Q: Is there a free tier?

**A:** Yes:
- **OpenAI:** $5 free credits (good for testing)
- **Google Cloud:** $300 free trial (90 days)
- **Local providers:** Completely free

Use free tier for development, switch to paying tier for production.

### Reliability & Failover

#### Q: How does failover work?

**A:** When primary provider fails, automatically tries fallback:

```yaml
voice:
  stt:
    provider: "openai-realtime"    # Primary
    fallback:
      strategy: "failover"
      providers:
        - "whisper-local"          # Try if primary fails
        - "google-cloud-stt"        # Try if both fail
```

**Example flow:**
1. Try OpenAI → Success → Return result
2. OpenAI fails → Try Whisper
3. Whisper succeeds → Return result (log fallback)

#### Q: How do I know if failover happened?

**A:** Check logs:

```bash
clawdbot logs --service voice --tail 50 | grep -i fallback

# Output
[2026-01-16 10:30:45] INFO  Fallback to whisper-local (openai-realtime failed)
[2026-01-16 10:30:48] INFO  whisper-local succeeded
```

#### Q: Can I test failover?

**A:** Yes, simulate provider failure:

```bash
clawdbot debug voice-test --simulate-failure openai-realtime

# Should automatically fallback
```

### Logging & Debugging

#### Q: How do I enable debug logging?

**A:** Update config:

```yaml
logging:
  voice:
    level: "debug"
    format: "json"
    includeFields:
      - provider
      - durationMs
      - errorIfAny
```

Then check logs:
```bash
clawdbot logs --service voice --level debug
```

#### Q: Where are voice logs stored?

**A:**
- Linux/macOS: `~/.clawdbot/logs/voice.log`
- Windows: `%APPDATA%\Clawdbot\logs\voice.log`
- Docker: `stdout` (use `docker logs`)

#### Q: How do I report a bug?

**A:** Generate diagnostic report:

```bash
clawdbot debug voice-report > voice-diagnostics.json

# Share with support
clawdbot share-diagnostics
```

Report includes:
- Provider status
- Configuration (no API keys)
- Recent logs
- System information

### Integration Questions

#### Q: Can I use voice with my chatbot?

**A:** Yes, voice-call extension handles incoming calls and automatically:
1. Transcribes voice to text (STT)
2. Sends to your agent
3. Synthesizes response to voice (TTS)
4. Plays to caller

No additional code needed.

#### Q: How do I customize voice behavior?

**A:** In agent config:

```yaml
agents:
  myagent:
    voiceSettings:
      language: "es"
      stTProvider: "openai-realtime"
      ttsVoice: "sage"
      ttsSpeed: 0.95
```

#### Q: Can I use voice with Slack/Discord?

**A:** Not directly (those platforms provide audio separately).

But you can transcribe Slack threads or Discord messages if they contain voice notes.

### Platform-Specific

#### Q: Voice doesn't work on macOS

**A:** macOS app uses built-in providers. Check:

```bash
# Verify OpenAI key is configured
defaults read com.clawd.clawdbot voice

# Restart app
killall Clawdbot
open /Applications/Clawdbot.app
```

#### Q: Voice doesn't work on Windows

**A:** Check:

1. **Provider installed:**
   ```powershell
   clawdbot debug voice-health
   ```

2. **Python available (for local):**
   ```powershell
   python --version  # Should show 3.9+
   ```

3. **CUDA installed (for GPU):**
   ```powershell
   nvidia-smi
   ```

#### Q: Voice doesn't work on Linux

**A:** Check:

1. **PortAudio installed:**
   ```bash
   sudo apt-get install libportaudio2
   ```

2. **Provider available:**
   ```bash
   clawdbot debug voice-health
   ```

3. **ALSA configured:**
   ```bash
   speaker-test -t wav -c 2 -l 1
   ```

### Deployment Questions

#### Q: How do I deploy voice to production?

**A:** See [Administrator Guide](/voice-providers-admin-guide)

Quick steps:
1. Choose deployment model (cloud, local, hybrid)
2. Secure API keys in environment
3. Configure fallback providers
4. Set up monitoring
5. Load test
6. Document runbook

#### Q: How do I scale voice for many users?

**A:**
1. Use cloud providers (handle scaling)
2. Set up load balancing
3. Configure connection pooling
4. Monitor latency
5. Use fallback for reliability

#### Q: How do I monitor voice in production?

**A:**
1. Set up Prometheus metrics
2. Create Grafana dashboard
3. Set up alerting
4. Monitor provider health
5. Track costs

See [Administrator Guide](/voice-providers-admin-guide#part-5-monitoring--diagnostics)

---

## Troubleshooting Flowchart

```
Voice Not Working?
    │
    ├─ No errors, but nothing happens
    │   ├─ Check if voice enabled: clawdbot status
    │   └─ Restart: clawdbot restart
    │
    ├─ "Provider not found"
    │   ├─ Install provider: npm install @clawdbot/stt-whisper
    │   └─ Auto-discover: clawdbot voice --discover-providers
    │
    ├─ "API key invalid"
    │   ├─ Check key: echo $OPENAI_API_KEY
    │   ├─ Regenerate: https://platform.openai.com/account/api-keys
    │   └─ Update config: clawdbot configure voice
    │
    ├─ "Network timeout"
    │   ├─ Check internet: ping api.openai.com
    │   ├─ Try fallback: clawdbot configure voice --mode hybrid
    │   └─ Use local: clawdbot configure voice --provider whisper-local
    │
    ├─ "High latency"
    │   ├─ Use GPU: clawdbot configure voice --device cuda
    │   ├─ Use cloud: clawdbot configure voice --provider openai-realtime
    │   └─ Check CPU: top
    │
    └─ "Poor quality"
        ├─ Improve audio: Speak clearly, less noise
        ├─ Bigger model: clawdbot configure voice --stt-model small
        └─ Try provider: clawdbot configure voice --stt-provider google-cloud-stt
```

---

## Quick Diagnostics

### Run These Commands

```bash
# Check overall status
clawdbot debug voice-health

# Test providers
clawdbot debug voice-test --provider openai-realtime
clawdbot debug voice-test --provider whisper-local

# Check latency
clawdbot debug voice-latency

# Monitor usage
clawdbot debug voice-monitor

# Generate report
clawdbot debug voice-report > report.json
```

### Expected Output

```bash
$ clawdbot debug voice-health

Voice Providers Health Check:

STT Providers:
  ✓ openai-realtime: connected (latency: 245ms)
  ✓ whisper-local: ready (model: base)

TTS Providers:
  ✓ openai-tts: connected (latency: 180ms)
  ✓ kokoro-local: ready

Fallback Configuration:
  STT: openai-realtime → whisper-local
  TTS: openai-tts → kokoro-local

Overall Status: ✓ Ready
```

---

## Common Error Messages & Solutions

### "Error: STT provider required"

**Cause:** No STT provider configured

**Fix:**
```bash
clawdbot configure voice
# Select STT provider
```

### "Error: Network connection failed"

**Cause:** Internet down or provider unavailable

**Fix:**
```bash
# Check network
ping 8.8.8.8

# Use local provider
clawdbot configure voice --provider whisper-local

# Check provider status
curl https://status.openai.com
```

### "Error: No audio detected"

**Cause:** Microphone issues

**Fix:**
```bash
# Test microphone
clawdbot debug audio-test

# Check audio permissions
# Linux: check ~/.asound.conf
# macOS: System Preferences → Security & Privacy → Microphone
# Windows: Settings → Privacy & Security → Microphone
```

### "Error: Model not found"

**Cause:** Local model not downloaded

**Fix:**
```bash
# Download models
clawdbot debug voice-download-models

# Or on first use (automatic)
clawdbot configure voice --provider whisper-local
```

### "Error: CUDA not available"

**Cause:** GPU not properly configured

**Fix:**
```bash
# Check NVIDIA installation
nvidia-smi

# Verify CUDA
nvcc --version

# Install CUDA if needed
# https://developer.nvidia.com/cuda-downloads

# Fallback to CPU
clawdbot configure voice --device cpu
```

---

## Still Need Help?

- 📖 **Documentation:** https://docs.clawd.bot/voice
- 🐛 **Report Issue:** https://github.com/clawdbot/clawdbot/issues
- 💬 **Community:** https://discord.gg/clawdbot
- 📧 **Support:** support@clawd.bot

