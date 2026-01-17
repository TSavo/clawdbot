/**
 * Docker Provider Adapter
 *
 * Adapts generic deployment configurations to provider-specific Docker parameters.
 * Handles automatic port allocation, volume management, and environment setup.
 * Supports multiple voice providers: Kokoro, Faster-Whisper, Chatterbox, Whisper, Deepgram.
 */
import { DockerHandler } from './docker-handler.js';
import type { DockerProviderConfig } from './docker-handler.js';
export type { DockerProviderConfig };
/**
 * Provider-specific Docker configuration templates
 */
export interface ProviderDockerTemplate {
    providerName: string;
    defaultImage: string;
    defaultPort: number;
    containerPortInternal: number;
    healthCheckPath: string;
    healthCheckInterval: number;
    healthCheckTimeout: number;
    volumeMountPaths: Record<string, string>;
    environmentVariables: Record<string, string>;
    gpuSupport: boolean;
    cpuLimit: string;
    memoryLimit: string;
}
/**
 * Predefined templates for popular voice providers
 */
export declare const PROVIDER_TEMPLATES: Record<string, ProviderDockerTemplate>;
/**
 * Port allocation manager for tracking and preventing conflicts
 */
export declare class PortAllocator {
    private allocatedPorts;
    private readonly minPort;
    private readonly maxPort;
    /**
     * Allocate a port, avoiding conflicts with already-used ports
     */
    allocatePort(preferredPort?: number): number;
    /**
     * Release an allocated port
     */
    releasePort(port: number): void;
    /**
     * Check if a port is allocated
     */
    isAllocated(port: number): boolean;
    /**
     * Get all allocated ports
     */
    getAllocatedPorts(): number[];
}
/**
 * Volume manager for tracking and managing Docker volumes
 */
export declare class VolumeManager {
    private namedVolumes;
    private readonly baseVolumeName;
    /**
     * Create or get a named volume for model caching
     */
    getOrCreateModelVolume(providerId: string): string;
    /**
     * Get mount path configuration for a provider
     */
    getMountPaths(providerId: string, template: ProviderDockerTemplate): Record<string, string>;
    /**
     * Clean up volumes for a provider (useful for cleanup)
     */
    removeProviderVolumes(providerId: string): string[];
}
/**
 * Docker Provider Adapter
 *
 * Manages Docker deployment for voice providers with automatic configuration.
 */
export declare class DockerProviderAdapter {
    private portAllocator;
    private volumeManager;
    private handlers;
    constructor();
    /**
     * Create a Docker handler for a specific provider instance
     */
    createProviderInstance(providerId: string, providerType: string, customConfig?: Partial<DockerProviderConfig>): Promise<DockerHandler>;
    /**
     * Get an existing handler by provider ID
     */
    getHandler(providerId: string): DockerHandler | undefined;
    /**
     * Remove a provider instance and clean up resources
     */
    removeProviderInstance(providerId: string): void;
    /**
     * Get a template for a provider type
     */
    getTemplate(providerType: string): ProviderDockerTemplate;
    /**
     * List all registered provider templates
     */
    listAvailableProviders(): string[];
    /**
     * Get all active provider instances
     */
    getActiveInstances(): string[];
    /**
     * Cleanup all handlers and release all resources
     */
    cleanup(): Promise<void>;
}
/**
 * Get or create the global Docker provider adapter
 */
export declare function getGlobalDockerProviderAdapter(): DockerProviderAdapter;
/**
 * Reset the global adapter (useful for testing)
 */
export declare function resetGlobalDockerProviderAdapter(): void;
//# sourceMappingURL=docker-provider-adapter.d.ts.map