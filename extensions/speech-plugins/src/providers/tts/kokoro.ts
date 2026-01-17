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
}
