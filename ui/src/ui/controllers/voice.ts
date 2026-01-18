/**
 * Voice Settings Controller
 *
 * Manages fetching and updating voice provider configurations.
 * Provides data loading functions for the voice settings UI.
 */

import type { ClawdbotApp } from "../app";

/**
 * Represents a voice provider with its capabilities
 */
export interface VoiceProvider {
  id: string;
  name: string;
  type: "stt" | "tts";
  description: string;
  capabilities: string[];
  status: "available" | "unavailable" | "error";
  error?: string;
  config?: Record<string, unknown>;
}

/**
 * STT provider configuration
 */
export interface STTConfig {
  provider: string;
  model?: string;
  language?: string;
  [key: string]: unknown;
}

/**
 * TTS provider configuration
 */
export interface TTSConfig {
  provider: string;
  voice?: string;
  speed?: number;
  instructions?: string;
  [key: string]: unknown;
}

/**
 * Voice system configuration
 */
export interface VoiceConfig {
  sttProvider: STTConfig;
  ttsProvider: TTSConfig;
  fallbackChain?: string[];
  enabled: boolean;
}

/**
 * Provider status information
 */
export interface ProviderStatus {
  id: string;
  available: boolean;
  healthy: boolean;
  lastChecked: number;
  resourceUsage?: {
    gpu?: boolean;
    memory?: number;
    cpu?: number;
  };
  warnings?: string[];
}

/**
 * Test results for TTS/STT
 */
export interface VoiceTestResult {
  success: boolean;
  provider: string;
  type: "tts" | "stt";
  duration: number;
  error?: string;
  audio?: {
    duration: number;
    format: string;
  };
  transcript?: string;
}

/**
 * Load available voice providers
 */
export async function loadVoiceProviders(
  host: ClawdbotApp,
): Promise<VoiceProvider[]> {
  try {
    const response = await fetch("/api/voice/providers", {
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load providers: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { providers: VoiceProvider[] };
    host.voiceProviders = data.providers;
    return data.providers;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading voice providers:", errorMessage);
    host.voiceProviders = [];
    return [];
  }
}

/**
 * Load current voice configuration
 */
export async function loadVoiceConfig(
  host: ClawdbotApp,
): Promise<VoiceConfig | null> {
  try {
    const response = await fetch("/api/voice/config", {
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load config: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { config: VoiceConfig };
    host.voiceConfig = data.config;
    return data.config;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading voice config:", errorMessage);
    return null;
  }
}

/**
 * Save voice configuration
 */
export async function saveVoiceConfig(
  host: ClawdbotApp,
  config: VoiceConfig,
): Promise<boolean> {
  try {
    const response = await fetch("/api/voice/config", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ config }),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to save config: ${response.status} ${response.statusText}`,
      );
    }

    host.voiceConfig = config;
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error saving voice config:", errorMessage);
    return false;
  }
}

/**
 * Get provider status information
 */
export async function loadProviderStatus(
  host: ClawdbotApp,
  providerId: string,
): Promise<ProviderStatus | null> {
  try {
    const response = await fetch(`/api/voice/providers/${providerId}/status`, {
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load status: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { status: ProviderStatus };
    return data.status;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading provider status:", errorMessage);
    return null;
  }
}

/**
 * Test TTS provider
 */
export async function testTTSProvider(
  host: ClawdbotApp,
  providerId: string,
  text: string,
  options?: Record<string, unknown>,
): Promise<VoiceTestResult | null> {
  try {
    const response = await fetch("/api/voice/test-tts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        providerId,
        text,
        options,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Test failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { result: VoiceTestResult };
    return data.result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error testing TTS provider:", errorMessage);
    return {
      success: false,
      provider: providerId,
      type: "tts",
      duration: 0,
      error: errorMessage,
    };
  }
}

/**
 * Test STT provider
 */
export async function testSTTProvider(
  host: ClawdbotApp,
  providerId: string,
  audioBuffer: ArrayBuffer,
): Promise<VoiceTestResult | null> {
  try {
    const formData = new FormData();
    formData.append("providerId", providerId);
    formData.append("audio", new Blob([audioBuffer], { type: "audio/wav" }));

    const response = await fetch("/api/voice/test-stt", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${host.sessionKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      throw new Error(
        `Test failed: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as { result: VoiceTestResult };
    return data.result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error testing STT provider:", errorMessage);
    return {
      success: false,
      provider: providerId,
      type: "stt",
      duration: 0,
      error: errorMessage,
    };
  }
}

/**
 * Get provider capabilities (voices, models, languages, etc.)
 */
export async function loadProviderCapabilities(
  host: ClawdbotApp,
  providerId: string,
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(
      `/api/voice/providers/${providerId}/capabilities`,
      {
        headers: {
          Authorization: `Bearer ${host.sessionKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to load capabilities: ${response.status} ${response.statusText}`,
      );
    }

    const data =
      (await response.json()) as Record<string, unknown>;
    return data;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error loading capabilities:", errorMessage);
    return null;
  }
}
