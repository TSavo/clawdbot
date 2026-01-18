# Local Providers Integration Guide

Step-by-step guide for integrating local STT/TTS providers into the Clawdbot voice-call extension.

## Overview

This guide shows how to integrate Whisper-local, Kokoro, and Piper providers into the existing voice-call plugin system.

## Step 1: Register Providers

Create a provider registry module:

```typescript
// src/providers/registry.ts
import type { STTProvider, TTSProvider } from './interfaces.js';
import { WhisperLocalSTTProvider } from './stt-whisper-local.js';
import { KokoroTTSProvider } from './tts-kokoro.js';
import { PiperTTSProvider } from './tts-piper.js';

export interface ProviderRegistry {
  stt: Map<string, STTProvider>;
  tts: Map<string, TTSProvider>;
}

export function createProviderRegistry(config: {
  whisper?: ConstructorParameters<typeof WhisperLocalSTTProvider>[0];
  kokoro?: ConstructorParameters<typeof KokoroTTSProvider>[0];
  piper: ConstructorParameters<typeof PiperTTSProvider>[0];
}): ProviderRegistry {
  const registry: ProviderRegistry = {
    stt: new Map(),
    tts: new Map(),
  };

  // Register Whisper STT
  if (config.whisper) {
    const whisperProvider = new WhisperLocalSTTProvider(config.whisper);
    registry.stt.set('whisper-local', whisperProvider);
  }

  // Register Kokoro TTS
  if (config.kokoro) {
    const kokoroProvider = new KokoroTTSProvider(config.kokoro);
    registry.tts.set('kokoro', kokoroProvider);
  }

  // Register Piper TTS (required)
  const piperProvider = new PiperTTSProvider(config.piper);
  registry.tts.set('piper', piperProvider);

  return registry;
}

export function getProviderRegistry(): ProviderRegistry {
  return createProviderRegistry({
    whisper: {
      modelSize: 'base',
      language: 'auto',
    },
    kokoro: {
      voice: 'af_bella',
      speed: 1.0,
    },
    piper: {
      modelPath: process.env.PIPER_MODELS || './models/piper-voices',
      language: 'en',
    },
  });
}
```

## Step 2: Update Voice-Call Manager

Integrate providers into the existing call manager:

```typescript
// src/manager.ts (existing file - modifications)
import type { STTProvider, TTSProvider } from './plugins/interfaces.js';
import { ProviderRegistry, getProviderRegistry } from './providers/registry.js';

export class VoiceCallManager {
  private sttProvider: STTProvider;
  private ttsProvider: TTSProvider;
  private providerRegistry: ProviderRegistry;

  constructor(config: VoiceCallConfig) {
    this.providerRegistry = getProviderRegistry();

    // Select STT provider (default to Whisper if available)
    this.sttProvider =
      this.providerRegistry.stt.get('whisper-local') ||
      this.providerRegistry.stt.values().next().value;

    // Select TTS provider (default to Piper)
    this.ttsProvider =
      this.providerRegistry.tts.get(config.ttsProvider || 'piper') ||
      this.providerRegistry.tts.values().next().value;
  }

  async transcribeAudio(audio: Buffer): Promise<string> {
    const session = this.sttProvider.createSession();
    await session.connect();

    try {
      session.sendAudio(audio);
      return await session.waitForTranscript(30000);
    } finally {
      session.close();
    }
  }

  async synthesizeText(text: string): Promise<Buffer> {
    return await this.ttsProvider.synthesize(text);
  }
}
```

## Step 3: Plugin Configuration

Update the voice-call plugin to accept local provider configuration:

```typescript
// extensions/voice-call/index.ts (modifications)
import type { ClawdbotPluginDefinition } from '../../src/plugins/types.js';
import { getProviderRegistry } from './src/providers/registry.js';

export default {
  id: 'voice-call',
  name: 'Voice Call',
  description: 'Voice calling with local STT/TTS support',
  configSchema: {
    uiHints: {
      provider: {
        label: 'Voice Provider',
        help: 'Select between Twilio, Telnyx, or local providers',
      },
      sttProvider: {
        label: 'Speech-to-Text Provider',
        help: 'Select STT provider (whisper-local for offline)',
      },
      ttsProvider: {
        label: 'Text-to-Speech Provider',
        help: 'Select TTS provider (piper or kokoro for offline)',
      },
    },
  },

  activate(api) {
    // Initialize registry on plugin activation
    const registry = getProviderRegistry();

    // Log available providers
    api.logger.info('Available STT providers:');
    registry.stt.forEach((provider) => {
      api.logger.info(`  - ${provider.metadata.name} v${provider.metadata.version}`);
    });

    api.logger.info('Available TTS providers:');
    registry.tts.forEach((provider) => {
      api.logger.info(`  - ${provider.metadata.name} v${provider.metadata.version}`);
    });
  },
} satisfies ClawdbotPluginDefinition;
```

## Step 4: Audio Format Handling

Create a handler for audio format conversions in the call flow:

```typescript
// src/providers/audio-format-handler.ts
import { pcmToMuLaw, muLawToPcm, resampleAudio, AUDIO_FORMATS } from './audio-utils.js';

export interface AudioFormatConfig {
  input: {
    sampleRate: number;
    encoding: 'pcm' | 'mulaw';
  };
  output: {
    sampleRate: number;
    encoding: 'pcm' | 'mulaw';
  };
}

export class AudioFormatHandler {
  constructor(private config: AudioFormatConfig) {}

  convert(audio: Buffer): Buffer {
    let result = audio;

    // Step 1: Decode input format
    if (this.config.input.encoding === 'mulaw') {
      result = muLawToPcm(result);
    }

    // Step 2: Resample if needed
    if (this.config.input.sampleRate !== this.config.output.sampleRate) {
      result = resampleAudio(
        result,
        this.config.input.sampleRate,
        this.config.output.sampleRate,
      );
    }

    // Step 3: Encode output format
    if (this.config.output.encoding === 'mulaw') {
      result = pcmToMuLaw(result);
    }

    return result;
  }
}
```

## Step 5: Call Flow Integration

Example of complete call flow using local providers:

```typescript
// Usage example: src/call-flow.ts
import { VoiceCallManager } from './manager.js';
import { AudioFormatHandler } from './providers/audio-format-handler.js';

export async function handleIncomingCall(callId: string, audioStream: Stream) {
  const manager = new VoiceCallManager({
    ttsProvider: 'piper',
  });

  // Prepare audio format handler
  const formatHandler = new AudioFormatHandler({
    input: { sampleRate: 8000, encoding: 'mulaw' },   // Twilio input
    output: { sampleRate: 16000, encoding: 'pcm' },   // Whisper expects 16kHz
  });

  // Listen for incoming audio
  for await (const chunk of audioStream) {
    // Convert format
    const pcmAudio = formatHandler.convert(chunk);

    // Transcribe
    const transcript = await manager.transcribeAudio(pcmAudio);
    console.log('User said:', transcript);

    // Generate response (simplified)
    const response = 'Thank you for calling. How can I help?';

    // Synthesize response
    const responseAudio = await manager.synthesizeText(response);

    // Convert back to Twilio format
    const twilioFormatHandler = new AudioFormatHandler({
      input: { sampleRate: 24000, encoding: 'pcm' },   // Piper output
      output: { sampleRate: 8000, encoding: 'mulaw' },  // Back to Twilio
    });

    const twilioAudio = twilioFormatHandler.convert(responseAudio);

    // Send back to caller
    audioStream.write(twilioAudio);
  }
}
```

## Step 6: Environment Configuration

Create `.env` configuration for model paths:

```bash
# .env or .env.local
WHISPER_MODEL_SIZE=base
WHISPER_LANGUAGE=auto

KOKORO_VOICE=af_bella
KOKORO_MODEL_PATH=./models/kokoro

PIPER_LANGUAGE=en
PIPER_VOICE=en_US-arctic-medium
PIPER_MODELS=./models/piper-voices
```

## Step 7: CLI Integration

Add CLI commands for provider management:

```typescript
// src/providers/cli.ts
import type { Command } from 'commander';
import { getProviderRegistry } from './registry.js';

export function registerProviderCommands(program: Command) {
  program
    .command('providers')
    .description('Manage local STT/TTS providers')
    .action(async () => {
      const registry = getProviderRegistry();

      console.log('\n=== Speech-to-Text Providers ===');
      registry.stt.forEach((provider) => {
        console.log(`\n${provider.metadata.name} v${provider.metadata.version}`);
        console.log(`  Type: ${provider.metadata.type}`);
        console.log(`  Description: ${provider.metadata.description}`);
        console.log(`  Capabilities: ${provider.metadata.capabilities.join(', ')}`);
      });

      console.log('\n\n=== Text-to-Speech Providers ===');
      registry.tts.forEach((provider) => {
        console.log(`\n${provider.metadata.name} v${provider.metadata.version}`);
        console.log(`  Type: ${provider.metadata.type}`);
        console.log(`  Description: ${provider.metadata.description}`);
        console.log(`  Capabilities: ${provider.metadata.capabilities.join(', ')}`);
      });

      console.log('\n');
    });

  program
    .command('test-stt')
    .option('--audio <path>', 'Audio file to transcribe')
    .description('Test STT provider')
    .action(async (options) => {
      const { readFileSync } = await import('fs');
      const { WhisperLocalSTTProvider } = await import('./stt-whisper-local.js');

      const audio = readFileSync(options.audio);
      const provider = new WhisperLocalSTTProvider();
      const session = provider.createSession();

      await session.connect();
      session.sendAudio(audio);

      const transcript = await session.waitForTranscript();
      console.log('Transcription:', transcript);

      session.close();
    });

  program
    .command('test-tts')
    .option('--text <text>', 'Text to synthesize')
    .option('--provider <provider>', 'TTS provider (piper, kokoro)', 'piper')
    .option('--output <path>', 'Output audio file', './test-output.wav')
    .description('Test TTS provider')
    .action(async (options) => {
      const { writeFileSync } = await import('fs');
      const { PiperTTSProvider } = await import('./tts-piper.js');

      const provider = new PiperTTSProvider({
        modelPath: process.env.PIPER_MODELS || './models/piper-voices',
      });

      const audio = await provider.synthesize(options.text);
      writeFileSync(options.output, audio);

      console.log(`✓ Audio saved to ${options.output}`);
    });
}
```

## Step 8: Testing Integration

Complete integration test:

```typescript
// test/integration.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { VoiceCallManager } from '../src/manager.js';
import { readFileSync } from 'fs';

describe('Local Providers Integration', () => {
  let manager: VoiceCallManager;

  beforeAll(() => {
    manager = new VoiceCallManager({ ttsProvider: 'piper' });
  });

  it('transcribes audio with Whisper', async () => {
    const audio = readFileSync('./test-audio.wav');
    const transcript = await manager.transcribeAudio(audio);

    expect(typeof transcript).toBe('string');
    expect(transcript.length).toBeGreaterThan(0);
  });

  it('synthesizes text with Piper', async () => {
    const audio = await manager.synthesizeText('Hello world');

    expect(Buffer.isBuffer(audio)).toBe(true);
    expect(audio.length).toBeGreaterThan(0);
  });
});
```

## Step 9: Deployment Checklist

Before deploying to production:

- [ ] Download and test all required models
- [ ] Verify disk space (5-10GB minimum)
- [ ] Test on target platform (Windows/Linux)
- [ ] Configure environment variables
- [ ] Run full test suite
- [ ] Benchmark performance
- [ ] Set up error logging
- [ ] Configure timeout values
- [ ] Test fallback scenarios
- [ ] Document any platform-specific issues

## Step 10: Monitoring & Observability

Add logging and monitoring:

```typescript
// src/providers/telemetry.ts
export interface TranscriptionMetrics {
  duration: number;
  textLength: number;
  confidence?: number;
  language?: string;
}

export interface SynthesisMetrics {
  duration: number;
  textLength: number;
  audioLength: number;
  voice: string;
}

export class ProviderMetrics {
  private transcriptions: TranscriptionMetrics[] = [];
  private syntheses: SynthesisMetrics[] = [];

  recordTranscription(metrics: TranscriptionMetrics) {
    this.transcriptions.push(metrics);
    console.log(`[STT] ${metrics.duration}ms: ${metrics.textLength} chars`);
  }

  recordSynthesis(metrics: SynthesisMetrics) {
    this.syntheses.push(metrics);
    console.log(`[TTS] ${metrics.duration}ms: ${metrics.audioLength} bytes`);
  }

  getStats() {
    const avgTranscriptionTime =
      this.transcriptions.reduce((sum, m) => sum + m.duration, 0) /
      this.transcriptions.length;
    const avgSynthesisTime =
      this.syntheses.reduce((sum, m) => sum + m.duration, 0) /
      this.syntheses.length;

    return { avgTranscriptionTime, avgSynthesisTime };
  }
}
```

## Troubleshooting Integration

### Models Not Found

```typescript
// Verify models exist
import { existsSync } from 'fs';

if (!existsSync('./models/piper-voices')) {
  throw new Error('Piper models not found. Run setup script first.');
}
```

### Memory Issues

```typescript
// Use smaller models for limited memory
const provider = new WhisperLocalSTTProvider({
  modelSize: 'tiny',  // Use smaller model
});
```

### Format Conversion Issues

```typescript
// Test format conversions
import { pcmToMuLaw, muLawToPcm } from './providers/audio-utils.js';

const pcm = readFileSync('./test.wav');
const mulaw = pcmToMuLaw(pcm);
const recovered = muLawToPcm(mulaw);
console.log('Format conversion OK');
```

## Next Steps

1. Follow system setup: `LOCAL_PROVIDERS_SETUP.md`
2. Review code examples: `USAGE_EXAMPLES.md`
3. Run tests: `npm test`
4. Deploy to target platform
5. Monitor performance and adjust configuration

## Support

For integration questions:
- Check documentation files
- Review test implementations
- Check example code
- Run diagnostics: `npm run providers`
