# Docker Quick Start Guide - Clawdbot with Voice Providers

This guide walks you through building and running Clawdbot in Docker with full voice provider support (Whisper STT + Kokoro TTS) using system mode (no external APIs required).

## Prerequisites

- Docker Desktop or Docker Engine 20.10+
- Docker Compose 2.0+
- 2GB+ free disk space (for models)
- 4GB+ RAM recommended

## Quick Start (5 minutes)

### 1. Build the Docker Image

Build the production-ready image with voice providers pre-installed:

```bash
# From the clawdbot root directory
docker build -t clawdbot:voice .
```

**What this does:**
- Installs Node.js 22 runtime
- Installs ffmpeg, Python 3 for audio processing
- Installs Whisper for speech-to-text
- Pre-downloads Whisper base model (~140MB)
- Builds the Clawdbot application with voice-call extension
- Creates non-root user for security

### 2. Set Up Environment Variables

Create a `.env` file in the project root:

```bash
# Gateway configuration
CLAWDBOT_IMAGE=clawdbot:voice
CLAWDBOT_GATEWAY_PORT=18789
CLAWDBOT_BRIDGE_PORT=18790
CLAWDBOT_GATEWAY_BIND=lan
CLAWDBOT_GATEWAY_TOKEN=your-secure-token-here

# Claude web session (required for Claude integration)
CLAUDE_AI_SESSION_KEY=your-session-key
CLAUDE_WEB_SESSION_KEY=your-web-session-key
CLAUDE_WEB_COOKIE=your-cookie

# Local paths (create these directories)
CLAWDBOT_CONFIG_DIR=./config
CLAWDBOT_WORKSPACE_DIR=./clawd

# Voice provider configuration (optional - defaults shown)
VOICE_STT_PROVIDER=whisper-local
VOICE_TTS_PROVIDER=kokoro
WHISPER_MODEL_SIZE=base
WHISPER_LANGUAGE=auto
KOKORO_VOICE=af
```

Create the required directories:

```bash
mkdir -p config clawd
```

### 3. Start the Container

Using Docker Compose (recommended):

```bash
docker-compose up -d
```

Or with Docker directly:

```bash
docker run -d \
  --name clawdbot-gateway \
  -p 18789:18789 \
  -p 18790:18790 \
  -p 18791:18791 \
  -e CLAWDBOT_GATEWAY_TOKEN="your-token" \
  -e CLAUDE_AI_SESSION_KEY="your-key" \
  -e CLAUDE_WEB_SESSION_KEY="your-key" \
  -e CLAUDE_WEB_COOKIE="your-cookie" \
  -v $(pwd)/config:/home/node/.clawdbot \
  -v $(pwd)/clawd:/home/node/clawd \
  clawdbot:voice \
  node dist/index.js gateway-daemon --bind lan --port 18789
```

### 4. Verify the Container is Running

Check container status:

```bash
docker ps | grep clawdbot
docker-compose ps
```

View logs:

```bash
docker logs clawdbot-gateway
docker-compose logs -f clawdbot-gateway
```

Check health:

```bash
# Health endpoint
curl http://localhost:18789/health

# Should return: {"status": "ok"}
```

## Testing Voice Features

### Test Speech-to-Text (Whisper)

Transcribe an audio file to text:

```bash
# Create a test audio file (using ffmpeg to generate a simple tone)
ffmpeg -f lavfi -i "sine=frequency=1000:duration=2" -q:a 9 test-audio.mp3

# Test transcription via the gateway
curl -X POST http://localhost:18789/voice/transcribe \
  -F "audio=@test-audio.mp3" \
  -H "Authorization: Bearer your-token"
```

Or use the CLI from inside the container:

```bash
docker-compose exec clawdbot-gateway \
  node dist/index.js voice transcribe --file test-audio.mp3
```

### Test Text-to-Speech (Kokoro)

Generate speech from text:

```bash
# Request TTS synthesis
curl -X POST http://localhost:18789/voice/synthesize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{
    "text": "Hello, this is Clawdbot speaking!",
    "voice": "af",
    "model": "kokoro"
  }' > output.wav

# Play the generated audio
ffplay output.wav
```

Or via CLI:

```bash
docker-compose exec clawdbot-gateway \
  node dist/index.js voice synthesize \
    --text "Hello, this is Clawdbot" \
    --voice af \
    --output output.wav
```

### End-to-End Voice Conversation

Test the full voice loop (STT → Claude → TTS):

```bash
# Terminal 1: Start recording audio input
# (Uses the gateway's audio processing pipeline)
docker-compose exec clawdbot-gateway \
  node dist/index.js voice listen --duration 5

# Terminal 2: Send a voice message for processing
curl -X POST http://localhost:18789/voice/message \
  -H "Authorization: Bearer your-token" \
  -F "audio=@test-audio.mp3" \
  -F "context=greeting"
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VOICE_STT_PROVIDER` | `whisper-local` | Speech-to-text provider (whisper-local or openai) |
| `VOICE_TTS_PROVIDER` | `kokoro` | Text-to-speech provider (kokoro, piper, openai, elevenlabs) |
| `WHISPER_MODEL_SIZE` | `base` | Whisper model size: tiny, small, base, medium, large |
| `WHISPER_LANGUAGE` | `auto` | Language code (e.g., en, es) or 'auto' for detection |
| `KOKORO_VOICE` | `af` | Kokoro voice: af (female), am (male), bf (female alt), bm (male alt) |
| `CLAWDBOT_GATEWAY_PORT` | `18789` | Main gateway port |
| `CLAWDBOT_BRIDGE_PORT` | `18790` | Bridge communication port |
| `VOICE_API_PORT` | `18791` | Optional voice API endpoint port |

### Switch to Larger Whisper Model

For better accuracy (slower, more memory):

```bash
# medium model (1.4GB, ~10s per minute of audio)
WHISPER_MODEL_SIZE=medium docker-compose up -d

# Rebuild to pre-download the model
docker build --build-arg WHISPER_MODEL=medium -t clawdbot:voice-medium .
```

### Use External TTS/STT Services

Switch to OpenAI Whisper (API-based) or other providers:

```env
VOICE_STT_PROVIDER=openai
OPENAI_API_KEY=sk-...

VOICE_TTS_PROVIDER=openai
OPENAI_ORG_ID=org-...
```

## Logs and Debugging

### View Gateway Logs

```bash
docker-compose logs -f clawdbot-gateway
```

### Check Voice Provider Status

```bash
docker-compose exec clawdbot-gateway \
  node dist/index.js voice status
```

### Enable Debug Logging

```bash
# Restart with debug mode
docker-compose exec clawdbot-gateway \
  DEBUG=clawdbot:* node dist/index.js gateway-daemon --port 18789
```

### Inspect Model Cache

```bash
# Check downloaded models
docker-compose exec clawdbot-gateway ls -lah /app/.cache/whisper/

# Check TTS models
docker-compose exec clawdbot-gateway ls -lah /app/models/tts-kokoro/
```

## Troubleshooting

### Gateway Won't Start

**Error:** `Port 18789 already in use`

```bash
# Check what's using the port
lsof -i :18789

# Use a different port in docker-compose
CLAWDBOT_GATEWAY_PORT=18800 docker-compose up -d
```

### Whisper Model Download Fails

**Error:** `ConnectionError: Failed to download model`

```bash
# Check internet connectivity
docker-compose exec clawdbot-gateway curl -I https://huggingface.co

# Clear cache and rebuild
docker-compose down
docker volume rm clawdbot_whisper-cache
docker build --no-cache -t clawdbot:voice .
docker-compose up -d
```

### Audio Processing Errors

**Error:** `ffmpeg: not found` or audio format issues

```bash
# Verify ffmpeg is installed in container
docker-compose exec clawdbot-gateway which ffmpeg

# Rebuild with ffmpeg included
docker build -t clawdbot:voice .
```

### Memory Issues with Large Models

**Error:** `Killed` or `Out of memory`

```bash
# Use smaller model
WHISPER_MODEL_SIZE=tiny docker-compose up -d

# Increase Docker memory limit
# Edit docker-compose.yml and add:
# mem_limit: 8g
# memswap_limit: 8g
```

### Models Not Persisting

If models are re-downloaded on each restart:

```bash
# Verify volumes are being used
docker-compose exec clawdbot-gateway df -h /app/.cache/whisper

# Check volume mounts
docker inspect clawdbot-gateway | grep -A 5 Mounts

# Ensure volume is created
docker volume ls | grep whisper-cache
```

## Performance Tips

### Faster First Run

Pre-build with the model you want to use:

```dockerfile
# In Dockerfile, before the USER line
RUN python3 -c "import whisper; whisper.load_model('base')"
```

### Optimize for CPU

If running on CPU-only systems, use smaller models:

```bash
WHISPER_MODEL_SIZE=tiny docker-compose up -d
```

### Optimize for GPU (Optional)

If you have GPU support:

```bash
docker build --build-arg CUDA_SUPPORT=true -t clawdbot:voice-gpu .
```

## Stopping and Cleanup

### Stop Containers

```bash
docker-compose down
```

### Remove All Clawdbot Data

```bash
docker-compose down -v
docker rmi clawdbot:voice
rm -rf config clawd
```

### Keep Volumes (Preserve Model Cache)

```bash
# Stop but keep volumes
docker-compose down

# Restart - models will still be cached
docker-compose up -d
```

## Production Deployment

### Security Recommendations

1. **Use a secure gateway token:**
   ```bash
   CLAWDBOT_GATEWAY_TOKEN=$(openssl rand -base64 32) docker-compose up -d
   ```

2. **Run behind a reverse proxy (nginx):**
   ```nginx
   upstream clawdbot {
     server localhost:18789;
   }

   server {
     listen 443 ssl http2;
     server_name your-domain.com;

     ssl_certificate /path/to/cert.pem;
     ssl_certificate_key /path/to/key.pem;

     location / {
       proxy_pass http://clawdbot;
       proxy_set_header Authorization $http_authorization;
       proxy_pass_header Authorization;
     }
   }
   ```

3. **Restrict volume mounts:**
   ```bash
   chmod 700 config clawd
   ```

4. **Use read-only root filesystem:**
   ```yaml
   read_only: true
   tmpfs:
     - /tmp
     - /app/logs
   ```

### Hardware Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 1 core | 4+ cores |
| RAM | 2GB | 8GB+ |
| Disk | 2GB | 20GB (for models + cache) |
| Storage Type | HDD | SSD recommended |

### Monitoring

Monitor container health:

```bash
# Watch resource usage
docker stats clawdbot-gateway

# Check logs for errors
docker-compose logs --tail 50 -f

# Monitor health check status
docker-compose ps
```

## Advanced Topics

### Custom Voice Provider Configuration

Edit `extensions/voice-call/src/config.ts` or mount a custom config:

```yaml
volumes:
  - ./my-voice-config.json:/app/config/voice-providers.json
```

### Using Docker Compose Overrides

For local development vs production:

```bash
# Development (with hot reload)
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up

# Production (no reload)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Multi-Provider Setup

Run multiple voice providers simultaneously:

```env
VOICE_STT_PROVIDER=whisper-local  # Local for low latency
VOICE_TTS_PROVIDER_PRIMARY=kokoro # Fast local TTS
VOICE_TTS_PROVIDER_FALLBACK=openai # Fallback to OpenAI
```

## Additional Resources

- [Voice Integration Guide](/VOICE_INTEGRATION_SUMMARY.md)
- [Provider Configuration](/extensions/voice-call/src/providers/config-schemas.ts)
- [Voice Plugin Examples](/extensions/voice-call/src/plugins/EXAMPLES.ts)
- [Docker Testing Guide](/DOCKER-TEST-SETUP.md)

## Support

For issues or questions:

1. Check the logs: `docker-compose logs`
2. Review the [Troubleshooting](#troubleshooting) section above
3. Open an issue on GitHub with your `docker version` output
4. Include docker logs: `docker-compose logs > logs.txt`

---

**Last Updated:** January 2025

**Tested Configurations:**
- Docker 20.10+, Docker Compose 2.0+
- Linux (Ubuntu 20.04+, Debian, etc.)
- macOS (Docker Desktop)
- Windows (WSL2 with Docker Desktop)
