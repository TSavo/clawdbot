# Voice Providers: Administrator & Deployment Guide

**Audience:** System Administrators, DevOps, Self-Hosted Operators
**Status:** Complete
**Last Updated:** January 2026

---

## Executive Summary

This guide covers deployment, configuration, performance tuning, and troubleshooting of Clawdbot's voice provider system for administrators managing production or self-hosted instances.

**Key Topics:**
- Provider selection based on deployment type
- Resource requirements and optimization
- Security and credential management
- Monitoring and diagnostics
- Troubleshooting common issues

---

## Part 1: Deployment Models

### Model 1: Cloud-First (Recommended for Most Users)

**Providers:** OpenAI Realtime STT + OpenAI TTS

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"
      model: "gpt-4o-transcribe"
      vadThreshold: 0.5

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
      voice: "coral"
```

**Characteristics:**
- ✅ Highest quality results
- ✅ No local GPU required
- ✅ Automatic updates via API
- ✅ Minimal setup time
- ❌ Requires internet connection
- ❌ Per-API-call cost ($0.005 - $0.015 per request)
- ❌ Streaming latency ~200-500ms

**When to Use:**
- Professional deployments with budget
- Low-latency requirements
- Maximum quality demanded
- Simple infrastructure

**Cost Estimation (Monthly):**
```
100 calls/day × 30 days = 3,000 calls/month
Average cost: $0.01/call × 3,000 = ~$30/month

Volume discounts available:
- 1M calls/month → ~$0.003/call → ~$3,000/month
```

**Setup Time:** 5-10 minutes (API key only)

---

### Model 2: Fully Local/Offline

**Providers:** Whisper Local STT + Kokoro TTS

```yaml
voice:
  stt:
    provider: "whisper-local"
    config:
      modelSize: "base"    # 140MB model
      device: "cpu"        # or "cuda" for GPU
      language: "en"

  tts:
    provider: "kokoro-local"
    config:
      modelPath: "/opt/models/kokoro"
      device: "cpu"
      voice: "af"          # Female voice
```

**Characteristics:**
- ✅ Zero API costs
- ✅ Complete privacy (no external calls)
- ✅ Works without internet
- ✅ Customizable voice cloning
- ❌ Requires local GPU or slower CPU
- ❌ Manual model updates
- ❌ Higher latency (2-5s on CPU)
- ❌ More setup complexity

**When to Use:**
- Privacy-critical environments
- Offline/air-gapped deployments
- High volume (1000+ calls/day)
- Cost-sensitive operations
- Compliance requirements (no external data)

**Cost Estimation (Monthly):**
```
Hardware: $200-1000 (one-time) for GPU
Electricity: ~$0.10/kWh × 200W × 730h = ~$15/month
No API costs
```

**Setup Time:** 30-60 minutes (model download + configuration)

---

### Model 3: Hybrid (Recommended for Reliability)

**Providers:** OpenAI Realtime (primary) + Whisper Local (fallback)

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      apiKey: "${OPENAI_API_KEY}"
    fallback:
      providers:
        - "whisper-local"
      strategy: "failover"
      maxRetries: 1

  tts:
    provider: "openai-tts"
    config:
      apiKey: "${OPENAI_API_KEY}"
    fallback:
      providers:
        - "kokoro-local"
```

**Characteristics:**
- ✅ Best quality when cloud available
- ✅ Continues working during outages
- ✅ Graceful degradation
- ✅ Balanced cost/quality
- ❌ Moderate complexity
- ❌ Needs both CPU and API key

**When to Use:**
- Production deployments requiring reliability
- Environments with intermittent connectivity
- Compliance + quality requirements
- Mission-critical services

**Setup Time:** 30-45 minutes

---

## Part 2: Resource Requirements

### CPU-Based Deployments

#### Whisper STT on CPU

| Model | VRAM | Disk | Latency (CPU) | Accuracy |
|-------|------|------|---------------|----------|
| tiny | 1GB | 39MB | 3s | 76% |
| base | 1GB | 140MB | 8s | 80% |
| small | 2GB | 466MB | 15s | 85% |
| medium | 5GB | 1.5GB | 40s | 88% |
| large | 10GB | 2.9GB | 60s+ | 95% |

**Recommendation:** Start with `base` (140MB) for best latency/accuracy balance.

#### Kokoro TTS on CPU

| Feature | Requirement |
|---------|-------------|
| Model Size | 500MB |
| Inference Time | 0.5-1.0s per sentence |
| Concurrent Streams | 2-4 (CPU) |
| Voice Cloning | Optional (needs training audio) |

**Disk Space:** ~1GB for models directory

### GPU-Based Deployments

#### NVIDIA GPU

**Supported Models:**
- CUDA 11.8+ (for Whisper)
- CUDA 12.0+ (preferred)

**Performance:**

| Hardware | Whisper (base) | Latency | Cost/Month |
|----------|---|---------|-----------|
| CPU (4 core) | 8s | High | $0 |
| RTX 3060 | 0.5s | Low | $10-20 |
| RTX 4090 | 0.2s | Very Low | $30-40 |
| A100 | 0.1s | Minimal | $100+ |

**Setup:**

```bash
# Ubuntu 22.04 with NVIDIA driver
sudo apt-get install nvidia-cuda-toolkit

# Test GPU availability
nvidia-smi

# Configure Clawdbot
voice:
  stt:
    provider: "whisper-local"
    config:
      device: "cuda"
      modelSize: "small"  # More models fit in VRAM
```

#### Apple Metal (macOS)

Whisper automatically detects and uses Metal Performance Shaders:

```bash
voice:
  stt:
    provider: "whisper-local"
    config:
      device: "mps"  # Metal Performance Shaders
      modelSize: "small"
```

**Performance:** ~1-2s latency on M1/M2 Pro

### Memory Requirements

#### Minimum Configuration (Cloud Only)

```
RAM: 512MB
Disk: 100MB (config + logs)
Network: 1Mbps (streaming)
```

#### Recommended Configuration (Hybrid)

```
RAM: 2-4GB (for provider caching)
Disk: 2-5GB (models + cache)
Network: 5Mbps (streaming + updates)
```

#### High-Volume Configuration (Fully Local)

```
RAM: 8-16GB (buffer management)
Disk: 10-20GB (multiple models)
GPU: NVIDIA RTX 3060 12GB or better
CPU: 8+ cores for parallel processing
```

---

## Part 3: Security & Credentials

### API Key Management

#### Storage Locations

**Development:**
```
~/.clawdbot/credentials/openai-api-key
```

**Production (Recommended):**

Use environment variables or secrets management:

```bash
# Method 1: Environment variables
export OPENAI_API_KEY="sk-..."
export ELEVENLABS_API_KEY="..."

# Method 2: systemd environment file
/etc/systemd/system/clawdbot.service.d/env.conf
[Service]
EnvironmentFile=/etc/clawdbot/env

# Method 3: Docker secrets (Swarm/K8s)
docker secret create openai-api-key ./openai-key.txt
```

#### Credential Rotation

Implement API key rotation every 90 days:

```bash
#!/bin/bash
# scripts/rotate-voice-keys.sh

# Generate new OpenAI API key in dashboard
NEW_KEY="sk-..."

# Update systemd environment
sudo sed -i "s/OPENAI_API_KEY=.*/OPENAI_API_KEY=$NEW_KEY/" \
  /etc/clawdbot/env

# Restart service
sudo systemctl restart clawdbot

# Revoke old key
curl -X DELETE https://api.openai.com/v1/api-keys/old-key-id \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### Network Security

#### TLS/SSL for Audio Streaming

Ensure HTTPS is enabled for web dashboard and API:

```bash
# nginx configuration
upstream clawdbot {
  server localhost:3000;
}

server {
  listen 443 ssl http2;
  server_name clawdbot.example.com;

  ssl_certificate /etc/letsencrypt/live/clawdbot.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/clawdbot.example.com/privkey.pem;

  location /api/voice {
    proxy_pass https://clawdbot;
    proxy_ssl_verify off;
    proxy_set_header X-Forwarded-For $remote_addr;
  }
}
```

#### Provider Communication

Verify provider certificates:

```typescript
// src/gateway/voice-providers-security.ts
import https from "https";

export function createSecureVoiceProvider(config: VoiceProviderConfig) {
  const agent = new https.Agent({
    rejectUnauthorized: true,
    ca: process.env.CA_BUNDLE, // Optional custom CA bundle
  });

  return {
    ...config,
    httpsAgent: agent,
  };
}
```

### Data Privacy

#### Local Processing

Models run entirely locally:

```yaml
voice:
  privacy:
    storeAudioLocally: false      # Don't cache audio
    storageRetention: 0            # Immediate cleanup
    disableMetrics: true           # No telemetry
```

#### Cloud Provider Policies

Review provider privacy policies:

| Provider | Data Retention | GDPR Compliant |
|----------|---|---|
| OpenAI | 30 days default | Yes (with DPA) |
| ElevenLabs | 7 days | Yes |
| Google Cloud | Varies | Yes |

**Request DPA (Data Processing Agreement) for enterprise use.**

### Audit Logging

Enable comprehensive logging:

```yaml
logging:
  voice:
    level: "debug"
    format: "json"
    includeFields:
      - provider
      - processingTime
      - inputLength
      - errorIfAny
      - userId

  # Sample log output
  # {"provider": "openai-realtime", "processingTime": 245, "status": "success"}
```

---

## Part 4: Performance Tuning

### STT Optimization

#### Latency Tuning

```yaml
voice:
  stt:
    provider: "openai-realtime"
    config:
      # Reduce latency (may increase errors)
      silenceDurationMs: 500        # Default: 800ms
      vadThreshold: 0.7             # Default: 0.5

      # For Whisper Local
      chunkSizeMs: 1000             # Smaller chunks = lower latency
```

#### Accuracy Tuning

```yaml
voice:
  stt:
    provider: "whisper-local"
    config:
      modelSize: "small"             # More accurate than "tiny"
      device: "cuda"                 # Faster = allows larger model

      # Post-processing
      confidenceThreshold: 0.8       # Filter low-confidence results
      languageDetection: true
```

### TTS Optimization

#### Speed Control

```yaml
voice:
  tts:
    config:
      speed: 1.0                    # 1.0 = normal speed
      # 0.5 = 2x slower
      # 1.5 = 1.5x faster
```

#### Voice Selection

```yaml
# Cloud providers have pre-optimized voices
voice:
  tts:
    provider: "openai-tts"
    config:
      voice: "coral"               # Fast, clear delivery
      # Options: coral, sage, shimmer, onyx, nova, fable

    provider: "kokoro-local"
    config:
      voice: "af"                  # American female
      # Options: af, am, bf, bm (american/british × female/male)
```

### Caching Strategies

#### Provider Response Caching

Cache frequently-used TTS results:

```typescript
// extensions/voice-call/src/cache/tts-cache.ts
import NodeCache from "node-cache";

const ttsCache = new NodeCache({ stdTTL: 3600 });

export async function synthesizeWithCache(
  text: string,
  provider: TTSProvider,
  cacheKey?: string
): Promise<Buffer> {
  const key = cacheKey || `tts:${provider.name}:${text}`;

  let cached = ttsCache.get<Buffer>(key);
  if (cached) return cached;

  const audio = await provider.synthesize(text);
  ttsCache.set(key, audio);
  return audio;
}
```

#### Model Loading Optimization

Pre-load models at startup:

```typescript
// src/gateway/startup.ts
import { getVoiceProviderRegistry } from "./extensions/voice-call/plugins/registry";

export async function preloadModels() {
  const registry = await getVoiceProviderRegistry();

  // Pre-load STT models
  for (const provider of registry.listSTTProviders()) {
    await provider.provider.healthCheck?.();
    console.log(`Pre-loaded STT: ${provider.name}`);
  }

  // Pre-load TTS models
  for (const provider of registry.listTTSProviders()) {
    await provider.provider.healthCheck?.();
    console.log(`Pre-loaded TTS: ${provider.name}`);
  }
}
```

---

## Part 5: Monitoring & Diagnostics

### Health Checks

#### Built-in Health Endpoint

```bash
# Check provider health
curl http://localhost:3000/api/voice/health

# Response
{
  "stt": {
    "openai-realtime": { "healthy": true, "latencyMs": 245 },
    "whisper-local": { "healthy": true, "latencyMs": 3200 }
  },
  "tts": {
    "openai-tts": { "healthy": true, "latencyMs": 180 },
    "kokoro-local": { "healthy": true, "latencyMs": 850 }
  }
}
```

#### Prometheus Metrics

Export metrics for monitoring:

```typescript
// src/gateway/metrics/voice.ts
import prom from "prom-client";

export const sttLatency = new prom.Histogram({
  name: "voice_stt_latency_ms",
  help: "STT processing latency",
  labelNames: ["provider"],
  buckets: [100, 500, 1000, 2000, 5000],
});

export const ttsLatency = new prom.Histogram({
  name: "voice_tts_latency_ms",
  help: "TTS processing latency",
  labelNames: ["provider"],
  buckets: [100, 500, 1000, 2000],
});

export const providerErrors = new prom.Counter({
  name: "voice_provider_errors_total",
  help: "Total provider errors",
  labelNames: ["provider", "type", "error"],
});
```

Scrape in Prometheus:

```yaml
# prometheus.yml
scrape_configs:
  - job_name: "clawdbot-voice"
    static_configs:
      - targets: ["localhost:9090"]
    metrics_path: "/metrics"
```

### Logging

#### Structured Logs

```json
{
  "timestamp": "2026-01-16T10:30:45.123Z",
  "level": "info",
  "service": "voice",
  "event": "transcription_complete",
  "provider": "openai-realtime",
  "durationMs": 2450,
  "inputBytes": 8000,
  "confidence": 0.95,
  "callId": "call_abc123"
}
```

#### Log Aggregation

Centralize logs using ELK or similar:

```bash
# Filebeat configuration
filebeat.inputs:
  - type: log
    enabled: true
    paths:
      - /var/log/clawdbot/voice.log
    json.message_key: "msg"
    json.keys_under_root: true

output.elasticsearch:
  hosts: ["elasticsearch:9200"]
```

### Performance Dashboards

#### Grafana Dashboard

Key metrics to track:

1. **Provider Availability**
   - Health check success rate per provider
   - Response time trends

2. **Quality Metrics**
   - Average confidence scores
   - Error rates per provider
   - Latency percentiles (p50, p95, p99)

3. **Resource Usage**
   - GPU memory utilization
   - CPU usage during processing
   - Cache hit rates

4. **Cost Tracking** (if using cloud)
   - API calls per provider
   - Estimated monthly spend
   - Cost per minute of usage

---

## Part 6: Troubleshooting

### Common Issues & Solutions

#### Issue 1: STT Provider Unavailable

**Symptoms:**
```
Error: No STT provider available
```

**Diagnosis:**

```bash
# Check provider health
clawdbot debug voice-health

# Output
[✓] openai-realtime: connected
[✗] whisper-local: model not loaded
```

**Solutions:**

1. **OpenAI Realtime Failed:**
   ```bash
   # Verify API key
   echo $OPENAI_API_KEY

   # Test connectivity
   curl -i https://api.openai.com/v1/models

   # Check network
   ping api.openai.com
   ```

2. **Whisper Local Failed:**
   ```bash
   # Check model installation
   ls -la ~/.cache/huggingface/hub/

   # Force model download
   clawdbot configure voice --reset-whisper-cache

   # Check GPU access
   nvidia-smi
   ```

#### Issue 2: High Latency

**Symptoms:**
```
STT taking 5+ seconds for normal audio
TTS taking 2+ seconds for short sentences
```

**Diagnosis:**

```bash
clawdbot debug voice-latency --provider openai-realtime
```

**Solutions:**

1. **Network Latency:**
   ```bash
   # Ping provider
   ping api.openai.com
   traceroute api.openai.com

   # Check bandwidth
   iperf3 -c speedtest.example.com
   ```

2. **CPU/GPU Bottleneck:**
   ```bash
   # Monitor during call
   watch -n 1 'top -p $(pgrep -f "voice-worker")'
   watch nvidia-smi

   # Reduce model size
   voice:
     stt:
       provider: "whisper-local"
       config:
         modelSize: "tiny"  # Faster but less accurate
   ```

3. **Network Location:**
   ```bash
   # Consider regional endpoints if available
   # Some cloud providers have regional APIs
   OPENAI_API_BASE=https://api.europe.openai.com
   ```

#### Issue 3: Poor Transcription Quality

**Symptoms:**
```
STT output: "wake up" instead of "makeup"
STT output: gibberish or repeated words
```

**Diagnosis:**

```bash
# Test with known audio
clawdbot debug voice-test --audio samples/clear-speech.wav
```

**Solutions:**

1. **Background Noise:**
   ```yaml
   voice:
     stt:
       config:
         vadThreshold: 0.8  # More aggressive noise filtering
         silenceDurationMs: 1000  # Longer silence detection
   ```

2. **Language Mismatch:**
   ```yaml
   voice:
     stt:
       config:
         language: "en"  # Explicitly set language
   ```

3. **Model Size:**
   ```yaml
   voice:
     stt:
       provider: "whisper-local"
       config:
         modelSize: "small"  # Larger models are more accurate
   ```

4. **Provider Switch:**
   ```bash
   # Try alternative provider
   clawdbot configure voice --provider google-cloud-stt
   ```

#### Issue 4: TTS Voice Sounds Robotic

**Symptoms:**
```
Generated speech sounds unnatural or metallic
```

**Solutions:**

1. **Improve Voice Instructions:**
   ```yaml
   voice:
     tts:
       config:
         instructions: "Speak in a warm, conversational tone"
   ```

2. **Reduce Speed:**
   ```yaml
   voice:
     tts:
       config:
         speed: 0.9  # Slower = more natural
   ```

3. **Try Different Voice:**
   ```bash
   clawdbot configure voice --tts-voice shimmer
   ```

4. **Use Local TTS:**
   ```yaml
   voice:
     tts:
       provider: "kokoro-local"
       config:
         voice: "af"  # More natural than cloud for certain use cases
   ```

#### Issue 5: Intermittent Failures

**Symptoms:**
```
Works fine most of the time, then suddenly fails
Then works again after restart
```

**Diagnosis:**

```bash
# Check for resource leaks
clawdbot debug memory-usage --interval 10s

# Check for connection drops
tail -f /var/log/clawdbot/voice.log | grep -i error
```

**Solutions:**

1. **Connection Pooling:**
   ```typescript
   // Ensure connections are properly reused
   voice:
     stt:
       config:
         maxConcurrentStreams: 10
         connectionPool: true
   ```

2. **Automatic Reconnection:**
   ```yaml
   voice:
     stt:
       fallback:
         strategy: "failover"
         maxRetries: 3
         retryDelayMs: 1000
   ```

3. **Regular Restarts:**
   ```bash
   # Daily restart at 2 AM
   crontab -e
   0 2 * * * systemctl restart clawdbot
   ```

### Debug Commands

```bash
# Check overall voice system
clawdbot debug voice-health

# Test specific provider
clawdbot debug voice-test --provider openai-realtime

# Monitor real-time metrics
clawdbot debug voice-monitor

# Generate diagnostic report
clawdbot debug voice-report > voice-diagnostics.json

# Clear cached models
clawdbot debug voice-clear-cache

# Reset to defaults
clawdbot debug voice-reset-config
```

---

## Part 7: Scaling & High Availability

### Multi-Provider Setup

```yaml
voice:
  stt:
    provider: "openai-realtime"
    fallback:
      providers:
        - "whisper-local"
        - "google-cloud-stt"
      strategy: "failover"

  tts:
    provider: "openai-tts"
    fallback:
      providers:
        - "elevenlabs"
        - "kokoro-local"
```

### Load Balancing

For high-volume deployments:

```nginx
# nginx upstream for multiple clawdbot instances
upstream clawdbot-voice {
  least_conn;  # Use connection-based balancing
  server 10.0.1.10:3000;
  server 10.0.1.11:3000;
  server 10.0.1.12:3000;

  # Health check
  check interval=3000 rise=2 fall=5 timeout=1000;
  check_http_send "GET /health HTTP/1.0\r\n\r\n";
  check_http_expect_alive http_2xx http_3xx;
}

server {
  location /api/voice {
    proxy_pass http://clawdbot-voice;
  }
}
```

### Horizontal Scaling

Deploy multiple Clawdbot instances sharing configuration:

```bash
# docker-compose.yml
version: "3"

services:
  clawdbot-1:
    image: clawdbot:latest
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      CLAWDBOT_PORT: 3000
    volumes:
      - shared-config:/root/.clawdbot
    ports:
      - "3001:3000"

  clawdbot-2:
    image: clawdbot:latest
    environment:
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      CLAWDBOT_PORT: 3000
    volumes:
      - shared-config:/root/.clawdbot
    ports:
      - "3002:3000"

  nginx:
    image: nginx:latest
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - clawdbot-1
      - clawdbot-2

volumes:
  shared-config:
```

---

## Deployment Checklist

- [ ] Choose deployment model (cloud-first, local, hybrid)
- [ ] Verify resource requirements met
- [ ] Secure API keys in credential store
- [ ] Enable TLS/SSL for all communication
- [ ] Configure logging and monitoring
- [ ] Set up health checks
- [ ] Load test with expected volume
- [ ] Document fallback procedures
- [ ] Set up alerting for provider failures
- [ ] Create runbook for common issues
- [ ] Test disaster recovery procedures
- [ ] Document deployment in runbook

---

## References

- [Configuration Guide](/configuration)
- [Voice Plugins Architecture](/voice-plugins)
- [Security Best Practices](/security)
- [Monitoring & Observability](/observability)

