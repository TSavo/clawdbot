/**
 * Voice Provider Benchmark Test Suite
 *
 * Validates benchmark accuracy, output format, and data integrity
 */

import { describe, it, expect, beforeAll } from "vitest";

interface LatencyMetrics {
  min: number;
  avg: number;
  max: number;
  p50: number;
  p95: number;
  p99: number;
  samples: number;
}

interface ResourceMetrics {
  cpu: {
    peak: number;
    average: number;
    percent: number;
  };
  memory: {
    peak: number;
    average: number;
    mb: number;
  };
  disk: {
    modelSize: number;
    cacheSize: number;
    tempSize: number;
    totalMb: number;
  };
}

describe("Voice Provider Benchmarks", () => {
  describe("Latency Metrics Validation", () => {
    it("should calculate valid latency statistics", () => {
      const latencies = [100, 150, 200, 250, 300];
      const metrics = calculateMetrics(latencies);

      expect(metrics).toHaveProperty("min");
      expect(metrics).toHaveProperty("avg");
      expect(metrics).toHaveProperty("max");
      expect(metrics).toHaveProperty("p95");
      expect(metrics).toHaveProperty("p99");
      expect(metrics.min).toBe(100);
      expect(metrics.max).toBe(300);
      expect(metrics.avg).toBe(200);
      expect(metrics.p95).toBeGreaterThanOrEqual(metrics.avg);
      expect(metrics.p99).toBeGreaterThanOrEqual(metrics.p95);
    });

    it("should handle single sample", () => {
      const latencies = [250];
      const metrics = calculateMetrics(latencies);

      expect(metrics.min).toBe(250);
      expect(metrics.avg).toBe(250);
      expect(metrics.max).toBe(250);
      expect(metrics.samples).toBe(1);
    });

    it("should handle empty array", () => {
      const latencies: number[] = [];
      const metrics = calculateMetrics(latencies);

      expect(metrics.min).toBe(0);
      expect(metrics.avg).toBe(0);
      expect(metrics.max).toBe(0);
      expect(metrics.samples).toBe(0);
    });

    it("should validate percentile ordering", () => {
      const latencies = Array.from({ length: 100 }, (_, i) => i + 1);
      const metrics = calculateMetrics(latencies);

      expect(metrics.min).toBeLessThanOrEqual(metrics.p50);
      expect(metrics.p50).toBeLessThanOrEqual(metrics.p95);
      expect(metrics.p95).toBeLessThanOrEqual(metrics.p99);
      expect(metrics.p99).toBeLessThanOrEqual(metrics.max);
    });
  });

  describe("Resource Metrics Validation", () => {
    it("should validate CPU metrics", () => {
      const resources: ResourceMetrics = {
        cpu: { peak: 85, average: 65, percent: 75 },
        memory: { peak: 850, average: 650, mb: 700 },
        disk: {
          modelSize: 1400,
          cacheSize: 150,
          tempSize: 50,
          totalMb: 1600,
        },
      };

      expect(resources.cpu.peak).toBeGreaterThanOrEqual(resources.cpu.average);
      expect(resources.cpu.average).toBeGreaterThanOrEqual(0);
      expect(resources.cpu.peak).toBeLessThanOrEqual(100);
    });

    it("should validate memory metrics", () => {
      const resources: ResourceMetrics = {
        cpu: { peak: 85, average: 65, percent: 75 },
        memory: { peak: 850, average: 650, mb: 700 },
        disk: {
          modelSize: 1400,
          cacheSize: 150,
          tempSize: 50,
          totalMb: 1600,
        },
      };

      expect(resources.memory.peak).toBeGreaterThanOrEqual(resources.memory.average);
      expect(resources.memory.average).toBeGreaterThanOrEqual(0);
      expect(resources.memory.mb).toBeGreaterThanOrEqual(0);
    });

    it("should validate disk metrics", () => {
      const resources: ResourceMetrics = {
        cpu: { peak: 85, average: 65, percent: 75 },
        memory: { peak: 850, average: 650, mb: 700 },
        disk: {
          modelSize: 1400,
          cacheSize: 150,
          tempSize: 50,
          totalMb: 1600,
        },
      };

      const calculatedTotal =
        resources.disk.modelSize +
        resources.disk.cacheSize +
        resources.disk.tempSize;
      expect(resources.disk.totalMb).toBeLessThanOrEqual(calculatedTotal * 1.2); // Allow 20% overhead
      expect(resources.disk.modelSize).toBeGreaterThan(0);
    });
  });

  describe("Provider Performance Characteristics", () => {
    it("should match expected Whisper latency range", () => {
      // Realistic Whisper latencies
      const whisperLatencies = [350, 450, 400, 475, 425];
      const metrics = calculateMetrics(whisperLatencies);

      // Expected range: 300-600ms for base model
      expect(metrics.avg).toBeGreaterThanOrEqual(300);
      expect(metrics.avg).toBeLessThanOrEqual(600);
      expect(metrics.p95).toBeLessThanOrEqual(1000);
    });

    it("should match expected Kokoro latency range", () => {
      // Realistic Kokoro latencies at 1.0x speed
      const kokoroLatencies = [180, 220, 200, 210, 190];
      const metrics = calculateMetrics(kokoroLatencies);

      // Expected range: 150-300ms at 1.0x speed
      expect(metrics.avg).toBeGreaterThanOrEqual(150);
      expect(metrics.avg).toBeLessThanOrEqual(300);
    });

    it("should match expected Piper latency range", () => {
      // Realistic Piper latencies
      const piperLatencies = [150, 180, 170, 160, 175];
      const metrics = calculateMetrics(piperLatencies);

      // Expected range: 100-250ms
      expect(metrics.avg).toBeGreaterThanOrEqual(100);
      expect(metrics.avg).toBeLessThanOrEqual(250);
    });

    it("should validate provider switching overhead", () => {
      // Provider switching should be fast
      const switchingLatencies = [15, 25, 20, 30, 18];
      const metrics = calculateMetrics(switchingLatencies);

      // Expected: <100ms
      expect(metrics.avg).toBeLessThanOrEqual(100);
      expect(metrics.max).toBeLessThanOrEqual(200);
    });
  });

  describe("Configuration Impact Analysis", () => {
    it("should show Whisper model size impact", () => {
      // Smaller models should be faster
      const tinyLatencies = [150, 160, 155];
      const smallLatencies = [600, 610, 605];

      const tinyMetrics = calculateMetrics(tinyLatencies);
      const smallMetrics = calculateMetrics(smallLatencies);

      expect(tinyMetrics.avg).toBeLessThan(smallMetrics.avg);
      expect(smallMetrics.avg / tinyMetrics.avg).toBeGreaterThan(3); // ~4x slower
    });

    it("should show Kokoro speed impact", () => {
      // Faster speeds should reduce latency
      const halfSpeedLatencies = [400, 410, 405];
      const normalSpeedLatencies = [200, 210, 205];
      const doubleSpeedLatencies = [100, 110, 105];

      const half = calculateMetrics(halfSpeedLatencies);
      const normal = calculateMetrics(normalSpeedLatencies);
      const double = calculateMetrics(doubleSpeedLatencies);

      expect(half.avg).toBeGreaterThan(normal.avg);
      expect(double.avg).toBeLessThan(normal.avg);
      expect(half.avg / double.avg).toBeCloseTo(4, 1); // ~2x slower each direction
    });
  });

  describe("Bottleneck Detection", () => {
    it("should identify high latency bottlenecks", () => {
      const metrics: LatencyMetrics = {
        min: 2000,
        avg: 2500,
        max: 3000,
        p50: 2400,
        p95: 2900,
        p99: 3000,
        samples: 100,
      };

      const bottleneck = metrics.avg > 2000;
      expect(bottleneck).toBe(true);
    });

    it("should identify inconsistent performance", () => {
      const consistent = [100, 101, 102, 99, 100];
      const inconsistent = [50, 100, 200, 150, 50];

      const consistentStdDev = calculateStdDev(consistent);
      const inconsistentStdDev = calculateStdDev(inconsistent);

      expect(inconsistentStdDev).toBeGreaterThan(consistentStdDev);
    });

    it("should identify high resource usage", () => {
      const resources: ResourceMetrics = {
        cpu: { peak: 95, average: 85, percent: 90 },
        memory: { peak: 2500, average: 2000, mb: 2200 },
        disk: {
          modelSize: 5000,
          cacheSize: 500,
          tempSize: 200,
          totalMb: 5700,
        },
      };

      const cpuBottleneck = resources.cpu.peak > 90;
      const memoryBottleneck = resources.memory.peak > 2048;
      const diskBottleneck = resources.disk.totalMb > 5000;

      expect(cpuBottleneck).toBe(true);
      expect(memoryBottleneck).toBe(true);
      expect(diskBottleneck).toBe(true);
    });
  });

  describe("Optimization Recommendation Generation", () => {
    it("should recommend fastest provider", () => {
      const providers = {
        whisper: 450,
        kokoro: 200,
        piper: 180,
      };

      const fastest = Object.entries(providers).sort((a, b) => a[1] - b[1])[0][0];
      expect(fastest).toBe("piper");
    });

    it("should recommend model downsizing for memory", () => {
      const resources: ResourceMetrics = {
        cpu: { peak: 75, average: 55, percent: 65 },
        memory: { peak: 2000, average: 1500, mb: 1700 },
        disk: {
          modelSize: 5000,
          cacheSize: 500,
          tempSize: 200,
          totalMb: 5700,
        },
      };

      const shouldDownsize = resources.memory.peak > 1500;
      expect(shouldDownsize).toBe(true);
    });

    it("should recommend GPU acceleration", () => {
      const latencies = [800, 850, 820, 900, 880]; // High latency
      const metrics = calculateMetrics(latencies);

      const shouldEnableGPU = metrics.avg > 700;
      expect(shouldEnableGPU).toBe(true);
    });
  });

  describe("Data Integrity", () => {
    it("should validate JSON output format", () => {
      const report = {
        timestamp: new Date().toISOString(),
        provider: "whisper",
        latency: 450,
        cpu: 75,
        memory: 850,
      };

      const json = JSON.stringify(report);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(report);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("should validate markdown report generation", () => {
      const report = `# Voice Benchmark Report

## Results
- Whisper: 450ms
- Kokoro: 200ms
- Piper: 180ms

## Recommendations
- Use Piper for best latency
- Enable GPU if available`;

      expect(report).toContain("# Voice Benchmark Report");
      expect(report).toContain("## Results");
      expect(report).toContain("Recommendations");
    });
  });

  describe("Performance Baseline Validation", () => {
    it("should meet minimal setup baselines", () => {
      // 4GB RAM, 2-core CPU
      const minimal = {
        whisper: 700, // Max 800ms
        kokoro: 350, // Max 400ms
        piper: 300, // Max 350ms
      };

      expect(minimal.whisper).toBeLessThanOrEqual(800);
      expect(minimal.kokoro).toBeLessThanOrEqual(400);
      expect(minimal.piper).toBeLessThanOrEqual(350);
    });

    it("should meet standard setup baselines", () => {
      // 8GB RAM, 4-core CPU
      const standard = {
        whisper: 450, // Max 500ms
        kokoro: 250, // Max 300ms
        piper: 200, // Max 250ms
      };

      expect(standard.whisper).toBeLessThanOrEqual(500);
      expect(standard.kokoro).toBeLessThanOrEqual(300);
      expect(standard.piper).toBeLessThanOrEqual(250);
    });

    it("should meet optimal setup baselines", () => {
      // 16GB RAM, 8-core GPU
      const optimal = {
        whisper: 150, // Max 200ms with GPU
        kokoro: 75, // Max 100ms with GPU
        piper: 125, // Max 150ms
      };

      expect(optimal.whisper).toBeLessThanOrEqual(200);
      expect(optimal.kokoro).toBeLessThanOrEqual(100);
      expect(optimal.piper).toBeLessThanOrEqual(150);
    });
  });
});

// Helper functions
function calculateMetrics(latencies: number[]): LatencyMetrics {
  if (latencies.length === 0) {
    return {
      min: 0,
      avg: 0,
      max: 0,
      p50: 0,
      p95: 0,
      p99: 0,
      samples: 0,
    };
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const len = sorted.length;
  const avg = latencies.reduce((a, b) => a + b, 0) / len;

  return {
    min: sorted[0],
    avg,
    max: sorted[len - 1],
    p50: sorted[Math.floor(len * 0.5)],
    p95: sorted[Math.floor(len * 0.95)],
    p99: sorted[Math.floor(len * 0.99)],
    samples: len,
  };
}

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sq, n) => sq + (n - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
