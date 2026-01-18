/**
 * Audio Test Fixtures and Utilities
 *
 * Provides helper functions to generate test audio data without external files
 */

/**
 * Generate PCM audio data for testing
 * Creates a sine wave at the specified frequency
 */
export function generateSineWave(
  durationMs: number,
  frequency: number = 440,
  sampleRate: number = 16000,
  amplitude: number = 0.3,
): Buffer {
  const numSamples = (durationMs * sampleRate) / 1000;
  const audioData = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((i / sampleRate) * frequency * 2 * Math.PI) * amplitude * 32767;
    audioData.writeInt16LE(Math.floor(sample), i * 2);
  }

  return audioData;
}

/**
 * Generate white noise audio for testing
 */
export function generateWhiteNoise(
  durationMs: number,
  sampleRate: number = 16000,
  amplitude: number = 0.3,
): Buffer {
  const numSamples = (durationMs * sampleRate) / 1000;
  const audioData = Buffer.alloc(numSamples * 2);

  for (let i = 0; i < numSamples; i++) {
    const sample = (Math.random() - 0.5) * amplitude * 32767;
    audioData.writeInt16LE(Math.floor(sample), i * 2);
  }

  return audioData;
}

/**
 * Generate spoken-like audio pattern (approximates speech characteristics)
 */
export function generateSpeechPattern(
  durationMs: number,
  sampleRate: number = 16000,
): Buffer {
  const numSamples = (durationMs * sampleRate) / 1000;
  const audioData = Buffer.alloc(numSamples * 2);

  // Create a combination of frequencies to approximate speech
  const baseFreq = 200;
  const modFreq = 3;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;

    // Main frequency modulated by envelope
    const envelope = Math.sin((t / (durationMs / 1000)) * Math.PI);
    const fundamental = Math.sin(t * baseFreq * 2 * Math.PI);

    // Add some harmonics
    const harmonic1 = 0.3 * Math.sin(t * baseFreq * 2 * 2 * Math.PI);
    const harmonic2 = 0.15 * Math.sin(t * baseFreq * 3 * 2 * Math.PI);

    // Frequency modulation
    const fmComponent = Math.sin(t * modFreq * 2 * Math.PI);

    const sample = (fundamental + harmonic1 + harmonic2 + fmComponent * 0.1) * envelope * 0.3 * 32767;
    audioData.writeInt16LE(Math.floor(sample), i * 2);
  }

  return audioData;
}

/**
 * Create a complete WAV file with proper RIFF headers
 */
export function createWAVBuffer(
  audioData: Buffer,
  sampleRate: number = 16000,
  channels: number = 1,
  bitsPerSample: number = 16,
): Buffer {
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const subChunk2Size = audioData.length;

  const header = Buffer.alloc(44);
  let offset = 0;

  // RIFF identifier
  header.write("RIFF", offset);
  offset += 4;

  // File size - 8
  const fileSize = 36 + subChunk2Size;
  header.writeUInt32LE(fileSize, offset);
  offset += 4;

  // WAVE identifier
  header.write("WAVE", offset);
  offset += 4;

  // fmt subchunk
  header.write("fmt ", offset);
  offset += 4;

  // fmt subchunk size (16 for PCM)
  header.writeUInt32LE(16, offset);
  offset += 4;

  // Audio format (1 = PCM)
  header.writeUInt16LE(1, offset);
  offset += 2;

  // Channels
  header.writeUInt16LE(channels, offset);
  offset += 2;

  // Sample rate
  header.writeUInt32LE(sampleRate, offset);
  offset += 4;

  // Byte rate
  header.writeUInt32LE(byteRate, offset);
  offset += 4;

  // Block align
  header.writeUInt16LE(blockAlign, offset);
  offset += 2;

  // Bits per sample
  header.writeUInt16LE(bitsPerSample, offset);
  offset += 2;

  // data subchunk
  header.write("data", offset);
  offset += 4;

  // data subchunk size
  header.writeUInt32LE(subChunk2Size, offset);

  return Buffer.concat([header, audioData]);
}

/**
 * Create various test audio fixtures
 */
export const AudioFixtures = {
  /**
   * Short silence for testing (100ms)
   */
  shortSilence: () => createWAVBuffer(Buffer.alloc(3200), 16000), // 100ms silence at 16kHz

  /**
   * Medium silence for testing (500ms)
   */
  mediumSilence: () => createWAVBuffer(Buffer.alloc(16000), 16000), // 500ms silence

  /**
   * Short tone for testing (250ms, 440Hz)
   */
  shortTone: () => {
    const audio = generateSineWave(250, 440, 16000);
    return createWAVBuffer(audio, 16000);
  },

  /**
   * Speech-like pattern for testing (1 second)
   */
  speechPattern: () => {
    const audio = generateSpeechPattern(1000, 16000);
    return createWAVBuffer(audio, 16000);
  },

  /**
   * White noise for testing (500ms)
   */
  whiteNoise: () => {
    const audio = generateWhiteNoise(500, 16000);
    return createWAVBuffer(audio, 16000);
  },

  /**
   * Multiple tones for testing (combining frequencies)
   */
  multiFrequency: () => {
    const numSamples = 16000; // 1 second at 16kHz
    const audioData = Buffer.alloc(numSamples * 2);

    for (let i = 0; i < numSamples; i++) {
      const t = i / 16000;
      const f1 = Math.sin(t * 440 * 2 * Math.PI);
      const f2 = Math.sin(t * 880 * 2 * Math.PI) * 0.5;
      const sample = (f1 + f2) * 0.3 * 32767;
      audioData.writeInt16LE(Math.floor(sample), i * 2);
    }

    return createWAVBuffer(audioData, 16000);
  },

  /**
   * Low frequency audio (for testing bass response)
   */
  lowFrequency: () => {
    const audio = generateSineWave(500, 50, 16000); // 50Hz for 500ms
    return createWAVBuffer(audio, 16000);
  },

  /**
   * High frequency audio (for testing treble response)
   */
  highFrequency: () => {
    const audio = generateSineWave(500, 8000, 16000); // 8kHz for 500ms
    return createWAVBuffer(audio, 16000);
  },

  /**
   * Chirp (frequency sweep)
   */
  chirp: () => {
    const durationMs = 1000;
    const sampleRate = 16000;
    const numSamples = (durationMs * sampleRate) / 1000;
    const audioData = Buffer.alloc(numSamples * 2);

    const startFreq = 200;
    const endFreq = 2000;

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      const progress = t / (durationMs / 1000);
      const freq = startFreq + (endFreq - startFreq) * progress;

      const phase = (freq / sampleRate) * 2 * Math.PI;
      const sample = Math.sin(i * phase) * 0.3 * 32767;
      audioData.writeInt16LE(Math.floor(sample), i * 2);
    }

    return createWAVBuffer(audioData, sampleRate);
  },

  /**
   * Silence with click (for onset detection testing)
   */
  silenceWithClick: () => {
    const sampleRate = 16000;
    const audioData = Buffer.alloc(sampleRate * 2); // 2 seconds

    // Add click at 1 second mark
    const clickStart = sampleRate; // At 1 second
    for (let i = 0; i < 1600; i++) {
      // 100ms click
      const sample = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 0.5 * 32767;
      audioData.writeInt16LE(Math.floor(sample), (clickStart + i) * 2);
    }

    return createWAVBuffer(audioData, sampleRate);
  },
};

/**
 * Audio buffer utilities for testing
 */
export const AudioBufferUtils = {
  /**
   * Concatenate multiple audio buffers
   */
  concat: (buffers: Buffer[], sampleRate: number = 16000): Buffer => {
    return Buffer.concat(buffers);
  },

  /**
   * Repeat audio buffer N times
   */
  repeat: (buffer: Buffer, times: number): Buffer => {
    return Buffer.concat(Array(times).fill(buffer));
  },

  /**
   * Get duration in milliseconds of PCM audio
   */
  getDurationMs: (buffer: Buffer, sampleRate: number = 16000): number => {
    const numSamples = buffer.length / 2;
    return (numSamples / sampleRate) * 1000;
  },

  /**
   * Create silence of specified duration
   */
  silence: (durationMs: number, sampleRate: number = 16000): Buffer => {
    const numSamples = (durationMs * sampleRate) / 1000;
    return Buffer.alloc(numSamples * 2);
  },

  /**
   * Normalize audio to prevent clipping
   */
  normalize: (buffer: Buffer): Buffer => {
    let max = 0;

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      max = Math.max(max, Math.abs(sample));
    }

    if (max === 0) return buffer;

    const normalized = Buffer.alloc(buffer.length);
    const scale = 32767 / max;

    for (let i = 0; i < buffer.length; i += 2) {
      const sample = buffer.readInt16LE(i);
      const scaled = Math.floor(sample * scale);
      normalized.writeInt16LE(scaled, i);
    }

    return normalized;
  },

  /**
   * Fade in audio
   */
  fadeIn: (buffer: Buffer, durationMs: number = 500, sampleRate: number = 16000): Buffer => {
    const fadeSamples = (durationMs * sampleRate) / 1000;
    const faded = Buffer.from(buffer);

    for (let i = 0; i < Math.min(fadeSamples, buffer.length / 2); i++) {
      const sample = faded.readInt16LE(i * 2);
      const fade = i / fadeSamples;
      faded.writeInt16LE(Math.floor(sample * fade), i * 2);
    }

    return faded;
  },

  /**
   * Fade out audio
   */
  fadeOut: (buffer: Buffer, durationMs: number = 500, sampleRate: number = 16000): Buffer => {
    const fadeSamples = (durationMs * sampleRate) / 1000;
    const faded = Buffer.from(buffer);
    const totalSamples = buffer.length / 2;

    for (let i = Math.max(0, totalSamples - fadeSamples); i < totalSamples; i++) {
      const sample = faded.readInt16LE(i * 2);
      const fade = (totalSamples - i) / fadeSamples;
      faded.writeInt16LE(Math.floor(sample * fade), i * 2);
    }

    return faded;
  },

  /**
   * Resample audio buffer (simple downsampling)
   */
  resample: (
    buffer: Buffer,
    fromSampleRate: number,
    toSampleRate: number,
  ): Buffer => {
    const ratio = toSampleRate / fromSampleRate;
    const newLength = Math.floor(buffer.length * ratio);
    const resampled = Buffer.alloc(newLength);

    for (let i = 0; i < newLength / 2; i++) {
      const sourceIndex = Math.floor(i / ratio);
      const sample = buffer.readInt16LE(sourceIndex * 2);
      resampled.writeInt16LE(sample, i * 2);
    }

    return resampled;
  },
};
