/**
 * Simple Plugin Registry Implementation
 *
 * Manages registration, lifecycle, and configuration of STT/TTS providers
 * with support for multiple deployment modes (system, docker, cloud).
 */
import type { PluginRegistry, ProviderConfig, RegistryEventListener } from "../interfaces/plugin-registry.js";
import type { STTProvider } from "../interfaces/stt-provider.js";
import type { TTSProvider } from "../interfaces/tts-provider.js";
import type { DeploymentConfig } from "../providers/index.js";
/**
 * Simple implementation of PluginRegistry
 */
export declare class SimplePluginRegistry implements PluginRegistry {
    private sttProviders;
    private ttsProviders;
    private config;
    private listeners;
    /**
     * Register an STT provider
     */
    registerSTTProvider(provider: STTProvider): Promise<void>;
    /**
     * Register a TTS provider
     */
    registerTTSProvider(provider: TTSProvider): Promise<void>;
    /**
     * Get all registered STT providers
     */
    getSTTProviders(): STTProvider[];
    /**
     * Get all registered TTS providers
     */
    getTTSProviders(): TTSProvider[];
    /**
     * Get specific STT provider by ID
     */
    getSTTProvider(providerId: string): STTProvider | undefined;
    /**
     * Get specific TTS provider by ID
     */
    getTTSProvider(providerId: string): TTSProvider | undefined;
    /**
     * Get default/preferred STT provider (highest priority enabled provider)
     */
    getDefaultSTTProvider(): STTProvider | undefined;
    /**
     * Get default/preferred TTS provider (highest priority enabled provider)
     */
    getDefaultTTSProvider(): TTSProvider | undefined;
    /**
     * Unregister provider by ID
     */
    unregisterProvider(providerId: string, type: "stt" | "tts"): Promise<void>;
    /**
     * Load providers from configuration file
     */
    loadFromConfig(configPath: string): Promise<void>;
    /**
     * Get loaded configuration
     */
    getConfig(): ProviderConfig[];
    /**
     * Initialize all registered providers
     */
    initializeAll(): Promise<void>;
    /**
     * Shutdown all providers
     */
    shutdownAll(): Promise<void>;
    /**
     * Add event listener for registry events
     */
    addEventListener(listener: RegistryEventListener): void;
    /**
     * Remove event listener
     */
    removeEventListener(listener: RegistryEventListener): void;
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
export declare function expandEnvVars(value: string): string;
/**
 * Helper to validate deployment configuration
 */
export declare function validateDeploymentConfig(deployment: DeploymentConfig): void;
//# sourceMappingURL=plugin-registry.d.ts.map