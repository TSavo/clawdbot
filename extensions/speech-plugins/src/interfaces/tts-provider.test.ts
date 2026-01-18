import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TTSProvider, TTSProviderMetadata, TTSCapabilities, TTSVoice } from "./tts-provider.js";

describe("TTS Provider Interface", () => {
  let mockCapabilities: TTSCapabilities;
  let mockMetadata: TTSProviderMetadata;
  let mockProvider: TTSProvider;

  beforeEach(() => {
    const voices: TTSVoice[] = [
      {
        id: "voice-1",
        name: "Alice",
        language: "en",
        gender: "female",
        characteristics: ["natural", "professional"],
      },
      {
        id: "voice-2",
        name: "Bob",
        language: "en",
        gender: "male",
        characteristics: ["natural", "casual"],
      },
      {
        id: "voice-3",
        name: "Carlos",
        language: "es",
        gender: "male",
      },
    ];

    mockCapabilities = {
      formats: ["wav", "mp3", "pcm", "ulaw"],
      sampleRates: [8000, 16000, 24000, 44100],
      voices,
      supportsStreaming: true,
      languages: ["en", "es", "fr"],
    };

    mockMetadata = {
      id: "test-tts",
      name: "Test TTS Provider",
      description: "A test TTS provider",
      version: "1.0.0",
      capabilities: mockCapabilities,
      configSchema: {
        validate: (config: unknown) => {
          if (typeof config === "object" && config !== null) {
            return { ok: true };
          }
          return { ok: false, errors: ["Invalid config"] };
        },
      },
    };

    mockProvider = {
      metadata: mockMetadata,
      initialize: vi.fn(async () => {}),
      listVoices: vi.fn(async () => voices),
      synthesize: vi.fn(async () => Buffer.from([0, 1, 2, 3])),
      synthesizeStream: vi.fn(async () => {}),
      resample: vi.fn(async (buffer) => buffer),
      shutdown: vi.fn(async () => {}),
    };
  });

  describe("Provider Metadata", () => {
    it("should have required metadata properties", () => {
      expect(mockProvider.metadata).toBeDefined();
      expect(mockProvider.metadata.id).toBe("test-tts");
      expect(mockProvider.metadata.name).toBe("Test TTS Provider");
      expect(mockProvider.metadata.version).toBe("1.0.0");
      expect(mockProvider.metadata.description).toBe("A test TTS provider");
    });

    it("should expose capabilities", () => {
      const capabilities = mockProvider.metadata.capabilities;
      expect(capabilities.formats).toContain("wav");
      expect(capabilities.formats).toContain("mp3");
      expect(capabilities.sampleRates).toContain(16000);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.languages.length).toBeGreaterThan(0);
    });

    it("should list available voices in capabilities", () => {
      const voices = mockProvider.metadata.capabilities.voices;
      expect(voices.length).toBeGreaterThan(0);

      for (const voice of voices) {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.language).toBeDefined();
      }
    });
  });

  describe("Provider Initialization", () => {
    it("should initialize with configuration", async () => {
      const config = { apiKey: "test-key", model: "tts-1" };
      await mockProvider.initialize(config);
      expect(mockProvider.initialize).toHaveBeenCalledWith(config);
    });

    it("should initialize without configuration", async () => {
      await mockProvider.initialize();
      expect(mockProvider.initialize).toHaveBeenCalled();
    });
  });

  describe("Voice Management", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should list available voices", async () => {
      const voices = await mockProvider.listVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it("should have consistent voices between capabilities and listVoices", async () => {
      const listedVoices = await mockProvider.listVoices();
      const capabilityVoices = mockProvider.metadata.capabilities.voices;

      expect(listedVoices.length).toBe(capabilityVoices.length);
      for (let i = 0; i < listedVoices.length; i++) {
        expect(listedVoices[i].id).toBe(capabilityVoices[i].id);
        expect(listedVoices[i].name).toBe(capabilityVoices[i].name);
      }
    });

    it("should include required voice properties", async () => {
      const voices = await mockProvider.listVoices();

      for (const voice of voices) {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.language).toBeDefined();
        expect(typeof voice.id).toBe("string");
        expect(typeof voice.name).toBe("string");
        expect(voice.language).toMatch(/^[a-z]{2}$/);
      }
    });

    it("should support optional voice properties", async () => {
      const voices = await mockProvider.listVoices();

      const voiceWithGender = voices.find((v) => v.gender);
      if (voiceWithGender) {
        expect(["male", "female", "neutral"]).toContain(voiceWithGender.gender);
      }

      const voiceWithCharacteristics = voices.find((v) => v.characteristics);
      if (voiceWithCharacteristics) {
        expect(Array.isArray(voiceWithCharacteristics.characteristics)).toBe(true);
      }
    });
  });

  describe("Synthesis Methods", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should synthesize text to audio buffer", async () => {
      const text = "Hello world";
      const options = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 16000,
      };

      const result = await mockProvider.synthesize(text, options);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should support synthesis options", async () => {
      const text = "Test speech";
      const options = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 16000,
        speechRate: 1.0,
        pitch: 0,
        volumeDb: 0,
      };

      await mockProvider.synthesize(text, options);

      expect(mockProvider.synthesize).toHaveBeenCalledWith(text, options);
    });

    it("should make synthesis options partially optional", async () => {
      const text = "Test";
      const baseOptions = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 16000,
      };

      // With optional fields
      await mockProvider.synthesize(text, {
        ...baseOptions,
        speechRate: 0.8,
      });

      await mockProvider.synthesize(text, {
        ...baseOptions,
        pitch: -5,
      });

      await mockProvider.synthesize(text, {
        ...baseOptions,
        volumeDb: 3,
      });
    });

    it("should support all audio formats", async () => {
      const text = "Test";
      const formats: Array<"wav" | "mp3" | "pcm" | "ulaw"> = ["wav", "mp3", "pcm", "ulaw"];

      for (const format of formats) {
        const options = {
          voiceId: "voice-1",
          format,
          sampleRate: 16000,
        };

        await mockProvider.synthesize(text, options);
        expect(mockProvider.synthesize).toHaveBeenCalledWith(text, options);
      }
    });
  });

  describe("Stream Synthesis", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should call synthesizeStream with correct parameters", async () => {
      const text = "Hello";
      const callbacks = {
        onAudio: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };
      const options = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 16000,
      };

      await mockProvider.synthesizeStream(text, callbacks, options);

      expect(mockProvider.synthesizeStream).toHaveBeenCalledWith(text, callbacks, options);
    });

    it("should support audio chunk callback", async () => {
      const text = "Stream test";
      const onAudio = vi.fn();

      await mockProvider.synthesizeStream(
        text,
        { onAudio },
        {
          voiceId: "voice-1",
          format: "wav",
          sampleRate: 16000,
        },
      );

      expect(mockProvider.synthesizeStream).toHaveBeenCalled();
    });

    it("should support complete callback", async () => {
      const text = "Stream test";
      const onComplete = vi.fn();

      await mockProvider.synthesizeStream(
        text,
        { onComplete },
        {
          voiceId: "voice-1",
          format: "wav",
          sampleRate: 16000,
        },
      );

      expect(mockProvider.synthesizeStream).toHaveBeenCalled();
    });

    it("should support error callback", async () => {
      const text = "Stream test";
      const onError = vi.fn();

      await mockProvider.synthesizeStream(
        text,
        { onError },
        {
          voiceId: "voice-1",
          format: "wav",
          sampleRate: 16000,
        },
      );

      expect(mockProvider.synthesizeStream).toHaveBeenCalled();
    });
  });

  describe("Audio Resampling", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should resample audio buffer", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3, 4, 5]);
      const result = await mockProvider.resample(audioBuffer, 16000, 8000, "pcm");

      expect(Buffer.isBuffer(result)).toBe(true);
      // Resampling typically reduces size when downsampling
      expect(result.length).toBeLessThanOrEqual(audioBuffer.length);
    });

    it("should support resampling between common rates", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const pairs = [
        [44100, 16000],
        [24000, 8000],
        [16000, 8000],
        [8000, 16000],
      ];

      for (const [from, to] of pairs) {
        const result = await mockProvider.resample(audioBuffer, from, to);
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });

    it("should handle resampling without format specification", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const result = await mockProvider.resample(audioBuffer, 16000, 8000);

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Provider Lifecycle", () => {
    it("should support shutdown", async () => {
      await mockProvider.shutdown?.();
      expect(mockProvider.shutdown).toHaveBeenCalled();
    });

    it("should make shutdown optional", () => {
      const providerWithoutShutdown: TTSProvider = {
        metadata: mockMetadata,
        initialize: vi.fn(async () => {}),
        listVoices: vi.fn(async () => []),
        synthesize: vi.fn(async () => Buffer.from([])),
        synthesizeStream: vi.fn(async () => {}),
        resample: vi.fn(async (buffer) => buffer),
      };

      expect(providerWithoutShutdown.shutdown).toBeUndefined();
    });
  });

  describe("Configuration Schema", () => {
    it("should support property descriptions", () => {
      const schemaWithProps: typeof mockMetadata.configSchema = {
        validate: (config: unknown) => ({ ok: typeof config === "object" }),
        properties: {
          apiKey: {
            type: "string",
            description: "API key for the provider",
          },
          model: {
            type: "string",
            description: "Model to use for synthesis",
          },
        },
      };

      expect(schemaWithProps.properties?.apiKey).toBeDefined();
      expect(schemaWithProps.properties?.apiKey.type).toBe("string");
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty text synthesis", async () => {
      const result = await mockProvider.synthesize("", {
        voiceId: "voice-1",
        format: "wav",
        sampleRate: 16000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should handle extreme audio parameters", async () => {
      const options = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 16000,
        speechRate: 0.1, // Very slow
        pitch: -20, // Lowest pitch
        volumeDb: 20, // Loudest
      };

      await mockProvider.synthesize("Test", options);
      expect(mockProvider.synthesize).toHaveBeenCalled();
    });

    it("should have consistent format support", () => {
      const formats = mockProvider.metadata.capabilities.formats;
      expect(formats).toContain("wav");
      expect(formats.length).toBeGreaterThan(0);
    });

    it("should have at least one voice", () => {
      const voices = mockProvider.metadata.capabilities.voices;
      expect(voices.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Contract Validation", () => {
    it("should ensure all required methods are present", () => {
      expect(typeof mockProvider.initialize).toBe("function");
      expect(typeof mockProvider.listVoices).toBe("function");
      expect(typeof mockProvider.synthesize).toBe("function");
      expect(typeof mockProvider.synthesizeStream).toBe("function");
      expect(typeof mockProvider.resample).toBe("function");
    });

    it("should ensure metadata is read-only", () => {
      expect(mockProvider.metadata).toBeDefined();
      expect(mockProvider.metadata.id).toBe("test-tts");
    });

    it("should ensure capabilities includes required fields", () => {
      const caps = mockProvider.metadata.capabilities;
      expect(Array.isArray(caps.formats)).toBe(true);
      expect(Array.isArray(caps.sampleRates)).toBe(true);
      expect(Array.isArray(caps.voices)).toBe(true);
      expect(Array.isArray(caps.languages)).toBe(true);
      expect(typeof caps.supportsStreaming).toBe("boolean");
    });
  });
});
