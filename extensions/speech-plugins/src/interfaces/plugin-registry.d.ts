/**
 * Plugin Registry Interface
 *
 * Manages registration, discovery, and lifecycle of STT/TTS providers
 */
import type { STTProvider } from "./stt-provider.js";
import type { TTSProvider } from "./tts-provider.js";
export interface ProviderConfig {
    /** Provider identifier */
    id: string;
    /** Provider type */
    type: "stt" | "tts";
    /** Provider module path or package name */
    module: string;
    /** Configuration to pass to provider */
    config?: Record<string, unknown>;
    /** Whether provider is enabled */
    enabled?: boolean;
    /** Provider priority (higher = preferred) */
    priority?: number;
}
export interface PluginRegistry {
    /**
     * Register an STT provider
     * @param provider Provider instance
     */
    registerSTTProvider(provider: STTProvider): Promise<void>;
    /**
     * Register a TTS provider
     * @param provider Provider instance
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
     * @param providerId Provider identifier
     */
    getSTTProvider(providerId: string): STTProvider | undefined;
    /**
     * Get specific TTS provider by ID
     * @param providerId Provider identifier
     */
    getTTSProvider(providerId: string): TTSProvider | undefined;
    /**
     * Get default/preferred STT provider
     */
    getDefaultSTTProvider(): STTProvider | undefined;
    /**
     * Get default/preferred TTS provider
     */
    getDefaultTTSProvider(): TTSProvider | undefined;
    /**
     * Unregister provider by ID
     * @param providerId Provider identifier
     * @param type Provider type
     */
    unregisterProvider(providerId: string, type: "stt" | "tts"): Promise<void>;
    /**
     * Load providers from configuration file
     * @param configPath Path to configuration file
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
}
export interface RegistryEventListener {
    onProviderRegistered?(provider: STTProvider | TTSProvider, type: "stt" | "tts"): void;
    onProviderUnregistered?(providerId: string, type: "stt" | "tts"): void;
    onProviderError?(providerId: string, error: Error): void;
}
//# sourceMappingURL=plugin-registry.d.ts.map