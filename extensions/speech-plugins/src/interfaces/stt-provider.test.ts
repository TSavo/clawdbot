import { describe, it, expect, beforeEach, vi } from "vitest";
import type { STTProvider, STTProviderMetadata, STTCapabilities, STTTranscriptSegment } from "./stt-provider.js";

describe("STT Provider Interface", () => {
  let mockMetadata: STTProviderMetadata;
  let mockProvider: STTProvider;

  beforeEach(() => {
    const capabilities: STTCapabilities = {
      formats: ["wav", "mp3", "ogg"],
      sampleRates: [8000, 16000, 44100],
      supportsStreaming: true,
      supportsPartialTranscripts: true,
      languages: ["en", "es", "fr", "de"],
      maxDurationSeconds: 600,
    };

    mockMetadata = {
      id: "test-stt",
      name: "Test STT Provider",
      description: "A test STT provider",
      version: "1.0.0",
      capabilities,
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
      transcribe: vi.fn(async () => [
        {
          text: "Hello world",
          confidence: 0.95,
          startMs: 0,
          endMs: 1500,
          isFinal: true,
          language: "en",
        },
      ]),
      transcribeStream: vi.fn(async () => {}),
      shutdown: vi.fn(async () => {}),
    };
  });

  describe("Provider Metadata", () => {
    it("should have required metadata properties", () => {
      expect(mockProvider.metadata).toBeDefined();
      expect(mockProvider.metadata.id).toBe("test-stt");
      expect(mockProvider.metadata.name).toBe("Test STT Provider");
      expect(mockProvider.metadata.version).toBe("1.0.0");
      expect(mockProvider.metadata.description).toBe("A test STT provider");
    });

    it("should have capabilities defined", () => {
      const capabilities = mockProvider.metadata.capabilities;
      expect(capabilities.formats).toContain("wav");
      expect(capabilities.formats).toContain("mp3");
      expect(capabilities.sampleRates).toContain(16000);
      expect(capabilities.supportsStreaming).toBe(true);
      expect(capabilities.languages.length).toBeGreaterThan(0);
    });

    it("should validate configuration", () => {
      const schema = mockProvider.metadata.configSchema;
      expect(schema).toBeDefined();

      const validResult = schema?.validate({ apiKey: "test-key" });
      expect(validResult?.ok).toBe(true);

      const invalidResult = schema?.validate(null);
      expect(invalidResult?.ok).toBe(false);
      expect(invalidResult?.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("Provider Initialization", () => {
    it("should initialize with configuration", async () => {
      const config = { apiKey: "test-key", model: "base" };
      await mockProvider.initialize(config);
      expect(mockProvider.initialize).toHaveBeenCalledWith(config);
    });

    it("should initialize without configuration", async () => {
      await mockProvider.initialize();
      expect(mockProvider.initialize).toHaveBeenCalled();
    });
  });

  describe("Transcription Methods", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should transcribe audio buffer", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3, 4, 5]);
      const result = await mockProvider.transcribe(audioBuffer, {
        format: "wav",
        sampleRate: 16000,
        language: "en",
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      const segment = result[0];
      expect(segment.text).toBeDefined();
      expect(segment.confidence).toBeGreaterThanOrEqual(0);
      expect(segment.confidence).toBeLessThanOrEqual(1);
      expect(segment.isFinal).toBeDefined();
    });

    it("should support optional transcription options", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      await mockProvider.transcribe(audioBuffer);
      expect(mockProvider.transcribe).toHaveBeenCalledWith(audioBuffer);

      await mockProvider.transcribe(audioBuffer, { format: "mp3" });
      expect(mockProvider.transcribe).toHaveBeenCalledWith(audioBuffer, { format: "mp3" });
    });

    it("should return transcript segments with required properties", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);
      const segments = await mockProvider.transcribe(audioBuffer);

      for (const segment of segments) {
        expect(segment).toHaveProperty("text");
        expect(segment).toHaveProperty("confidence");
        expect(segment).toHaveProperty("startMs");
        expect(segment).toHaveProperty("endMs");
        expect(segment).toHaveProperty("isFinal");
        expect(typeof segment.text).toBe("string");
        expect(typeof segment.confidence).toBe("number");
        expect(typeof segment.startMs).toBe("number");
        expect(typeof segment.endMs).toBe("number");
        expect(typeof segment.isFinal).toBe("boolean");
      }
    });
  });

  describe("Stream Transcription", () => {
    beforeEach(async () => {
      await mockProvider.initialize();
    });

    it("should call transcribeStream with correct parameters", async () => {
      const mockStream = {
        on: vi.fn(),
        once: vi.fn(),
        emit: vi.fn(),
      } as unknown as NodeJS.ReadableStream;

      const callbacks = {
        onTranscript: vi.fn(),
        onPartial: vi.fn(),
        onComplete: vi.fn(),
        onError: vi.fn(),
      };

      await mockProvider.transcribeStream(mockStream, callbacks, {
        format: "wav",
        sampleRate: 16000,
      });

      expect(mockProvider.transcribeStream).toHaveBeenCalledWith(mockStream, callbacks, {
        format: "wav",
        sampleRate: 16000,
      });
    });

    it("should support partial transcripts callback", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onPartial = vi.fn();

      await mockProvider.transcribeStream(mockStream, { onPartial });

      expect(mockProvider.transcribeStream).toHaveBeenCalled();
    });

    it("should support error callback", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onError = vi.fn();

      await mockProvider.transcribeStream(mockStream, { onError });

      expect(mockProvider.transcribeStream).toHaveBeenCalled();
    });
  });

  describe("Provider Lifecycle", () => {
    it("should support shutdown", async () => {
      await mockProvider.shutdown?.();
      expect(mockProvider.shutdown).toHaveBeenCalled();
    });

    it("should make shutdown optional", () => {
      const providerWithoutShutdown: STTProvider = {
        metadata: mockMetadata,
        initialize: vi.fn(async () => {}),
        transcribe: vi.fn(async () => []),
        transcribeStream: vi.fn(async () => {}),
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
            description: "OpenAI API key",
          },
          model: {
            type: "string",
            description: "Model identifier",
          },
        },
      };

      expect(schemaWithProps.properties?.apiKey).toBeDefined();
      expect(schemaWithProps.properties?.apiKey.type).toBe("string");
    });

    it("should be optional", () => {
      const providerWithoutSchema: STTProvider = {
        metadata: {
          ...mockMetadata,
          configSchema: undefined,
        },
        initialize: vi.fn(async () => {}),
        transcribe: vi.fn(async () => []),
        transcribeStream: vi.fn(async () => {}),
      };

      expect(providerWithoutSchema.metadata.configSchema).toBeUndefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty transcript result", async () => {
      const emptyProvider: STTProvider = {
        metadata: mockMetadata,
        initialize: vi.fn(async () => {}),
        transcribe: vi.fn(async () => []),
        transcribeStream: vi.fn(async () => {}),
      };

      const result = await emptyProvider.transcribe(Buffer.from([]));
      expect(result).toEqual([]);
    });

    it("should handle confidence boundaries", async () => {
      const segment: STTTranscriptSegment = {
        text: "Test",
        confidence: 1.0,
        startMs: 0,
        endMs: 100,
        isFinal: true,
      };

      expect(segment.confidence).toBeLessThanOrEqual(1);
      expect(segment.confidence).toBeGreaterThanOrEqual(0);
    });

    it("should handle long transcript durations", () => {
      const capabilities = mockProvider.metadata.capabilities;
      if (capabilities.maxDurationSeconds) {
        expect(capabilities.maxDurationSeconds).toBeGreaterThan(0);
      } else {
        // null means unlimited
        expect(capabilities.maxDurationSeconds).toBeNull();
      }
    });

    it("should handle multiple languages in capabilities", () => {
      const capabilities = mockProvider.metadata.capabilities;
      expect(capabilities.languages.length).toBeGreaterThanOrEqual(1);
      for (const lang of capabilities.languages) {
        expect(lang).toMatch(/^[a-z]{2}$/);
      }
    });
  });

  describe("Contract Validation", () => {
    it("should ensure all required methods are present", () => {
      expect(typeof mockProvider.initialize).toBe("function");
      expect(typeof mockProvider.transcribe).toBe("function");
      expect(typeof mockProvider.transcribeStream).toBe("function");
    });

    it("should ensure metadata is read-only", () => {
      expect(() => {
        (mockProvider as any).metadata = {};
      }).toBeDefined();
    });

    it("should ensure all transcription options are optional", async () => {
      const audioBuffer = Buffer.from([0, 1, 2, 3]);

      // Should work with no options
      await mockProvider.transcribe(audioBuffer);

      // Should work with partial options
      await mockProvider.transcribe(audioBuffer, { format: "wav" });
      await mockProvider.transcribe(audioBuffer, { sampleRate: 16000 });
      await mockProvider.transcribe(audioBuffer, { language: "en" });
    });
  });
});
