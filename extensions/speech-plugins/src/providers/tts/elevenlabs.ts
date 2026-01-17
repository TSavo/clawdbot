/**
 * ElevenLabs TTS Plugin Wrapper
 *
 * Wraps the ElevenLabs executor for use as a TTSProvider plugin.
 * Supports premium voice synthesis with extensive voice library.
 */

import type {
  TTSProviderMetadata,
  TTSCapabilities,
  TTSVoice,
} from '../../interfaces/tts-provider.js';

import { BaseTTSPlugin } from './base.js';
import { ElevenLabsExecutor } from '@media/voice-providers/tts-elevenlabs.js';
import { CloudCredentialManager, getCredentialManager } from '../cloud-credential-manager.js';
import {
  createStreamHandler,
  type StreamConfig,
  type BaseStreamHandler,
} from '../cloud-stream-handlers.js';
import { CloudRateLimiter, DEFAULT_CONFIGS } from '../cloud-rate-limiter.js';

/**
 * ElevenLabs TTS configuration
 */
export interface ElevenLabsTTSConfig {
  apiKey: string;
  model?: string;
  voiceId?: string;
  stability?: number;
  similarityBoost?: number;
  timeout?: number;
}

/**
 * ElevenLabs TTS Plugin
 */
export class ElevenLabsTTSPlugin extends BaseTTSPlugin {
  readonly metadata: TTSProviderMetadata;
  private cloudCredentialManager: CloudCredentialManager | null = null;
  private rateLimiter: CloudRateLimiter | null = null;
  private streamHandler: BaseStreamHandler | null = null;

  constructor(private config: ElevenLabsTTSConfig) {
    super();

    // Build metadata from config
    this.metadata = {
      id: 'elevenlabs-tts',
      name: 'ElevenLabs TTS',
      description: 'Premium voice synthesis with extensive voice library',
      version: '1.0.0',
      capabilities: this.buildCapabilities(),
      configSchema: {
        validate: (config: unknown) => {
          const cfg = config as ElevenLabsTTSConfig;
          const errors: string[] = [];

          if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
            errors.push('apiKey is required and must be a string');
          }

          if (cfg.stability !== undefined && (cfg.stability < 0 || cfg.stability > 1)) {
            errors.push('stability must be between 0 and 1');
          }

          if (cfg.similarityBoost !== undefined && (cfg.similarityBoost < 0 || cfg.similarityBoost > 1)) {
            errors.push('similarityBoost must be between 0 and 1');
          }

          return { ok: errors.length === 0, errors };
        },
        properties: {
          apiKey: { type: 'string', description: 'ElevenLabs API key' },
          model: { type: 'string', description: 'Model ID (e.g., eleven_monolingual_v1)' },
          voiceId: { type: 'string', description: 'Default voice ID' },
          stability: { type: 'number', description: 'Voice stability (0-1)' },
          similarityBoost: { type: 'number', description: 'Similarity boost (0-1)' },
        },
      },
    };
  }

  /**
   * Create ElevenLabs executor instance
   */
  protected createExecutor(config?: Record<string, unknown>): ElevenLabsExecutor {
    // Merge provided config with constructor config
    const finalConfig = { ...this.config, ...(config || {}) } as ElevenLabsTTSConfig;
    return new ElevenLabsExecutor('elevenlabs-tts', finalConfig);
  }

  /**
   * Build capabilities from executor
   */
  private buildCapabilities(): TTSCapabilities {
    return {
      formats: ['mp3', 'pcm'],
      sampleRates: [16000, 22050, 24000, 44100],
      voices: this.getDefaultVoices(),
      supportsStreaming: true,
      languages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'uk', 'ja', 'ko',
        'zh', 'ar', 'hi', 'tr', 'sv', 'no', 'da', 'fi', 'cs', 'hu', 'ro',
      ],
    };
  }

  /**
   * Get default voices (will be populated dynamically after initialization)
   */
  private getDefaultVoices(): TTSVoice[] {
    return [
      {
        id: 'rachel',
        name: 'Rachel',
        language: 'en',
        gender: 'female',
        characteristics: ['calm', 'professional'],
      },
      {
        id: 'adam',
        name: 'Adam',
        language: 'en',
        gender: 'male',
        characteristics: ['deep', 'authoritative'],
      },
    ];
  }

  /**
   * List available voices (dynamically populated from API)
   */
  async listVoices(): Promise<TTSVoice[]> {
    this.ensureInitialized();

    // If executor has loaded voices, use them
    if (this.executor && 'availableVoices' in this.executor) {
      const executorVoices = (this.executor as any).availableVoices as Map<string, any>;
      if (executorVoices && executorVoices.size > 0) {
        const voices: TTSVoice[] = [];
        for (const [id, voice] of executorVoices.entries()) {
          voices.push({
            id,
            name: voice.name || id,
            language: voice.language || 'en',
            gender: voice.gender,
            characteristics: voice.labels ? Object.keys(voice.labels) : undefined,
          });
        }
        return voices;
      }
    }

    return this.metadata.capabilities.voices;
  }

  /**
   * Initialize cloud mode with credential management and rate limiting
   *
   * Cloud mode features:
   * - REST API streaming for voice synthesis
   * - Secure credential storage
   * - Automatic rate limiting
   * - Dynamic voice library loading
   */
  async initializeCloudMode(config?: {
    apiKey?: string;
    endpoint?: string;
  }): Promise<void> {
    // Get credential manager
    this.cloudCredentialManager = await getCredentialManager();

    // Store or retrieve credentials
    const apiKey =
      config?.apiKey ||
      process.env.ELEVENLABS_API_KEY ||
      (await this.cloudCredentialManager.getCredential('elevenlabs'))?.apiKey;

    if (!apiKey) {
      throw new Error(
        'ElevenLabs API key not found. Set ELEVENLABS_API_KEY environment variable or provide it in config.',
      );
    }

    // Validate credential
    const validation = await this.cloudCredentialManager.validateCredential('elevenlabs', {
      provider: 'elevenlabs',
      apiKey,
      endpoint: config?.endpoint || 'https://api.elevenlabs.io/v1/voices',
    });

    if (!validation.valid) {
      throw new Error(`ElevenLabs API key validation failed: ${validation.error}`);
    }

    // Store credential for future use
    await this.cloudCredentialManager.storeCredential({
      provider: 'elevenlabs',
      apiKey,
      endpoint: config?.endpoint,
    });

    // Initialize rate limiter
    this.rateLimiter = new CloudRateLimiter();
    this.rateLimiter.registerProvider('elevenlabs', DEFAULT_CONFIGS.elevenlabs);

    // Initialize REST stream handler
    const streamConfig: StreamConfig = {
      url: 'https://api.elevenlabs.io/v1/text-to-speech',
      apiKey,
      timeout: 30000,
    };

    this.streamHandler = createStreamHandler('rest', streamConfig);

    // Setup error handling
    this.streamHandler.on('error', (error) => {
      console.error('ElevenLabs stream error:', error);
    });
  }

  /**
   * Get cloud mode status
   */
  getCloudModeStatus(): {
    initialized: boolean;
    rateLimitStatus?: {
      remainingRequests: number;
      resetAt: Date;
    };
  } {
    if (!this.rateLimiter) {
      return { initialized: false };
    }

    const status = this.rateLimiter.getStatus('elevenlabs');
    return {
      initialized: true,
      rateLimitStatus: {
        remainingRequests: status.remainingQuota,
        resetAt: status.resetAt,
      },
    };
  }

  /**
   * Check if cloud mode is available
   */
  isCloudModeAvailable(): boolean {
    return !!(this.cloudCredentialManager && this.rateLimiter && this.streamHandler);
  }

  /**
   * Cleanup cloud mode resources
   */
  async cleanupCloudMode(): Promise<void> {
    if (this.streamHandler) {
      await this.streamHandler.disconnect();
      this.streamHandler = null;
    }
    this.cloudCredentialManager = null;
    this.rateLimiter = null;
  }
}
