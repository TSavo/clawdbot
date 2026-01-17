# Voice Provider Configuration Guide

This directory contains configuration files for voice provider plugins supporting STT (Speech-to-Text) and TTS (Text-to-Speech) providers.

## Files

- **`default-providers.json`**: Default provider configurations ready for use
- **`voice-providers.example.json`**: Comprehensive examples showing all deployment modes
- **`provider-config-schema.json`**: JSON Schema for validation

## Deployment Modes

Voice providers can be deployed in three modes, each with different trade-offs:

### 1. System Mode (Local Binary)

Run providers as local binaries on the host machine.

**Pros:**
- Full privacy (no data leaves your machine)
- No network dependency (works offline)
- Low latency
- No API costs

**Cons:**
- Requires manual installation
- Limited by local CPU/GPU
- Manual model updates

**Configuration Example:**
```json
{
  "deployment": {
    "mode": "system",
    "system": {
      "binaryPath": "/usr/local/bin/whisper",
      "workingDir": "/var/tmp/whisper",
      "env": {
        "WHISPER_MODEL": "base"
      }
    }
  }
}
```

**Use Cases:**
- Privacy-sensitive transcription
- Offline operation
- High-volume usage (no per-request costs)
- Low-latency requirements

### 2. Docker Mode (Containerized)

Run providers in Docker containers with isolated environments.

**Pros:**
- Easy deployment and updates
- Version control (image tags)
- GPU acceleration support
- Reproducible environments

**Cons:**
- Docker overhead (CPU/memory)
- Storage for container images
- Requires Docker daemon

**Configuration Example:**
```json
{
  "deployment": {
    "mode": "docker",
    "docker": {
      "image": "ghcr.io/openai/faster-whisper",
      "tag": "latest-gpu",
      "containerName": "clawdbot-faster-whisper",
      "volumes": [
        {
          "host": "${HOME}/.cache/whisper",
          "container": "/root/.cache/whisper"
        }
      ],
      "env": {
        "NVIDIA_VISIBLE_DEVICES": "all"
      }
    }
  }
}
```

**Use Cases:**
- Development environments
- GPU-accelerated workloads
- Microservices architecture
- Version-pinned deployments

### 3. Cloud Mode (API)

Use cloud-hosted APIs for speech services.

**Pros:**
- No local setup required
- Auto-scaling infrastructure
- Latest models and features
- Professional support

**Cons:**
- Per-request API costs
- Network dependency
- Privacy concerns (data sent to cloud)
- Rate limits

**Configuration Example:**
```json
{
  "deployment": {
    "mode": "cloud",
    "cloud": {
      "endpoint": "https://api.deepgram.com/v1/listen",
      "apiKey": "${DEEPGRAM_API_KEY}",
      "region": "us",
      "timeout": 30000
    }
  }
}
```

**Use Cases:**
- Low-volume usage
- Prototyping and development
- Variable load (auto-scaling)
- Access to latest models

## Provider Reference

### STT (Speech-to-Text) Providers

| Provider | Mode | ID | Priority | Use Case |
|----------|------|-----|----------|----------|
| Whisper | System | `whisper-system` | 100 | Default, offline, privacy |
| Faster-Whisper | Docker | `faster-whisper-docker` | 90 | GPU acceleration, fast |
| Deepgram | Cloud | `deepgram-cloud` | 110 | High accuracy, features |

### TTS (Text-to-Speech) Providers

| Provider | Mode | ID | Priority | Use Case |
|----------|------|-----|----------|----------|
| Kokoro | System | `kokoro-system` | 100 | Default, fast, local |
| CartesiaAI | Cloud | `cartesia-cloud` | 110 | Ultra-realistic, streaming |
| ElevenLabs | Cloud | `elevenlabs-cloud` | 105 | Premium voices, cloning |
| Chatterbox | Docker | `chatterbox-docker` | 95 | Containerized, VITS-based |

## Configuration Options

### Provider Priority

Providers have priority values (0-1000) that determine fallback order:
- Higher priority = preferred provider
- Default priority: 100
- Cloud providers typically: 105-110
- System providers typically: 100
- Docker providers typically: 90-95

### Fallback Chains

You can define fallback chains for resilience:

```json
{
  "fallbackChains": {
    "stt": [
      {
        "description": "High accuracy with cloud fallback",
        "providers": [
          "deepgram-cloud",
          "faster-whisper-docker",
          "whisper-system"
        ]
      }
    ],
    "tts": [
      {
        "description": "Premium quality with local fallback",
        "providers": [
          "cartesia-cloud",
          "elevenlabs-cloud",
          "kokoro-system"
        ]
      }
    ]
  }
}
```

### Environment Variable Expansion

Configuration values support environment variable expansion using `${VAR}` syntax:

```json
{
  "apiKey": "${DEEPGRAM_API_KEY}",
  "binaryPath": "${HOME}/.local/bin/whisper"
}
```

## Getting Started

### 1. Choose Your Deployment Mode

Based on your requirements:
- **Privacy + Offline**: System mode
- **GPU Acceleration**: Docker mode
- **Quick Start**: Cloud mode

### 2. Configure Providers

Copy `voice-providers.example.json` and customize:

```bash
cp voice-providers.example.json my-providers.json
```

Edit `my-providers.json`:
- Set `enabled: true` for desired providers
- Configure API keys (cloud mode)
- Set binary paths (system mode)
- Configure Docker images (docker mode)

### 3. Set Environment Variables

For cloud providers:
```bash
export DEEPGRAM_API_KEY="your-key-here"
export CARTESIA_API_KEY="your-key-here"
export ELEVENLABS_API_KEY="your-key-here"
```

For system providers:
```bash
export WHISPER_MODEL="base"
export KOKORO_VOICE="af_sky"
```

### 4. Load Configuration

```typescript
import { SimplePluginRegistry } from "@clawdbot/speech-plugins/registry";

const registry = new SimplePluginRegistry();
await registry.loadFromConfig("./my-providers.json");
await registry.initializeAll();

// Use providers
const sttProvider = registry.getDefaultSTTProvider();
const ttsProvider = registry.getDefaultTTSProvider();
```

## Mode Selection Guide

### Choose System Mode When:
- ✅ Privacy is critical
- ✅ Operating offline
- ✅ High-volume usage (no per-request costs)
- ✅ Low-latency requirements
- ❌ You need the absolute latest models
- ❌ You don't want to manage installations

### Choose Docker Mode When:
- ✅ GPU acceleration needed
- ✅ Reproducible environments important
- ✅ Version control desired
- ✅ Running in microservices architecture
- ❌ Minimal resource overhead needed
- ❌ No Docker available

### Choose Cloud Mode When:
- ✅ Quick setup needed
- ✅ Low volume usage
- ✅ Latest models required
- ✅ Variable load (auto-scaling)
- ❌ Privacy is critical
- ❌ Offline operation needed
- ❌ High-volume usage (cost concerns)

## Common Configurations

### Privacy-First Setup
```json
{
  "providers": [
    { "id": "whisper-system", "enabled": true, "priority": 100 },
    { "id": "kokoro-system", "enabled": true, "priority": 100 }
  ]
}
```

### High-Performance GPU Setup
```json
{
  "providers": [
    { "id": "faster-whisper-docker", "enabled": true, "priority": 100 },
    { "id": "chatterbox-docker", "enabled": true, "priority": 100 }
  ]
}
```

### Cloud Premium Setup
```json
{
  "providers": [
    { "id": "deepgram-cloud", "enabled": true, "priority": 110 },
    { "id": "cartesia-cloud", "enabled": true, "priority": 110 }
  ]
}
```

### Hybrid Fallback Setup
```json
{
  "providers": [
    { "id": "deepgram-cloud", "enabled": true, "priority": 110 },
    { "id": "whisper-system", "enabled": true, "priority": 100 },
    { "id": "cartesia-cloud", "enabled": true, "priority": 110 },
    { "id": "kokoro-system", "enabled": true, "priority": 100 }
  ]
}
```

## Troubleshooting

### System Mode Issues
- **Binary not found**: Check `binaryPath` is correct and executable
- **Permission denied**: Ensure binary has execute permissions
- **Model not found**: Check model cache directory exists and has models

### Docker Mode Issues
- **Container not starting**: Check Docker daemon is running
- **Image not found**: Pull the image first: `docker pull <image>:<tag>`
- **GPU not detected**: Ensure NVIDIA Docker runtime is installed
- **Volume mount failed**: Check host paths exist and have correct permissions

### Cloud Mode Issues
- **Authentication failed**: Verify API key is correct and has not expired
- **Rate limit exceeded**: Check your API plan limits
- **Network timeout**: Increase `timeout` value or check network connection
- **Region unavailable**: Try a different region

## Schema Validation

Validate your configuration against the schema:

```bash
# Using ajv-cli
npm install -g ajv-cli
ajv validate -s provider-config-schema.json -d my-providers.json
```

Or programmatically:

```typescript
import Ajv from "ajv";
import schema from "./provider-config-schema.json";
import config from "./my-providers.json";

const ajv = new Ajv();
const validate = ajv.compile(schema);

if (!validate(config)) {
  console.error("Validation errors:", validate.errors);
}
```

## Security Best Practices

1. **Never commit API keys**: Use environment variables
2. **Rotate keys regularly**: Set up key rotation for cloud providers
3. **Restrict permissions**: Use least-privilege API keys
4. **Audit logs**: Monitor provider usage and errors
5. **Secure storage**: Protect configuration files with appropriate permissions

## Support

For provider-specific issues, consult:
- **Whisper**: https://github.com/openai/whisper
- **Faster-Whisper**: https://github.com/guillaumekln/faster-whisper
- **Deepgram**: https://developers.deepgram.com
- **Kokoro**: https://huggingface.co/hexgrad/Kokoro-82M
- **CartesiaAI**: https://docs.cartesia.ai
- **ElevenLabs**: https://docs.elevenlabs.io
- **Chatterbox**: https://github.com/chatterbox/tts
