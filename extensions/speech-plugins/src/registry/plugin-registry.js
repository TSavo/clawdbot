/**
 * Simple Plugin Registry Implementation
 *
 * Manages registration, lifecycle, and configuration of STT/TTS providers
 * with support for multiple deployment modes (system, docker, cloud).
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
/**
 * Simple implementation of PluginRegistry
 */
export class SimplePluginRegistry {
    constructor() {
        this.sttProviders = new Map();
        this.ttsProviders = new Map();
        this.config = [];
        this.listeners = [];
    }
    /**
     * Register an STT provider
     */
    async registerSTTProvider(provider) {
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
    async registerTTSProvider(provider) {
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
    getSTTProviders() {
        return Array.from(this.sttProviders.values());
    }
    /**
     * Get all registered TTS providers
     */
    getTTSProviders() {
        return Array.from(this.ttsProviders.values());
    }
    /**
     * Get specific STT provider by ID
     */
    getSTTProvider(providerId) {
        return this.sttProviders.get(providerId);
    }
    /**
     * Get specific TTS provider by ID
     */
    getTTSProvider(providerId) {
        return this.ttsProviders.get(providerId);
    }
    /**
     * Get default/preferred STT provider (highest priority enabled provider)
     */
    getDefaultSTTProvider() {
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
    getDefaultTTSProvider() {
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
    async unregisterProvider(providerId, type) {
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
    async loadFromConfig(configPath) {
        try {
            const absolutePath = resolve(configPath);
            const fileContent = await readFile(absolutePath, "utf-8");
            const configData = JSON.parse(fileContent);
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
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to load configuration from "${configPath}": ${message}`);
        }
    }
    /**
     * Get loaded configuration
     */
    getConfig() {
        return [...this.config];
    }
    /**
     * Initialize all registered providers
     */
    async initializeAll() {
        const sttPromises = Array.from(this.sttProviders.values()).map(async (provider) => {
            try {
                const config = this.config.find((c) => c.id === provider.metadata.id);
                await provider.initialize(config?.config);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Notify listeners
                for (const listener of this.listeners) {
                    listener.onProviderError?.(provider.metadata.id, new Error(`Initialization failed: ${message}`));
                }
                throw error;
            }
        });
        const ttsPromises = Array.from(this.ttsProviders.values()).map(async (provider) => {
            try {
                const config = this.config.find((c) => c.id === provider.metadata.id);
                await provider.initialize(config?.config);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                // Notify listeners
                for (const listener of this.listeners) {
                    listener.onProviderError?.(provider.metadata.id, new Error(`Initialization failed: ${message}`));
                }
                throw error;
            }
        });
        await Promise.all([...sttPromises, ...ttsPromises]);
    }
    /**
     * Shutdown all providers
     */
    async shutdownAll() {
        const sttPromises = Array.from(this.sttProviders.values()).map(async (provider) => {
            if (provider.shutdown) {
                try {
                    await provider.shutdown();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    // Notify listeners
                    for (const listener of this.listeners) {
                        listener.onProviderError?.(provider.metadata.id, new Error(`Shutdown failed: ${message}`));
                    }
                }
            }
        });
        const ttsPromises = Array.from(this.ttsProviders.values()).map(async (provider) => {
            if (provider.shutdown) {
                try {
                    await provider.shutdown();
                }
                catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    // Notify listeners
                    for (const listener of this.listeners) {
                        listener.onProviderError?.(provider.metadata.id, new Error(`Shutdown failed: ${message}`));
                    }
                }
            }
        });
        await Promise.all([...sttPromises, ...ttsPromises]);
    }
    /**
     * Add event listener for registry events
     */
    addEventListener(listener) {
        this.listeners.push(listener);
    }
    /**
     * Remove event listener
     */
    removeEventListener(listener) {
        const index = this.listeners.indexOf(listener);
        if (index !== -1) {
            this.listeners.splice(index, 1);
        }
    }
}
/**
 * Helper to expand environment variables in configuration
 */
export function expandEnvVars(value) {
    return value.replace(/\$\{([^}]+)\}/g, (_match, varName) => {
        return process.env[varName] ?? "";
    });
}
/**
 * Helper to validate deployment configuration
 */
export function validateDeploymentConfig(deployment) {
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
            throw new Error(`Invalid deployment mode: ${deployment.mode}. Must be system, docker, or cloud`);
    }
}
//# sourceMappingURL=plugin-registry.js.map