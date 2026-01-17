# Local STT/TTS Providers Usage Examples

Complete examples showing how to use Whisper-local, Kokoro, and Piper providers.

## Table of Contents

1. [Speech-to-Text (Whisper-local)](#speech-to-text)
2. [Text-to-Speech (Kokoro)](#text-to-speech-kokoro)
3. [Text-to-Speech (Piper)](#text-to-speech-piper)
4. [Advanced Usage](#advanced-usage)
5. [Integration with Voice Calls](#integration-with-voice-calls)

## Speech-to-Text

### Basic Transcription

```typescript
import { WhisperLocalSTTProvider } from './providers/stt-whisper-local';
import { readFileSync } from 'fs';

async function transcribeAudio() {
  // Initialize provider
  const provider = new WhisperLocalSTTProvider({
    modelSize: 'base',
    language: 'auto', // Auto-detect language
  });

  // Create session
  const session = provider.createSession();

  // Connect to transcription service
  await session.connect();

  // Read audio file
  const audio = readFileSync('./audio.wav');

  // Send for transcription
  session.sendAudio(audio);

  // Register for callbacks
  session.onPartial((partial) => {
    console.log('Partial transcript:', partial);
  });

  session.onTranscript((transcript) => {
    console.log('Final transcript:', transcript);
  });

  // Wait for result
  try {
    const result = await session.waitForTranscript(30000);
    console.log('Transcription result:', result);
  } catch (error) {
    console.error('Transcription failed:', error);
  } finally {
    session.close();
  }
}

transcribeAudio();
```

### Batch Transcription

```typescript
import { WhisperLocalSTTProvider, WhisperLocalBatchProcessor } from './providers/stt-whisper-local';
import { readFileSync } from 'fs';

async function batchTranscribe() {
  const provider = new WhisperLocalSTTProvider({
    modelSize: 'base',
    language: 'en',
  });

  const processor = new WhisperLocalBatchProcessor(provider);

  // Load multiple audio files
  const audioBuffers = [
    readFileSync('./audio1.wav'),
    readFileSync('./audio2.wav'),
    readFileSync('./audio3.wav'),
  ];

  // Process with progress callback
  const results = await processor.transcribeBatch(audioBuffers, (index, total) => {
    console.log(`Processing ${index + 1}/${total}`);
  });

  results.forEach((result, index) => {
    console.log(`Audio ${index + 1}: ${result.text}`);
  });
}

batchTranscribe();
```

### Language Detection

```typescript
async function detectAndTranscribe() {
  // Use auto language detection
  const provider = new WhisperLocalSTTProvider({
    modelSize: 'small',
    language: 'auto',
  });

  const session = provider.createSession();
  await session.connect();

  // Send audio with detected language
  const audio = readFileSync('./multilingual_audio.wav');
  session.sendAudio(audio);

  const transcript = await session.waitForTranscript();
  console.log('Detected and transcribed:', transcript);

  session.close();
}

detectAndTranscribe();
```

### Audio Analysis

```typescript
import { analyzeAudioQuality, isValidWhisperAudio } from './providers/stt-whisper-local';
import { readFileSync } from 'fs';

function analyzeAudio(filePath: string) {
  const audio = readFileSync(filePath);

  // Validate audio
  if (!isValidWhisperAudio(audio, 16000)) {
    console.error('Audio is not valid for Whisper');
    return;
  }

  // Analyze quality
  const quality = analyzeAudioQuality(audio);

  console.log('Audio Quality Analysis:');
  console.log(`  RMS Level: ${quality.rmsLevel.toFixed(2)}`);
  console.log(`  Peak Level: ${quality.peakLevel}`);
  console.log(`  Silence Ratio: ${(quality.silenceRatio * 100).toFixed(1)}%`);

  if (quality.silenceRatio > 0.5) {
    console.warn('Warning: Audio is mostly silent');
  }

  if (quality.rmsLevel < 100) {
    console.warn('Warning: Audio is very quiet');
  }
}

analyzeAudio('./audio.wav');
```

## Text-to-Speech: Kokoro

### Basic Synthesis

```typescript
import { KokoroTTSProvider } from './providers/tts-kokoro';
import { writeFileSync } from 'fs';

async function synthesizeWithKokoro() {
  // Initialize provider
  const provider = new KokoroTTSProvider({
    voice: 'af_bella', // Friendly female voice
    speed: 1.0,
  });

  // Synthesize text
  const text = 'Hello! Welcome to our service. How can I assist you today?';
  const audio = await provider.synthesize(text);

  // Save to file
  writeFileSync('./output_kokoro.wav', audio);
  console.log('Audio saved to output_kokoro.wav');
}

synthesizeWithKokoro();
```

### Voice Selection

```typescript
import { KokoroTTSProvider, getAvailableVoices } from './providers/tts-kokoro';

async function demonstrateVoices() {
  const voices = getAvailableVoices();

  console.log('Available Kokoro Voices:');
  voices.forEach((voice) => {
    console.log(`- ${voice.name} (${voice.gender}, ${voice.accent}): ${voice.id}`);
  });

  // Use different voices
  const text = 'This is a demonstration of different voices.';

  for (const voice of voices.slice(0, 3)) {
    const provider = new KokoroTTSProvider({ voice: voice.id });
    const audio = await provider.synthesize(text);
    console.log(`✓ Synthesized with ${voice.name}`);
  }
}

demonstrateVoices();
```

### Speed Control

```typescript
import { KokoroTTSProvider } from './providers/tts-kokoro';

async function synthesizeAtDifferentSpeeds() {
  const text = 'This is a test of different speaking speeds.';
  const speeds = [0.5, 1.0, 1.5, 2.0];

  for (const speed of speeds) {
    const provider = new KokoroTTSProvider({ speed });
    const audio = await provider.synthesize(text);
    console.log(`✓ Synthesized at ${speed}x speed (${audio.length} bytes)`);
  }
}

synthesizeAtDifferentSpeeds();
```

### Batch Synthesis

```typescript
import { KokoroTTSProvider, KokorobatchSynthesizer } from './providers/tts-kokoro';
import { writeFileSync } from 'fs';

async function batchSynthesizeKokoro() {
  const provider = new KokoroTTSProvider({
    voice: 'am_michael',
    speed: 1.0,
  });

  const synthesizer = new KokorobatchSynthesizer(provider);

  const phrases = [
    'Welcome to our service.',
    'This is a message.',
    'Thank you for your patience.',
    'Goodbye!',
  ];

  // Synthesize with progress
  const results = await synthesizer.synthesizeBatch(phrases, undefined, (index, total) => {
    console.log(`Synthesizing ${index + 1}/${total}`);
  });

  // Concatenate with silence
  const concatenated = await synthesizer.synthesizeAndConcatenate(phrases, undefined, 500);

  writeFileSync('./kokoro_output.wav', concatenated);
  console.log(`✓ Created concatenated audio: ${concatenated.length} bytes`);
}

batchSynthesizeKokoro();
```

## Text-to-Speech: Piper

### Basic Synthesis

```typescript
import { PiperTTSProvider } from './providers/tts-piper';
import { writeFileSync } from 'fs';

async function synthesizeWithPiper() {
  // Initialize provider
  const provider = new PiperTTSProvider({
    language: 'en',
    voice: 'en_US-arctic-medium',
    modelPath: './models/piper-voices',
  });

  // Synthesize text
  const audio = await provider.synthesize(
    'Welcome to Clawdbot. Your virtual assistant.',
  );

  writeFileSync('./output_piper.wav', audio);
  console.log('Audio saved to output_piper.wav');
}

synthesizeWithPiper();
```

### Multi-Language Support

```typescript
import { PiperTTSProvider, getAvailableVoices as getPiperVoices, getLanguageName } from './providers/tts-piper';

async function multiLanguageSynthesis() {
  const texts = {
    en: 'Hello, this is English.',
    es: 'Hola, esto es español.',
    fr: 'Bonjour, ceci est français.',
    de: 'Hallo, das ist Deutsch.',
  };

  for (const [lang, text] of Object.entries(texts)) {
    const provider = new PiperTTSProvider({
      language: lang,
      modelPath: './models/piper-voices',
      voice: getPiperVoices(lang)[0], // Use first available voice
    });

    const audio = await provider.synthesize(text);
    console.log(`✓ Synthesized ${getLanguageName(lang)}: ${audio.length} bytes`);
  }
}

multiLanguageSynthesis();
```

### Output Format Conversion

```typescript
import { PiperTTSProvider } from './providers/tts-piper';
import { writeFileSync } from 'fs';

async function synthesizeMultipleFormats() {
  const formats = ['pcm', 'mulaw', 'wav'] as const;

  for (const format of formats) {
    const provider = new PiperTTSProvider({
      modelPath: './models/piper-voices',
      outputFormat: format,
    });

    const audio = await provider.synthesize('Test message.');
    writeFileSync(`./output.${format === 'mulaw' ? 'raw' : format}`, audio);
    console.log(`✓ Saved as ${format} format: ${audio.length} bytes`);
  }
}

synthesizeMultipleFormats();
```

### Batch Processing

```typescript
import { PiperTTSProvider, PiperBatchSynthesizer, chunkTextBySentences } from './providers/tts-piper';

async function synthesizeLongText() {
  const longText = `
    Welcome to our customer service. We appreciate your business.
    If you have any questions, please feel free to ask.
    We are here to help you with any concerns.
    Thank you for choosing us. Have a great day!
  `;

  // Split into chunks
  const chunks = chunkTextBySentences(longText, 200);

  const provider = new PiperTTSProvider({
    modelPath: './models/piper-voices',
    language: 'en',
  });

  const synthesizer = new PiperBatchSynthesizer(provider);

  // Synthesize and concatenate
  const audio = await synthesizer.synthesizeAndConcatenate(chunks, undefined, 300);

  console.log(`✓ Synthesized ${chunks.length} chunks into ${audio.length} bytes`);
}

synthesizeLongText();
```

## Advanced Usage

### Audio Format Conversions

```typescript
import {
  pcmToMuLaw,
  muLawToPcm,
  resampleAudio,
  stereoToMono,
  scaleVolume,
  concatenateAudio,
} from './providers/audio-utils';

function demonstrateAudioConversions() {
  // Create sample PCM data
  const pcmData = Buffer.alloc(4000);
  const view = new DataView(pcmData.buffer);
  for (let i = 0; i < 2000; i++) {
    view.setInt16(i * 2, Math.sin(i / 100) * 10000, true);
  }

  // Convert to mu-law (for Twilio)
  const muLawData = pcmToMuLaw(pcmData);
  console.log(`PCM: ${pcmData.length} bytes -> Mu-law: ${muLawData.length} bytes`);

  // Convert back to PCM
  const recovered = muLawToPcm(muLawData);
  console.log(`Mu-law: ${muLawData.length} bytes -> PCM: ${recovered.length} bytes`);

  // Resample from 16kHz to 8kHz
  const downsampled = resampleAudio(pcmData, 16000, 8000);
  console.log(`Resampled to 8kHz: ${downsampled.length} bytes`);

  // Scale volume
  const quieter = scaleVolume(pcmData, 0.5);
  const louder = scaleVolume(pcmData, 2.0);
  console.log(`Volume: normal -> 0.5x: ${quieter.length}, 2x: ${louder.length}`);
}

demonstrateAudioConversions();
```

### Custom Provider Configuration

```typescript
import { validateWhisperLocalConfig, validatePiperConfig } from './providers/config-schemas';

function validateConfigurations() {
  const whisperConfig = {
    modelSize: 'base',
    language: 'en',
    wordTimestamps: true,
  };

  const result1 = validateWhisperLocalConfig(whisperConfig);
  console.log('Whisper config valid:', result1.valid);

  const piperConfig = {
    language: 'en',
    modelPath: '/path/to/models',
    outputFormat: 'pcm',
  };

  const result2 = validatePiperConfig(piperConfig);
  console.log('Piper config valid:', result2.valid);

  // Invalid config
  const invalidConfig = {
    modelSize: 'invalid',
    speed: 5.0, // Out of range
  };

  const result3 = validateWhisperLocalConfig(invalidConfig);
  console.log('Errors:', result3.errors);
}

validateConfigurations();
```

## Integration with Voice Calls

### Complete Voice Call Pipeline

```typescript
import { WhisperLocalSTTProvider } from './providers/stt-whisper-local';
import { PiperTTSProvider } from './providers/tts-piper';
import { pcmToMuLaw } from './providers/audio-utils';

async function completeVoiceCallFlow() {
  // Initialize STT
  const sttProvider = new WhisperLocalSTTProvider({
    modelSize: 'small',
    language: 'en',
  });

  // Initialize TTS
  const ttsProvider = new PiperTTSProvider({
    modelPath: './models/piper-voices',
    language: 'en',
    voice: 'en_US-arctic-medium',
  });

  // Simulate receiving audio from caller
  const incomingAudio = Buffer.alloc(16000 * 2); // 1 second of audio

  // Transcribe user input
  const sttSession = sttProvider.createSession();
  await sttSession.connect();
  sttSession.sendAudio(incomingAudio);
  const userTranscript = await sttSession.waitForTranscript();
  sttSession.close();

  console.log('User said:', userTranscript);

  // Generate response
  const responseText = 'Thank you for your message. How can I help?';

  // Synthesize response
  const responseAudio = await ttsProvider.synthesize(responseText);

  // Convert to mu-law for Twilio
  const twilioAudio = pcmToMuLaw(responseAudio);

  console.log('Response audio ready:', twilioAudio.length, 'bytes');
  // Send back to caller...
}

completeVoiceCallFlow();
```

### Error Handling and Fallback

```typescript
import { WhisperLocalSTTProvider } from './providers/stt-whisper-local';
import { PiperTTSProvider } from './providers/tts-piper';
import { KokoroTTSProvider } from './providers/tts-kokoro';

async function robustVoiceProcessing(audio: Buffer) {
  try {
    // Try with default STT
    const sttProvider = new WhisperLocalSTTProvider({ modelSize: 'base' });
    const session = sttProvider.createSession();
    await session.connect();
    session.sendAudio(audio);

    const transcript = await Promise.race([
      session.waitForTranscript(),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('STT timeout')), 10000),
      ),
    ]);

    session.close();
    console.log('✓ STT successful:', transcript);

    // Try TTS synthesis with fallback
    let synthesizedAudio: Buffer | null = null;

    try {
      // Try Piper first (faster)
      const piperProvider = new PiperTTSProvider({
        modelPath: './models/piper-voices',
      });
      synthesizedAudio = await piperProvider.synthesize(
        'Your request has been processed.',
      );
      console.log('✓ TTS successful with Piper');
    } catch (piperError) {
      console.warn('⚠ Piper failed, trying Kokoro...');

      try {
        // Fall back to Kokoro
        const kokoroProvider = new KokoroTTSProvider();
        synthesizedAudio = await kokoroProvider.synthesize(
          'Your request has been processed.',
        );
        console.log('✓ TTS successful with Kokoro');
      } catch (kokoroError) {
        console.error('✗ Both TTS providers failed');
        throw new Error('TTS synthesis failed');
      }
    }

    return { transcript, audio: synthesizedAudio };
  } catch (error) {
    console.error('Voice processing failed:', error);
    throw error;
  }
}

// Usage
robustVoiceProcessing(Buffer.alloc(1000));
```

## Performance Tips

1. **Choose appropriate model sizes:**
   - Use `tiny` for low-latency requirements
   - Use `base` for balanced performance
   - Use `large` only when accuracy is critical

2. **Cache providers:**
   - Reuse provider instances across multiple calls
   - Don't recreate providers for each request

3. **Batch process when possible:**
   - Process multiple audio files together
   - Use batch synthesizers for TTS

4. **Monitor audio quality:**
   - Use `analyzeAudioQuality()` to detect issues
   - Skip processing for very quiet audio

5. **Format conversion:**
   - Cache converted audio when reused
   - Convert formats only when necessary
