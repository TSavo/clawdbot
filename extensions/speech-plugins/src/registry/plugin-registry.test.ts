import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { STTProvider } from "../interfaces/stt-provider.js";
import type { TTSProvider } from "../interfaces/tts-provider.js";
import type { PluginRegistry } from "../interfaces/plugin-registry.js";
import { createMockSTTProvider, createMockTTSProvider } from "../test-utils/mocks.js";

// This is a placeholder for the actual registry implementation
class SimplePluginRegistry implements PluginRegistry {
  private sttProviders = new Map<string, STTProvider>();
  private ttsProviders = new Map<string, TTSProvider>();
  private config: Array<{ id: string; type: "stt" | "tts"; module: string; config?: unknown; enabled?: boolean; priority?: number }> = [];

  async registerSTTProvider(provider: STTProvider): Promise<void> {
    this.sttProviders.set(provider.metadata.id, provider);
    this.config.push({
      id: provider.metadata.id,
      type: "stt",
      module: provider.metadata.id,
      enabled: true,
    });
  }

  async registerTTSProvider(provider: TTSProvider): Promise<void> {
    this.ttsProviders.set(provider.metadata.id, provider);
    this.config.push({
      id: provider.metadata.id,
      type: "tts",
      module: provider.metadata.id,
      enabled: true,
    });
  }

  getSTTProviders(): STTProvider[] {
    return Array.from(this.sttProviders.values());
  }

  getTTSProviders(): TTSProvider[] {
    return Array.from(this.ttsProviders.values());
  }

  getSTTProvider(providerId: string): STTProvider | undefined {
    return this.sttProviders.get(providerId);
  }

  getTTSProvider(providerId: string): TTSProvider | undefined {
    return this.ttsProviders.get(providerId);
  }

  getDefaultSTTProvider(): STTProvider | undefined {
    return this.getSTTProviders()[0];
  }

  getDefaultTTSProvider(): TTSProvider | undefined {
    return this.getTTSProviders()[0];
  }

  async unregisterProvider(providerId: string, type: "stt" | "tts"): Promise<void> {
    if (type === "stt") {
      this.sttProviders.delete(providerId);
    } else {
      this.ttsProviders.delete(providerId);
    }
    this.config = this.config.filter((c) => c.id !== providerId);
  }

  async loadFromConfig(configPath: string): Promise<void> {
    // Mock implementation
  }

  getConfig() {
    return [...this.config];
  }

  async initializeAll(): Promise<void> {
    for (const provider of this.sttProviders.values()) {
      await provider.initialize();
    }
    for (const provider of this.ttsProviders.values()) {
      await provider.initialize();
    }
  }

  async shutdownAll(): Promise<void> {
    for (const provider of this.sttProviders.values()) {
      await provider.shutdown?.();
    }
    for (const provider of this.ttsProviders.values()) {
      await provider.shutdown?.();
    }
  }
}

describe("Plugin Registry", () => {
  let registry: PluginRegistry;
  let mockSTT: STTProvider;
  let mockTTS: TTSProvider;

  beforeEach(() => {
    registry = new SimplePluginRegistry();
    mockSTT = createMockSTTProvider("stt-1");
    mockTTS = createMockTTSProvider("tts-1");
  });

  afterEach(async () => {
    try {
      await registry.shutdownAll();
    } catch {
      // Ignore shutdown errors in afterEach
    }
  });

  describe("Provider Registration", () => {
    it("should register STT provider", async () => {
      await registry.registerSTTProvider(mockSTT);
      expect(registry.getSTTProviders().length).toBe(1);
      expect(registry.getSTTProvider("stt-1")).toBe(mockSTT);
    });

    it("should register TTS provider", async () => {
      await registry.registerTTSProvider(mockTTS);
      expect(registry.getTTSProviders().length).toBe(1);
      expect(registry.getTTSProvider("tts-1")).toBe(mockTTS);
    });

    it("should register multiple STT providers", async () => {
      const stt2 = createMockSTTProvider("stt-2");
      const stt3 = createMockSTTProvider("stt-3");

      await registry.registerSTTProvider(mockSTT);
      await registry.registerSTTProvider(stt2);
      await registry.registerSTTProvider(stt3);

      expect(registry.getSTTProviders().length).toBe(3);
    });

    it("should register multiple TTS providers", async () => {
      const tts2 = createMockTTSProvider("tts-2");
      const tts3 = createMockTTSProvider("tts-3");

      await registry.registerTTSProvider(mockTTS);
      await registry.registerTTSProvider(tts2);
      await registry.registerTTSProvider(tts3);

      expect(registry.getTTSProviders().length).toBe(3);
    });

    it("should mix STT and TTS providers", async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);

      expect(registry.getSTTProviders().length).toBe(1);
      expect(registry.getTTSProviders().length).toBe(1);
    });
  });

  describe("Provider Discovery", () => {
    beforeEach(async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);
    });

    it("should get provider by ID", () => {
      const stt = registry.getSTTProvider("stt-1");
      expect(stt).toBeDefined();
      expect(stt?.metadata.id).toBe("stt-1");

      const tts = registry.getTTSProvider("tts-1");
      expect(tts).toBeDefined();
      expect(tts?.metadata.id).toBe("tts-1");
    });

    it("should return undefined for unknown provider", () => {
      expect(registry.getSTTProvider("unknown")).toBeUndefined();
      expect(registry.getTTSProvider("unknown")).toBeUndefined();
    });

    it("should return default providers", () => {
      const defaultSTT = registry.getDefaultSTTProvider();
      expect(defaultSTT).toBeDefined();
      expect(defaultSTT?.metadata.id).toBe("stt-1");

      const defaultTTS = registry.getDefaultTTSProvider();
      expect(defaultTTS).toBeDefined();
      expect(defaultTTS?.metadata.id).toBe("tts-1");
    });

    it("should return first provider as default when multiple registered", async () => {
      const stt2 = createMockSTTProvider("stt-2");
      await registry.registerSTTProvider(stt2);

      const defaultSTT = registry.getDefaultSTTProvider();
      expect(defaultSTT?.metadata.id).toBe("stt-1");
    });

    it("should return undefined for default when no providers registered", () => {
      const emptyRegistry = new SimplePluginRegistry();
      expect(emptyRegistry.getDefaultSTTProvider()).toBeUndefined();
      expect(emptyRegistry.getDefaultTTSProvider()).toBeUndefined();
    });
  });

  describe("Provider Unregistration", () => {
    beforeEach(async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);
    });

    it("should unregister STT provider", async () => {
      await registry.unregisterProvider("stt-1", "stt");
      expect(registry.getSTTProvider("stt-1")).toBeUndefined();
      expect(registry.getSTTProviders().length).toBe(0);
    });

    it("should unregister TTS provider", async () => {
      await registry.unregisterProvider("tts-1", "tts");
      expect(registry.getTTSProvider("tts-1")).toBeUndefined();
      expect(registry.getTTSProviders().length).toBe(0);
    });

    it("should not affect other providers when unregistering one", async () => {
      const stt2 = createMockSTTProvider("stt-2");
      await registry.registerSTTProvider(stt2);

      await registry.unregisterProvider("stt-1", "stt");

      expect(registry.getSTTProvider("stt-1")).toBeUndefined();
      expect(registry.getSTTProvider("stt-2")).toBeDefined();
      expect(registry.getSTTProviders().length).toBe(1);
    });

    it("should not affect TTS when unregistering STT", async () => {
      await registry.unregisterProvider("stt-1", "stt");

      expect(registry.getTTSProvider("tts-1")).toBeDefined();
      expect(registry.getTTSProviders().length).toBe(1);
    });
  });

  describe("Configuration Management", () => {
    beforeEach(async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);
    });

    it("should retrieve configuration", () => {
      const config = registry.getConfig();
      expect(Array.isArray(config)).toBe(true);
      expect(config.length).toBeGreaterThanOrEqual(2);
    });

    it("should track provider type in configuration", () => {
      const config = registry.getConfig();
      const sttConfig = config.find((c) => c.id === "stt-1");
      const ttsConfig = config.find((c) => c.id === "tts-1");

      expect(sttConfig?.type).toBe("stt");
      expect(ttsConfig?.type).toBe("tts");
    });

    it("should track provider enabled status", () => {
      const config = registry.getConfig();
      for (const item of config) {
        expect(typeof item.enabled).toBe("boolean");
      }
    });
  });

  describe("Provider Initialization", () => {
    it("should initialize all providers", async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);

      await registry.initializeAll();

      expect(mockSTT.initialize).toHaveBeenCalled();
      expect(mockTTS.initialize).toHaveBeenCalled();
    });

    it("should handle initialization errors", async () => {
      const errorSTT = createMockSTTProvider("error-stt");
      const initError = new Error("Initialization failed");
      (errorSTT.initialize as any).mockRejectedValue(initError);

      await registry.registerSTTProvider(errorSTT);

      await expect(registry.initializeAll()).rejects.toThrow("Initialization failed");
    });

    it("should initialize empty registry without error", async () => {
      const emptyRegistry = new SimplePluginRegistry();
      await expect(emptyRegistry.initializeAll()).resolves.not.toThrow();
    });
  });

  describe("Provider Shutdown", () => {
    beforeEach(async () => {
      await registry.registerSTTProvider(mockSTT);
      await registry.registerTTSProvider(mockTTS);
    });

    it("should shutdown all providers", async () => {
      await registry.shutdownAll();

      expect(mockSTT.shutdown).toHaveBeenCalled();
      expect(mockTTS.shutdown).toHaveBeenCalled();
    });

    it("should handle optional shutdown", async () => {
      const sttNoShutdown = createMockSTTProvider("stt-no-shutdown");
      delete (sttNoShutdown as any).shutdown;

      await registry.registerSTTProvider(sttNoShutdown);
      await expect(registry.shutdownAll()).resolves.not.toThrow();
    });

    it("should handle shutdown errors gracefully", async () => {
      const errorTTS = createMockTTSProvider("error-tts");
      (errorTTS.shutdown as any).mockImplementation(async () => {
        throw new Error("Shutdown failed");
      });

      await registry.registerTTSProvider(errorTTS);
      let thrownError: Error | undefined;
      try {
        await registry.shutdownAll();
      } catch (error) {
        thrownError = error as Error;
      }

      expect(thrownError).toBeDefined();
      expect(thrownError?.message).toContain("Shutdown failed");
    });

    it("should shutdown empty registry without error", async () => {
      const emptyRegistry = new SimplePluginRegistry();
      await expect(emptyRegistry.shutdownAll()).resolves.not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle duplicate registration of same provider ID", async () => {
      await registry.registerSTTProvider(mockSTT);

      const duplicate = createMockSTTProvider("stt-1");
      await registry.registerSTTProvider(duplicate);

      // Should replace the old one
      expect(registry.getSTTProviders().length).toBe(1);
      expect(registry.getSTTProvider("stt-1")).toBe(duplicate);
    });

    it("should handle concurrent registration", async () => {
      const providers = [
        createMockSTTProvider("stt-a"),
        createMockSTTProvider("stt-b"),
        createMockSTTProvider("stt-c"),
      ];

      await Promise.all(providers.map((p) => registry.registerSTTProvider(p)));

      expect(registry.getSTTProviders().length).toBe(3);
    });

    it("should get all providers of each type", async () => {
      const stt1 = createMockSTTProvider("stt-1");
      const stt2 = createMockSTTProvider("stt-2");
      const tts1 = createMockTTSProvider("tts-1");
      const tts2 = createMockTTSProvider("tts-2");

      await registry.registerSTTProvider(stt1);
      await registry.registerSTTProvider(stt2);
      await registry.registerTTSProvider(tts1);
      await registry.registerTTSProvider(tts2);

      expect(registry.getSTTProviders().length).toBe(2);
      expect(registry.getTTSProviders().length).toBe(2);
    });
  });
});
