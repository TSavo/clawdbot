/**
 * Audio Test Fixtures and Utilities
 *
 * Provides helper functions to generate test audio data without external files
 */
/**
 * Generate PCM audio data for testing
 * Creates a sine wave at the specified frequency
 */
export declare function generateSineWave(durationMs: number, frequency?: number, sampleRate?: number, amplitude?: number): Buffer;
/**
 * Generate white noise audio for testing
 */
export declare function generateWhiteNoise(durationMs: number, sampleRate?: number, amplitude?: number): Buffer;
/**
 * Generate spoken-like audio pattern (approximates speech characteristics)
 */
export declare function generateSpeechPattern(durationMs: number, sampleRate?: number): Buffer;
/**
 * Create a complete WAV file with proper RIFF headers
 */
export declare function createWAVBuffer(audioData: Buffer, sampleRate?: number, channels?: number, bitsPerSample?: number): Buffer;
/**
 * Create various test audio fixtures
 */
export declare const AudioFixtures: {
    /**
     * Short silence for testing (100ms)
     */
    shortSilence: () => Buffer<ArrayBufferLike>;
    /**
     * Medium silence for testing (500ms)
     */
    mediumSilence: () => Buffer<ArrayBufferLike>;
    /**
     * Short tone for testing (250ms, 440Hz)
     */
    shortTone: () => Buffer<ArrayBufferLike>;
    /**
     * Speech-like pattern for testing (1 second)
     */
    speechPattern: () => Buffer<ArrayBufferLike>;
    /**
     * White noise for testing (500ms)
     */
    whiteNoise: () => Buffer<ArrayBufferLike>;
    /**
     * Multiple tones for testing (combining frequencies)
     */
    multiFrequency: () => Buffer<ArrayBufferLike>;
    /**
     * Low frequency audio (for testing bass response)
     */
    lowFrequency: () => Buffer<ArrayBufferLike>;
    /**
     * High frequency audio (for testing treble response)
     */
    highFrequency: () => Buffer<ArrayBufferLike>;
    /**
     * Chirp (frequency sweep)
     */
    chirp: () => Buffer<ArrayBufferLike>;
    /**
     * Silence with click (for onset detection testing)
     */
    silenceWithClick: () => Buffer<ArrayBufferLike>;
};
/**
 * Audio buffer utilities for testing
 */
export declare const AudioBufferUtils: {
    /**
     * Concatenate multiple audio buffers
     */
    concat: (buffers: Buffer[], sampleRate?: number) => Buffer;
    /**
     * Repeat audio buffer N times
     */
    repeat: (buffer: Buffer, times: number) => Buffer;
    /**
     * Get duration in milliseconds of PCM audio
     */
    getDurationMs: (buffer: Buffer, sampleRate?: number) => number;
    /**
     * Create silence of specified duration
     */
    silence: (durationMs: number, sampleRate?: number) => Buffer;
    /**
     * Normalize audio to prevent clipping
     */
    normalize: (buffer: Buffer) => Buffer;
    /**
     * Fade in audio
     */
    fadeIn: (buffer: Buffer, durationMs?: number, sampleRate?: number) => Buffer;
    /**
     * Fade out audio
     */
    fadeOut: (buffer: Buffer, durationMs?: number, sampleRate?: number) => Buffer;
    /**
     * Resample audio buffer (simple downsampling)
     */
    resample: (buffer: Buffer, fromSampleRate: number, toSampleRate: number) => Buffer;
};
//# sourceMappingURL=audio-fixtures.d.ts.map