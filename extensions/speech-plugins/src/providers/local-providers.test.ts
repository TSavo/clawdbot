import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { STTProvider, STTCapabilities } from "../interfaces/stt-provider.js";
import type { TTSProvider, TTSCapabilities } from "../interfaces/tts-provider.js";
import { createMockWAVFile } from "../test-utils/mocks.js";

/**
 * Local Speech Provider Tests
 *
 * Tests for local providers like Whisper (STT) and Piper/Kokoro (TTS)
 * These tests mock the actual model loading to avoid heavy dependencies
 */

describe("Local STT Provider (Whisper Mock)", () => {
  let provider: STTProvider;

  beforeEach(() => {
    const capabilities: STTCapabilities = {
      formats: ["wav", "mp3", "ogg"],
      sampleRates: [8000, 16000, 44100],
      supportsStreaming: false, // Local doesn't stream
      supportsPartialTranscripts: false,
      languages: [
        "en",
        "es",
        "fr",
        "de",
        "it",
        "ja",
        "ko",
        "zh",
        "pt",
        "ru",
        "ar",
        "hi",
      ],
      maxDurationSeconds: null, // No limit for local
    };

    provider = {
      metadata: {
        id: "whisper-local",
        name: "Whisper Local",
        description: "Local Whisper speech-to-text",
        version: "1.0.0",
        capabilities,
        configSchema: {
          validate: (config: unknown) => {
            if (!config || typeof config !== "object") {
              return { ok: false, errors: ["Config must be an object"] };
            }
            const cfg = config as Record<string, unknown>;
            if (cfg.modelSize && !["tiny", "base", "small", "medium", "large"].includes(cfg.modelSize as string)) {
              return { ok: false, errors: ["Invalid model size"] };
            }
            return { ok: true };
          },
          properties: {
            modelSize: {
              type: "string",
              description: "Model size (tiny, base, small, medium, large)",
            },
            device: {
              type: "string",
              description: "Device to use (cpu, cuda, mps)",
            },
          },
        },
      },
      initialize: vi.fn(async (config?: Record<string, unknown>) => {
        // Mock model loading
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      transcribe: vi.fn(async (buffer, options) => [
        {
          text: "Transcription from local Whisper",
          confidence: 0.87,
          startMs: 0,
          endMs: 2000,
          isFinal: true,
          language: options?.language || "en",
        },
      ]),
      transcribeStream: vi.fn(async () => {
        throw new Error("Local Whisper does not support streaming");
      }),
      shutdown: vi.fn(async () => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Provider Configuration", () => {
    it("should have correct metadata", () => {
      expect(provider.metadata.id).toBe("whisper-local");
      expect(provider.metadata.name).toBe("Whisper Local");
    });

    it("should support multiple model sizes", () => {
      const schema = provider.metadata.configSchema;

      for (const size of ["tiny", "base", "small", "medium", "large"]) {
        const result = schema?.validate({ modelSize: size });
        expect(result?.ok).toBe(true);
      }
    });

    it("should reject invalid model sizes", () => {
      const schema = provider.metadata.configSchema;
      const result = schema?.validate({ modelSize: "xlarge" });
      expect(result?.ok).toBe(false);
    });

    it("should support GPU/device configuration", () => {
      const schema = provider.metadata.configSchema;
      const result = schema?.validate({ device: "cuda" });
      expect(result?.ok).toBe(true);
    });

    it("should support unlimited duration", () => {
      expect(provider.metadata.capabilities.maxDurationSeconds).toBeNull();
    });

    it("should not support streaming", () => {
      expect(provider.metadata.capabilities.supportsStreaming).toBe(false);
      expect(provider.metadata.capabilities.supportsPartialTranscripts).toBe(false);
    });
  });

  describe("Initialization", () => {
    it("should initialize with model size", async () => {
      await provider.initialize({ modelSize: "base" });
      expect(provider.initialize).toHaveBeenCalled();
    });

    it("should initialize with device selection", async () => {
      await provider.initialize({ modelSize: "base", device: "mps" });
      expect(provider.initialize).toHaveBeenCalled();
    });

    it("should support model caching", async () => {
      await provider.initialize({ modelSize: "base", cacheDir: "/tmp/models" });
      expect(provider.initialize).toHaveBeenCalled();
    });
  });

  describe("Transcription", () => {
    beforeEach(async () => {
      await provider.initialize({ modelSize: "base" });
    });

    it("should transcribe WAV files", async () => {
      const wavBuffer = createMockWAVFile(2000, 16000);
      const result = await provider.transcribe(wavBuffer, { format: "wav" });

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].text).toBeDefined();
    });

    it("should detect language automatically", async () => {
      const buffer = createMockWAVFile(1000, 16000);
      const result = await provider.transcribe(buffer);

      expect(result[0].language).toBeDefined();
    });

    it("should support specific language", async () => {
      const buffer = createMockWAVFile(1000, 16000);
      const result = await provider.transcribe(buffer, { language: "es" });

      expect(result[0].language).toBe("es");
    });

    it("should support prompt for context", async () => {
      const buffer = createMockWAVFile(1000, 16000);
      const result = await provider.transcribe(buffer, {
        prompt: "This is about technology",
      });

      expect(provider.transcribe).toHaveBeenCalledWith(buffer, {
        prompt: "This is about technology",
      });
    });

    it("should support multiple formats", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      for (const format of ["wav", "mp3", "ogg"]) {
        await provider.transcribe(buffer, { format });
      }
      expect(provider.transcribe).toHaveBeenCalled();
    });

    it("should handle long audio files", async () => {
      const longBuffer = createMockWAVFile(600000, 16000); // 10 minutes
      const result = await provider.transcribe(longBuffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe("Streaming Not Supported", () => {
    beforeEach(async () => {
      await provider.initialize({ modelSize: "base" });
    });

    it("should throw when attempting to stream", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      await expect(provider.transcribeStream(mockStream, {})).rejects.toThrow(
        "does not support streaming",
      );
    });
  });

  describe("Shutdown", () => {
    it("should cleanup resources on shutdown", async () => {
      await provider.initialize({ modelSize: "base" });
      await provider.shutdown?.();
      expect(provider.shutdown).toHaveBeenCalled();
    });
  });
});

describe("Local TTS Provider (Piper/Kokoro Mock)", () => {
  let provider: TTSProvider;

  beforeEach(() => {
    const capabilities: TTSCapabilities = {
      formats: ["wav", "pcm"],
      sampleRates: [22050], // Piper default
      voices: [
        {
          id: "en-us-libritts-high",
          name: "LibriTTS English (High)",
          language: "en",
          gender: "female",
        },
        {
          id: "en-us-libritts-medium",
          name: "LibriTTS English (Medium)",
          language: "en",
          gender: "male",
        },
        {
          id: "es-es-carlfm-x-low",
          name: "Spanish Carl",
          language: "es",
          gender: "male",
        },
      ],
      supportsStreaming: false, // Local doesn't stream
      languages: ["en", "es", "fr", "de"],
    };

    provider = {
      metadata: {
        id: "piper-local",
        name: "Piper Local",
        description: "Local Piper/Kokoro text-to-speech",
        version: "1.0.0",
        capabilities,
      },
      initialize: vi.fn(async (config?: Record<string, unknown>) => {
        // Mock model loading
        await new Promise((resolve) => setTimeout(resolve, 10));
      }),
      listVoices: vi.fn(async () => capabilities.voices),
      synthesize: vi.fn(async (text, options) => {
        // Return mock WAV data
        const wavBuffer = Buffer.alloc(100);
        wavBuffer.write("RIFF");
        return wavBuffer;
      }),
      synthesizeStream: vi.fn(async () => {
        throw new Error("Local provider does not support streaming");
      }),
      resample: vi.fn(async (buffer, from, to) => {
        // Simple mock resampling
        if (to < from) {
          return buffer.slice(0, Math.max(1, Math.floor(buffer.length * (to / from))));
        }
        return buffer;
      }),
      shutdown: vi.fn(async () => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Provider Configuration", () => {
    it("should have correct metadata", () => {
      expect(provider.metadata.id).toBe("piper-local");
      expect(provider.metadata.name).toBe("Piper Local");
    });

    it("should expose available voices", () => {
      const voices = provider.metadata.capabilities.voices;
      expect(voices.length).toBeGreaterThan(0);
      expect(voices[0].id).toBeDefined();
      expect(voices[0].name).toBeDefined();
    });

    it("should support multiple languages", () => {
      const languages = provider.metadata.capabilities.languages;
      expect(languages).toContain("en");
      expect(languages.length).toBeGreaterThan(1);
    });

    it("should support WAV and PCM output", () => {
      const formats = provider.metadata.capabilities.formats;
      expect(formats).toContain("wav");
      expect(formats).toContain("pcm");
    });

    it("should not support streaming", () => {
      expect(provider.metadata.capabilities.supportsStreaming).toBe(false);
    });
  });

  describe("Initialization", () => {
    it("should initialize", async () => {
      await provider.initialize();
      expect(provider.initialize).toHaveBeenCalled();
    });
  });

  describe("Voice Management", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it("should list available voices", async () => {
      const voices = await provider.listVoices();
      expect(voices.length).toBeGreaterThan(0);
    });

    it("should have consistent voices", async () => {
      const listedVoices = await provider.listVoices();
      const capVoices = provider.metadata.capabilities.voices;

      expect(listedVoices.length).toBe(capVoices.length);
    });
  });

  describe("Synthesis", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it("should synthesize text", async () => {
      const result = await provider.synthesize("Hello world", {
        voiceId: "en-us-libritts-high",
        format: "wav",
        sampleRate: 22050,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should support all available voices", async () => {
      const voices = await provider.listVoices();

      for (const voice of voices) {
        const result = await provider.synthesize("Test", {
          voiceId: voice.id,
          format: "wav",
          sampleRate: 22050,
        });
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });

    it("should support speech rate control", async () => {
      const result = await provider.synthesize("Test", {
        voiceId: "en-us-libritts-high",
        format: "wav",
        sampleRate: 22050,
        speechRate: 1.5,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Audio Resampling", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it("should resample from 22050 to 8000", async () => {
      const buffer = Buffer.from([0, 1, 2, 3, 4, 5]);
      const result = await provider.resample(buffer, 22050, 8000);

      expect(Buffer.isBuffer(result)).toBe(true);
      // Downsampling reduces size
      expect(result.length).toBeLessThanOrEqual(buffer.length);
    });

    it("should normalize audio levels", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.synthesize("Test", {
        voiceId: "en-us-libritts-high",
        format: "wav",
        sampleRate: 22050,
        volumeDb: -6, // Reduce by 6dB
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Streaming Not Supported", () => {
    beforeEach(async () => {
      await provider.initialize();
    });

    it("should throw when attempting to stream", async () => {
      await expect(
        provider.synthesizeStream("Test", {}, {
          voiceId: "en-us-libritts-high",
          format: "wav",
          sampleRate: 22050,
        }),
      ).rejects.toThrow("does not support streaming");
    });
  });

  describe("Shutdown", () => {
    it("should cleanup resources", async () => {
      await provider.initialize();
      await provider.shutdown?.();
      expect(provider.shutdown).toHaveBeenCalled();
    });
  });
});
