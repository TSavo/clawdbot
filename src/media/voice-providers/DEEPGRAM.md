# Deepgram STT Provider

Deepgram integration for real-time speech-to-text with conversational turn detection, perfect for voice agents requiring immediate response feedback.

## Features

- **Flux STT Model**: Conversational STT with built-in turn detection
- **<300ms Latency**: Real-time responses ideal for voice interactions
- **36+ Languages**: Support for 36+ languages and dialects
- **Turn Detection**: Automatically detects when speaker finishes (no post-processing)
- **Interruption Handling**: Handles overlapping speech and interruptions
- **Speaker Identification**: Optional diarization for multi-speaker scenarios
- **Smart Formatting**: Automatic number/currency/punctuation formatting
- **WebSocket Streaming**: Real-time streaming for live transcription
- **Cloud-Based**: No local model deployment required

## Installation

Deepgram is cloud-only and requires an API key from https://console.deepgram.com

```bash
# Set environment variable
export DEEPGRAM_API_KEY=sk-your-api-key-here
```

## Configuration

Add to your Clawdbot configuration:

```yaml
voiceProviders:
  enabled: true
  providers:
    - id: deepgram-stt
      stt:
        type: deepgram
        model: flux
        language: en-US
        enableTurnDetection: true
        detectLanguage: false
        smartFormat: true
        diarize: false
      priority: 1
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `flux` | Model to use: `flux` (recommended) or `nova-v3` |
| `language` | string | `en-US` | Primary language for transcription |
| `enableTurnDetection` | boolean | `true` | Enable automatic turn detection |
| `detectLanguage` | boolean | `false` | Auto-detect language (overrides language setting) |
| `smartFormat` | boolean | `true` | Format numbers, currencies, dates automatically |
| `diarize` | boolean | `false` | Enable speaker identification |
| `numSpeakers` | number | undefined | Expected number of speakers (if diarize=true) |
| `apiUrl` | string | `https://api.deepgram.com/v1` | Custom API endpoint |

## Usage

### Basic Transcription

```typescript
import { DeepgramExecutor } from '@/media/voice-providers/deepgram.js';

const executor = new DeepgramExecutor('deepgram-stt', {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
  language: 'en-US',
});

await executor.initialize();

const result = await executor.transcribe(audioBuffer);
console.log(`Transcribed: ${result.text}`);
console.log(`Confidence: ${result.confidence}`);
```

### Streaming Transcription with Turn Detection

```typescript
// Real-time streaming with automatic turn detection
const stream = audioStream.readable; // ReadableStream<AudioBuffer>

for await (const chunk of executor.transcribeStream(stream)) {
  console.log(`Partial: ${chunk.text}`);

  if (!chunk.partial) {
    console.log(`Final: ${chunk.text}`);
  }
}
```

### Service Management

```typescript
import { getDeepgramService } from '@/media/voice-providers/deepgram.service.js';

const service = getDeepgramService();

// Initialize
await service.initialize({
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',
});

// Get executor
const executor = service.getExecutor();

// Check health
const health = await service.checkHealth();
console.log(`Healthy: ${health.healthy}`);
console.log(`Latency: ${health.latencyMs}ms`);

// Get metrics
const metrics = service.getMetrics();
console.log(`Average latency: ${metrics.averageLatencyMs}ms`);
console.log(`P95 latency: ${metrics.p95LatencyMs}ms`);
console.log(`Error rate: ${(metrics.errorRate * 100).toFixed(2)}%`);

// Cleanup
await service.shutdown();
```

## Supported Languages

Deepgram supports 36+ languages including:

**English**: en-US, en-GB, en-AU, en-IN

**Spanish**: es-ES, es-MX

**French**: fr-FR

**German**: de-DE

**Italian**: it-IT

**Japanese**: ja-JP

**Chinese**: zh-CN, zh-TW

**Korean**: ko-KR

**Russian**: ru-RU

**Portuguese**: pt-BR, pt-PT

**Dutch**: nl-NL

**Turkish**: tr-TR

**Arabic**: ar-SA

**Hindi**: hi-IN

And 20+ more. See [Deepgram Language Codes](https://developers.deepgram.com/docs/language) for complete list.

## Audio Format Support

| Format | Encoding | Sample Rate | Notes |
|--------|----------|-------------|-------|
| PCM 16-bit | WAV/RIFF | 8000, 16000, 48000 Hz | Recommended |
| Opus | OggOpus | Variable | Low bandwidth |
| AAC | M4A | Variable | Mobile-friendly |
| MP3 | MPEG Layer III | Variable | Common format |
| Vorbis | OggVorbis | Variable | High quality |

## Turn Detection

Deepgram's native turn detection is the key differentiator for voice agents:

```typescript
// Turn detection happens automatically during streaming
for await (const chunk of executor.transcribeStream(stream)) {
  // Deepgram provides:
  // - Automatic speaker completion detection
  // - No artificial silence padding required
  // - Natural conversation flow
  // - Low latency (typically <200ms)

  if (chunk.partial) {
    // Interim result - user still speaking
    updateUI(chunk.text, 'interim');
  } else {
    // Final result - turn ended, ready for response
    generateAndStream(chunk.text);
  }
}
```

### Configuration for Conversational AI

For optimal conversation flow:

1. Set `enableTurnDetection: true` (default)
2. Use `model: 'flux'` for lowest latency
3. Set `language` based on user preference
4. Enable `smartFormat` for natural text output

## Diarization (Speaker Identification)

Enable speaker identification for multi-speaker scenarios:

```typescript
const executor = new DeepgramExecutor('deepgram-stt', {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  diarize: true,
  numSpeakers: 2, // Expected speaker count
});
```

Response will include speaker IDs for each transcript segment.

## Error Handling

Common errors and recovery strategies:

```typescript
import { VoiceProviderError } from '@/media/voice-providers/executor.js';

try {
  const result = await executor.transcribe(audioBuffer);
} catch (error) {
  if (error instanceof VoiceProviderError) {
    switch (error.code) {
      case 'MISSING_API_KEY':
        console.error('Deepgram API key not configured');
        break;
      case 'HTTP_401':
        console.error('Invalid API key');
        break;
      case 'HTTP_429':
        console.error('Rate limit exceeded - implement backoff');
        break;
      case 'EMPTY_AUDIO':
        console.error('No audio data provided');
        break;
      case 'STREAM_TRANSCRIPTION_FAILED':
        console.error('Streaming connection failed');
        break;
      default:
        console.error(`Transcription failed: ${error.message}`);
    }
  }
}
```

## Performance Characteristics

### Latency

- **Real-time streaming**: <300ms end-to-end latency
- **Batch processing**: <1s for typical audio clips
- **Turn detection**: ~100-200ms additional latency

### Throughput

- **Concurrent requests**: 100+ simultaneous streams
- **API rate limits**: Varies by subscription tier
- **Streaming connections**: WebSocket-based (stateful)

### Accuracy

- **Typical WER**: 5-10% on clean speech
- **Noisy environments**: 15-25% WER
- **Accented speech**: Generally robust

## Metrics & Monitoring

The Deepgram service automatically collects metrics:

```typescript
const metrics = service.getMetrics();

console.log(`Total requests: ${metrics.totalRequests}`);
console.log(`Success rate: ${((1 - metrics.errorRate) * 100).toFixed(2)}%`);
console.log(`Average latency: ${metrics.averageLatencyMs.toFixed(0)}ms`);
console.log(`P95 latency: ${metrics.p95LatencyMs.toFixed(0)}ms`);
console.log(`P99 latency: ${metrics.p99LatencyMs.toFixed(0)}ms`);
console.log(`Turn detection accuracy: ${(metrics.turnDetectionAccuracy * 100).toFixed(2)}%`);
```

## Testing

Run tests with:

```bash
# All tests
pnpm test src/media/voice-providers/deepgram.test.ts

# Coverage
pnpm test:coverage src/media/voice-providers/deepgram.test.ts

# Live tests (requires API key)
DEEPGRAM_API_KEY=sk-... LIVE=1 pnpm test:live
```

## Limitations

- **STT Only**: Deepgram specializes in speech-to-text. Use a TTS provider for text-to-speech.
- **Cloud Dependent**: Requires internet connection and Deepgram API availability
- **Billing**: API calls are metered and billed by Deepgram
- **Latency**: Slightly higher than local models due to network round-trip

## Best Practices

### For Voice Agents

```typescript
// Optimal configuration for conversational agents
const config: DeepgramConfig = {
  apiKey: process.env.DEEPGRAM_API_KEY || '',
  model: 'flux',              // Lowest latency
  language: 'en-US',
  enableTurnDetection: true,  // Crucial for natural conversation
  smartFormat: true,          // Clean output
  diarize: false,             // Single speaker usually
};
```

### For Cost Optimization

```typescript
// Monitor and adjust based on usage
const metrics = service.getMetrics();

if (metrics.errorRate > 0.05) {
  // High error rate - check API key and network
}

if (metrics.p95LatencyMs > 500) {
  // High latency - consider fallback or user notice
}

if (metrics.totalRequests > monthlyBudget) {
  // Approaching budget limit - implement rate limiting
}
```

### For Reliability

```typescript
// Use fallback chain in orchestrator
sttFallbackChain: [
  'deepgram-stt',        // Primary - Flux
  'faster-whisper-stt',  // Fallback - Local
];
```

## Troubleshooting

### "Invalid credentials" Error

```
Error: HTTP 401: Invalid credentials
```

Solution:
- Verify API key is correct: `echo $DEEPGRAM_API_KEY`
- Check key hasn't been revoked in Deepgram console
- Regenerate key if necessary

### High Latency

```
P95 latency: 2000ms (Expected: <300ms)
```

Solutions:
- Check network connectivity
- Verify Deepgram API status
- Consider fallback to local provider
- Check regional API endpoint availability

### Rate Limiting

```
Error: HTTP 429: Rate limit exceeded
```

Solutions:
- Implement exponential backoff
- Reduce concurrent requests
- Check Deepgram plan limits
- Consider upgrading plan

### No Turn Detection

Turn detection not activating properly:

- Ensure `enableTurnDetection: true`
- Check audio quality (clear speech needed)
- Verify language setting matches speaker
- Test with known-good audio sample

## Integration with Voice Orchestrator

Deepgram is automatically available when registered:

```typescript
// In voice-providers/registry.ts
if (sttConfig.type === 'deepgram') {
  const { DeepgramExecutor } = await import('./deepgram.js');
  return new DeepgramExecutor(entry.id, sttConfig);
}
```

Configuration in orchestrator:

```yaml
orchestrator:
  deploymentMode: cloud
  providers:
    - id: deepgram-stt
      name: Deepgram Flux
      type: stt
      deployment: cloud
      priority: 1
      enabled: true
  sttFallbackChain:
    - deepgram-stt
    - faster-whisper-system
```

## Additional Resources

- **Deepgram API Docs**: https://developers.deepgram.com/reference
- **Pricing**: https://deepgram.com/pricing
- **Console**: https://console.deepgram.com
- **Status Page**: https://status.deepgram.com
- **Support**: https://deepgram.com/contact-us

## License

Clawdbot Deepgram provider is MIT licensed. Deepgram API usage is governed by Deepgram's Terms of Service.
