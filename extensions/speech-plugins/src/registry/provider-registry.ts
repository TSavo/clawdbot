/**
 * Unified Provider Registry
 *
 * Comprehensive registry that discovers and exposes all STT/TTS providers
 * with full deployment mode support (system, docker, cloud).
 *
 * This registry:
 * - Scans all available providers
 * - Documents supported deployment modes for each
 * - Provides discovery and validation methods
 * - Generates mode support matrix
 * - Exports configuration for onboarding and plugin-installer
 */

import type { STTProvider } from '../interfaces/stt-provider.js';
import type { TTSProvider } from '../interfaces/tts-provider.js';

/**
 * Deployment mode for a provider
 */
export type DeploymentMode = 'system' | 'docker' | 'cloud';

/**
 * Mode configuration and availability
 */
export interface ModeConfig {
  available: boolean;
  dependencies?: string[];
  dockerImage?: string;
  dockerTag?: string;
  requiredKeys?: string[];
  requiredEnvVars?: string[];
  notes?: string;
}

/**
 * Provider metadata in registry
 */
export interface ProviderMetadata {
  id: string;
  name: string;
  type: 'stt' | 'tts';
  description: string;
  version: string;
  modes: {
    system?: ModeConfig;
    docker?: ModeConfig;
    cloud?: ModeConfig;
  };
  capabilities?: {
    formats?: string[];
    languages?: string[];
    voices?: Array<{ id: string; name: string }>;
    features?: string[];
  };
  priority?: number;
}

/**
 * Discovery result for a provider
 */
export interface ProviderDiscovery {
  provider: ProviderMetadata;
  status: 'ready' | 'partial' | 'unavailable';
  availableModes: DeploymentMode[];
  missingDependencies: string[];
}

/**
 * Unified Provider Registry
 */
export class UnifiedProviderRegistry {
  private providers: Map<string, ProviderMetadata> = new Map();
  private sttProviders: Map<string, ProviderMetadata> = new Map();
  private ttsProviders: Map<string, ProviderMetadata> = new Map();
  private discoveryCache: Map<string, ProviderDiscovery> = new Map();

  constructor() {
    this.initializeRegistry();
  }

  /**
   * Initialize registry with all known providers
   */
  private initializeRegistry(): void {
    // STT Providers
    this.registerProvider({
      id: 'whisper-stt',
      name: 'Whisper',
      type: 'stt',
      description: 'OpenAI Whisper speech-to-text model',
      version: '1.0.0',
      modes: {
        system: {
          available: true,
          dependencies: ['whisper.cpp', 'ffmpeg'],
          notes: 'Requires whisper binary on system PATH or specified binaryPath',
        },
        docker: {
          available: true,
          dockerImage: 'openai/whisper',
          dockerTag: 'latest',
          dependencies: ['docker'],
        },
        cloud: {
          available: false,
          notes: 'No official OpenAI hosted Whisper API (use OpenAI API instead)',
        },
      },
      capabilities: {
        formats: ['wav', 'mp3', 'opus', 'aac', 'flac', 'ogg'],
        languages: [
          'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 'ar',
          'hi', 'tr', 'pl', 'sv', 'id', 'th', 'vi', 'he', 'cs', 'ro', 'fi', 'da',
          // 99+ languages total
        ],
        features: ['multi-language', 'streaming', 'GPU acceleration via Docker'],
      },
      priority: 1,
    });

    this.registerProvider({
      id: 'faster-whisper-stt',
      name: 'Faster Whisper',
      type: 'stt',
      description: 'Optimized Whisper with GPU acceleration',
      version: '1.0.0',
      modes: {
        system: {
          available: true,
          dependencies: ['python3', 'faster-whisper', 'ffmpeg'],
          notes: 'Requires Python and faster-whisper package',
        },
        docker: {
          available: true,
          dockerImage: 'faster-whisper',
          dockerTag: 'latest',
          dependencies: ['docker'],
          notes: 'GPU acceleration available with nvidia-docker',
        },
        cloud: {
          available: false,
        },
      },
      capabilities: {
        formats: ['wav', 'mp3', 'opus', 'aac', 'flac', 'ogg'],
        languages: [
          'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko',
          // 99+ languages
        ],
        features: ['GPU optimization', 'streaming', 'speaker diarization', 'punctuation'],
      },
      priority: 2,
    });

    this.registerProvider({
      id: 'deepgram-stt',
      name: 'Deepgram',
      type: 'stt',
      description: 'Cloud-based STT with real-time streaming',
      version: '1.0.0',
      modes: {
        system: {
          available: false,
          notes: 'Cloud-only provider',
        },
        docker: {
          available: false,
          notes: 'Cloud-only provider',
        },
        cloud: {
          available: true,
          requiredKeys: ['DEEPGRAM_API_KEY'],
          requiredEnvVars: ['DEEPGRAM_API_KEY'],
          notes: 'Requires Deepgram API key from https://console.deepgram.com',
        },
      },
      capabilities: {
        formats: ['wav', 'mp3', 'opus', 'flac', 'webm', 'ogg'],
        languages: [
          'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko',
          'ar', 'hi', 'pl', 'tr', 'ur', 'vi', 'uk', 'th', 'ta', 'te', 'tl',
          // 30+ languages
        ],
        features: ['real-time streaming', '<300ms latency', 'turn detection', 'speaker diarization', 'smart formatting'],
      },
      priority: 3,
    });

    // TTS Providers
    this.registerProvider({
      id: 'kokoro-tts',
      name: 'Kokoro',
      type: 'tts',
      description: 'Fast, high-quality neural TTS',
      version: '1.0.0',
      modes: {
        system: {
          available: true,
          dependencies: ['kokoro-tts', 'python3'],
          notes: 'Requires Kokoro TTS binary on system PATH',
        },
        docker: {
          available: true,
          dockerImage: 'kokoro-tts',
          dockerTag: 'latest',
          dependencies: ['docker'],
        },
        cloud: {
          available: false,
          notes: 'No official cloud deployment',
        },
      },
      capabilities: {
        formats: ['wav', 'pcm'],
        languages: ['en'],
        voices: [
          { id: 'af', name: 'American Female' },
          { id: 'am', name: 'American Male' },
          { id: 'bf', name: 'British Female' },
          { id: 'bm', name: 'British Male' },
          { id: 'jf', name: 'Japanese Female' },
          { id: 'jm', name: 'Japanese Male' },
        ],
        features: ['fast synthesis', 'emotion control', 'natural voices', 'low latency'],
      },
      priority: 1,
    });

    this.registerProvider({
      id: 'elevenlabs-tts',
      name: 'ElevenLabs',
      type: 'tts',
      description: 'Premium voice synthesis with extensive voice library',
      version: '1.0.0',
      modes: {
        system: {
          available: false,
          notes: 'Cloud-only provider',
        },
        docker: {
          available: false,
          notes: 'Cloud-only provider',
        },
        cloud: {
          available: true,
          requiredKeys: ['ELEVENLABS_API_KEY'],
          requiredEnvVars: ['ELEVENLABS_API_KEY'],
          notes: 'Requires ElevenLabs API key from https://elevenlabs.io',
        },
      },
      capabilities: {
        formats: ['mp3', 'pcm', 'ulaw'],
        languages: [
          'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'tr', 'cs',
          'ro', 'ja', 'ko', 'zh', 'ar', 'hi', 'th', 'vi',
          // 29+ languages
        ],
        voices: [
          { id: 'default', name: 'Default' },
          // 100+ pre-made voices + custom voice cloning
        ],
        features: ['100+ voices', 'voice cloning', 'emotion control', 'multilingual', 'real-time streaming'],
      },
      priority: 2,
    });

    this.registerProvider({
      id: 'cartesia-tts',
      name: 'Cartesia AI',
      type: 'tts',
      description: 'Ultra-realistic voice synthesis',
      version: '1.0.0',
      modes: {
        system: {
          available: false,
          notes: 'Cloud-only provider',
        },
        docker: {
          available: false,
          notes: 'Cloud-only provider',
        },
        cloud: {
          available: true,
          requiredKeys: ['CARTESIA_API_KEY'],
          requiredEnvVars: ['CARTESIA_API_KEY'],
          notes: 'Requires Cartesia AI API key',
        },
      },
      capabilities: {
        formats: ['wav', 'mp3', 'pcm'],
        languages: [
          'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi',
          // 14+ languages
        ],
        voices: [
          { id: 'default', name: 'Default' },
          // 50+ voices across languages
        ],
        features: ['50+ voices', 'real-time streaming', 'voice cloning', 'emotion control', 'ultra-realistic'],
      },
      priority: 3,
    });

    this.registerProvider({
      id: 'chatterbox-tts',
      name: 'Chatterbox',
      type: 'tts',
      description: 'VITS-based voice synthesis',
      version: '1.0.0',
      modes: {
        system: {
          available: true,
          dependencies: ['chatterbox', 'python3', 'pytorch'],
          notes: 'Requires Python and PyTorch',
        },
        docker: {
          available: true,
          dockerImage: 'chatterbox-tts',
          dockerTag: 'latest',
          dependencies: ['docker'],
        },
        cloud: {
          available: false,
          notes: 'No official cloud deployment',
        },
      },
      capabilities: {
        formats: ['wav', 'pcm'],
        languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru'],
        voices: [
          { id: 'default', name: 'Default' },
          // Multiple voices per language
        ],
        features: ['fast synthesis', 'customizable models', 'VITS-based', 'multi-language'],
      },
      priority: 4,
    });
  }

  /**
   * Register a provider in the registry
   */
  private registerProvider(metadata: ProviderMetadata): void {
    this.providers.set(metadata.id, metadata);

    if (metadata.type === 'stt') {
      this.sttProviders.set(metadata.id, metadata);
    } else {
      this.ttsProviders.set(metadata.id, metadata);
    }

    // Invalidate cache
    this.discoveryCache.delete(metadata.id);
  }

  /**
   * Get all providers
   */
  getAllProviders(): ProviderMetadata[] {
    return Array.from(this.providers.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
  }

  /**
   * Get all STT providers
   */
  getSTTProviders(): ProviderMetadata[] {
    return Array.from(this.sttProviders.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
  }

  /**
   * Get all TTS providers
   */
  getTTSProviders(): ProviderMetadata[] {
    return Array.from(this.ttsProviders.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
    );
  }

  /**
   * Get provider by ID
   */
  getProvider(providerId: string): ProviderMetadata | undefined {
    return this.providers.get(providerId);
  }

  /**
   * Get providers filtered by deployment mode
   */
  getProvidersByMode(mode: DeploymentMode): ProviderMetadata[] {
    return this.getAllProviders().filter((provider) => {
      const modeConfig = provider.modes[mode];
      return modeConfig?.available === true;
    });
  }

  /**
   * Get STT providers filtered by deployment mode
   */
  getSTTProvidersByMode(mode: DeploymentMode): ProviderMetadata[] {
    return this.getSTTProviders().filter((provider) => {
      const modeConfig = provider.modes[mode];
      return modeConfig?.available === true;
    });
  }

  /**
   * Get TTS providers filtered by deployment mode
   */
  getTTSProvidersByMode(mode: DeploymentMode): ProviderMetadata[] {
    return this.getTTSProviders().filter((provider) => {
      const modeConfig = provider.modes[mode];
      return modeConfig?.available === true;
    });
  }

  /**
   * Validate if a provider is available in a specific mode
   */
  validateProvider(providerId: string, mode: DeploymentMode): {
    valid: boolean;
    errors: string[];
  } {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {
        valid: false,
        errors: [`Provider "${providerId}" not found in registry`],
      };
    }

    const modeConfig = provider.modes[mode];

    if (!modeConfig) {
      return {
        valid: false,
        errors: [`Mode "${mode}" not configured for provider "${providerId}"`],
      };
    }

    if (!modeConfig.available) {
      return {
        valid: false,
        errors: [
          `Provider "${providerId}" is not available in "${mode}" mode`,
          modeConfig.notes ? `  Reason: ${modeConfig.notes}` : '',
        ].filter(Boolean),
      };
    }

    return {
      valid: true,
      errors: [],
    };
  }

  /**
   * Get dependencies for a provider in a specific mode
   */
  getProviderDependencies(providerId: string, mode: DeploymentMode): string[] {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return [];
    }

    const modeConfig = provider.modes[mode];

    if (!modeConfig) {
      return [];
    }

    return modeConfig.dependencies || [];
  }

  /**
   * Get required environment variables for a provider in a specific mode
   */
  getProviderEnvVars(providerId: string, mode: DeploymentMode): string[] {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return [];
    }

    const modeConfig = provider.modes[mode];

    if (!modeConfig) {
      return [];
    }

    return modeConfig.requiredEnvVars || [];
  }

  /**
   * Check if a provider is ready for use
   */
  isProviderReady(providerId: string, mode: DeploymentMode): boolean {
    const validation = this.validateProvider(providerId, mode);
    return validation.valid;
  }

  /**
   * Discover provider status and available modes
   */
  discoverProvider(providerId: string): ProviderDiscovery {
    if (this.discoveryCache.has(providerId)) {
      return this.discoveryCache.get(providerId)!;
    }

    const provider = this.getProvider(providerId);

    if (!provider) {
      const discovery: ProviderDiscovery = {
        provider: {} as ProviderMetadata,
        status: 'unavailable',
        availableModes: [],
        missingDependencies: [],
      };
      return discovery;
    }

    const availableModes: DeploymentMode[] = [];
    const modes = ['system', 'docker', 'cloud'] as const;

    for (const mode of modes) {
      const modeConfig = provider.modes[mode];
      if (modeConfig?.available) {
        availableModes.push(mode);
      }
    }

    const discovery: ProviderDiscovery = {
      provider,
      status: availableModes.length === 0 ? 'unavailable' : 'ready',
      availableModes,
      missingDependencies: [],
    };

    this.discoveryCache.set(providerId, discovery);
    return discovery;
  }

  /**
   * Generate mode support matrix
   */
  generateModeSupportMatrix(): {
    stt: Record<string, Record<DeploymentMode, boolean>>;
    tts: Record<string, Record<DeploymentMode, boolean>>;
  } {
    const stt: Record<string, Record<DeploymentMode, boolean>> = {};
    const tts: Record<string, Record<DeploymentMode, boolean>> = {};

    const modes = ['system', 'docker', 'cloud'] as const;

    for (const provider of this.getSTTProviders()) {
      stt[provider.id] = {
        system: provider.modes.system?.available ?? false,
        docker: provider.modes.docker?.available ?? false,
        cloud: provider.modes.cloud?.available ?? false,
      };
    }

    for (const provider of this.getTTSProviders()) {
      tts[provider.id] = {
        system: provider.modes.system?.available ?? false,
        docker: provider.modes.docker?.available ?? false,
        cloud: provider.modes.cloud?.available ?? false,
      };
    }

    return { stt, tts };
  }

  /**
   * Export registry as JSON for external use
   */
  toJSON(): {
    providers: ProviderMetadata[];
    stt: ProviderMetadata[];
    tts: ProviderMetadata[];
    modeMatrix: ReturnType<UnifiedProviderRegistry['generateModeSupportMatrix']>;
    timestamp: string;
  } {
    return {
      providers: this.getAllProviders(),
      stt: this.getSTTProviders(),
      tts: this.getTTSProviders(),
      modeMatrix: this.generateModeSupportMatrix(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get provider configuration template for onboarding
   */
  getProviderTemplate(providerId: string, mode: DeploymentMode): Record<string, unknown> {
    const provider = this.getProvider(providerId);

    if (!provider) {
      return {};
    }

    const modeConfig = provider.modes[mode];

    if (!modeConfig) {
      return {};
    }

    const template: Record<string, unknown> = {
      id: providerId,
      name: provider.name,
      type: provider.type,
      mode,
      enabled: true,
      priority: provider.priority ?? 0,
    };

    if (modeConfig.dependencies) {
      template.dependencies = modeConfig.dependencies;
    }

    if (modeConfig.requiredEnvVars) {
      template.requiredEnvVars = modeConfig.requiredEnvVars;
    }

    if (mode === 'docker' && modeConfig.dockerImage) {
      template.docker = {
        image: modeConfig.dockerImage,
        tag: modeConfig.dockerTag || 'latest',
      };
    }

    if (mode === 'cloud' && modeConfig.requiredKeys) {
      template.apiKeys = modeConfig.requiredKeys;
    }

    return template;
  }

  /**
   * List all available provider IDs
   */
  listProviderIds(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * List all STT provider IDs
   */
  listSTTProviderIds(): string[] {
    return Array.from(this.sttProviders.keys());
  }

  /**
   * List all TTS provider IDs
   */
  listTTSProviderIds(): string[] {
    return Array.from(this.ttsProviders.keys());
  }
}

/**
 * Global singleton instance
 */
let globalRegistry: UnifiedProviderRegistry | null = null;

/**
 * Get or create the global registry instance
 */
export function getProviderRegistry(): UnifiedProviderRegistry {
  if (!globalRegistry) {
    globalRegistry = new UnifiedProviderRegistry();
  }
  return globalRegistry;
}

/**
 * Create a fresh registry instance
 */
export function createProviderRegistry(): UnifiedProviderRegistry {
  return new UnifiedProviderRegistry();
}
