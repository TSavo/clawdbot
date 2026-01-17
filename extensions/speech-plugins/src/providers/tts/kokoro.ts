/**
 * Kokoro TTS Plugin Wrapper
 *
 * Wraps the Kokoro executor for use as a TTSProvider plugin.
 * Supports Docker, System, and Cloud deployment modes.
 */

import type {
  TTSProviderMetadata,
  TTSCapabilities,
  TTSVoice,
} from '../../interfaces/tts-provider.js';

import { BaseTTSPlugin } from './base.js';
import { KokoroExecutor } from '@media/voice-providers/kokoro.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';
import {
  initializeTTSDockerMode,
  checkTTSContainerHealth,
  startTTSContainer,
  stopTTSContainer,
} from './docker-handler.js';

/**
 * Kokoro TTS plugin configuration
 * (matches the shape expected by KokoroExecutor)
 */
export interface KokoroTTSConfig {
  mode: 'docker' | 'system' | 'cloud';
  docker?: {
    image: string;
    port: number;
    volumes?: Record<string, string>;
    env?: Record<string, string>;
  };
  system?: {
    pythonPath?: string;
    installCmd?: string;
  };
  cloud?: {
    endpoint: string;
    apiKey?: string;
  };
  healthCheck?: {
    endpoint: string;
    interval: number;
  };
}

/**
 * Kokoro TTS Plugin
 */
export class KokoroTTSPlugin extends BaseTTSPlugin {
  readonly metadata: TTSProviderMetadata;
  private dockerHealth: any = null;
  private dockerInitialized = false;

  constructor(private config: KokoroTTSConfig) {
    super();

    // Build metadata from config
    this.metadata = {
      id: 'kokoro-tts',
      name: 'Kokoro TTS',
      description: 'High-quality neural TTS with multi-language support',
      version: '1.0.0',
      capabilities: this.buildCapabilities(),
    };
  }

  /**
   * Create Kokoro executor instance
   */
  protected createExecutor(config?: Record<string, unknown>): KokoroExecutor {
    // Merge provided config with constructor config
    const finalConfig = { ...this.config, ...(config || {}) } as KokoroTTSConfig;
    return new KokoroExecutor(finalConfig);
  }

  /**
   * Build capabilities from executor
   */
  private buildCapabilities(): TTSCapabilities {
    return {
      formats: ['pcm', 'wav'],
      sampleRates: [16000],
      voices: [
        {
          id: 'af',
          name: 'American Female',
          language: 'en',
          gender: 'female',
          characteristics: ['natural', 'expressive'],
        },
        {
          id: 'am',
          name: 'American Male',
          language: 'en',
          gender: 'male',
          characteristics: ['natural', 'expressive'],
        },
        {
          id: 'bf',
          name: 'British Female',
          language: 'en',
          gender: 'female',
          characteristics: ['natural', 'british'],
        },
        {
          id: 'bm',
          name: 'British Male',
          language: 'en',
          gender: 'male',
          characteristics: ['natural', 'british'],
        },
      ],
      supportsStreaming: true,
      languages: ['en', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'pt', 'ko'],
    };
  }

  /**
   * List available voices
   */
  async listVoices(): Promise<TTSVoice[]> {
    return this.metadata.capabilities.voices;
  }

  /**
   * Initialize Docker mode for Kokoro
   * Pulls image, creates volumes, starts container, and performs health check
   */
  async initializeDockerMode(verbose = false): Promise<{
    success: boolean;
    port: number;
    volumePath: string;
    containerId?: string;
    error?: string;
  }> {
    if (this.config.mode !== 'docker') {
      return {
        success: false,
        port: this.config.docker?.port || 8000,
        volumePath: '',
        error: 'Provider not configured for Docker mode',
      };
    }

    try {
      const result = await initializeTTSDockerMode(
        'kokoro',
        {
          provider: 'kokoro',
          image: this.config.docker?.image,
          port: this.config.docker?.port,
          env: this.config.docker?.env,
        },
        verbose,
      );

      if (result.success) {
        this.dockerInitialized = true;
        this.dockerHealth = {
          port: result.port,
          volumePath: result.volumePath,
          containerId: result.containerId,
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        port: this.config.docker?.port || 8000,
        volumePath: '',
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Check Docker container health
   */
  async checkDockerHealth(verbose = false): Promise<boolean> {
    if (this.config.mode !== 'docker') {
      return false;
    }

    try {
      const health = await checkTTSContainerHealth('kokoro', verbose);
      this.dockerHealth = {
        running: health.running,
        healthy: health.healthy,
        port: health.port,
        containerId: health.containerId,
      };
      return health.healthy;
    } catch (error) {
      if (verbose) {
        console.error('Health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Stop Docker container
   */
  async stopDocker(verbose = false): Promise<boolean> {
    if (this.config.mode !== 'docker') {
      return false;
    }

    try {
      const success = await stopTTSContainer('kokoro', verbose);
      if (success) {
        this.dockerInitialized = false;
        this.dockerHealth = null;
      }
      return success;
    } catch (error) {
      if (verbose) {
        console.error('Failed to stop Docker container:', error);
      }
      return false;
    }
  }

  /**
   * Get Docker status
   */
  getDockerStatus(): { initialized: boolean; health: any } {
    return {
      initialized: this.dockerInitialized,
      health: this.dockerHealth,
    };
  }
}
