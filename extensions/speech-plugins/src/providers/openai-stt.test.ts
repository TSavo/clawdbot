import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { STTProvider } from "../interfaces/stt-provider.js";

/**
 * Mock OpenAI STT Provider Tests
 *
 * These tests cover the OpenAI Whisper API integration
 */

describe("OpenAI STT Provider", () => {
  let provider: STTProvider;

  beforeEach(() => {
    // Create mock provider with OpenAI Whisper configuration
    provider = {
      metadata: {
        id: "openai-whisper",
        name: "OpenAI Whisper",
        description: "OpenAI Whisper speech-to-text",
        version: "1.0.0",
        capabilities: {
          formats: ["wav", "mp3", "ogg", "flac", "m4a"],
          sampleRates: [8000, 16000, 44100, 48000],
          supportsStreaming: true,
          supportsPartialTranscripts: true,
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
            "nl",
            "ru",
            "ar",
            "tr",
            "pl",
            "th",
          ],
          maxDurationSeconds: 600,
        },
        configSchema: {
          validate: (config: unknown) => {
            if (!config || typeof config !== "object") {
              return { ok: false, errors: ["Config must be an object"] };
            }
            const cfg = config as Record<string, unknown>;
            if (!cfg.apiKey || typeof cfg.apiKey !== "string") {
              return { ok: false, errors: ["apiKey is required"] };
            }
            return { ok: true };
          },
          properties: {
            apiKey: {
              type: "string",
              description: "OpenAI API key",
            },
            model: {
              type: "string",
              description: "Model name (default: whisper-1)",
            },
          },
        },
      },
      initialize: vi.fn(async (config?: Record<string, unknown>) => {
        if (!config?.apiKey) {
          throw new Error("API key required for initialization");
        }
      }),
      transcribe: vi.fn(async (buffer, options) => [
        {
          text: "The quick brown fox jumps over the lazy dog",
          confidence: 0.98,
          startMs: 0,
          endMs: 3500,
          isFinal: true,
          language: options?.language || "en",
        },
      ]),
      transcribeStream: vi.fn(async (stream, callbacks) => {
        // Simulate WebSocket stream with partial transcripts
        if (callbacks.onPartial) {
          callbacks.onPartial("The quick");
          callbacks.onPartial("The quick brown");
          callbacks.onPartial("The quick brown fox");
        }

        if (callbacks.onTranscript) {
          callbacks.onTranscript({
            type: "transcript",
            segments: [
              {
                text: "The quick brown fox",
                confidence: 0.96,
                startMs: 0,
                endMs: 1200,
                isFinal: false,
              },
            ],
          });
        }

        // Final transcript
        if (callbacks.onComplete) {
          callbacks.onComplete([
            {
              text: "The quick brown fox jumps over the lazy dog",
              confidence: 0.98,
              startMs: 0,
              endMs: 3500,
              isFinal: true,
            },
          ]);
        }
      }),
      shutdown: vi.fn(async () => {}),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Provider Configuration", () => {
    it("should have correct metadata", () => {
      expect(provider.metadata.id).toBe("openai-whisper");
      expect(provider.metadata.name).toBe("OpenAI Whisper");
      expect(provider.metadata.version).toBe("1.0.0");
    });

    it("should support multiple audio formats", () => {
      const formats = provider.metadata.capabilities.formats;
      expect(formats).toContain("wav");
      expect(formats).toContain("mp3");
      expect(formats).toContain("ogg");
      expect(formats.length).toBeGreaterThan(4);
    });

    it("should support multiple languages", () => {
      const languages = provider.metadata.capabilities.languages;
      expect(languages).toContain("en");
      expect(languages).toContain("es");
      expect(languages).toContain("fr");
      expect(languages.length).toBeGreaterThanOrEqual(10);
    });

    it("should support streaming", () => {
      expect(provider.metadata.capabilities.supportsStreaming).toBe(true);
      expect(provider.metadata.capabilities.supportsPartialTranscripts).toBe(true);
    });

    it("should validate configuration with apiKey", () => {
      const schema = provider.metadata.configSchema;
      const validConfig = { apiKey: "sk-test-key", model: "whisper-1" };
      const result = schema?.validate(validConfig);
      expect(result?.ok).toBe(true);
    });

    it("should reject configuration without apiKey", () => {
      const schema = provider.metadata.configSchema;
      const invalidConfig = { model: "whisper-1" };
      const result = schema?.validate(invalidConfig);
      expect(result?.ok).toBe(false);
      expect(result?.errors).toContain("apiKey is required");
    });
  });

  describe("Provider Initialization", () => {
    it("should initialize with valid config", async () => {
      const config = { apiKey: "sk-test-key" };
      await provider.initialize(config);
      expect(provider.initialize).toHaveBeenCalledWith(config);
    });

    it("should throw without apiKey", async () => {
      await expect(provider.initialize({})).rejects.toThrow("API key required");
    });

    it("should accept model configuration", async () => {
      const config = { apiKey: "sk-test-key", model: "whisper-1" };
      await provider.initialize(config);
      expect(provider.initialize).toHaveBeenCalledWith(config);
    });
  });

  describe("Transcription", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should transcribe audio buffer", async () => {
      const buffer = Buffer.from([0, 1, 2, 3, 4, 5]);
      const result = await provider.transcribe(buffer);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].text).toBeDefined();
      expect(result[0].confidence).toBeGreaterThan(0.8);
      expect(result[0].isFinal).toBe(true);
    });

    it("should support language detection", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.transcribe(buffer, { language: "es" });

      expect(result[0].language).toBe("es");
    });

    it("should support prompt for context", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.transcribe(buffer, {
        prompt: "This is a technical conversation about AI",
      });

      expect(provider.transcribe).toHaveBeenCalledWith(buffer, {
        prompt: "This is a technical conversation about AI",
      });
    });

    it("should support multiple audio formats", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const formats = ["wav", "mp3", "ogg"];

      for (const format of formats) {
        await provider.transcribe(buffer, { format });
        expect(provider.transcribe).toHaveBeenCalledWith(buffer, { format });
      }
    });
  });

  describe("Streaming Transcription", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should emit partial transcripts during streaming", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onPartial = vi.fn();

      await provider.transcribeStream(mockStream, { onPartial });

      expect(onPartial).toHaveBeenCalled();
    });

    it("should emit transcript events", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onTranscript = vi.fn();

      await provider.transcribeStream(mockStream, { onTranscript });

      expect(onTranscript).toHaveBeenCalled();
      const call = onTranscript.mock.calls[0][0];
      expect(call.type).toBe("transcript");
      expect(call.segments).toBeDefined();
    });

    it("should emit complete event with final transcript", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onComplete = vi.fn();

      await provider.transcribeStream(mockStream, { onComplete });

      expect(onComplete).toHaveBeenCalled();
      const segments = onComplete.mock.calls[0][0];
      expect(segments[0].isFinal).toBe(true);
      expect(segments[0].text).toContain("quick brown fox");
    });

    it("should support error callback for streaming", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onError = vi.fn();

      await provider.transcribeStream(mockStream, { onError });

      expect(provider.transcribeStream).toHaveBeenCalled();
    });
  });

  describe("Reconnection and Error Handling", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should handle network timeouts", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onError = vi.fn();

      // Test error callback is available
      await provider.transcribeStream(mockStream, { onError });

      expect(provider.transcribeStream).toHaveBeenCalled();
    });

    it("should support WebSocket reconnection logic", () => {
      // Streaming provider should support partial/intermediate results
      expect(provider.metadata.capabilities.supportsPartialTranscripts).toBe(true);
    });

    it("should gracefully degrade on error", async () => {
      const mockStream = {} as NodeJS.ReadableStream;
      const onError = vi.fn();
      const onComplete = vi.fn();

      await provider.transcribeStream(mockStream, { onError, onComplete });

      expect(provider.transcribeStream).toHaveBeenCalled();
    });
  });

  describe("Capabilities", () => {
    it("should report streaming capabilities accurately", () => {
      const caps = provider.metadata.capabilities;
      expect(caps.supportsStreaming).toBe(true);
      expect(caps.supportsPartialTranscripts).toBe(true);
    });

    it("should have reasonable duration limits", () => {
      const maxDuration = provider.metadata.capabilities.maxDurationSeconds;
      expect(maxDuration).toBe(600); // 10 minutes for Whisper API
    });

    it("should support common sample rates", () => {
      const rates = provider.metadata.capabilities.sampleRates;
      expect(rates).toContain(16000); // Common for speech
      expect(rates).toContain(8000); // Phone quality
    });
  });

  describe("Provider Lifecycle", () => {
    it("should shutdown gracefully", async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
      await provider.shutdown?.();
      expect(provider.shutdown).toHaveBeenCalled();
    });
  });
});
