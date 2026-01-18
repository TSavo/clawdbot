# Voice Dashboard API Specification

## Base URL

```
http://localhost:3000/api/voice
wss://localhost:3000/ws/voice
```

## Authentication

All HTTP endpoints require Bearer token authentication:

```
Authorization: Bearer <session-token>
```

WebSocket connections use query parameter:

```
wss://localhost:3000/ws/voice/updates?token=<session-token>
```

## HTTP Endpoints

### 1. Get Provider Status (Polling)

**Endpoint:** `GET /api/voice/status`

**Description:** Get real-time health status of all providers

**Query Parameters:**
- `providerId` (optional): Filter by specific provider ID

**Response (200 OK):**

```json
{
  "providers": [
    {
      "id": "faster-whisper",
      "health": "healthy",
      "available": true,
      "healthy": true,
      "lastChecked": 1705423456000,
      "latency": 823,
      "errorRate": 0.15,
      "successRate": 99.85,
      "requestsProcessed": 12450,
      "requestsFailed": 18,
      "warnings": [],
      "resourceUsage": {
        "memoryMb": 2048,
        "cpuPercent": 35.2,
        "gpuPercent": 78.5,
        "threadsActive": 8,
        "uptime": 864000
      }
    },
    {
      "id": "elevenlabs",
      "health": "healthy",
      "available": true,
      "healthy": true,
      "lastChecked": 1705423456000,
      "latency": 145,
      "errorRate": 0.0,
      "successRate": 100.0,
      "requestsProcessed": 8234,
      "requestsFailed": 0,
      "warnings": []
    }
  ],
  "timestamp": 1705423456000
}
```

**Error Responses:**
- `401 Unauthorized` - Invalid or missing token
- `500 Internal Server Error` - Server error

---

### 2. Get All Providers with Capabilities

**Endpoint:** `GET /api/voice/providers`

**Description:** List all available providers with their capabilities

**Response (200 OK):**

```json
{
  "providers": [
    {
      "id": "faster-whisper",
      "name": "Faster-Whisper",
      "type": "stt",
      "mode": "docker",
      "description": "GPU-accelerated OpenAI Whisper",
      "capabilities": [
        {
          "name": "models",
          "value": "tiny,base,small,medium,large",
          "configurable": true
        },
        {
          "name": "languages",
          "value": "100+",
          "configurable": true
        },
        {
          "name": "maxConcurrent",
          "value": "8",
          "configurable": false
        },
        {
          "name": "gpuRequired",
          "value": true,
          "configurable": false
        }
      ],
      "active": true,
      "resourceRequirements": {
        "minMemoryMb": 2048,
        "minCpuCores": 4,
        "gpuRequired": true,
        "networkBandwidth": "low"
      },
      "documentation": "https://docs.clawd.bot/voice/providers#faster-whisper"
    },
    {
      "id": "elevenlabs",
      "name": "ElevenLabs",
      "type": "tts",
      "mode": "cloud",
      "description": "High-quality text-to-speech",
      "capabilities": [
        {
          "name": "voices",
          "value": "32",
          "configurable": true
        },
        {
          "name": "languages",
          "value": "29",
          "configurable": false
        },
        {
          "name": "emotions",
          "value": "cheerful,sad,angry,surprised",
          "configurable": true
        }
      ],
      "active": true,
      "resourceRequirements": {
        "networkBandwidth": "medium"
      }
    }
  ]
}
```

---

### 3. Get Provider Capabilities

**Endpoint:** `GET /api/voice/providers/:providerId/capabilities`

**Description:** Get detailed capabilities for a specific provider

**Path Parameters:**
- `providerId`: Provider ID (e.g., "faster-whisper")

**Response (200 OK):**

```json
{
  "providerId": "elevenlabs",
  "capabilities": {
    "models": ["multilingual", "english", "spanish"],
    "voices": [
      {
        "id": "aria",
        "name": "Aria",
        "language": "en-US",
        "gender": "female",
        "age": "adult",
        "accent": "american"
      },
      {
        "id": "roger",
        "name": "Roger",
        "language": "en-US",
        "gender": "male",
        "age": "middle-aged",
        "accent": "american"
      }
    ],
    "languages": ["en-US", "es-ES", "fr-FR", "de-DE"],
    "emotions": ["cheerful", "sad", "angry", "surprised"],
    "maxTextLength": 5000,
    "supportedFormats": ["mp3", "wav", "ulaw", "pcm"],
    "sampleRates": [8000, 16000, 22050, 24000, 44100, 48000],
    "latencyMs": 100
  }
}
```

---

### 4. Select Active Provider

**Endpoint:** `POST /api/voice/select`

**Description:** Switch the active STT or TTS provider

**Request Body:**

```json
{
  "type": "stt",
  "providerId": "faster-whisper"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "message": "STT provider switched to faster-whisper",
  "provider": {
    "id": "faster-whisper",
    "name": "Faster-Whisper",
    "active": true
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid provider ID or type
- `409 Conflict` - Provider unavailable
- `500 Internal Server Error` - Switch failed

---

### 5. Test STT Provider

**Endpoint:** `POST /api/voice/test/transcribe`

**Description:** Test a specific STT provider with audio file

**Request (multipart/form-data):**

```
providerId: faster-whisper
audio: <binary audio file>
language: en (optional)
```

**Supported Audio Formats:**
- WAV, MP3, OGG, FLAC, M4A
- Max size: 50MB
- Sample rates: 8kHz - 48kHz

**Response (200 OK):**

```json
{
  "result": {
    "success": true,
    "providerId": "faster-whisper",
    "timestamp": 1705423456000,
    "duration": 150,
    "latency": 1234,
    "transcript": "Hello, this is a test of the speech recognition system.",
    "confidence": 0.94,
    "language": "en",
    "metadata": {
      "model": "base",
      "audioFormat": "wav",
      "audioDuration": 2.5
    }
  }
}
```

**Error Responses:**
- `400 Bad Request` - Invalid audio or missing provider
- `413 Payload Too Large` - File exceeds size limit
- `503 Service Unavailable` - Provider offline
- `500 Internal Server Error` - Processing failed

**Error Response Body:**

```json
{
  "result": {
    "success": false,
    "providerId": "faster-whisper",
    "timestamp": 1705423456000,
    "duration": 100,
    "latency": 0,
    "error": {
      "code": "MODEL_LOAD_ERROR",
      "message": "Failed to load model: Out of memory"
    }
  }
}
```

---

### 6. Test TTS Provider

**Endpoint:** `POST /api/voice/test/synthesize`

**Description:** Test a specific TTS provider with text input

**Request Body:**

```json
{
  "providerId": "elevenlabs",
  "text": "Hello, this is a test of the text to speech system.",
  "voice": "aria",
  "language": "en-US",
  "speed": 1.0,
  "emotion": "neutral"
}
```

**Request Parameters:**
- `providerId` (required): Provider ID
- `text` (required): Text to synthesize (max 5000 chars)
- `voice` (optional): Voice ID
- `language` (optional): Language code
- `speed` (optional): Speed multiplier (0.5-2.0, default 1.0)
- `emotion` (optional): Emotion type

**Response (200 OK):**

```json
{
  "result": {
    "success": true,
    "providerId": "elevenlabs",
    "timestamp": 1705423456000,
    "duration": 3500,
    "latency": 245,
    "audioUrl": "/api/voice/audio/temp-uuid-12345.mp3",
    "audioSize": 28500,
    "audioFormat": "mp3",
    "metadata": {
      "voice": "aria",
      "sampleRate": 22050,
      "bitrate": "128k"
    }
  }
}
```

**Audio URL Format:**
- Temporary URL valid for 1 hour
- Can be downloaded directly
- Returns audio/mp3 content type

---

### 7. Get Metrics & Analytics

**Endpoint:** `GET /api/voice/metrics`

**Description:** Get historical performance metrics for all providers

**Query Parameters:**
- `timeRange` (required): "24h" | "7d" | "30d"
- `providers` (optional): Comma-separated provider IDs (default: all)
- `metric` (optional): Specific metric to filter

**Response (200 OK):**

```json
{
  "metrics": [
    {
      "providerId": "faster-whisper",
      "timestamp": 1705423456000,
      "latency": 823,
      "errorRate": 0.15,
      "successRate": 99.85,
      "requestCount": 1024,
      "avgResponseTime": 823,
      "p50Latency": 780,
      "p95Latency": 1200,
      "p99Latency": 1450
    },
    {
      "providerId": "elevenlabs",
      "timestamp": 1705423456000,
      "latency": 145,
      "errorRate": 0.0,
      "successRate": 100.0,
      "requestCount": 856,
      "avgResponseTime": 145,
      "p50Latency": 120,
      "p95Latency": 200,
      "p99Latency": 250
    }
  ],
  "summary": {
    "totalRequests": 45234,
    "successRate": 99.8,
    "avgLatency": 234,
    "totalErrors": 85,
    "topProviderBySpeed": {
      "providerId": "cartesiaaai",
      "latency": 89
    },
    "topProviderByAccuracy": {
      "providerId": "deepgram",
      "errorRate": 0.01
    },
    "peakLoadTime": {
      "time": "14:32",
      "requestsPerMin": 3421
    }
  },
  "timeRange": "24h"
}
```

---

### 8. Get Health History

**Endpoint:** `GET /api/voice/health-history`

**Description:** Get historical health check records for a provider

**Query Parameters:**
- `providerId` (required): Provider ID
- `hours` (optional): Time window in hours (default: 24)

**Response (200 OK):**

```json
{
  "providerId": "faster-whisper",
  "history": [
    {
      "timestamp": 1705423456000,
      "health": "healthy",
      "latency": 823,
      "errorRate": 0.15
    },
    {
      "timestamp": 1705419856000,
      "health": "degraded",
      "latency": 1500,
      "errorRate": 2.3
    },
    {
      "timestamp": 1705416256000,
      "health": "healthy",
      "latency": 789,
      "errorRate": 0.1
    }
  ]
}
```

---

### 9. Get Fallback Chain

**Endpoint:** `GET /api/voice/fallback-chain`

**Description:** Get current fallback chain configuration

**Query Parameters:**
- `type` (optional): "stt" | "tts" (default: both)

**Response (200 OK):**

```json
{
  "chains": [
    {
      "type": "stt",
      "providers": ["faster-whisper", "whisper", "deepgram"],
      "createdAt": 1704892800000,
      "modifiedAt": 1705423456000
    },
    {
      "type": "tts",
      "providers": ["elevenlabs", "cartesiaaai", "kokoro"],
      "createdAt": 1704892800000,
      "modifiedAt": 1705423456000
    }
  ]
}
```

---

### 10. Update Fallback Chain

**Endpoint:** `POST /api/voice/fallback-chain`

**Description:** Update the fallback provider chain

**Request Body:**

```json
{
  "type": "stt",
  "chain": ["faster-whisper", "whisper", "deepgram"]
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "chain": {
    "type": "stt",
    "providers": ["faster-whisper", "whisper", "deepgram"],
    "modifiedAt": 1705423456000
  }
}
```

---

### 11. Get Dashboard Settings

**Endpoint:** `GET /api/voice/settings`

**Description:** Get current dashboard settings

**Response (200 OK):**

```json
{
  "settings": {
    "healthCheckInterval": 10000,
    "maxConcurrentSessions": 8,
    "defaultFallbackBehavior": "intelligent",
    "loggingLevel": "info",
    "enableNotifications": true,
    "autoRefreshEnabled": true,
    "autoRefreshInterval": 10000,
    "theme": "dark",
    "metricsRetention": "24h",
    "timeZone": "America/New_York"
  }
}
```

---

### 12. Update Dashboard Settings

**Endpoint:** `POST /api/voice/settings`

**Description:** Update dashboard settings

**Request Body:**

```json
{
  "settings": {
    "autoRefreshInterval": 15000,
    "theme": "light",
    "enableNotifications": false
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "settings": {
    "healthCheckInterval": 10000,
    "maxConcurrentSessions": 8,
    "autoRefreshInterval": 15000,
    "theme": "light",
    "enableNotifications": false
  }
}
```

---

### 13. Health Check (Heartbeat)

**Endpoint:** `GET /api/voice/health`

**Description:** Quick health check of the voice service

**Response (200 OK):**

```json
{
  "status": "healthy",
  "uptime": 864000,
  "providersHealthy": 7,
  "providersTotal": 7,
  "wsConnections": 23,
  "version": "1.0.0"
}
```

**Response (503 Service Unavailable):**

```json
{
  "status": "degraded",
  "providersHealthy": 4,
  "providersTotal": 7,
  "message": "Some providers offline"
}
```

---

## WebSocket Real-time Updates

### Connection

```
wss://localhost:3000/ws/voice/updates?token=<session-token>
```

### Message Format

All WebSocket messages follow this format:

```json
{
  "type": "provider-status|metrics|test-result|error|config-update",
  "timestamp": 1705423456000,
  "data": {}
}
```

### Message Types

#### 1. Provider Status Update

```json
{
  "type": "provider-status",
  "timestamp": 1705423456000,
  "data": {
    "providerId": "faster-whisper",
    "status": {
      "id": "faster-whisper",
      "health": "healthy",
      "available": true,
      "healthy": true,
      "lastChecked": 1705423456000,
      "latency": 823,
      "errorRate": 0.15,
      "successRate": 99.85,
      "requestsProcessed": 12450,
      "requestsFailed": 18,
      "warnings": []
    }
  }
}
```

**Frequency:** Every 10 seconds (or when status changes)

#### 2. Metrics Update

```json
{
  "type": "metrics",
  "timestamp": 1705423456000,
  "data": {
    "metrics": [
      {
        "providerId": "faster-whisper",
        "timestamp": 1705423456000,
        "latency": 823,
        "errorRate": 0.15,
        "successRate": 99.85,
        "requestCount": 1024,
        "avgResponseTime": 823,
        "p50Latency": 780,
        "p95Latency": 1200,
        "p99Latency": 1450
      }
    ],
    "summary": {
      "totalRequests": 45234,
      "successRate": 99.8,
      "avgLatency": 234
    }
  }
}
```

**Frequency:** Every 60 seconds

#### 3. Error Message

```json
{
  "type": "error",
  "timestamp": 1705423456000,
  "data": {
    "providerId": "faster-whisper",
    "code": "GPU_MEMORY_ERROR",
    "message": "GPU out of memory, falling back to CPU",
    "severity": "warning"
  }
}
```

**Frequency:** Real-time (when errors occur)

#### 4. Configuration Update

```json
{
  "type": "config-update",
  "timestamp": 1705423456000,
  "data": {
    "activeSTTProvider": "faster-whisper",
    "activeTTSProvider": "elevenlabs",
    "sttFallbackChain": {
      "type": "stt",
      "providers": ["faster-whisper", "whisper", "deepgram"]
    },
    "ttsFallbackChain": {
      "type": "tts",
      "providers": ["elevenlabs", "cartesiaaai"]
    }
  }
}
```

**Frequency:** When configuration changes

---

## Error Codes

### Client Errors (4xx)

| Code | Status | Description |
|------|--------|-------------|
| 400 | Bad Request | Invalid parameters or request format |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Provider or resource not found |
| 409 | Conflict | Provider state conflict (e.g., unavailable) |
| 413 | Payload Too Large | Request/file size exceeds limit |
| 429 | Too Many Requests | Rate limit exceeded |

### Server Errors (5xx)

| Code | Status | Description |
|------|--------|-------------|
| 500 | Internal Server Error | Unexpected server error |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Service temporarily unavailable |
| 504 | Gateway Timeout | Request timeout |

### Error Response Format

```json
{
  "error": {
    "code": "PROVIDER_UNAVAILABLE",
    "message": "Provider 'faster-whisper' is currently unavailable",
    "details": {
      "providerId": "faster-whisper",
      "reason": "GPU initialization failed"
    },
    "timestamp": 1705423456000,
    "requestId": "req-12345-uuid"
  }
}
```

---

## Rate Limiting

**Limits per authenticated user:**
- HTTP requests: 1000 per minute
- WebSocket connections: 5 concurrent
- File uploads: 10 per minute (50MB each)
- Test requests: 100 per minute

**Headers:**
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1705423500
```

---

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `limit`: Items per page (default: 50, max: 200)
- `offset`: Number of items to skip (default: 0)

**Response:**
```json
{
  "items": [...],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 127,
    "hasMore": true
  }
}
```

---

## API Client Library

### TypeScript Client

```typescript
import { VoiceAPIClient } from "@clawdbot/voice-api";

const client = new VoiceAPIClient({
  baseUrl: "http://localhost:3000",
  token: "your-session-token",
});

// Get status
const status = await client.getStatus();

// Get providers
const providers = await client.getProviders();

// Select provider
await client.selectProvider("stt", "faster-whisper");

// Test STT
const result = await client.testSTT("faster-whisper", audioFile);

// Subscribe to real-time updates
client.onStatusUpdate((update) => {
  console.log("Status updated:", update);
});

client.connect();
```

---

## Rate Limiting & Throttling

### Client-side recommendations:

```typescript
// Debounce settings updates (1 second)
const debouncedSettingsUpdate = debounce(
  (settings) => client.updateSettings(settings),
  1000
);

// Throttle status polling (10 seconds)
const throttledStatusFetch = throttle(
  () => client.getStatus(),
  10000
);
```

---

## Backwards Compatibility

All API endpoints maintain backwards compatibility. Breaking changes increment the API version:
- v1: Current version
- v2 (future): Will be available at `/api/v2/voice/`

Old endpoints continue to work with deprecation warnings.

---

## Testing the API

### cURL Examples

```bash
# Get status
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/voice/status

# Test STT
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "providerId=faster-whisper" \
  -F "audio=@audio.wav" \
  http://localhost:3000/api/voice/test/transcribe

# Test TTS
curl -X POST \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providerId": "elevenlabs",
    "text": "Hello world"
  }' \
  http://localhost:3000/api/voice/test/synthesize
```

### Postman Collection

Import the OpenAPI spec:
- Available at `/api/voice/openapi.json`
- Compatible with Postman, Insomnia, and other tools

---

## Version History

### v1.0.0 (2024-01-15)

- Initial release
- 13 HTTP endpoints
- WebSocket real-time updates
- Support for 7 voice providers
- Full metrics and analytics
- Dashboard settings management
