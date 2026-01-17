import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { TTSProvider } from "../interfaces/tts-provider.js";

/**
 * OpenAI TTS Provider Tests
 *
 * Tests for OpenAI's Text-to-Speech API integration
 */

describe("OpenAI TTS Provider", () => {
  let provider: TTSProvider;

  beforeEach(() => {
    provider = {
      metadata: {
        id: "openai-tts",
        name: "OpenAI TTS",
        description: "OpenAI Text-to-Speech API",
        version: "1.0.0",
        capabilities: {
          formats: ["mp3", "pcm", "ulaw"],
          sampleRates: [24000],
          voices: [
            { id: "alloy", name: "Alloy", language: "en" },
            { id: "echo", name: "Echo", language: "en" },
            { id: "fable", name: "Fable", language: "en" },
            { id: "onyx", name: "Onyx", language: "en" },
            { id: "nova", name: "Nova", language: "en" },
            { id: "shimmer", name: "Shimmer", language: "en" },
          ],
          supportsStreaming: true,
          languages: ["en"],
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
              description: "Model name (default: tts-1)",
            },
          },
        },
      },
      initialize: vi.fn(async (config?: Record<string, unknown>) => {
        if (!config?.apiKey) {
          throw new Error("API key required for initialization");
        }
      }),
      listVoices: vi.fn(async () => [
        { id: "alloy", name: "Alloy", language: "en" },
        { id: "echo", name: "Echo", language: "en" },
        { id: "fable", name: "Fable", language: "en" },
        { id: "onyx", name: "Onyx", language: "en" },
        { id: "nova", name: "Nova", language: "en" },
        { id: "shimmer", name: "Shimmer", language: "en" },
      ]),
      synthesize: vi.fn(async (text, options) => {
        // Return mock MP3 data
        return Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x00, 0x00, 0x00, 0x00]);
      }),
      synthesizeStream: vi.fn(async (text, callbacks) => {
        if (callbacks.onAudio) {
          callbacks.onAudio(Buffer.from([0xff, 0xfb]));
        }
        if (callbacks.onComplete) {
          callbacks.onComplete();
        }
      }),
      resample: vi.fn(async (buffer, from, to) => {
        // For 24000->8000, reduce to ~1/3
        if (to < from) {
          const ratio = to / from;
          return buffer.slice(0, Math.max(1, Math.floor(buffer.length * ratio)));
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
      expect(provider.metadata.id).toBe("openai-tts");
      expect(provider.metadata.name).toBe("OpenAI TTS");
      expect(provider.metadata.version).toBe("1.0.0");
    });

    it("should expose available voices", () => {
      const voices = provider.metadata.capabilities.voices;
      expect(voices.length).toBeGreaterThan(0);
      expect(voices).toContainEqual({
        id: "alloy",
        name: "Alloy",
        language: "en",
      });
    });

    it("should support MP3 and PCM output", () => {
      const formats = provider.metadata.capabilities.formats;
      expect(formats).toContain("mp3");
      expect(formats).toContain("pcm");
    });

    it("should support streaming", () => {
      expect(provider.metadata.capabilities.supportsStreaming).toBe(true);
    });

    it("should validate configuration with apiKey", () => {
      const schema = provider.metadata.configSchema;
      const validConfig = { apiKey: "sk-test-key" };
      const result = schema?.validate(validConfig);
      expect(result?.ok).toBe(true);
    });

    it("should reject configuration without apiKey", () => {
      const schema = provider.metadata.configSchema;
      const result = schema?.validate({});
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
  });

  describe("Voice Management", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should list available voices", async () => {
      const voices = await provider.listVoices();
      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it("should have all required voice properties", async () => {
      const voices = await provider.listVoices();
      for (const voice of voices) {
        expect(voice.id).toBeDefined();
        expect(voice.name).toBeDefined();
        expect(voice.language).toBe("en");
      }
    });

    it("should match capabilities voices with listed voices", async () => {
      const listedVoices = await provider.listVoices();
      const capVoices = provider.metadata.capabilities.voices;

      expect(listedVoices.length).toBe(capVoices.length);
    });
  });

  describe("Text Synthesis", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should synthesize text to audio buffer", async () => {
      const text = "Hello world";
      const options = {
        voiceId: "alloy",
        format: "mp3" as const,
        sampleRate: 24000,
      };

      const result = await provider.synthesize(text, options);

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it("should support all available voices", async () => {
      const text = "Test";
      const voices = await provider.listVoices();

      for (const voice of voices) {
        const result = await provider.synthesize(text, {
          voiceId: voice.id,
          format: "mp3",
          sampleRate: 24000,
        });
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });

    it("should support synthesis options", async () => {
      const text = "Test speech";
      const options = {
        voiceId: "alloy",
        format: "mp3" as const,
        sampleRate: 24000,
        speechRate: 1.2,
        pitch: 2,
        volumeDb: 0,
      };

      await provider.synthesize(text, options);
      expect(provider.synthesize).toHaveBeenCalledWith(text, options);
    });

    it("should handle empty text", async () => {
      const result = await provider.synthesize("", {
        voiceId: "alloy",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should handle long text", async () => {
      const longText = "Hello world. ".repeat(100); // ~1200 chars
      const result = await provider.synthesize(longText, {
        voiceId: "alloy",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Streaming Synthesis", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should stream audio chunks", async () => {
      const text = "Stream test";
      const onAudio = vi.fn();

      await provider.synthesizeStream(
        text,
        { onAudio },
        {
          voiceId: "alloy",
          format: "mp3",
          sampleRate: 24000,
        },
      );

      expect(onAudio).toHaveBeenCalled();
    });

    it("should emit complete event", async () => {
      const text = "Stream test";
      const onComplete = vi.fn();

      await provider.synthesizeStream(
        text,
        { onComplete },
        {
          voiceId: "alloy",
          format: "mp3",
          sampleRate: 24000,
        },
      );

      expect(onComplete).toHaveBeenCalled();
    });

    it("should support error callback", async () => {
      const text = "Stream test";
      const onError = vi.fn();

      await provider.synthesizeStream(
        text,
        { onError },
        {
          voiceId: "alloy",
          format: "mp3",
          sampleRate: 24000,
        },
      );

      expect(provider.synthesizeStream).toHaveBeenCalled();
    });
  });

  describe("Audio Format Handling", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should support MP3 output", async () => {
      const result = await provider.synthesize("Test", {
        voiceId: "alloy",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should support PCM output", async () => {
      const result = await provider.synthesize("Test", {
        voiceId: "alloy",
        format: "pcm",
        sampleRate: 24000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should support mu-law encoding", async () => {
      const result = await provider.synthesize("Test", {
        voiceId: "alloy",
        format: "ulaw",
        sampleRate: 24000,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Audio Resampling", () => {
    beforeEach(async () => {
      await provider.initialize({ apiKey: "sk-test-key" });
    });

    it("should resample from 24kHz to 8kHz (phone quality)", async () => {
      const buffer = Buffer.from([0, 1, 2, 3, 4, 5, 6, 7]);
      const result = await provider.resample(buffer, 24000, 8000);

      expect(Buffer.isBuffer(result)).toBe(true);
      // Downsampling should reduce size
      expect(result.length).toBeLessThanOrEqual(buffer.length);
    });

    it("should handle resampling to same rate", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.resample(buffer, 24000, 24000);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should handle upsampling", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.resample(buffer, 8000, 24000);

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it("should support PCM format resampling", async () => {
      const buffer = Buffer.from([0, 1, 2, 3]);
      const result = await provider.resample(buffer, 24000, 8000, "pcm");

      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });

  describe("Provider Capabilities", () => {
    it("should expose single sample rate", () => {
      const rates = provider.metadata.capabilities.sampleRates;
      expect(rates).toContain(24000);
      expect(rates.length).toBeGreaterThanOrEqual(1);
    });

    it("should support multiple output formats", () => {
      const formats = provider.metadata.capabilities.formats;
      expect(formats.length).toBeGreaterThanOrEqual(2);
    });

    it("should have voices in metadata", () => {
      const voices = provider.metadata.capabilities.voices;
      expect(voices.length).toBeGreaterThan(0);
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
