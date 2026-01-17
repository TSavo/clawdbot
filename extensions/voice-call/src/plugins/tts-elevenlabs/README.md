# ElevenLabs TTS Provider

Cloud-based text-to-speech synthesis via [ElevenLabs API](https://elevenlabs.io/).

## Features

- **100+ Realistic Voices** - Wide selection of natural-sounding voices across multiple languages and accents
- **Real-time Streaming** - Stream audio synthesis for responsive applications
- **Voice Cloning** - Create custom cloned voices from voice samples
- **Stability Control** - Fine-tune voice consistency (0-1 scale)
- **Similarity Boost** - Control how closely synthesis matches the original voice
- **Multiple Audio Formats** - MP3 (44.1kHz, 22.05kHz), µ-law, and more
- **Rate Limiting** - Built-in request throttling to stay within API quotas
- **Connection Pooling** - Efficient HTTP client with retry logic
- **Cost Tracking** - Monitor character usage against subscription limits

## Installation

The ElevenLabs TTS provider is included with the voice-call extension. Ensure you have Node.js 22+ installed.

```bash
pnpm install
```

## Configuration

### API Key Setup

1. Sign up for a free account at [ElevenLabs](https://elevenlabs.io/)
2. Navigate to your API settings
3. Copy your API key
4. Set the `ELEVENLABS_API_KEY` environment variable or pass it directly to the provider

### Basic Usage

```typescript
import { ElevenLabsTTSProvider } from "./providers/tts-elevenlabs.js";

const provider = new ElevenLabsTTSProvider({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

// Synthesize text to speech
const audio = await provider.synthesize("Hello, world!");
```

### Advanced Configuration

```typescript
const provider = new ElevenLabsTTSProvider({
  apiKey: process.env.ELEVENLABS_API_KEY!,
  voiceId: "rachel",              // Default voice (default: bella)
  modelId: "eleven_monolingual_v1", // Model to use
  stability: 0.5,                 // Voice stability (0-1, default: 0.5)
  similarityBoost: 0.75,          // Similarity boost (0-1, default: 0.75)
  outputFormat: "mp3_22050_32",   // Output audio format
  rateLimit: true,                // Enable rate limiting
  requestsPerMinute: 100,         // Max requests per minute
  cacheVoices: true,              // Cache voice list
});
```

## Usage

### Basic Synthesis

```typescript
const audio = await provider.synthesize("Hello, world!");
// Returns: Buffer containing MP3 audio data
```

### With Options

```typescript
const audio = await provider.synthesize("Hello, world!", {
  voice: "caleb",                 // Use specific voice
  speed: 1.0,                     // Speed multiplier (not directly supported by ElevenLabs)
  instructions: "friendly tone",  // Optional instructions
});
```

### Batch Synthesis

```typescript
import { ElevenLabsBatchSynthesizer } from "./providers/tts-elevenlabs.js";

const synthesizer = new ElevenLabsBatchSynthesizer(provider);

// Synthesize multiple texts
const texts = ["Hello", "World", "Test"];
const audioBuffers = await synthesizer.synthesizeBatch(texts, undefined, (index, total) => {
  console.log(`Progress: ${index}/${total}`);
});
```

### Concatenate Multiple Phrases

```typescript
// Synthesize and concatenate with silence between phrases
const concatenated = await synthesizer.synthesizeAndConcatenate(
  ["Good morning", "Welcome to ElevenLabs", "Goodbye"],
  undefined,
  500, // Silence duration in ms
);
```

### List Available Voices

```typescript
const voices = await provider.getAvailableVoices();
console.log(voices);
// Output: [{ voice_id, name, category, ... }, ...]
```

### Get Voice Information

```typescript
const voice = await provider.getVoiceInfo("rachel");
console.log(voice.name, voice.category);
```

### Track Character Usage

```typescript
const userInfo = await provider.getUserInfo();
console.log(`Characters remaining: ${userInfo.subscription.character_count}`);
```

## Voice Selection

### Using Built-in Voice Helpers

```typescript
import {
  getCommonVoices,
  findVoiceByName,
  getVoicesByGender,
  getVoicesByAccent,
} from "./providers/tts-elevenlabs.js";

// Get list of common voices
const voices = getCommonVoices();

// Find voice by name (case-insensitive)
const rachel = findVoiceByName("rachel");

// Get female voices
const femaleVoices = getVoicesByGender("female");

// Get American accent voices
const americanVoices = getVoicesByAccent("American");
```

### Common Voices

| ID | Name | Gender | Accent | Description |
|---|---|---|---|---|
| bella | Bella | Female | American | Warm and friendly |
| rachel | Rachel | Female | American | Clear and professional |
| caleb | Caleb | Male | American | Friendly and approachable |
| charlotte | Charlotte | Female | American | Charming and expressive |
| james | James | Male | American | Deep and resonant |
| sophia | Sophia | Female | American | Sophisticated and elegant |
| isabella | Isabella | Female | Italian | Romantic and expressive |

## Configuration Parameters

### Provider Config

| Parameter | Type | Default | Description |
|---|---|---|---|
| `apiKey` | string | - | **Required.** ElevenLabs API key |
| `voiceId` | string | "bella" | Default voice identifier |
| `modelId` | string | "eleven_monolingual_v1" | TTS model to use |
| `stability` | number | 0.5 | Voice stability (0-1) |
| `similarityBoost` | number | 0.75 | Similarity to voice (0-1) |
| `outputFormat` | string | "mp3_22050_32" | Audio output format |
| `rateLimit` | boolean | true | Enable rate limiting |
| `requestsPerMinute` | number | 100 | Max requests per minute |
| `cacheVoices` | boolean | true | Cache voice list |

### Synthesis Options

| Parameter | Type | Description |
|---|---|---|
| `voice` | string | Voice ID or name to use |
| `speed` | number | Speed multiplier (note: ElevenLabs uses stability instead) |
| `instructions` | string | Optional tone/style instructions |

### Output Formats

- `mp3_44100_64` - MP3 at 44.1kHz, 64 kbps
- `mp3_44100_128` - MP3 at 44.1kHz, 128 kbps
- `mp3_22050_32` - MP3 at 22.05kHz, 32 kbps (default)
- `ulaw_8000_bit` - µ-law at 8kHz (Twilio compatible)

## Plugin Service

The ElevenLabs TTS is registered as a cloud-only plugin service:

```typescript
import { ElevenLabsTTSPlugin } from "./plugins/tts-elevenlabs/service.js";

const plugin = new ElevenLabsTTSPlugin();

// Initialize service
const service = await plugin.init({
  apiKey: process.env.ELEVENLABS_API_KEY!,
});

// Check readiness
if (service.isReady()) {
  const provider = service.getProvider();
  const audio = await provider?.synthesize("Hello");
}

// Health check
const healthy = await service.healthCheck();

// Get status
const status = service.getStatus();

// Cleanup
await plugin.destroy();
```

## Utility Functions

### Estimate Character Count

```typescript
import { estimateCharacterCount } from "./providers/tts-elevenlabs.js";

const text = "Hello, how are you today?";
const charCount = estimateCharacterCount(text);
// Includes 10% overhead for API processing
```

### Chunk Text by Sentences

```typescript
import { chunkTextBySentences } from "./providers/tts-elevenlabs.js";

const longText = "First sentence. Second sentence. Third sentence.";
const chunks = chunkTextBySentences(longText, 100); // Max 100 chars per chunk
// Output: ["First sentence.", "Second sentence.", "Third sentence."]
```

## Error Handling

```typescript
try {
  const audio = await provider.synthesize("Hello");
} catch (error) {
  if (error.message.includes("API key")) {
    console.error("Invalid API key");
  } else if (error.message.includes("rate limit")) {
    console.error("Rate limit exceeded - wait before retrying");
  } else if (error.message.includes("not found")) {
    console.error("Voice not found");
  } else {
    console.error("Synthesis error:", error);
  }
}
```

## Rate Limiting

The provider includes built-in rate limiting to prevent exceeding ElevenLabs API quotas:

- **Default limit**: 100 requests per minute
- **Enforcement**: Automatic wait times between requests
- **Disable**: Set `rateLimit: false` in config

```typescript
const provider = new ElevenLabsTTSProvider({
  apiKey: "...",
  rateLimit: true,
  requestsPerMinute: 100, // Requests per minute quota
});
```

## Voice Caching

Voice lists are cached for 1 hour to reduce API calls:

- **Enabled by default**: `cacheVoices: true`
- **Cache duration**: 1 hour
- **Auto-refresh**: After 1 hour or when cache is disabled

## Testing

Run the test suite:

```bash
pnpm test src/providers/tts-elevenlabs.test.ts
pnpm test src/plugins/tts-elevenlabs/service.test.ts
```

Tests include:
- Provider initialization and validation
- Synthesis with various options
- Batch operations
- Error handling
- Voice filtering and selection
- Rate limiting and health checks

## Troubleshooting

### "Invalid ElevenLabs API key"

1. Verify your API key in the [ElevenLabs dashboard](https://elevenlabs.io/account/api-keys)
2. Check that the environment variable is set: `echo $ELEVENLABS_API_KEY`
3. Ensure no whitespace in the API key

### "Rate limit exceeded"

The provider automatically handles rate limiting, but if you see this error:
1. Reduce `requestsPerMinute` in config
2. Increase delays between synthesis calls
3. Use batch synthesis for efficiency

### "Voice not found"

1. Call `provider.getAvailableVoices()` to list available voices
2. Use voice IDs (e.g., "bella") instead of names when possible
3. Check that voice exists in your subscription tier

### "Character limit exceeded"

1. Check remaining balance: `await provider.getUserInfo()`
2. Upgrade your subscription at [ElevenLabs billing](https://elevenlabs.io/subscription)
3. Use shorter texts or implement quota tracking

## Performance Tips

1. **Batch Processing**: Synthesize multiple texts in a single operation
2. **Caching**: Enable voice list caching (default)
3. **Format Selection**: Use `mp3_22050_32` for lower bandwidth
4. **Rate Limiting**: Let the built-in rate limiter handle quota management

## API Reference

### ElevenLabsTTSProvider

```typescript
class ElevenLabsTTSProvider implements TTSProvider {
  constructor(config: ElevenLabsTTSConfig)
  synthesize(text: string, options?: TTSSynthesisOptions): Promise<Buffer>
  getAvailableVoices(): Promise<ElevenLabsVoiceMetadata[]>
  getVoiceInfo(voiceId: string): Promise<ElevenLabsVoiceMetadata>
  getUserInfo(): Promise<{ subscription: { character_count: number }; subscription_tier?: string }>
  validateConfig(): void
}
```

### ElevenLabsBatchSynthesizer

```typescript
class ElevenLabsBatchSynthesizer {
  constructor(provider: ElevenLabsTTSProvider)
  synthesizeBatch(texts: string[], options?: TTSSynthesisOptions, onProgress?: (index: number, total: number) => void): Promise<Buffer[]>
  synthesizeAndConcatenate(texts: string[], options?: TTSSynthesisOptions, silenceMs?: number): Promise<Buffer>
}
```

### ElevenLabsTTSService

```typescript
class ElevenLabsTTSService {
  initialize(config: ElevenLabsTTSConfig): Promise<boolean>
  getProvider(): TTSProvider | null
  isReady(): boolean
  healthCheck(): Promise<boolean>
  getStatus(): { initialized: boolean; healthy: boolean; provider: string | null; metadata?: PluginMetadata }
  shutdown(): Promise<void>
}
```

## Related Documentation

- [ElevenLabs API Documentation](https://elevenlabs.io/docs)
- [Voice Provider Interface](../providers/interfaces.ts)
- [Audio Utilities](../providers/audio-utils.ts)
- [Kokoro TTS Provider](../providers/tts-kokoro.ts)
- [Piper TTS Provider](../providers/tts-piper.ts)

## License

MIT - See LICENSE file for details.

## Support

For issues with the ElevenLabs provider:
1. Check the [troubleshooting section](#troubleshooting)
2. Review [ElevenLabs documentation](https://elevenlabs.io/docs)
3. Open an issue on GitHub

For issues with the Clawdbot voice system:
1. Review the voice provider documentation
2. Check existing GitHub issues
3. Open a new issue with reproduction steps
