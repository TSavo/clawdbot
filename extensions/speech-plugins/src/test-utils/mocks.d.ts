import type { STTProvider } from "../interfaces/stt-provider.js";
import type { TTSProvider } from "../interfaces/tts-provider.js";
/**
 * Create a mock STT provider for testing
 */
export declare function createMockSTTProvider(id?: string): STTProvider;
/**
 * Create a mock TTS provider for testing
 */
export declare function createMockTTSProvider(id?: string): TTSProvider;
/**
 * Create mock test audio buffer (minimal WAV data)
 */
export declare function createMockAudioBuffer(durationMs?: number, sampleRate?: number): Buffer;
/**
 * Create a complete mock WAV file
 */
export declare function createMockWAVFile(durationMs?: number, sampleRate?: number): Buffer;
/**
 * Create a readable stream from buffer (for testing stream APIs)
 */
export declare function createMockStream(data: Buffer): NodeJS.ReadableStream;
/**
 * Create error stubs for provider testing
 */
export declare function createErrorSTTProvider(id: string, errorMessage: string): STTProvider;
/**
 * Create error stubs for TTS testing
 */
export declare function createErrorTTSProvider(id: string, errorMessage: string): TTSProvider;
//# sourceMappingURL=mocks.d.ts.map