import { vi } from "vitest";
/**
 * Create a mock STT provider for testing
 */
export function createMockSTTProvider(id = "mock-stt") {
    const capabilities = {
        formats: ["wav", "mp3"],
        sampleRates: [8000, 16000],
        supportsStreaming: true,
        supportsPartialTranscripts: true,
        languages: ["en", "es"],
        maxDurationSeconds: 600,
    };
    return {
        metadata: {
            id,
            name: `Mock STT ${id}`,
            description: "Mock STT provider for testing",
            version: "1.0.0",
            capabilities,
        },
        initialize: vi.fn(async () => { }),
        transcribe: vi.fn(async (buffer, options) => [
            {
                text: "Mock transcription",
                confidence: 0.95,
                startMs: 0,
                endMs: 1000,
                isFinal: true,
                language: options?.language || "en",
            },
        ]),
        transcribeStream: vi.fn(async (stream, callbacks) => {
            if (callbacks.onTranscript) {
                callbacks.onTranscript({
                    type: "transcript",
                    segments: [
                        {
                            text: "Mock stream transcription",
                            confidence: 0.9,
                            startMs: 0,
                            endMs: 500,
                            isFinal: true,
                        },
                    ],
                });
            }
            if (callbacks.onComplete) {
                callbacks.onComplete([
                    {
                        text: "Mock stream transcription",
                        confidence: 0.9,
                        startMs: 0,
                        endMs: 500,
                        isFinal: true,
                    },
                ]);
            }
        }),
        shutdown: vi.fn(async () => { }),
    };
}
/**
 * Create a mock TTS provider for testing
 */
export function createMockTTSProvider(id = "mock-tts") {
    const voices = [
        {
            id: "voice-1",
            name: "Alice",
            language: "en",
            gender: "female",
        },
        {
            id: "voice-2",
            name: "Bob",
            language: "en",
            gender: "male",
        },
    ];
    const capabilities = {
        formats: ["wav", "mp3", "pcm", "ulaw"],
        sampleRates: [8000, 16000, 24000],
        voices,
        supportsStreaming: true,
        languages: ["en", "es"],
    };
    return {
        metadata: {
            id,
            name: `Mock TTS ${id}`,
            description: "Mock TTS provider for testing",
            version: "1.0.0",
            capabilities,
        },
        initialize: vi.fn(async () => { }),
        listVoices: vi.fn(async () => voices),
        synthesize: vi.fn(async (text, options) => {
            // Return a fake WAV header + some audio data
            return Buffer.from([
                0x52, 0x49, 0x46, 0x46, // "RIFF"
                0x24, 0x00, 0x00, 0x00, // File size
                0x57, 0x41, 0x56, 0x45, // "WAVE"
                0x66, 0x6d, 0x74, 0x20, // "fmt "
                0x10, 0x00, 0x00, 0x00, // Subchunk1Size
                0x01, 0x00, 0x01, 0x00, // AudioFormat, NumChannels
                0x10, 0x27, 0x00, 0x00, // SampleRate (10000 Hz)
                0x20, 0x4e, 0x00, 0x00, // ByteRate
                0x02, 0x00, 0x10, 0x00, // BlockAlign, BitsPerSample
                0x64, 0x61, 0x74, 0x61, // "data"
                0x00, 0x00, 0x00, 0x00, // Subchunk2Size
            ]);
        }),
        synthesizeStream: vi.fn(async (text, callbacks) => {
            if (callbacks.onAudio) {
                callbacks.onAudio(Buffer.from([0, 1, 2, 3]));
            }
            if (callbacks.onComplete) {
                callbacks.onComplete();
            }
        }),
        resample: vi.fn(async (buffer, from, to) => {
            // Simple mock resampling (just return a smaller buffer for downsampling)
            if (to < from) {
                return buffer.slice(0, Math.max(1, Math.floor(buffer.length * (to / from))));
            }
            return buffer;
        }),
        shutdown: vi.fn(async () => { }),
    };
}
/**
 * Create mock test audio buffer (minimal WAV data)
 */
export function createMockAudioBuffer(durationMs = 1000, sampleRate = 16000) {
    const numSamples = (durationMs * sampleRate) / 1000;
    const audioData = Buffer.alloc(numSamples * 2);
    // Generate a simple sine wave pattern
    for (let i = 0; i < numSamples; i++) {
        const sample = Math.sin((i / sampleRate) * 440 * 2 * Math.PI) * 32767;
        audioData.writeInt16LE(Math.floor(sample), i * 2);
    }
    return audioData;
}
/**
 * Create a complete mock WAV file
 */
export function createMockWAVFile(durationMs = 1000, sampleRate = 16000) {
    const audioData = createMockAudioBuffer(durationMs, sampleRate);
    const byteRate = sampleRate * 2;
    const blockAlign = 2;
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
    // Channels (1 = mono)
    header.writeUInt16LE(1, offset);
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
    header.writeUInt16LE(16, offset);
    offset += 2;
    // data subchunk
    header.write("data", offset);
    offset += 4;
    // data subchunk size
    header.writeUInt32LE(subChunk2Size, offset);
    return Buffer.concat([header, audioData]);
}
/**
 * Create a readable stream from buffer (for testing stream APIs)
 */
export function createMockStream(data) {
    const { Readable } = require("stream");
    return Readable.from([data]);
}
/**
 * Create error stubs for provider testing
 */
export function createErrorSTTProvider(id, errorMessage) {
    const provider = createMockSTTProvider(id);
    const error = new Error(errorMessage);
    provider.initialize = vi.fn(async () => {
        throw error;
    });
    provider.transcribe = vi.fn(async () => {
        throw error;
    });
    return provider;
}
/**
 * Create error stubs for TTS testing
 */
export function createErrorTTSProvider(id, errorMessage) {
    const provider = createMockTTSProvider(id);
    const error = new Error(errorMessage);
    provider.initialize = vi.fn(async () => {
        throw error;
    });
    provider.synthesize = vi.fn(async () => {
        throw error;
    });
    return provider;
}
//# sourceMappingURL=mocks.js.map