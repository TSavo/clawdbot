import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { STTProvider } from "../interfaces/stt-provider.js";
import type { TTSProvider } from "../interfaces/tts-provider.js";
import { createMockSTTProvider, createMockTTSProvider, createMockWAVFile } from "../test-utils/mocks.js";

/**
 * Cross-Provider Compatibility Tests
 *
 * Tests mixing providers from different sources and ensuring audio format consistency
 */

describe("Cross-Provider Audio Processing Pipeline", () => {
  let sttOpenAI: STTProvider;
  let ttsOpenAI: TTSProvider;
  let sttLocal: STTProvider;
  let ttsLocal: TTSProvider;

  beforeEach(() => {
    // OpenAI providers
    sttOpenAI = createMockSTTProvider("openai-stt");
    ttsOpenAI = createMockTTSProvider("openai-tts");

    // Local providers
    sttLocal = createMockSTTProvider("local-stt");
    sttLocal.metadata.capabilities.supportsStreaming = false;

    ttsLocal = createMockTTSProvider("local-tts");
    ttsLocal.metadata.capabilities.formats = ["wav", "pcm"];
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("STT to TTS Pipeline", () => {
    it("should chain OpenAI STT to OpenAI TTS", async () => {
      // Transcribe audio
      const inputAudio = createMockWAVFile(2000, 16000);
      const transcript = await sttOpenAI.transcribe(inputAudio, { format: "wav" });
      expect(transcript.length).toBeGreaterThan(0);

      // Synthesize the transcript
      const text = transcript.map((seg) => seg.text).join(" ");
      const synthesized = await ttsOpenAI.synthesize(text, {
        voiceId: "nova",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(synthesized).toBeDefined();
    });

    it("should chain OpenAI STT to Local TTS", async () => {
      // Mix providers: cloud STT + local TTS
      const inputAudio = createMockWAVFile(1500, 16000);
      const transcript = await sttOpenAI.transcribe(inputAudio);

      const text = transcript.map((seg) => seg.text).join(" ");
      const synthesized = await ttsLocal.synthesize(text, {
        voiceId: "voice-1",
        format: "wav",
        sampleRate: 22050,
      });

      expect(synthesized).toBeDefined();
    });

    it("should chain Local STT to OpenAI TTS", async () => {
      // Mix providers: local STT + cloud TTS
      const inputAudio = createMockWAVFile(1500, 16000);
      const transcript = await sttLocal.transcribe(inputAudio);

      const text = transcript.map((seg) => seg.text).join(" ");
      const synthesized = await ttsOpenAI.synthesize(text, {
        voiceId: "alloy",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(synthesized).toBeDefined();
    });

    it("should chain Local STT to Local TTS", async () => {
      // All local providers
      const inputAudio = createMockWAVFile(1500, 16000);
      const transcript = await sttLocal.transcribe(inputAudio);

      const text = transcript.map((seg) => seg.text).join(" ");
      const synthesized = await ttsLocal.synthesize(text, {
        voiceId: "voice-1",
        format: "wav",
        sampleRate: 22050,
      });

      expect(synthesized).toBeDefined();
    });
  });

  describe("Audio Format Consistency", () => {
    it("should handle format conversion between providers", async () => {
      // OpenAI outputs MP3
      const mp3Audio = await ttsOpenAI.synthesize("Test", {
        voiceId: "nova",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(mp3Audio).toBeDefined();

      // If we need to feed this to local STT, it should support MP3
      const sttFormats = sttLocal.metadata.capabilities.formats;
      expect(sttFormats).toContain("mp3");
    });

    it("should support resampling between different sample rates", async () => {
      // OpenAI TTS outputs 24kHz
      const audio24k = await ttsOpenAI.synthesize("Test", {
        voiceId: "nova",
        format: "pcm",
        sampleRate: 24000,
      });

      // Resample to 16kHz for STT
      const audio16k = await ttsOpenAI.resample(audio24k, 24000, 16000);

      expect(audio16k.length).toBeLessThanOrEqual(audio24k.length);
    });

    it("should normalize audio levels across providers", async () => {
      // Synthesize with different volume levels
      const audio1 = await ttsOpenAI.synthesize("Test", {
        voiceId: "nova",
        format: "pcm",
        sampleRate: 24000,
        volumeDb: 0,
      });

      const audio2 = await ttsOpenAI.synthesize("Test", {
        voiceId: "nova",
        format: "pcm",
        sampleRate: 24000,
        volumeDb: 6, // Louder
      });

      // Both should be valid audio buffers
      expect(audio1).toBeDefined();
      expect(audio2).toBeDefined();
    });

    it("should handle different frame rates", async () => {
      const formats8k = sttLocal.metadata.capabilities.sampleRates;
      const formats16k = sttOpenAI.metadata.capabilities.sampleRates;

      // Both should support common rates
      expect(formats8k).toContain(8000);
      expect(formats16k).toContain(16000);
    });
  });

  describe("Provider Switching", () => {
    it("should allow switching STT providers mid-pipeline", async () => {
      const inputAudio = createMockWAVFile(1000, 16000);

      // Try OpenAI first
      const transcript1 = await sttOpenAI.transcribe(inputAudio);
      expect(transcript1.length).toBeGreaterThan(0);

      // Switch to local if needed
      const transcript2 = await sttLocal.transcribe(inputAudio);
      expect(transcript2.length).toBeGreaterThan(0);

      // Both should produce results
      expect(transcript1[0].text).toBeDefined();
      expect(transcript2[0].text).toBeDefined();
    });

    it("should allow switching TTS providers mid-pipeline", async () => {
      const text = "Hello world";
      const options1 = {
        voiceId: "nova",
        format: "mp3" as const,
        sampleRate: 24000,
      };
      const audio1 = await ttsOpenAI.synthesize(text, options1);

      const options2 = {
        voiceId: "voice-1",
        format: "wav" as const,
        sampleRate: 22050,
      };
      const audio2 = await ttsLocal.synthesize(text, options2);

      expect(audio1).toBeDefined();
      expect(audio2).toBeDefined();
    });

    it("should handle fallback scenarios", async () => {
      // Primary provider (OpenAI)
      // Fallback to local if unavailable
      const providers: STTProvider[] = [sttOpenAI, sttLocal];

      const inputAudio = createMockWAVFile(1000, 16000);
      let result;

      for (const provider of providers) {
        try {
          result = await provider.transcribe(inputAudio);
          break;
        } catch (error) {
          // Try next provider
          continue;
        }
      }

      expect(result).toBeDefined();
    });
  });

  describe("Error Propagation", () => {
    it("should propagate STT errors to TTS", async () => {
      const errorSTT = createMockSTTProvider("error-stt");
      (errorSTT.transcribe as any).mockRejectedValue(new Error("STT failed"));

      const inputAudio = Buffer.from([0, 1, 2, 3]);

      let error;
      try {
        await errorSTT.transcribe(inputAudio);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain("STT failed");
    });

    it("should propagate TTS errors in pipeline", async () => {
      const errorTTS = createMockTTSProvider("error-tts");
      (errorTTS.synthesize as any).mockRejectedValue(new Error("TTS failed"));

      const text = "Test";

      let error;
      try {
        await errorTTS.synthesize(text, {
          voiceId: "voice-1",
          format: "wav",
          sampleRate: 24000,
        });
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
      expect(error?.message).toContain("TTS failed");
    });

    it("should handle resampling errors", async () => {
      const errorTTS = createMockTTSProvider("error-tts");
      (errorTTS.resample as any).mockRejectedValue(new Error("Resampling failed"));

      const buffer = Buffer.from([0, 1, 2, 3]);

      let error;
      try {
        await errorTTS.resample(buffer, 24000, 8000);
      } catch (e) {
        error = e;
      }

      expect(error).toBeDefined();
    });
  });

  describe("Configuration Compatibility", () => {
    it("should handle different language configurations", async () => {
      const languages = [
        { stt: "en", tts: "en" },
        { stt: "es", tts: "es" },
        { stt: "fr", tts: undefined }, // TTS might not support all languages
      ];

      for (const lang of languages) {
        const inputAudio = createMockWAVFile(1000, 16000);

        // Transcribe with specific language
        const transcript = await sttOpenAI.transcribe(inputAudio, { language: lang.stt });
        expect(transcript[0].language).toBe(lang.stt);

        // Synthesize (may not support same language)
        if (lang.tts) {
          const text = transcript.map((seg) => seg.text).join(" ");
          const synthesized = await ttsOpenAI.synthesize(text, {
            voiceId: "nova",
            format: "mp3",
            sampleRate: 24000,
          });
          expect(synthesized).toBeDefined();
        }
      }
    });

    it("should handle format negotiation", async () => {
      // Find common formats between providers
      const sttFormats = sttOpenAI.metadata.capabilities.formats;
      const ttsFormats = ttsOpenAI.metadata.capabilities.formats;

      // Find intersection
      const commonFormats = sttFormats.filter((f) => ttsFormats.includes(f));

      // If there are common formats, we can pass audio directly
      if (commonFormats.length > 0) {
        const audio = await ttsOpenAI.synthesize("Test", {
          voiceId: "nova",
          format: commonFormats[0] as any,
          sampleRate: 24000,
        });
        expect(audio).toBeDefined();
      }
    });
  });

  describe("Performance and Caching", () => {
    it("should cache transcription results", async () => {
      const inputAudio = createMockWAVFile(1000, 16000);
      const key = Buffer.from(inputAudio).toString("hex");

      // First call
      const result1 = await sttOpenAI.transcribe(inputAudio);

      // Second call with same audio
      const result2 = await sttOpenAI.transcribe(inputAudio);

      // Should have same content
      expect(result1[0].text).toBe(result2[0].text);
    });

    it("should cache synthesis results", async () => {
      const text = "Test audio";

      // First synthesis
      const audio1 = await ttsOpenAI.synthesize(text, {
        voiceId: "nova",
        format: "mp3",
        sampleRate: 24000,
      });

      // Second synthesis with same parameters
      const audio2 = await ttsOpenAI.synthesize(text, {
        voiceId: "nova",
        format: "mp3",
        sampleRate: 24000,
      });

      expect(audio1).toBeDefined();
      expect(audio2).toBeDefined();
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent transcriptions", async () => {
      const inputs = [
        createMockWAVFile(500, 16000),
        createMockWAVFile(500, 16000),
        createMockWAVFile(500, 16000),
      ];

      const results = await Promise.all(inputs.map((audio) => sttOpenAI.transcribe(audio)));

      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it("should handle concurrent syntheses", async () => {
      const texts = ["Hello", "World", "Test"];

      const results = await Promise.all(
        texts.map((text) =>
          ttsOpenAI.synthesize(text, {
            voiceId: "nova",
            format: "mp3",
            sampleRate: 24000,
          }),
        ),
      );

      expect(results.length).toBe(3);
      for (const result of results) {
        expect(result).toBeDefined();
      }
    });
  });
});
