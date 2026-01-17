# Deepgram STT Provider - Quick Start Guide

Get Deepgram speech-to-text running in 5 minutes.

## 1. Get API Key

1. Sign up at https://console.deepgram.com
2. Navigate to "API Keys" section
3. Click "Create a Key"
4. Copy the API key (starts with `sk-`)

## 2. Configure Environment

```bash
# Set your API key
export DEEPGRAM_API_KEY=sk-your-key-here

# Or add to .env
echo "DEEPGRAM_API_KEY=sk-your-key-here" >> .env
```

## 3. Add to Clawdbot Config

In your `clawdbot.config.yaml`:

```yaml
voiceProviders:
  enabled: true
  providers:
    - id: deepgram-stt
      enabled: true
      stt:
        type: deepgram
        model: flux
        language: en-US
        enableTurnDetection: true
        smartFormat: true
      priority: 1
```

## 4. Initialize Service

```typescript
import { getDeepgramService } from '@/media/voice-providers/deepgram.service.js';

const service = getDeepgramService();

await service.initialize({
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
  enableTurnDetection: true,
});

const executor = service.getExecutor();
```

## 5. Use for Transcription

### Batch Mode (Upload Audio)

```typescript
import { AudioFormat } from '@/media/voice-providers/executor.js';

const audioBuffer = {
  data: audioData,           // Uint8Array
  format: AudioFormat.PCM_16,
  sampleRate: 16000,
  duration: 5000,            // milliseconds
  channels: 1,
};

const result = await executor.transcribe(audioBuffer);

console.log(result.text);       // Transcribed text
console.log(result.confidence); // 0.0 - 1.0
console.log(result.language);   // Language code
```

### Real-Time Streaming

```typescript
// Stream audio chunks for live transcription
const audioStream = /* ReadableStream<AudioBuffer> */;

for await (const chunk of executor.transcribeStream(audioStream)) {
  if (chunk.partial) {
    console.log(`Interim: ${chunk.text}`);    // User still speaking
  } else {
    console.log(`Final: ${chunk.text}`);      // Turn ended
    // Now generate response...
  }
}
```

## 6. Monitor Health & Metrics

```typescript
// Check service health
const health = await service.checkHealth();
console.log(`Healthy: ${health.healthy}`);
console.log(`Latency: ${health.latencyMs}ms`);

// Get performance metrics
const metrics = service.getMetrics();
console.log(`Avg latency: ${metrics.averageLatencyMs}ms`);
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
console.log(`Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
```

## 7. Test

```bash
# Run tests
pnpm test src/media/voice-providers/deepgram.test.ts

# Live test with real API
DEEPGRAM_API_KEY=sk-... LIVE=1 pnpm test:live
```

## Key Features Enabled by Default

✅ **Turn Detection** - Knows when user finishes speaking
✅ **Smart Format** - Formats numbers, dates, currencies automatically
✅ **Punctuation** - Adds proper punctuation
✅ **Flux Model** - Lowest latency (<300ms)

## Common Configuration Patterns

### Voice Agent (Conversational)

```typescript
{
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
  language: 'en-US',
  enableTurnDetection: true,  // Critical for natural conversation
  smartFormat: true,
  diarize: false,
}
```

### Multi-Language Support

```typescript
{
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
  detectLanguage: true,       // Auto-detect
  smartFormat: true,
}
```

### Multi-Speaker Scenarios

```typescript
{
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
  enableTurnDetection: true,
  diarize: true,              // Speaker identification
  numSpeakers: 2,
}
```

## Error Handling

```typescript
import { VoiceProviderError } from '@/media/voice-providers/executor.js';

try {
  const result = await executor.transcribe(audioBuffer);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    switch (error.code) {
      case 'MISSING_API_KEY':
        console.error('API key not configured');
        break;
      case 'HTTP_401':
        console.error('Invalid API key');
        break;
      case 'HTTP_429':
        console.error('Rate limit - implement backoff');
        break;
      default:
        console.error(`Error: ${error.message}`);
    }
  }
}
```

## Debugging

Check that everything is working:

```bash
# Verify API key is set
echo $DEEPGRAM_API_KEY

# Test API connectivity
curl -X GET https://api.deepgram.com/v1/status \
  -H "Authorization: Token $DEEPGRAM_API_KEY"

# Should return 200 OK
```

## Monitoring for Production

```typescript
// Track metrics regularly
setInterval(() => {
  const metrics = service.getMetrics();

  if (metrics.errorRate > 0.05) {
    console.warn(`High error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);
  }

  if (metrics.p95LatencyMs > 500) {
    console.warn(`High latency: ${metrics.p95LatencyMs}ms`);
  }

  // Log for monitoring
  console.log(`[deepgram] latency=${metrics.averageLatencyMs.toFixed(0)}ms error_rate=${(metrics.errorRate * 100).toFixed(2)}% requests=${metrics.totalRequests}`);
}, 60000); // Every minute
```

## Troubleshooting

### "Invalid credentials"
- Verify API key: `echo $DEEPGRAM_API_KEY`
- Regenerate key in Deepgram console
- Check no typos or spaces

### High latency (>500ms)
- Check network connection
- Verify Deepgram API status
- Consider using fallback provider

### Streaming not detecting turns
- Ensure audio is clear speech
- Verify language setting matches speaker
- Check turn detection is enabled
- Audio needs minimum volume level

### Rate limiting (429 errors)
- Implement exponential backoff
- Reduce concurrent requests
- Check plan limits on Deepgram console

## Next Steps

- Read full documentation: [DEEPGRAM.md](./DEEPGRAM.md)
- Explore voice orchestrator: [ORCHESTRATOR-QUICK-REFERENCE.md](./ORCHESTRATOR-QUICK-REFERENCE.md)
- Check integration guide: [ORCHESTRATOR-INTEGRATION.md](./ORCHESTRATOR-INTEGRATION.md)
- See example voice agent: `src/commands/voice/`

## Support

- **Deepgram Docs**: https://developers.deepgram.com/
- **API Reference**: https://developers.deepgram.com/reference
- **Console**: https://console.deepgram.com
- **Status**: https://status.deepgram.com
