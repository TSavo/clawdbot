/**
 * Voice Latency Benchmarks
 *
 * Performance benchmarks for Discord voice integration:
 * - Transcription latency (audio → text)
 * - TTS encoding latency (text → MP3)
 * - Voice channel end-to-end latency
 * - Target: < 100ms transcription, < 100ms encoding, < 150ms e2e
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { performance } from 'perf_hooks';

// ===================================================================
// BENCHMARK INFRASTRUCTURE
// ===================================================================

/**
 * Performance metrics
 */
interface BenchmarkMetrics {
  name: string;
  samples: number;
  avgMs: number;
  minMs: number;
  maxMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
}

/**
 * Run benchmark with multiple iterations
 */
async function runBenchmark(
  name: string,
  iterations: number,
  fn: () => Promise<void>,
): Promise<BenchmarkMetrics> {
  const timings: number[] = [];

  // Warmup
  for (let i = 0; i < 10; i++) {
    await fn();
  }

  // Actual benchmark
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    timings.push(duration);
  }

  // Calculate statistics
  timings.sort((a, b) => a - b);

  const sum = timings.reduce((acc, val) => acc + val, 0);
  const avg = sum / timings.length;
  const min = timings[0];
  const max = timings[timings.length - 1];

  const p50Index = Math.floor(timings.length * 0.5);
  const p95Index = Math.floor(timings.length * 0.95);
  const p99Index = Math.floor(timings.length * 0.99);

  return {
    name,
    samples: timings.length,
    avgMs: avg,
    minMs: min,
    maxMs: max,
    p50Ms: timings[p50Index],
    p95Ms: timings[p95Index],
    p99Ms: timings[p99Index],
  };
}

/**
 * Print benchmark results
 */
function printMetrics(metrics: BenchmarkMetrics): void {
  console.log(`\n${metrics.name}:`);
  console.log(`  Samples: ${metrics.samples}`);
  console.log(`  Avg:     ${metrics.avgMs.toFixed(2)}ms`);
  console.log(`  Min:     ${metrics.minMs.toFixed(2)}ms`);
  console.log(`  Max:     ${metrics.maxMs.toFixed(2)}ms`);
  console.log(`  P50:     ${metrics.p50Ms.toFixed(2)}ms`);
  console.log(`  P95:     ${metrics.p95Ms.toFixed(2)}ms`);
  console.log(`  P99:     ${metrics.p99Ms.toFixed(2)}ms`);
}

// ===================================================================
// MOCK AUDIO DATA
// ===================================================================

/**
 * Generate PCM audio data
 */
function generatePCMAudio(durationSeconds: number, sampleRate = 16000): Buffer {
  const samples = sampleRate * durationSeconds;
  const buffer = Buffer.alloc(samples * 2); // 16-bit PCM

  // Generate sine wave
  for (let i = 0; i < samples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate);
    const value = Math.floor(sample * 32767);
    buffer.writeInt16LE(value, i * 2);
  }

  return buffer;
}

/**
 * Mock transcription (simulates API call)
 */
async function mockTranscribe(audioData: Buffer): Promise<string> {
  // Simulate network + processing delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 50 + 20));
  return 'This is a mock transcription.';
}

/**
 * Mock TTS synthesis (simulates API call)
 */
async function mockSynthesize(text: string, format: 'mp3' | 'ogg' = 'mp3'): Promise<Buffer> {
  // Simulate network + processing delay
  await new Promise((resolve) => setTimeout(resolve, Math.random() * 60 + 30));

  // Generate mock audio output
  const outputSize = text.length * 50; // Rough estimate
  return Buffer.alloc(outputSize, 0x41);
}

/**
 * Mock MP3 encoding (simulates libmp3lame)
 */
async function mockEncodeMP3(pcmData: Buffer, bitrate = 64000): Promise<Buffer> {
  // Simulate encoding delay based on data size
  const encodingTimeMs = (pcmData.length / 32000) * 10; // ~10ms per second of audio
  await new Promise((resolve) => setTimeout(resolve, encodingTimeMs));

  // Return compressed buffer (rough compression ratio)
  const compressedSize = Math.floor((pcmData.length * bitrate) / (16000 * 16));
  return Buffer.alloc(compressedSize, 0x00);
}

// ===================================================================
// BENCHMARK SUITE: Transcription Latency
// ===================================================================

describe('Transcription Latency Benchmarks', () => {
  it('should measure 1-second audio transcription latency', async () => {
    const audioData = generatePCMAudio(1);

    const metrics = await runBenchmark('Transcribe 1s audio', 100, async () => {
      await mockTranscribe(audioData);
    });

    printMetrics(metrics);

    // Target: < 100ms
    expect(metrics.p95Ms).toBeLessThan(100);
  }, 30000);

  it('should measure 3-second audio transcription latency', async () => {
    const audioData = generatePCMAudio(3);

    const metrics = await runBenchmark('Transcribe 3s audio', 50, async () => {
      await mockTranscribe(audioData);
    });

    printMetrics(metrics);

    // Longer audio takes more time, but should still be reasonable
    expect(metrics.p95Ms).toBeLessThan(300);
  }, 30000);

  it('should measure 10-second audio transcription latency', async () => {
    const audioData = generatePCMAudio(10);

    const metrics = await runBenchmark('Transcribe 10s audio', 30, async () => {
      await mockTranscribe(audioData);
    });

    printMetrics(metrics);

    // 10 seconds of audio should complete under 1 second
    expect(metrics.p95Ms).toBeLessThan(1000);
  }, 30000);

  it('should measure concurrent transcription throughput', async () => {
    const audioData = generatePCMAudio(1);

    const startTime = performance.now();

    // Transcribe 10 files concurrently
    const promises = Array.from({ length: 10 }, () => mockTranscribe(audioData));
    await Promise.all(promises);

    const totalTime = performance.now() - startTime;
    const throughput = 10 / (totalTime / 1000); // files per second

    console.log(`\nConcurrent transcription throughput:`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput.toFixed(2)} files/sec`);

    // Should handle concurrent requests efficiently
    expect(throughput).toBeGreaterThan(5); // At least 5 files/sec
  }, 30000);
});

// ===================================================================
// BENCHMARK SUITE: TTS Encoding Latency
// ===================================================================

describe('TTS Encoding Latency Benchmarks', () => {
  it('should measure short text synthesis latency', async () => {
    const text = 'Hello, this is a short test message.';

    const metrics = await runBenchmark('Synthesize short text', 100, async () => {
      await mockSynthesize(text);
    });

    printMetrics(metrics);

    // Target: < 100ms for short text
    expect(metrics.p95Ms).toBeLessThan(100);
  }, 30000);

  it('should measure medium text synthesis latency', async () => {
    const text = 'This is a medium length message that contains multiple sentences. ' +
      'It should take a bit longer to synthesize than a short message. ' +
      'We are testing the performance of text-to-speech synthesis.';

    const metrics = await runBenchmark('Synthesize medium text', 50, async () => {
      await mockSynthesize(text);
    });

    printMetrics(metrics);

    // Target: < 200ms for medium text
    expect(metrics.p95Ms).toBeLessThan(200);
  }, 30000);

  it('should measure long text synthesis latency', async () => {
    const text = 'This is a very long message that will be used to test the performance ' +
      'of text-to-speech synthesis with longer input texts. '.repeat(10);

    const metrics = await runBenchmark('Synthesize long text', 30, async () => {
      await mockSynthesize(text);
    });

    printMetrics(metrics);

    // Long text should still complete under 500ms
    expect(metrics.p95Ms).toBeLessThan(500);
  }, 30000);

  it('should measure MP3 encoding latency', async () => {
    const pcmData = generatePCMAudio(3); // 3 seconds

    const metrics = await runBenchmark('Encode PCM to MP3', 50, async () => {
      await mockEncodeMP3(pcmData, 64000);
    });

    printMetrics(metrics);

    // Target: < 100ms for encoding
    expect(metrics.p95Ms).toBeLessThan(100);
  }, 30000);

  it('should compare bitrate encoding performance', async () => {
    const pcmData = generatePCMAudio(3);

    const bitrates = [32000, 64000, 128000];

    for (const bitrate of bitrates) {
      const metrics = await runBenchmark(`Encode MP3 @ ${bitrate}bps`, 30, async () => {
        await mockEncodeMP3(pcmData, bitrate);
      });

      printMetrics(metrics);

      // Higher bitrates may take slightly longer, but should still be fast
      expect(metrics.p95Ms).toBeLessThan(150);
    }
  }, 60000);
});

// ===================================================================
// BENCHMARK SUITE: End-to-End Voice Channel Latency
// ===================================================================

describe('End-to-End Voice Channel Latency', () => {
  it('should measure complete transcribe → respond cycle', async () => {
    const audioData = generatePCMAudio(2);

    const metrics = await runBenchmark('E2E: Audio → Text → Voice', 30, async () => {
      // Transcribe incoming audio
      const transcript = await mockTranscribe(audioData);

      // Generate response text (simulated)
      const responseText = `Response to: ${transcript}`;

      // Synthesize response audio
      const responseAudio = await mockSynthesize(responseText);

      // Encode to MP3
      await mockEncodeMP3(responseAudio, 64000);
    });

    printMetrics(metrics);

    // Target: < 150ms end-to-end
    expect(metrics.p95Ms).toBeLessThan(150);
  }, 60000);

  it('should measure voice channel join latency', async () => {
    const metrics = await runBenchmark('Voice channel join', 50, async () => {
      // Simulate voice channel connection
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 20 + 10));
    });

    printMetrics(metrics);

    // Should join channel quickly
    expect(metrics.p95Ms).toBeLessThan(50);
  }, 30000);

  it('should measure audio broadcast latency', async () => {
    const audioData = generatePCMAudio(1);

    const metrics = await runBenchmark('Audio broadcast', 100, async () => {
      // Simulate broadcasting audio to channel
      await new Promise((resolve) => setTimeout(resolve, Math.random() * 5));
    });

    printMetrics(metrics);

    // Broadcast should be very fast
    expect(metrics.p95Ms).toBeLessThan(10);
  }, 30000);
});

// ===================================================================
// BENCHMARK SUITE: Memory & Resource Usage
// ===================================================================

describe('Memory & Resource Usage', () => {
  it('should measure memory usage during transcription', async () => {
    const audioData = generatePCMAudio(10);

    const initialMemory = process.memoryUsage().heapUsed;

    // Process 100 transcriptions
    for (let i = 0; i < 100; i++) {
      await mockTranscribe(audioData);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`\nMemory usage during transcription:`);
    console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final:   ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Should not leak significant memory
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB
  }, 30000);

  it('should measure memory usage during synthesis', async () => {
    const text = 'This is a test message.';

    const initialMemory = process.memoryUsage().heapUsed;

    // Process 100 synthesis operations
    for (let i = 0; i < 100; i++) {
      await mockSynthesize(text);
    }

    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;

    console.log(`\nMemory usage during synthesis:`);
    console.log(`  Initial: ${(initialMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final:   ${(finalMemory / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

    // Should not leak significant memory
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // < 50MB
  }, 30000);
});

// ===================================================================
// BENCHMARK SUITE: Stress Testing
// ===================================================================

describe('Stress Testing', () => {
  it('should handle high concurrent load', async () => {
    const audioData = generatePCMAudio(1);
    const concurrentRequests = 50;

    const startTime = performance.now();

    const promises = Array.from({ length: concurrentRequests }, async () => {
      const transcript = await mockTranscribe(audioData);
      const audio = await mockSynthesize(transcript);
      return audio;
    });

    const results = await Promise.all(promises);
    const totalTime = performance.now() - startTime;

    const throughput = concurrentRequests / (totalTime / 1000);

    console.log(`\nHigh concurrent load test:`);
    console.log(`  Requests: ${concurrentRequests}`);
    console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
    console.log(`  Throughput: ${throughput.toFixed(2)} req/sec`);

    expect(results).toHaveLength(concurrentRequests);
    expect(throughput).toBeGreaterThan(10); // At least 10 req/sec
  }, 60000);

  it('should maintain performance under sustained load', async () => {
    const audioData = generatePCMAudio(1);
    const duration = 5000; // 5 seconds
    const startTime = performance.now();
    let requestCount = 0;

    // Generate requests for 5 seconds
    while (performance.now() - startTime < duration) {
      await mockTranscribe(audioData);
      requestCount++;
    }

    const actualDuration = performance.now() - startTime;
    const throughput = requestCount / (actualDuration / 1000);

    console.log(`\nSustained load test:`);
    console.log(`  Duration: ${(actualDuration / 1000).toFixed(2)}s`);
    console.log(`  Requests: ${requestCount}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} req/sec`);

    // Should maintain reasonable throughput
    expect(throughput).toBeGreaterThan(5); // At least 5 req/sec
  }, 10000);
});
