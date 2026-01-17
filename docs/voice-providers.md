# Voice Providers Configuration

The voice providers system enables pluggable Speech-to-Text (STT) and Text-to-Speech (TTS) integration. Supports both local models (for privacy and offline use) and cloud services (for simplicity and quality).

## Quick Start

### Setup via CLI

```bash
# Interactive configuration
clawdbot configure voice

# View current configuration
clawdbot voice status

# List available providers
clawdbot voice providers

# Test configured providers
clawdbot voice test
```

### During Onboarding

The voice providers configuration is available as an optional section during `clawdbot configure`:

```bash
clawdbot configure
# Select "Voice" from the menu
```

## Supported Providers

### Speech-to-Text (STT)

**Local Models:**
- **Faster-Whisper** - Optimized Whisper implementation, supports CUDA/MPS acceleration
- **Whisper** - OpenAI's Whisper model for accurate transcription

**Cloud Services:**
- **OpenAI Whisper API** - Cloud-based transcription
- **Google Cloud Speech-to-Text** - High-accuracy multilingual transcription
- **Azure Speech Services** - Enterprise-grade STT

### Text-to-Speech (TTS)

**Local Models:**
- **Kokoro** - Natural-sounding neural synthesis with GPU acceleration
- **Piper** - Lightweight, offline text-to-speech

**Cloud Services:**
- **ElevenLabs** - High-quality, natural voices (recommended)
- **Google Cloud Text-to-Speech** - Multilingual, professional voices
- **Azure Speech Services** - Enterprise TTS
- **OpenAI TTS** - Native TTS API

## Configuration

### Configuration File Structure

Voice providers are configured in `~/.clawdbot/clawdbot.json`:

```json
{
  "voice": {
    "providers": {
      "enabled": true,
      "providers": [
        {
          "id": "primary",
          "priority": 1,
          "enabled": true,
          "stt": {
            "type": "local",
            "model": "faster-whisper",
            "modelSize": "small",
            "device": "cuda",
            "language": "en"
          },
          "tts": {
            "type": "cloud",
            "service": "elevenlabs",
            "voiceId": "rachel",
            "apiKey": "${ELEVENLABS_API_KEY}",
            "speed": 1.0
          }
        }
      ],
      "defaultSttProviderId": "primary",
      "defaultTtsProviderId": "primary",
      "systemCapabilities": {
        "hasGpu": true,
        "gpuType": "cuda",
        "cpuThreads": 8,
        "totalMemoryGb": 16,
        "osType": "linux"
      }
    }
  }
}
```

### Local STT Configuration

```json
{
  "type": "local",
  "model": "faster-whisper",
  "modelSize": "small",
  "device": "cuda",
  "computeType": "float16",
  "language": "en"
}
```

**Model Sizes:** `tiny`, `base`, `small`, `medium`, `large`

**Device:** `cpu`, `cuda`, `mps`

**Memory Requirements:**
- Tiny: ~1GB
- Base: ~1GB
- Small: ~2GB
- Medium: ~5GB
- Large: ~10GB

### Cloud STT Configuration

```json
{
  "type": "cloud",
  "service": "openai",
  "apiKey": "${OPENAI_API_KEY}",
  "model": "whisper-1",
  "language": "en",
  "temperature": 0
}
```

### Local TTS Configuration

```json
{
  "type": "local",
  "model": "kokoro",
  "voice": "af_heart",
  "speed": 1.0,
  "language": "en",
  "device": "cuda"
}
```

**Kokoro Voices:** `af_heart`, `af`, `am`, `bf`, `bm`

**Piper Voices:** `en_US-amy`, `en_US-lessac`, `en_GB-alan`, etc.

### Cloud TTS Configuration

```json
{
  "type": "cloud",
  "service": "elevenlabs",
  "apiKey": "${ELEVENLABS_API_KEY}",
  "voiceId": "rachel",
  "modelId": "eleven_monolingual_v1",
  "outputFormat": "mp3_44100_128",
  "speed": 1.0
}
```

## Environment Variables

Voice providers support environment variable interpolation:

```bash
# STT API keys
export OPENAI_API_KEY="sk-..."
export GOOGLE_SPEECH_API_KEY="..."

# TTS API keys
export ELEVENLABS_API_KEY="..."
export GOOGLE_TTS_API_KEY="..."
export AZURE_SPEECH_API_KEY="..."
```

## Provider Priority and Fallback

Providers are ordered by priority (lower number = higher priority):

```json
{
  "providers": [
    { "id": "primary", "priority": 1 },
    { "id": "fallback", "priority": 2 },
    { "id": "final", "priority": 3 }
  ]
}
```

When the primary provider fails, the system automatically falls back to the next priority provider.

## System Capability Detection

The system automatically detects:
- GPU availability (CUDA, MPS)
- Total memory
- CPU cores
- Operating system
- Node.js version

This information is used to recommend appropriate providers and model sizes.

### Automatic Recommendations

Run `clawdbot voice providers` to see system-specific recommendations:

```
System Capabilities:
  Memory: 16.0GB
  GPU: Yes (cuda)
  CPU Threads: 8

Recommendations:
  STT: faster-whisper (small) - GPU acceleration available
  TTS: kokoro - Real-time synthesis with GPU
```

## Migration from Legacy Configuration

Previous voice configuration in `gateway.talk` is automatically migrated:

```json
{
  "gateway": {
    "talk": {
      "voiceId": "rachel",
      "modelId": "eleven_monolingual_v1",
      "apiKey": "..."
    }
  }
}
```

Run `clawdbot configure voice` and the wizard will automatically import and update your configuration.

## Dependencies

### Local STT

```bash
npm install faster-whisper
```

### Local TTS

```bash
npm install @kokoro-ai/kokoro
npm install piper-tts
```

The onboarding wizard will prompt to install missing dependencies.

## Commands Reference

### Voice Status
```bash
clawdbot voice status
```

Shows current provider configuration, system capabilities, and active providers.

### List Providers
```bash
clawdbot voice providers
```

Lists all available providers (local and cloud) with system capability indicators.

### Test Providers
```bash
clawdbot voice test
```

Tests configured providers for:
- Dependency availability
- API key configuration
- Basic connectivity

### Configure Interactively
```bash
clawdbot configure voice
```

Interactive configuration menu with options to:
- View status
- List providers
- Run tests
- Setup new providers
- Clear configuration

## Troubleshooting

### Missing Dependencies

```
ℹ STT model faster-whisper not installed
Run: npm install faster-whisper
```

**Solution:** Run the suggested npm install command, or use the onboarding wizard which will prompt for installation.

### GPU Not Detected

If you have GPU but it's not detected:

```bash
# Check GPU availability
nvidia-smi  # NVIDIA CUDA
rocminfo    # AMD ROCm
```

Configure manually in the config file:

```json
{
  "stt": {
    "type": "local",
    "model": "faster-whisper",
    "device": "cuda"
  }
}
```

### API Key Issues

Ensure API keys are set via environment variables:

```bash
export ELEVENLABS_API_KEY="your-key-here"
clawdbot voice test
```

### Memory Issues with Large Models

If running out of memory with large models:

1. Reduce model size:
   ```json
   { "modelSize": "small" }
   ```

2. Enable quantization:
   ```json
   { "computeType": "int8" }
   ```

3. Use cloud provider instead:
   ```json
   { "type": "cloud", "service": "openai" }
   ```

## Integration with Voice Call Plugin

Voice providers are designed to integrate with the voice-call extension:

```bash
clawdbot plugins enable voice-call
clawdbot voice test
```

The plugin automatically uses configured providers for:
- Real-time speech recognition
- Voice synthesis in conversations
- Voice wake word detection (if enabled)

## Advanced Configuration

### Multiple Providers with Fallback

```json
{
  "providers": [
    {
      "id": "gpu-local",
      "priority": 1,
      "stt": { "type": "local", "model": "faster-whisper", "device": "cuda" },
      "tts": { "type": "local", "model": "kokoro", "device": "cuda" }
    },
    {
      "id": "cloud-backup",
      "priority": 2,
      "stt": { "type": "cloud", "service": "openai", "apiKey": "${OPENAI_API_KEY}" },
      "tts": { "type": "cloud", "service": "elevenlabs", "apiKey": "${ELEVENLABS_API_KEY}" }
    }
  ]
}
```

### Per-Provider Configuration

Different settings for different contexts:

```json
{
  "providers": [
    {
      "id": "meeting",
      "stt": { "type": "local", "model": "medium", "language": "en" },
      "tts": { "type": "cloud", "service": "elevenlabs", "voiceId": "professional" }
    },
    {
      "id": "casual",
      "stt": { "type": "local", "model": "small", "language": "en" },
      "tts": { "type": "local", "model": "kokoro", "voice": "casual" }
    }
  ]
}
```

## Performance Tuning

### Optimize for Speed

```json
{
  "stt": {
    "type": "local",
    "model": "faster-whisper",
    "modelSize": "tiny",
    "device": "cuda"
  }
}
```

### Optimize for Quality

```json
{
  "stt": {
    "type": "local",
    "model": "faster-whisper",
    "modelSize": "large",
    "device": "cuda"
  },
  "tts": {
    "type": "cloud",
    "service": "elevenlabs",
    "voiceId": "premium"
  }
}
```

### Optimize for Privacy

Use local models exclusively:

```json
{
  "stt": { "type": "local", "model": "faster-whisper" },
  "tts": { "type": "local", "model": "kokoro" }
}
```

## See Also

- [Voice Call Plugin](https://github.com/clawdbot/clawdbot/tree/main/extensions/voice-call)
- [Configuration Reference](/configuration)
- [CLI Commands](/cli-reference)
