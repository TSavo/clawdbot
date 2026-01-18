# Local STT/TTS Providers Setup Guide

This document provides system requirements and setup instructions for running local Speech-to-Text (STT) and Text-to-Speech (TTS) providers on Windows and Linux.

## Overview

The voice-call extension supports three local providers for Windows/Linux compatibility:

1. **Whisper-local**: OpenAI Whisper running locally for STT
2. **Kokoro TTS**: Local voice synthesis with multiple voices
3. **Piper TTS**: Mozilla Piper local voice synthesis

All providers work offline and don't require external API calls.

## System Requirements

### General Requirements

- **Node.js**: 18.0.0 or higher
- **RAM**: Minimum 2GB (4GB+ recommended for large models)
- **Disk Space**: 5-10GB for model files
- **Network**: Initial setup requires internet to download models

### Platform-Specific Requirements

#### Windows 10/11

- Visual Studio Build Tools 2019 or higher (for compilation)
- Python 3.8+ (for some providers)
- Git for Windows

#### Linux (Ubuntu 20.04+, Debian 11+)

- Build tools: `build-essential`, `python3`, `python3-dev`
- Audio libraries: `libsndfile1-dev`, `portaudio19-dev`

## Installation

### 1. Whisper-local STT Provider

#### Option A: Using transformers.js (Recommended for JavaScript)

```bash
# Install Whisper.js via transformers.js
npm install @xenova/transformers

# Or in the voice-call extension
cd extensions/voice-call
npm install @xenova/transformers
```

#### Option B: Using Whisper.cpp (Faster C++ Implementation)

**Windows:**

```bash
# Clone whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp

# Build with MSVC (Visual Studio)
mkdir build
cd build
cmake ..
cmake --build . --config Release

# Download model
cd ..
.\models\download-ggml-model.cmd base
```

**Linux:**

```bash
# Install dependencies
sudo apt-get install build-essential cmake

# Clone and build
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
make

# Download model
./models/download-ggml-model.sh base
```

#### Configuration

```typescript
import { WhisperLocalSTTProvider } from './providers/stt-whisper-local';

const provider = new WhisperLocalSTTProvider({
  modelSize: 'base',        // 'tiny', 'small', 'base', 'medium', 'large'
  language: 'auto',         // Auto-detect or 'en', 'es', etc.
  wordTimestamps: false,
  modelPath: './models',    // Optional: custom model directory
});
```

### 2. Kokoro TTS Provider

#### Installation

**Windows:**

```bash
# Install via pip
pip install kokoro

# Or build from source
git clone https://github.com/hexgrad/kokoro.git
cd kokoro
pip install -e .
```

**Linux:**

```bash
# Install system dependencies
sudo apt-get install libsndfile1-dev libportaudio2

# Install Kokoro
pip install kokoro
# Or from source
git clone https://github.com/hexgrad/kokoro.git
cd kokoro
pip install -e .
```

#### Configuration

```typescript
import { KokoroTTSProvider } from './providers/tts-kokoro';

const provider = new KokoroTTSProvider({
  voice: 'af_bella',        // af_bella, af_sarah, am_michael, etc.
  speed: 1.0,               // 0.5 to 2.0
  modelPath: './models/kokoro',
});
```

#### Available Voices

Female voices:
- `af_bella` - American Female (Friendly)
- `af_sarah` - American Female (Professional)
- `af_nicole` - American Female (Energetic)
- `bf_emma` - British Female (Sophisticated)

Male voices:
- `am_michael` - American Male (Authoritative)
- `am_joshua` - American Male (Friendly)
- `am_brandon` - American Male (Deep)
- `bm_george` - British Male (Refined)

### 3. Piper TTS Provider

#### Installation

**Windows:**

```bash
# Download pre-built binary
# From: https://github.com/rhasspy/piper/releases

# Extract to a known location
mkdir C:\piper
cd C:\piper
# Extract piper.exe and model files

# Add to PATH
setx PATH "%PATH%;C:\piper"
```

**Linux:**

```bash
# Install dependencies
sudo apt-get install espeak-ng libsndfile1

# Download pre-built binary
mkdir ~/piper
cd ~/piper
wget https://github.com/rhasspy/piper/releases/download/2024.01.30/piper_linux_x86_64.tar.gz
tar xzf piper_linux_x86_64.tar.gz

# Add to PATH
export PATH="$HOME/piper:$PATH"
# Add to ~/.bashrc for persistence
echo 'export PATH="$HOME/piper:$PATH"' >> ~/.bashrc
```

#### Downloading Models

Models are available from HuggingFace. Download them to a known directory:

```bash
# Using git-lfs
git clone https://huggingface.co/rhasspy/piper-voices
# Or download specific voice: https://huggingface.co/rhasspy/piper-voices/tree/main/en

# Recommended voices for English:
# - en_US-arctic-medium.onnx (female, clear)
# - en_US-gpt4-medium.onnx (female, natural)
# - en_US-male-medium.onnx (male, natural)
```

#### Configuration

```typescript
import { PiperTTSProvider } from './providers/tts-piper';

const provider = new PiperTTSProvider({
  language: 'en',
  voice: 'en_US-arctic-medium',
  speed: 1.0,
  modelPath: './models/piper-voices',
  outputFormat: 'pcm',      // 'pcm', 'mulaw', or 'wav'
});
```

## Audio Format Reference

### Output Formats

| Provider | Default | Alternatives | Sample Rate |
|----------|---------|--------------|-------------|
| Whisper | PCM 16kHz | - | 16kHz |
| Kokoro | PCM 24kHz | - | 24kHz |
| Piper | PCM 22.05kHz | mu-law, WAV | 22.05kHz |

### Format Conversions

```typescript
import {
  pcmToMuLaw,
  muLawToPcm,
  resampleAudio,
  AUDIO_FORMATS,
} from './audio-utils';

// Convert to mu-law for Twilio
const muLawAudio = pcmToMuLaw(pcmData);

// Resample from 24kHz to 16kHz
const resampledAudio = resampleAudio(
  audio24k,
  AUDIO_FORMATS.PCM_24KHZ.sampleRate,
  AUDIO_FORMATS.PCM_16KHZ.sampleRate,
);
```

## Usage Examples

### Simple STT Example

```typescript
import { WhisperLocalSTTProvider } from './providers/stt-whisper-local';
import { readFileSync } from 'fs';

const provider = new WhisperLocalSTTProvider({
  modelSize: 'base',
  language: 'auto',
});

const session = provider.createSession();
await session.connect();

// Load audio file
const audio = readFileSync('./audio.wav');
session.sendAudio(audio);

// Get transcription
const transcript = await session.waitForTranscript(30000);
console.log('Transcription:', transcript);

session.close();
```

### Batch TTS Example

```typescript
import { PiperTTSProvider, PiperBatchSynthesizer } from './providers/tts-piper';

const provider = new PiperTTSProvider({
  modelPath: './models/piper-voices',
  language: 'en',
  voice: 'en_US-arctic-medium',
});

const synthesizer = new PiperBatchSynthesizer(provider);

const texts = [
  'Welcome to our service.',
  'This is a test message.',
  'Thank you for listening.',
];

const results = await synthesizer.synthesizeAndConcatenate(
  texts,
  undefined,
  500, // 500ms silence between phrases
);

// Convert to mu-law for Twilio
import { pcmToMuLaw } from './audio-utils';
const muLawAudio = pcmToMuLaw(results);
```

### Voice Selection Example

```typescript
import { KokoroTTSProvider, getAvailableVoices } from './providers/tts-kokoro';

// List all voices
const voices = getAvailableVoices();
voices.forEach(v => {
  console.log(`${v.name} (${v.gender}, ${v.accent}): ${v.id}`);
});

// Create provider with female voice
const provider = new KokoroTTSProvider({
  voice: 'af_sarah',
  speed: 0.9,
});

const audio = await provider.synthesize(
  'Hello, this is a test message.'
);
```

## Performance Tuning

### Memory Usage

**Whisper Models:**
- tiny: 100MB
- small: 200MB
- base: 300MB
- medium: 750MB
- large: 2.5GB

**Optimize for limited memory:**
```typescript
// Use smaller models
const provider = new WhisperLocalSTTProvider({
  modelSize: 'tiny', // Fast but less accurate
});

// Or batch smaller chunks
const processor = new WhisperLocalBatchProcessor(provider);
```

### Speed Optimization

**Piper (fastest):**
- Optimized for real-time synthesis
- ~100-200ms per second of audio
- 22.05kHz output

**Kokoro (balanced):**
- Good quality at reasonable speed
- ~200-300ms per second of audio
- 24kHz output

**Whisper (slowest but most accurate):**
- Use `tiny` or `small` models for speed
- Can take 10-30s for medium-length audio
- Parallelizable with batch processor

## Troubleshooting

### Whisper Issues

**Problem: Model download fails**
```bash
# Manually download model
python -c "from transformers import AutoFeatureExtractor; \
  AutoFeatureExtractor.from_pretrained('openai/whisper-base')"
```

**Problem: GPU out of memory**
```typescript
// Fall back to CPU with smaller model
const provider = new WhisperLocalSTTProvider({
  modelSize: 'tiny',
});
```

### Kokoro Issues

**Problem: Python not found**
```bash
# Windows
python -m pip install kokoro

# Linux
python3 -m pip install kokoro
```

**Problem: Audio file format not supported**
```typescript
// Ensure audio is in correct format (mono PCM)
import { stereoToMono } from './audio-utils';
const mono = stereoToMono(stereoAudio);
```

### Piper Issues

**Problem: Binary not in PATH**
```bash
# Windows
set PATH=%PATH%;C:\piper

# Linux
export PATH="$HOME/piper:$PATH"
```

**Problem: Model file not found**
```typescript
// Verify model path
import { existsSync } from 'fs';
if (!existsSync('./models/en_US-arctic-medium.onnx')) {
  console.error('Model file not found');
}
```

## Configuration Best Practices

### Production Setup

```typescript
const config = {
  // STT: Balance accuracy and speed
  stt: {
    modelSize: 'base',      // Good balance
    language: 'en',         // Explicit language when known
    wordTimestamps: false,  // Save processing time
    transcriptionTimeoutMs: 30000,
  },

  // TTS: High quality
  tts: {
    provider: 'piper',      // Fastest for streaming
    voice: 'en_US-arctic-medium', // Clear voice
    speed: 1.0,             // Normal speed
    outputFormat: 'pcm',    // Native format
  },
};
```

### Development Setup

```typescript
const config = {
  // STT: Fast iteration
  stt: {
    modelSize: 'tiny',      // Fastest
    language: 'auto',       // Auto-detect
    transcriptionTimeoutMs: 10000,
  },

  // TTS: Good quality
  tts: {
    provider: 'kokoro',
    voice: 'af_bella',
    speed: 1.5,             // Faster for testing
  },
};
```

## Cross-Platform Deployment

### Windows

```batch
# Install script
python -m pip install kokoro
mkdir models
cd models
# Download Piper and model files
# Set environment variables in .env
```

### Linux

```bash
#!/bin/bash
# Install dependencies
sudo apt-get update
sudo apt-get install -y build-essential python3 libsndfile1-dev

# Install Kokoro
pip install kokoro

# Create models directory
mkdir -p ./models
cd ./models

# Download Piper
wget https://github.com/rhasspy/piper/releases/download/2024.01.30/piper_linux_x86_64.tar.gz
tar xzf piper_linux_x86_64.tar.gz
```

## API Reference

### STTProvider Interface

```typescript
interface STTProvider {
  readonly metadata: PluginMetadata;
  createSession(config?: PluginConfig): STTSession;
  validateConfig(): void;
}

interface STTSession {
  readonly sessionId: string;
  connect(): Promise<void>;
  sendAudio(audio: Buffer): void;
  onPartial(callback: (partial: string) => void): void;
  onTranscript(callback: (transcript: string) => void): void;
  waitForTranscript(timeoutMs?: number): Promise<string>;
  isConnected(): boolean;
  close(): void;
}
```

### TTSProvider Interface

```typescript
interface TTSProvider {
  readonly metadata: PluginMetadata;
  synthesize(text: string, options?: TTSSynthesisOptions): Promise<Buffer>;
  validateConfig(): void;
}

interface TTSSynthesisOptions {
  voice?: string;
  speed?: number;
  instructions?: string;
}
```

## Support and Resources

- **Whisper**: https://github.com/openai/whisper
- **Whisper.cpp**: https://github.com/ggerganov/whisper.cpp
- **Kokoro**: https://github.com/hexgrad/kokoro
- **Piper**: https://github.com/rhasspy/piper
- **Clawdbot Docs**: https://docs.clawd.bot

## License

These providers are part of Clawdbot and are licensed under MIT.
