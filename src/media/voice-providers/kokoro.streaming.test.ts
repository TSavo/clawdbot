/**
 * Kokoro HTTP Streaming Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KokoroExecutor } from './kokoro.js';
import { DockerHandler } from './deployments/docker-handler.js';
import type { AudioBuffer } from './executor.js';

describe('KokoroExecutor HTTP Streaming', () => {
  let executor: KokoroExecutor;

  beforeEach(async () => {
    executor = new KokoroExecutor({
      mode: 'docker',
      docker: {
        image: 'kokoro:latest',
        port: 8000,
      },
    });

    // Mock Docker handler initialization
    vi.spyOn(DockerHandler.prototype, 'checkDockerAvailable').mockResolvedValue(true);
    vi.spyOn(DockerHandler.prototype, 'pullImage').mockResolvedValue();
    vi.spyOn(DockerHandler.prototype, 'startContainer').mockResolvedValue('test-container-id');
    vi.spyOn(DockerHandler.prototype, 'waitForHealthy').mockResolvedValue();
    vi.spyOn(DockerHandler.prototype, 'getContainerStatus').mockResolvedValue('running');

    await executor.initialize();
  });

  afterEach(async () => {
    await executor.shutdown();
    vi.restoreAllMocks();
  });

  describe('HTTP streaming endpoint', () => {
    it('should stream audio chunks via HTTP', async () => {
      // Mock fetch for streaming endpoint
      const mockChunks = [
        { audio: Buffer.from('chunk1').toString('base64') },
        { audio: Buffer.from('chunk2').toString('base64') },
      ];

      const mockResponse = new ReadableStream({
        start(controller) {
          mockChunks.forEach((chunk) => {
            const line = JSON.stringify(chunk) + '\n';
            controller.enqueue(new TextEncoder().encode(line));
          });
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Hello world');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      for await (const chunk of executor.synthesizeStream(textStream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].data).toBeDefined();
      expect(chunks[0].format).toBe('pcm_16');
    });

    it('should receive first chunk in <150ms', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          setTimeout(() => {
            const chunk = { audio: Buffer.from('test').toString('base64') };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
            controller.close();
          }, 10);
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      const startTime = performance.now();
      let firstChunkTime = 0;

      for await (const chunk of executor.synthesizeStream(textStream)) {
        if (firstChunkTime === 0) {
          firstChunkTime = performance.now() - startTime;
        }
        break;
      }

      expect(firstChunkTime).toBeLessThan(150);
    });

    it('should handle chunked transfer encoding', async () => {
      // Simulate chunked HTTP response
      const mockResponse = new ReadableStream({
        async start(controller) {
          // Send chunks with delays
          for (let i = 0; i < 5; i++) {
            await new Promise((resolve) => setTimeout(resolve, 5));
            const chunk = { audio: Buffer.from(`chunk${i}`).toString('base64') };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
          }
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Long text that will be streamed in chunks');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      for await (const chunk of executor.synthesizeStream(textStream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(5);
    });

    it('should handle ndjson format correctly', async () => {
      const mockNdjson =
        '{"audio":"dGVzdDE="}\n' + '{"audio":"dGVzdDI="}\n' + '{"audio":"dGVzdDM="}\n';

      const mockResponse = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(mockNdjson));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      for await (const chunk of executor.synthesizeStream(textStream)) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBe(3);
      expect(Buffer.from(chunks[0].data).toString()).toBe('test1');
      expect(Buffer.from(chunks[1].data).toString()).toBe('test2');
      expect(Buffer.from(chunks[2].data).toString()).toBe('test3');
    });

    it('should handle HTTP errors', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      await expect(async () => {
        for await (const chunk of executor.synthesizeStream(textStream)) {
          // Should throw
        }
      }).rejects.toThrow();
    });

    it('should handle streaming errors in ndjson', async () => {
      const mockResponse = new ReadableStream({
        start(controller) {
          const errorChunk = { error: 'Synthesis failed' };
          controller.enqueue(new TextEncoder().encode(JSON.stringify(errorChunk) + '\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      try {
        for await (const chunk of executor.synthesizeStream(textStream)) {
          chunks.push(chunk);
        }
      } catch (error) {
        // Expected error
      }

      // Should not receive chunks after error
      expect(chunks.length).toBe(0);
    });

    it('should not buffer sentences', async () => {
      const mockResponse = new ReadableStream({
        async start(controller) {
          // Send chunks immediately without sentence buffering
          const texts = ['Word1 ', 'word2 ', 'word3'];
          for (const text of texts) {
            const chunk = { audio: Buffer.from(text).toString('base64') };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
            await new Promise((resolve) => setTimeout(resolve, 1));
          }
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Word1 word2 word3');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      const timestamps: number[] = [];
      const startTime = performance.now();

      for await (const chunk of executor.synthesizeStream(textStream)) {
        chunks.push(chunk);
        timestamps.push(performance.now() - startTime);
      }

      expect(chunks.length).toBe(3);
      // Chunks should arrive quickly without sentence buffering
      if (timestamps.length > 1) {
        const maxInterval = Math.max(...timestamps.map((t, i) => (i > 0 ? t - timestamps[i - 1] : 0)));
        expect(maxInterval).toBeLessThan(100);
      }
    });
  });

  describe('base64 audio encoding', () => {
    it('should decode base64 audio correctly', async () => {
      const testAudio = Buffer.from('test audio data');
      const base64Audio = testAudio.toString('base64');

      const mockResponse = new ReadableStream({
        start(controller) {
          const chunk = { audio: base64Audio };
          controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      for await (const chunk of executor.synthesizeStream(textStream)) {
        const decoded = Buffer.from(chunk.data).toString();
        expect(decoded).toBe('test audio data');
        break;
      }
    });
  });

  describe('backpressure handling', () => {
    it('should handle slow consumers', async () => {
      const mockResponse = new ReadableStream({
        async start(controller) {
          for (let i = 0; i < 20; i++) {
            const chunk = { audio: Buffer.from(`chunk${i}`).toString('base64') };
            controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
          }
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: mockResponse,
      });

      const textStream = new ReadableStream({
        start(controller) {
          controller.enqueue('Test');
          controller.close();
        },
      });

      const chunks: AudioBuffer[] = [];
      for await (const chunk of executor.synthesizeStream(textStream)) {
        chunks.push(chunk);
        // Simulate slow processing
        await new Promise((resolve) => setTimeout(resolve, 2));
      }

      expect(chunks.length).toBe(20);
    });
  });
});
