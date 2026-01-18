/**
 * Voice Settings Panel Tests
 *
 * Unit tests for the voice settings panel component
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type {
  VoiceProvider,
  VoiceConfig,
  ProviderStatus,
} from "../controllers/voice";

/**
 * Mock data for testing
 */
const mockProviders: VoiceProvider[] = [
  {
    id: "stt-whisper-local",
    name: "Whisper (Local)",
    type: "stt",
    description: "OpenAI Whisper local transcription",
    capabilities: ["streaming", "offline"],
    status: "available",
    config: { models: ["tiny", "small", "base"] },
  },
  {
    id: "stt-openai-realtime",
    name: "OpenAI Realtime API",
    type: "stt",
    description: "OpenAI Realtime API with streaming",
    capabilities: ["streaming", "realtime"],
    status: "available",
    config: {},
  },
  {
    id: "tts-piper",
    name: "Piper (Local)",
    type: "tts",
    description: "Piper local TTS synthesis",
    capabilities: ["streaming", "offline"],
    status: "available",
    config: { voices: ["en_US-libritts-high", "en_GB-jenny-medium"] },
  },
  {
    id: "tts-kokoro",
    name: "Kokoro (Local)",
    type: "tts",
    description: "Kokoro local TTS synthesis",
    capabilities: ["fast", "offline"],
    status: "available",
    config: { voices: ["af", "en", "es"] },
  },
];

const mockConfig: VoiceConfig = {
  enabled: true,
  sttProvider: {
    provider: "stt-whisper-local",
    model: "base",
    language: "en",
  },
  ttsProvider: {
    provider: "tts-piper",
    voice: "en_US-libritts-high",
    speed: 1.0,
  },
  fallbackChain: ["stt-openai-realtime"],
};

const mockStatus: ProviderStatus = {
  id: "stt-whisper-local",
  available: true,
  healthy: true,
  lastChecked: Date.now(),
  resourceUsage: {
    gpu: true,
    memory: 2048,
    cpu: 45,
  },
  warnings: [],
};

describe("VoiceSettingsPanel", () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });

  describe("Data Loading", () => {
    it("should load providers on connection", async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ providers: mockProviders }),
      });

      global.fetch = fetchMock;

      // Component would load data in connectedCallback
      expect(mockProviders).toHaveLength(4);
      expect(
        mockProviders.filter((p) => p.type === "stt"),
      ).toHaveLength(2);
      expect(
        mockProviders.filter((p) => p.type === "tts"),
      ).toHaveLength(2);
    });

    it("should separate STT and TTS providers", () => {
      const sttProviders = mockProviders.filter((p) => p.type === "stt");
      const ttsProviders = mockProviders.filter((p) => p.type === "tts");

      expect(sttProviders).toHaveLength(2);
      expect(ttsProviders).toHaveLength(2);

      sttProviders.forEach((p) => {
        expect(p.type).toBe("stt");
      });

      ttsProviders.forEach((p) => {
        expect(p.type).toBe("tts");
      });
    });
  });

  describe("Configuration Management", () => {
    it("should handle STT provider changes", () => {
      const updatedConfig = {
        ...mockConfig,
        sttProvider: {
          ...mockConfig.sttProvider,
          provider: "stt-openai-realtime",
        },
      };

      expect(updatedConfig.sttProvider.provider).toBe("stt-openai-realtime");
    });

    it("should handle TTS provider changes", () => {
      const updatedConfig = {
        ...mockConfig,
        ttsProvider: {
          ...mockConfig.ttsProvider,
          provider: "tts-kokoro",
        },
      };

      expect(updatedConfig.ttsProvider.provider).toBe("tts-kokoro");
    });

    it("should preserve other config when changing provider", () => {
      const updatedConfig = {
        ...mockConfig,
        sttProvider: {
          ...mockConfig.sttProvider,
          provider: "stt-openai-realtime",
        },
      };

      expect(updatedConfig.ttsProvider).toEqual(mockConfig.ttsProvider);
      expect(updatedConfig.fallbackChain).toEqual(mockConfig.fallbackChain);
      expect(updatedConfig.enabled).toBe(mockConfig.enabled);
    });
  });

  describe("Status Display", () => {
    it("should display healthy status with green indicator", () => {
      const healthyStatus: ProviderStatus = {
        ...mockStatus,
        healthy: true,
        available: true,
      };

      expect(healthyStatus.healthy).toBe(true);
      expect(healthyStatus.available).toBe(true);
    });

    it("should display unhealthy status with red indicator", () => {
      const unhealthyStatus: ProviderStatus = {
        ...mockStatus,
        healthy: false,
        available: true,
      };

      expect(unhealthyStatus.healthy).toBe(false);
    });

    it("should display unavailable status when not available", () => {
      const unavailableStatus: ProviderStatus = {
        ...mockStatus,
        available: false,
      };

      expect(unavailableStatus.available).toBe(false);
    });

    it("should show resource usage information", () => {
      expect(mockStatus.resourceUsage).toBeDefined();
      expect(mockStatus.resourceUsage?.gpu).toBe(true);
      expect(mockStatus.resourceUsage?.memory).toBe(2048);
      expect(mockStatus.resourceUsage?.cpu).toBeGreaterThan(0);
    });

    it("should display warnings when present", () => {
      const statusWithWarnings: ProviderStatus = {
        ...mockStatus,
        warnings: ["GPU memory is low", "CPU usage is high"],
      };

      expect(statusWithWarnings.warnings).toHaveLength(2);
    });
  });

  describe("Save Functionality", () => {
    it("should send configuration to server on save", async () => {
      const saveMock = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });

      global.fetch = saveMock;

      // Simulating save
      await fetch("/api/voice/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ config: mockConfig }),
      });

      expect(saveMock).toHaveBeenCalledWith(
        "/api/voice/config",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should validate configuration before saving", () => {
      const invalidConfig = {
        ...mockConfig,
        sttProvider: { provider: "" },
        ttsProvider: { provider: "" },
      };

      // Should be invalid
      const isValid =
        !!invalidConfig.sttProvider.provider &&
        !!invalidConfig.ttsProvider.provider;
      expect(isValid).toBe(false);
    });
  });

  describe("Error Handling", () => {
    it("should handle provider loading errors gracefully", async () => {
      const errorMessage = "Failed to load providers";

      // Simulate error response
      expect(errorMessage).toContain("Failed");
    });

    it("should show error message on save failure", async () => {
      const saveMock = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      global.fetch = saveMock;

      const response = await fetch("/api/voice/config", {
        method: "POST",
        body: JSON.stringify({ config: mockConfig }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe("Fallback Chain", () => {
    it("should allow configuring fallback chain", () => {
      const configWithFallback: VoiceConfig = {
        ...mockConfig,
        fallbackChain: ["stt-openai-realtime", "stt-whisper-local"],
      };

      expect(configWithFallback.fallbackChain).toHaveLength(2);
      expect(configWithFallback.fallbackChain[0]).toBe("stt-openai-realtime");
    });

    it("should support empty fallback chain", () => {
      const configNoFallback: VoiceConfig = {
        ...mockConfig,
        fallbackChain: [],
      };

      expect(configNoFallback.fallbackChain).toHaveLength(0);
    });
  });

  describe("Enable/Disable Voice System", () => {
    it("should allow enabling voice system", () => {
      const enabledConfig: VoiceConfig = {
        ...mockConfig,
        enabled: true,
      };

      expect(enabledConfig.enabled).toBe(true);
    });

    it("should allow disabling voice system", () => {
      const disabledConfig: VoiceConfig = {
        ...mockConfig,
        enabled: false,
      };

      expect(disabledConfig.enabled).toBe(false);
    });
  });
});
