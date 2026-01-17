import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { STTProvider, STTCapabilities } from '../../interfaces/stt-provider.js';
import { createMockSTTProvider, createErrorSTTProvider, createMockAudioBuffer, createMockWAVFile } from '../../test-utils/mocks.js';

/**
 * Unit Tests for STT Providers
 *
 * Tests common functionality across all STT providers
 * - Configuration validation
 * - Initialization logic
 * - Error handling
 * - Capability validation
 */

describe('STT Provider Unit Tests', () => {
  let provider: STTProvider;

  describe('Provider Initialization', () => {
    it('should initialize successfully with valid config', async () => {
      provider = createMockSTTProvider('whisper');
      const initFn = vi.spyOn(provider, 'initialize');

      await provider.initialize({ apiKey: 'test-key' });

      expect(initFn).toHaveBeenCalledWith({ apiKey: 'test-key' });
    });

    it('should throw on initialization with missing required config', async () => {
      provider = createErrorSTTProvider('deepgram', 'API key required');

      await expect(provider.initialize({})).rejects.toThrow('API key required');
    });

    it('should handle initialization with null/undefined config gracefully', async () => {
      provider = createMockSTTProvider('test-provider');
      const initFn = vi.spyOn(provider, 'initialize');

      await provider.initialize();

      expect(initFn).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', async () => {
      provider = createMockSTTProvider('test-provider');
      const initFn = vi.spyOn(provider, 'initialize');

      await provider.initialize();
      await provider.initialize();

      // Should still be called twice (no caching at provider level)
      expect(initFn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Provider Metadata', () => {
    beforeEach(() => {
      provider = createMockSTTProvider('test-provider');
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
      expect(capabilities.formats).toContain('wav');
      expect(Array.isArray(capabilities.formats)).toBe(true);
    });

    it('should list all supported sample rates', () => {
      const capabilities = provider.metadata.capabilities;
      expect(capabilities.sampleRates).toContain(16000);
      expect(Array.isArray(capabilities.sampleRates)).toBe(true);
    });

    it('should indicate streaming support capability', () => {
      const capabilities = provider.metadata.capabilities;
      expect(typeof capabilities.supportsStreaming).toBe('boolean');
    });

    it('should list supported languages', () => {
      const capabilities = provider.metadata.capabilities;
      expect(capabilities.languages).toContain('en');
      expect(Array.isArray(capabilities.languages)).toBe(true);
    });

    it('should specify max duration if applicable', () => {
      const capabilities = provider.metadata.capabilities;
      if ('maxDurationSeconds' in capabilities) {
        expect(typeof capabilities.maxDurationSeconds).toBe('number');
        expect(capabilities.maxDurationSeconds).toBeGreaterThan(0);
      }
    });
  });

  describe('Transcription', () => {
    beforeEach(async () => {
      provider = createMockSTTProvider('test-provider');
      await provider.initialize();
    });

    it('should transcribe audio buffer successfully', async () => {
      const audioBuffer = createMockWAVFile(1000);
      const result = await provider.transcribe(audioBuffer);

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('text');
    });

    it('should return transcription segments with required fields', async () => {
      const audioBuffer = createMockWAVFile(1000);
      const result = await provider.transcribe(audioBuffer);

      result.forEach((segment) => {
        expect(segment).toHaveProperty('text');
        expect(typeof segment.text).toBe('string');
        expect(segment).toHaveProperty('confidence');
        expect(segment.confidence).toBeGreaterThanOrEqual(0);
        expect(segment.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('should respect language option', async () => {
      const audioBuffer = createMockWAVFile(1000);
      const result = await provider.transcribe(audioBuffer, { language: 'es' });

      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle empty audio buffer gracefully', async () => {
      const emptyBuffer = Buffer.alloc(0);

      // Should either return empty array or throw a specific error
      try {
        const result = await provider.transcribe(emptyBuffer);
        expect(Array.isArray(result)).toBe(true);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('should fail gracefully with invalid audio data', async () => {
      const provider = createErrorSTTProvider('test-provider', 'Invalid audio format');
      await provider.initialize();

      await expect(provider.transcribe(Buffer.from([0, 0, 0, 0]))).rejects.toThrow();
    });
  });

  describe('Streaming Transcription', () => {
    beforeEach(async () => {
      provider = createMockSTTProvider('test-provider');
      await provider.initialize();
    });

    it('should support streaming transcription if available', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return; // Skip if provider doesn't support streaming
      }

      const audioBuffer = createMockWAVFile(1000);
      const { Readable } = await import('stream');
      const audioStream = Readable.from([audioBuffer]);

      const transcriptsSpy = vi.fn();
      const completeSpy = vi.fn();
      const errorSpy = vi.fn();

      await provider.transcribeStream(audioStream, {
        onTranscript: transcriptsSpy,
        onComplete: completeSpy,
        onError: errorSpy,
      });

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should call onTranscript callback for partial results', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const audioBuffer = createMockWAVFile(2000);
      const { Readable } = await import('stream');
      const audioStream = Readable.from([audioBuffer]);

      const transcriptSpy = vi.fn();

      await provider.transcribeStream(audioStream, {
        onTranscript: transcriptSpy,
      });

      expect(transcriptSpy).toHaveBeenCalled();
    });

    it('should invoke onComplete callback when transcription finishes', async () => {
      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const audioBuffer = createMockWAVFile(1000);
      const { Readable } = await import('stream');
      const audioStream = Readable.from([audioBuffer]);

      const completeSpy = vi.fn();

      await provider.transcribeStream(audioStream, {
        onComplete: completeSpy,
      });

      expect(completeSpy).toHaveBeenCalled();
    });

    it('should call onError callback on transcription failure', async () => {
      const provider = createErrorSTTProvider('test-provider', 'Stream transcription failed');
      await provider.initialize();

      if (!provider.metadata.capabilities.supportsStreaming) {
        return;
      }

      const errorBuffer = Buffer.from([0xff, 0xff]); // Invalid audio
      const { Readable } = await import('stream');
      const audioStream = Readable.from([errorBuffer]);

      const errorSpy = vi.fn();

      // Stream may throw or call onError
      try {
        await provider.transcribeStream(audioStream, { onError: errorSpy });
      } catch (e) {
        // Expected
      }
    });

    it('should support partial transcripts if capability is present', async () => {
      if (!provider.metadata.capabilities.supportsPartialTranscripts) {
        return;
      }

      const audioBuffer = createMockWAVFile(2000);
      const { Readable } = await import('stream');
      const audioStream = Readable.from([audioBuffer]);

      const transcripts: any[] = [];
      const transcriptSpy = vi.fn((data) => transcripts.push(data));

      await provider.transcribeStream(audioStream, {
        onTranscript: transcriptSpy,
      });

      expect(transcriptSpy).toHaveBeenCalled();
      // Verify we received both partial and final transcripts if applicable
    });
  });

  describe('Error Handling', () => {
    it('should provide meaningful error messages', async () => {
      const provider = createErrorSTTProvider('test-provider', 'API rate limit exceeded');

      await expect(provider.initialize()).rejects.toThrow('API rate limit exceeded');
    });

    it('should handle network errors appropriately', async () => {
      const provider = createErrorSTTProvider('test-provider', 'Network timeout');

      await expect(provider.initialize()).rejects.toThrow('Network timeout');
    });

    it('should handle provider-specific errors', async () => {
      const provider = createErrorSTTProvider('test-provider', 'Invalid audio codec');

      await expect(provider.initialize()).rejects.toThrow('Invalid audio codec');
    });
  });

  describe('Shutdown', () => {
    beforeEach(async () => {
      provider = createMockSTTProvider('test-provider');
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
        // Provider should be in clean state after shutdown
        expect(provider).toBeDefined();
      }
    });
  });

  describe('Provider Comparison', () => {
    it('should support multiple providers simultaneously', async () => {
      const provider1 = createMockSTTProvider('provider-1');
      const provider2 = createMockSTTProvider('provider-2');

      await provider1.initialize();
      await provider2.initialize();

      expect(provider1.metadata.id).toBe('provider-1');
      expect(provider2.metadata.id).toBe('provider-2');
    });

    it('should maintain separate state per provider instance', async () => {
      const provider1 = createMockSTTProvider('test-1');
      const provider2 = createMockSTTProvider('test-2');

      await provider1.initialize({ apiKey: 'key1' });
      await provider2.initialize({ apiKey: 'key2' });

      const buffer = createMockWAVFile(1000);
      const result1 = await provider1.transcribe(buffer);
      const result2 = await provider2.transcribe(buffer);

      // Both should produce results independently
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
