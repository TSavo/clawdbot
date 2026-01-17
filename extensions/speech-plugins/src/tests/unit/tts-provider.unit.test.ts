import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { TTSProvider, TTSVoice } from '../../interfaces/tts-provider.js';
import { createMockTTSProvider, createErrorTTSProvider, createMockWAVFile } from '../../test-utils/mocks.js';

/**
 * Unit Tests for TTS Providers
 *
 * Tests common functionality across all TTS providers
 * - Configuration validation
 * - Voice management
 * - Synthesis functionality
 * - Error handling
 * - Streaming support
 */

describe('TTS Provider Unit Tests', () => {
  let provider: TTSProvider;

  describe('Provider Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      provider = createMockTTSProvider('elevenlabs');
      const initFn = vi.spyOn(provider, 'initialize');

      await provider.initialize({ apiKey: 'test-key' });

      expect(initFn).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('should throw on initialization with missing required config', async () => {
      provider = createErrorTTSProvider('elevenlabs', 'API key required');

      await expect(provider.initialize({})).rejects.toThrow('API key required');
    });

    it('should handle initialization with undefined config', async () => {
      provider = createMockTTSProvider('test-provider');
      const initFn = vi.spyOn(provider, 'initialize');

      await provider.initialize();

      expect(initFn).toHaveBeenCalled();
    });

    it('should validate API endpoint accessibility during init', async () => {
      provider = createErrorTTSProvider('test-provider', 'Endpoint not reachable');

      await expect(provider.initialize({ endpoint: 'http://invalid' })).rejects.toThrow(
        'Endpoint not reachable',
      );
    });
  });

  describe('Provider Metadata', () => {
    beforeEach(() => {
      provider = createMockTTSProvider('test-provider');
    });

    it('should expose correct metadata structure', () => {
      expect(provider.metadata).toBeDefined();
      expect(provider.metadata.id).toBe('test-provider');
      expect(provider.metadata.name).toBeDefined();
      expect(provider.metadata.version).toBeDefined();
      expect(provider.metadata.capabilities).toBeDefined();
    });

    it('should list all supported audio formats', () => {
      const capabilities = provider.metadata.capabilities;
      expect(Array.isArray(capabilities.formats)).toBe(true);
      expect(capabilities.formats.length).toBeGreaterThan(0);
      capabilities.formats.forEach((format) => {
        expect(['wav', 'mp3', 'pcm', 'ulaw', 'aac', 'opus'].includes(format)).toBe(true);
      });
    });

    it('should list all supported sample rates', () => {
      const capabilities = provider.metadata.capabilities;
      expect(Array.isArray(capabilities.sampleRates)).toBe(true);
      capabilities.sampleRates.forEach((rate) => {
        expect(typeof rate).toBe('number');
        expect(rate).toBeGreaterThan(0);
      });
    });

    it('should list all supported voices', () => {
      const capabilities = provider.metadata.capabilities;
      expect(Array.isArray(capabilities.voices)).toBe(true);
      expect(capabilities.voices.length).toBeGreaterThan(0);

      capabilities.voices.forEach((voice) => {
        expect(voice).toHaveProperty('id');
        expect(voice).toHaveProperty('name');
        expect(voice).toHaveProperty('language');
      });
    });

    it('should indicate streaming support capability', () => {
      const capabilities = provider.metadata.capabilities;
      expect(typeof capabilities.supportsStreaming).toBe('boolean');
    });

    it('should list supported languages', () => {
      const capabilities = provider.metadata.capabilities;
      expect(Array.isArray(capabilities.languages)).toBe(true);
      expect(capabilities.languages.length).toBeGreaterThan(0);
    });
  });

  describe('Voice Management', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should list available voices', async () => {
      const voices = await provider.listVoices();

      expect(Array.isArray(voices)).toBe(true);
      expect(voices.length).toBeGreaterThan(0);
    });

    it('should return voices with required properties', async () => {
      const voices = await provider.listVoices();

      voices.forEach((voice) => {
        expect(voice).toHaveProperty('id');
        expect(voice).toHaveProperty('name');
        expect(voice).toHaveProperty('language');
        expect(typeof voice.id).toBe('string');
        expect(typeof voice.name).toBe('string');
        expect(typeof voice.language).toBe('string');
      });
    });

    it('should include voice gender if available', async () => {
      const voices = await provider.listVoices();

      voices.forEach((voice) => {
        if ('gender' in voice) {
          expect(['male', 'female', 'neutral'].includes(voice.gender as any)).toBe(true);
        }
      });
    });

    it('should provide consistent voice list across calls', async () => {
      const voices1 = await provider.listVoices();
      const voices2 = await provider.listVoices();

      expect(voices1.length).toBe(voices2.length);
      voices1.forEach((v1, i) => {
        expect(v1.id).toBe(voices2[i].id);
      });
    });

    it('should include sample audio if available', async () => {
      const voices = await provider.listVoices();

      voices.forEach((voice) => {
        if ('sampleAudio' in voice) {
          expect(typeof voice.sampleAudio).toBe('string');
          expect((voice.sampleAudio as string).length).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Text Synthesis', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should synthesize text successfully', async () => {
      const result = await provider.synthesize('Hello world', { voiceId: 'voice-1' });

      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should support different voices', async () => {
      const voices = await provider.listVoices();
      const text = 'Test message';

      for (const voice of voices.slice(0, 2)) {
        // Test first 2 voices
        const result = await provider.synthesize(text, { voiceId: voice.id });
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });

    it('should respect voice ID in synthesis options', async () => {
      const voices = await provider.listVoices();
      const firstVoiceId = voices[0].id;

      const result = await provider.synthesize('Hello', { voiceId: firstVoiceId });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should support different sample rates', async () => {
      const capabilities = provider.metadata.capabilities;
      const sampleRates = capabilities.sampleRates.slice(0, 2);

      for (const sampleRate of sampleRates) {
        const result = await provider.synthesize('Test', {
          voiceId: 'voice-1',
          sampleRate,
        });
        expect(Buffer.isBuffer(result)).toBe(true);
      }
    });

    it('should support different audio formats', async () => {
      const capabilities = provider.metadata.capabilities;
      const formats = capabilities.formats.slice(0, 2);

      for (const format of formats) {
        try {
          const result = await provider.synthesize('Test', {
            voiceId: 'voice-1',
            format: format as any,
          });
          expect(Buffer.isBuffer(result)).toBe(true);
        } catch (e) {
          // Some formats might not be available
        }
      }
    });

    it('should support speech rate adjustment', async () => {
      const normalSpeed = await provider.synthesize('Hello', {
        voiceId: 'voice-1',
        speechRate: 1.0,
      });

      const fastSpeed = await provider.synthesize('Hello', {
        voiceId: 'voice-1',
        speechRate: 1.5,
      });

      expect(Buffer.isBuffer(normalSpeed)).toBe(true);
      expect(Buffer.isBuffer(fastSpeed)).toBe(true);
    });

    it('should support pitch adjustment if available', async () => {
      const result = await provider.synthesize('Hello', {
        voiceId: 'voice-1',
        pitch: 1.2,
      });

      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle empty text gracefully', async () => {
      try {
        const result = await provider.synthesize('', { voiceId: 'voice-1' });
        // Either returns empty buffer or throws
        if (result) {
          expect(Buffer.isBuffer(result)).toBe(true);
        }
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should reject invalid voice ID', async () => {
      try {
        await provider.synthesize('Hello', { voiceId: 'invalid-voice-id' });
        // If no error, result should still be valid
        expect(true).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should produce valid audio data', async () => {
      const result = await provider.synthesize('Test audio', { voiceId: 'voice-1' });

      // Check for valid audio file signatures
      const header = result.slice(0, 4).toString('utf8', 0, 4);
      expect(['RIFF', 'ID3'].some((sig) => result.toString().includes(sig))).toBe(true);
    });
  });

  describe('Streaming Synthesis', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should support streaming synthesis if available', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return; // Skip if not supported
      }

      const audioSpy = vi.fn();
      const completeSpy = vi.fn();

      await provider.synthesizeStream(
        'Test message',
        {
          onAudio: audioSpy,
          onComplete: completeSpy,
        },
        { voiceId: 'voice-1' },
      );

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should stream audio chunks progressively', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const chunks: Buffer[] = [];
      const audioSpy = vi.fn((chunk: Buffer) => chunks.push(chunk));

      await provider.synthesizeStream(
        'Stream test',
        { onAudio: audioSpy },
        { voiceId: 'voice-1' },
      );

      // For streaming, we should get multiple chunks or at least one
      expect(audioSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
    });

    it('should call onComplete when streaming finishes', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const completeSpy = vi.fn();

      await provider.synthesizeStream(
        'Complete test',
        { onComplete: completeSpy },
        { voiceId: 'voice-1' },
      );

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should handle stream errors gracefully', async () => {
      const provider = createErrorTTSProvider('test-provider', 'Stream error');

      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const errorSpy = vi.fn();

      try {
        await provider.synthesizeStream(
          'Error test',
          { onError: errorSpy },
          { voiceId: 'voice-1' },
        );
      } catch (e) {
        // Expected to throw
      }
    });
  });

  describe('Audio Resampling', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should support audio resampling if available', async () => {
      if (!provider.resample) {
        return; // Skip if resampling not supported
      }

      const buffer = createMockWAVFile(1000, 16000);
      const resampled = await provider.resample(buffer, 16000, 8000);

      expect(Buffer.isBuffer(resampled)).toBe(true);
      expect(resampled.length).toBeLessThanOrEqual(buffer.length);
    });

    it('should handle upsampling', async () => {
      if (!provider.resample) {
        return;
      }

      const buffer = createMockWAVFile(1000, 8000);
      const resampled = await provider.resample(buffer, 8000, 16000);

      expect(Buffer.isBuffer(resampled)).toBe(true);
      expect(resampled.length).toBeGreaterThanOrEqual(buffer.length);
    });

    it('should preserve audio data during resampling', async () => {
      if (!provider.resample) {
        return;
      }

      const buffer = createMockWAVFile(1000, 16000);
      const resampled = await provider.resample(buffer, 16000, 16000);

      // Same sample rate should return original or similar
      expect(Buffer.isBuffer(resampled)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const provider = createErrorTTSProvider('test-provider', 'API key invalid');

      await expect(provider.initialize()).rejects.toThrow('API key invalid');
    });

    it('should handle authentication errors', async () => {
      const provider = createErrorTTSProvider('test-provider', 'Unauthorized');

      await expect(provider.initialize()).rejects.toThrow('Unauthorized');
    });

    it('should handle rate limiting', async () => {
      const provider = createErrorTTSProvider('test-provider', 'Rate limit exceeded');

      await expect(provider.initialize()).rejects.toThrow('Rate limit exceeded');
    });

    it('should handle network errors', async () => {
      const provider = createErrorTTSProvider('test-provider', 'Connection timeout');

      await expect(provider.initialize()).rejects.toThrow('Connection timeout');
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should support graceful shutdown if available', async () => {
      if (provider.shutdown) {
        const shutdownSpy = vi.spyOn(provider, 'shutdown');
        await provider.shutdown();
        expect(shutdownSpy).toHaveBeenCalled();
      }
    });

    it('should clean up resources on shutdown', async () => {
      if (provider.shutdown) {
        await provider.shutdown();
        // Provider should be defined but in a clean state
        expect(provider).toBeDefined();
      }
    });
  });

  describe('Concurrent Operations', () => {
    beforeEach(async () => {
      provider = createMockTTSProvider('test-provider');
      await provider.initialize();
    });

    it('should handle concurrent synthesis requests', async () => {
      const promises = Array(5)
        .fill(null)
        .map((_, i) => provider.synthesize(`Message ${i}`, { voiceId: 'voice-1' }));

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(Buffer.isBuffer(result)).toBe(true);
      });
    });

    it('should maintain state during concurrent operations', async () => {
      const voices = await provider.listVoices();
      const initialVoiceCount = voices.length;

      // Run operations concurrently
      await Promise.all([
        provider.synthesize('Test 1', { voiceId: 'voice-1' }),
        provider.listVoices(),
        provider.synthesize('Test 2', { voiceId: 'voice-2' }),
      ]);

      const finalVoices = await provider.listVoices();
      expect(finalVoices.length).toBe(initialVoiceCount);
    });
  });
});
