# Voice Provider Configuration Examples

**Status:** Reference Guide
**Purpose:** Real-world configuration examples for all supported voice provider combinations

---

## Table of Contents

1. [Minimal Configuration](#minimal-configuration)
2. [Local-Only Setup](#local-only-setup)
3. [Cloud-Only Setup](#cloud-only-setup)
4. [Hybrid Setup](#hybrid-setup)
5. [Advanced Configurations](#advanced-configurations)
6. [Troubleshooting Configs](#troubleshooting-configs)
7. [Migration Examples](#migration-examples)

---

## Minimal Configuration

### Use Defaults (Skip Setup)

When user selects "Skip" during onboarding, minimal config is created:

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "provider": "whisper-local"
    },
    "tts": {
      "provider": "kokoro"
    }
  }
}
```

**What happens:**
- STT uses Whisper-local with defaults (medium model, auto-language detection)
- TTS uses Kokoro with defaults (af_bella voice, 1.0x speed)
- Fallback enabled (if one fails, try the other available provider)
- All optional config uses Zod defaults

**Loaded values:**
```typescript
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "medium",
        "autoLanguageDetection": true,
        "device": undefined,  // auto-detect
        "computeType": "default",
        "beamSize": 5,
        "bestOf": 1,
        "temperature": 0
      },
      "fallbackProvider": undefined,
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "kokoro",
      "kokoro": {
        "voice": "af_bella",
        "speed": 1.0,
        "device": undefined  // auto-detect
      },
      "fallbackProvider": undefined,
      "timeout": 10000
    },
    "fallbackEnabled": true,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

---

## Local-Only Setup

### Whisper + Kokoro (Recommended for Most Users)

**Setup:**
```bash
clawdbot voice configure --local-only
# Selects: Whisper-local + Kokoro (no API keys needed)
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "medium",
        "autoLanguageDetection": true
      },
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "kokoro",
      "kokoro": {
        "voice": "af_bella",
        "speed": 1.0
      },
      "timeout": 10000
    },
    "fallbackEnabled": false,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- Zero cost
- Zero API calls
- All processing local
- ~1-2 second latency (Whisper depends on audio length)
- Works offline
- Requires: Python 3.9+, 2GB+ RAM, ~2GB disk (models)

---

### Whisper (Large) + Piper (Multi-language)

**Setup:**
```bash
clawdbot voice configure --local-only
# Select: Whisper-local (large model)
# Select: Piper (for multi-language)
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "large",
        "autoLanguageDetection": true,
        "device": "cuda"
      },
      "fallbackProvider": undefined,
      "timeout": 45000
    },
    "tts": {
      "enabled": true,
      "provider": "piper",
      "piper": {
        "language": "en",
        "voice": "p301",
        "speed": 1.0,
        "outputFormat": "pcm"
      },
      "fallbackProvider": undefined,
      "timeout": 15000
    },
    "fallbackEnabled": false,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- Best accuracy for STT (Whisper large)
- 100+ voices across 20+ languages (Piper)
- Zero cost
- ~3-5 second latency (large model slower)
- Requires: GPU (CUDA/ROCm), 6GB+ VRAM, ~3GB disk

**Multi-language example:**
```json
{
  "tts": {
    "provider": "piper",
    "piper": {
      "language": "es",
      "voice": "es_MX-alaro-x-low",
      "speed": 0.9
    }
  }
}
```

---

## Cloud-Only Setup

### OpenAI Realtime STT + OpenAI TTS

**Setup:**
```bash
export OPENAI_API_KEY=sk-proj-...
clawdbot voice configure
# Select: OpenAI Realtime (for STT)
# Select: OpenAI TTS (for TTS)
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "openai-realtime",
      "openaiRealtime": {
        "apiKey": "sk-proj-...",
        "model": "gpt-4-realtime",
        "voiceActivityDetection": true,
        "vadThreshold": 0.3,
        "maxTokens": 4096
      },
      "fallbackProvider": undefined,
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "openai-tts",
      "openaiTts": {
        "apiKey": "sk-proj-...",
        "model": "tts-1",
        "voice": "nova",
        "speed": 1.0
      },
      "fallbackProvider": undefined,
      "timeout": 10000
    },
    "fallbackEnabled": false,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- Highest accuracy (~95%)
- Lowest latency (~100-200ms)
- 6 voices (alloy, echo, fable, onyx, shimmer, nova)
- Cost: $0.02/min STT + $0.015/1k chars TTS
- Requires: Internet, OpenAI API key, billing setup

**Cost estimation:**
- 1 hour voice calls/day: ~$1/day (≈$30/month)
- Average message: 50 chars TTS + 30s STT = $0.002

---

## Hybrid Setup

### Local STT + Cloud TTS (Best of Both)

**Scenario:** Want accuracy of local Whisper but highest quality voices from OpenAI

**Setup:**
```bash
export OPENAI_API_KEY=sk-proj-...
clawdbot voice configure
# Select: Whisper-local (for STT)
# Select: OpenAI TTS (for TTS)
# Enable fallback: Yes (Piper as backup for TTS)
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "medium",
        "autoLanguageDetection": true
      },
      "fallbackProvider": "openai-realtime",
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "openai-tts",
      "openaiTts": {
        "apiKey": "sk-proj-...",
        "model": "tts-1-hd",
        "voice": "nova",
        "speed": 1.0
      },
      "fallbackProvider": "piper",
      "timeout": 10000
    },
    "fallbackEnabled": true,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- STT: Free, local, offline, ~1-2s latency
- TTS: High quality, 6 voices, ~100-150ms latency, costs $0.015/1k chars
- Fallback: If OpenAI TTS fails, uses Piper (free)
- If STT times out, retries with OpenAI Realtime

**Cost:** ~$0.01/message (TTS only)

---

### Cloud STT + Local TTS (Cost Optimization)

**Scenario:** Need cloud STT for accuracy but want to save on TTS

**Setup:**
```bash
export OPENAI_API_KEY=sk-proj-...
clawdbot voice configure --advanced
# Select: OpenAI Realtime (for STT - accuracy)
# Select: Kokoro (for TTS - speed & cost)
# Enable fallback: Yes
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "openai-realtime",
      "openaiRealtime": {
        "apiKey": "sk-proj-...",
        "model": "gpt-4-realtime",
        "voiceActivityDetection": true,
        "vadThreshold": 0.3,
        "maxTokens": 4096
      },
      "fallbackProvider": "whisper-local",
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "kokoro",
      "kokoro": {
        "voice": "af_bella",
        "speed": 1.0
      },
      "fallbackProvider": "piper",
      "timeout": 10000
    },
    "fallbackEnabled": true,
    "audioFormat": {
      "sampleRate": 16000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- STT: Cloud, high accuracy (~95%), costs $0.02/min
- TTS: Local, fast, free, 8 voices
- Fallback: STT → Whisper-local (free), TTS → Piper (free)
- Cost: ~$0.01/message (STT only)

---

## Advanced Configurations

### Performance Tuning: Ultra-Fast Local

**Goal:** Minimize latency at the expense of accuracy

**Setup:**
```bash
clawdbot voice configure --advanced
# Select: Whisper-local (tiny model for speed)
# Select: Kokoro (fastest TTS)
# Disable VAD for faster response
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "tiny",
        "autoLanguageDetection": true,
        "device": "cuda",
        "beamSize": 1,
        "temperature": 0.3
      },
      "timeout": 15000
    },
    "tts": {
      "enabled": true,
      "provider": "kokoro",
      "kokoro": {
        "voice": "am_adam",
        "speed": 1.5,
        "device": "cuda"
      },
      "timeout": 5000
    },
    "fallbackEnabled": false,
    "audioFormat": {
      "sampleRate": 8000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "mulaw"
    }
  }
}
```

**Characteristics:**
- STT: 39MB model, ~0.5-1s latency, lower accuracy
- TTS: 1.5x speed, ~0.3-0.5s latency
- Total roundtrip: ~1-2 seconds
- Use case: Real-time interactions, latency-critical

---

### Quality Tuning: Maximum Accuracy

**Goal:** Maximize accuracy regardless of latency/cost

**Setup:**
```bash
export OPENAI_API_KEY=sk-proj-...
clawdbot voice configure --advanced
# Select: OpenAI Realtime (best accuracy)
# Select: OpenAI TTS (highest quality)
# Use HD model
```

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "openai-realtime",
      "openaiRealtime": {
        "apiKey": "sk-proj-...",
        "model": "gpt-4-realtime",
        "voiceActivityDetection": true,
        "vadThreshold": 0.1,
        "maxTokens": 4096
      },
      "timeout": 60000
    },
    "tts": {
      "enabled": true,
      "provider": "openai-tts",
      "openaiTts": {
        "apiKey": "sk-proj-...",
        "model": "tts-1-hd",
        "voice": "shimmer",
        "speed": 1.0
      },
      "timeout": 20000
    },
    "fallbackEnabled": true,
    "audioFormat": {
      "sampleRate": 24000,
      "channels": 1,
      "bitDepth": 16,
      "encoding": "pcm"
    }
  }
}
```

**Characteristics:**
- STT: 95%+ accuracy, VAD threshold 0.1 (more sensitive)
- TTS: HD model, highest quality
- Fallback: Both providers have fallbacks
- Cost: ~$0.03/message
- Latency: 200-500ms
- Use case: Customer service, accessibility

---

### Multi-Language Setup

**Goal:** Support multiple languages for voice

**English + Spanish + French:**

**`~/.clawdbot/clawdbot.json`:**
```json
{
  "voice": {
    "enabled": true,
    "stt": {
      "enabled": true,
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "medium",
        "autoLanguageDetection": true
      },
      "timeout": 30000
    },
    "tts": {
      "enabled": true,
      "provider": "piper",
      "piper": {
        "language": "en",
        "voice": "p301",
        "speed": 1.0,
        "outputFormat": "pcm"
      },
      "fallbackProvider": undefined,
      "timeout": 15000
    },
    "fallbackEnabled": false
  }
}
```

**Switching languages (at runtime):**
```bash
# English
clawdbot voice configure --tts piper --voice p301

# Spanish
clawdbot voice configure --tts piper --voice es_MX-alaro-x-low

# French
clawdbot voice configure --tts piper --voice fr_FR-siwis-medium
```

---

## Troubleshooting Configs

### Timeout Issues: Increase Timeouts

**Problem:** "STT timed out after 30s"

**Solution:**
```json
{
  "voice": {
    "stt": {
      "timeout": 60000
    }
  }
}
```

**CLI:**
```bash
clawdbot voice configure --json | \
  jq '.voice.stt.timeout = 60000' | \
  clawdbot voice configure --stdin
```

---

### Memory Pressure: Use Smaller Models

**Problem:** "Whisper model requires 6GB VRAM available"

**Solution:**
```json
{
  "voice": {
    "stt": {
      "whisperLocal": {
        "modelSize": "base"
      }
    }
  }
}
```

**CLI:**
```bash
clawdbot voice configure --stt whisper-local --model-size base
```

---

### API Rate Limiting: Add Retry Logic

**Problem:** OpenAI rate limit errors

**Solution:** Use fallback providers
```json
{
  "voice": {
    "stt": {
      "provider": "openai-realtime",
      "fallbackProvider": "whisper-local"
    },
    "fallbackEnabled": true
  }
}
```

---

### No GPU: Fall Back to CPU

**Problem:** GPU not available

**Solution:**
```json
{
  "voice": {
    "stt": {
      "whisperLocal": {
        "device": "cpu"
      }
    },
    "tts": {
      "kokoro": {
        "device": "cpu"
      }
    }
  }
}
```

---

## Migration Examples

### From Legacy Talk Config

**Before (legacy):**
```json
{
  "talk": {
    "voice": "nova",
    "voiceAliases": {
      "main": "nova"
    }
  }
}
```

**After (migrated to new system):**
```json
{
  "talk": {
    "voice": "nova",
    "voiceAliases": { "main": "nova" }
  },
  "voice": {
    "enabled": true,
    "tts": {
      "provider": "openai-tts",
      "openaiTts": {
        "voice": "nova"
      }
    }
  }
}
```

**CLI Migration:**
```bash
# Detect and auto-migrate
clawdbot voice configure --auto-migrate

# Or manual migration
export OPENAI_API_KEY=sk-proj-...
clawdbot voice configure
# Select TTS: OpenAI TTS
# Select voice: nova
```

---

### From Simple Config

**Before:**
```json
{
  "audio": {
    "enabled": true
  }
}
```

**After:**
```json
{
  "audio": {
    "enabled": true
  },
  "voice": {
    "enabled": true,
    "stt": {
      "provider": "whisper-local",
      "whisperLocal": {
        "modelSize": "medium"
      }
    },
    "tts": {
      "provider": "kokoro",
      "kokoro": {
        "voice": "af_bella"
      }
    }
  }
}
```

---

## Configuration Validation Examples

### Valid Config: Whisper + Kokoro
```bash
✓ Valid - both providers available locally
clawdbot voice configure --json < config.json
# Output: { "valid": true, "providers": ["whisper-local", "kokoro"] }
```

### Invalid Config: OpenAI without API key
```bash
✗ Invalid - OpenAI selected but no API key
clawdbot voice configure --json < config.json
# Error: Missing OPENAI_API_KEY for openai-realtime provider
```

### Valid Config: Fallback chain
```json
{
  "voice": {
    "stt": {
      "provider": "openai-realtime",
      "fallbackProvider": "whisper-local"
    }
  }
}
```

```bash
✓ Valid - fallback chain configured
clawdbot voice configure --json < config.json
# Output: { "valid": true, "fallback": "openai-realtime -> whisper-local" }
```

---

## Performance Metrics by Configuration

| Config | STT Latency | TTS Latency | Monthly Cost | Accuracy | Notes |
|--------|------------|------------|--------------|----------|-------|
| Whisper + Kokoro | 1-2s | 0.3-0.5s | $0 | 90% | Recommended |
| Whisper (large) + Piper | 3-5s | 0.5-1s | $0 | 95% | Best local quality |
| OpenAI + OpenAI | 0.1-0.2s | 0.1-0.15s | $30-60 | 99% | Most expensive |
| OpenAI + Kokoro | 0.1-0.2s | 0.3-0.5s | $10-20 | 99%/90% | Balanced |
| Whisper + OpenAI | 1-2s | 0.1-0.15s | $5-15 | 90%/99% | Balanced |
| Whisper (tiny) + Kokoro | 0.5-1s | 0.2-0.3s | $0 | 80% | Fastest |

---

*Last Updated: January 16, 2026*
*Configuration Examples: Production Ready*
