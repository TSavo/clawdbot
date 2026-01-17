/**
 * Simple Plugin Registry Implementation
 *
 * Manages registration, lifecycle, and configuration of STT/TTS providers
 * with support for multiple deployment modes (system, docker, cloud).
 */

import type {
  PluginRegistry,
  ProviderConfig,
  RegistryEventListener,
} from "../interfaces/plugin-registry.js";
import type { STTProvider } from "../interfaces/stt-provider.js";
import type { TTSProvider } from "../interfaces/tts-provider.js";
import type { DeploymentConfig, ProviderPluginConfig } from "../providers/index.js";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Simple implementation of PluginRegistry
 */
export class SimplePluginRegistry implements PluginRegistry {
  private sttProviders = new Map<string, STTProvider>();
  private ttsProviders = new Map<string, TTSProvider>();
  private config: ProviderConfig[] = [];
  private listeners: RegistryEventListener[] = [];

  /**
   * Register an STT provider
   */
  async registerSTTProvider(provider: STTProvider): Promise<void> {
    const providerId = provider.metadata.id;

    if (this.sttProviders.has(providerId)) {
      throw new Error(`STT provider "${providerId}" is already registered`);
    }

    this.sttProviders.set(providerId, provider);

    // Notify listeners
    for (const listener of this.listeners) {
      listener.onProviderRegistered?.(provider, "stt");
    }
  }

  /**
   * Register a TTS provider
   */
  async registerTTSProvider(provider: TTSProvider): Promise<void> {
    const providerId = provider.metadata.id;

    if (this.ttsProviders.has(providerId)) {
      throw new Error(`TTS provider "${providerId}" is already registered`);
    }

    this.ttsProviders.set(providerId, provider);

    // Notify listeners
    for (const listener of this.listeners) {
      listener.onProviderRegistered?.(provider, "tts");
    }
  }

  /**
   * Get all registered STT providers
   */
  getSTTProviders(): STTProvider[] {
    return Array.from(this.sttProviders.values());
  }

  /**
   * Get all registered TTS providers
   */
  getTTSProviders(): TTSProvider[] {
    return Array.from(this.ttsProviders.values());
  }

  /**
   * Get specific STT provider by ID
   */
  getSTTProvider(providerId: string): STTProvider | undefined {
    return this.sttProviders.get(providerId);
  }

  /**
   * Get specific TTS provider by ID
   */
  getTTSProvider(providerId: string): TTSProvider | undefined {
    return this.ttsProviders.get(providerId);
  }

  /**
   * Get default/preferred STT provider (highest priority enabled provider)
   */
  getDefaultSTTProvider(): STTProvider | undefined {
    const enabledProviders = this.config
      .filter((cfg) => cfg.type === "stt" && cfg.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (enabledProviders.length === 0) {
      // No config, return first provider
      return this.getSTTProviders()[0];
    }

    const defaultId = enabledProviders[0].id;
    return this.sttProviders.get(defaultId);
  }

  /**
   * Get default/preferred TTS provider (highest priority enabled provider)
   */
  getDefaultTTSProvider(): TTSProvider | undefined {
    const enabledProviders = this.config
      .filter((cfg) => cfg.type === "tts" && cfg.enabled !== false)
      .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    if (enabledProviders.length === 0) {
      // No config, return first provider
      return this.getTTSProviders()[0];
    }

    const defaultId = enabledProviders[0].id;
    return this.ttsProviders.get(defaultId);
  }

  /**
   * Unregister provider by ID
   */
  async unregisterProvider(providerId: string, type: "stt" | "tts"): Promise<void> {
    const providers = type === "stt" ? this.sttProviders : this.ttsProviders;
    const provider = providers.get(providerId);

    if (!provider) {
      throw new Error(`Provider "${providerId}" of type "${type}" is not registered`);
    }

    // Shutdown provider if it has shutdown method
    if (provider.shutdown) {
      await provider.shutdown();
    }

    providers.delete(providerId);

    // Notify listeners
    for (const listener of this.listeners) {
      listener.onProviderUnregistered?.(providerId, type);
    }
  }

  /**
   * Load providers from configuration file
   */
  async loadFromConfig(configPath: string): Promise<void> {
    try {
      const absolutePath = resolve(configPath);
      const fileContent = await readFile(absolutePath, "utf-8");
      const configData = JSON.parse(fileContent) as {
        providers: ProviderPluginConfig[];
      };

      if (!configData.providers || !Array.isArray(configData.providers)) {
        throw new Error("Configuration file must contain a 'providers' array");
      }

      // Store configuration
      this.config = configData.providers.map((pluginConfig) => ({
        id: pluginConfig.id,
        type: pluginConfig.type,
        module: pluginConfig.module,
        config: {
          ...pluginConfig.config,
          deployment: pluginConfig.deployment,
        },
        enabled: pluginConfig.enabled,
        priority: pluginConfig.priority,
      }));

      // Note: Actual provider instantiation would happen here
      // For now, we just store the config
      // Real implementation would:
      // 1. Dynamically import the module
      // 2. Create provider instance based on deployment mode
      // 3. Initialize with config
      // 4. Register with registry
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to load configuration from "${configPath}": ${message}`);
    }
  }

  /**
   * Get loaded configuration
   */
  getConfig(): ProviderConfig[] {
    return [...this.config];
  }

  /**
   * Initialize all registered providers
   */
  async initializeAll(): Promise<void> {
    const sttPromises = Array.from(this.sttProviders.values()).map(async (provider) => {
      try {
        const config = this.config.find((c) => c.id === provider.metadata.id);
        await provider.initialize(config?.config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Notify listeners
        for (const listener of this.listeners) {
          listener.onProviderError?.(
            provider.metadata.id,
            new Error(`Initialization failed: ${message}`),
          );
        }
        throw error;
      }
    });

    const ttsPromises = Array.from(this.ttsProviders.values()).map(async (provider) => {
      try {
        const config = this.config.find((c) => c.id === provider.metadata.id);
        await provider.initialize(config?.config);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Notify listeners
        for (const listener of this.listeners) {
          listener.onProviderError?.(
            provider.metadata.id,
            new Error(`Initialization failed: ${message}`),
          );
        }
        throw error;
      }
    });

    await Promise.all([...sttPromises, ...ttsPromises]);
  }

  /**
   * Shutdown all providers
   */
  async shutdownAll(): Promise<void> {
    const sttPromises = Array.from(this.sttProviders.values()).map(async (provider) => {
      if (provider.shutdown) {
        try {
          await provider.shutdown();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Notify listeners
          for (const listener of this.listeners) {
            listener.onProviderError?.(
              provider.metadata.id,
              new Error(`Shutdown failed: ${message}`),
            );
          }
        }
      }
    });

    const ttsPromises = Array.from(this.ttsProviders.values()).map(async (provider) => {
      if (provider.shutdown) {
        try {
          await provider.shutdown();
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          // Notify listeners
          for (const listener of this.listeners) {
            listener.onProviderError?.(
              provider.metadata.id,
              new Error(`Shutdown failed: ${message}`),
            );
          }
        }
      }
    });

    await Promise.all([...sttPromises, ...ttsPromises]);
  }

  /**
   * Add event listener for registry events
   */
  addEventListener(listener: RegistryEventListener): void {
    this.listeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: RegistryEventListener): void {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }
}

/**
 * Create a deployment-aware provider factory
 *
 * This would be used by actual provider implementations to handle
 * different deployment modes (system, docker, cloud).
 */
export interface ProviderFactory<T> {
  /**
   * Create provider instance based on deployment configuration
   */
  create(deployment: DeploymentConfig, config?: Record<string, unknown>): Promise<T>;
}

/**
 * Helper to expand environment variables in configuration
 */
export function expandEnvVars(value: string): string {
  return value.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
    return process.env[varName] ?? "";
  });
}

/**
 * Helper to validate deployment configuration
 */
export function validateDeploymentConfig(deployment: DeploymentConfig): void {
  if (!deployment.mode) {
    throw new Error("Deployment mode is required");
  }

  switch (deployment.mode) {
    case "system":
      if (!deployment.system?.binaryPath) {
        throw new Error("System deployment requires binaryPath");
      }
      break;
    case "docker":
      if (!deployment.docker?.image || !deployment.docker?.tag) {
        throw new Error("Docker deployment requires image and tag");
      }
      break;
    case "cloud":
      if (!deployment.cloud?.endpoint || !deployment.cloud?.apiKey) {
        throw new Error("Cloud deployment requires endpoint and apiKey");
      }
      break;
    default:
      throw new Error(
        `Invalid deployment mode: ${deployment.mode as string}. Must be system, docker, or cloud`,
      );
  }
}
