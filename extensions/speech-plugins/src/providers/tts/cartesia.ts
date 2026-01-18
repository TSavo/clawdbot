/**
 * CartesiaAI TTS Plugin Wrapper
 *
 * Wraps the CartesiaAI executor for use as a TTSProvider plugin.
 * Supports ultra-fast voice synthesis with model selection.
 */

import type {
  TTSProviderMetadata,
  TTSCapabilities,
  TTSVoice,
} from '../../interfaces/tts-provider.js';

import { BaseTTSPlugin } from './base.js';
import { CartesiaExecutor } from '@media/voice-providers/cartesia.js';
import type { CartesiaConfig } from '@media/voice-providers/cartesia.js';
import { CloudCredentialManager, getCredentialManager } from '../cloud-credential-manager.js';
import {
  createStreamHandler,
  type StreamConfig,
  type BaseStreamHandler,
} from '../cloud-stream-handlers.js';
import { CloudRateLimiter, DEFAULT_CONFIGS } from '../cloud-rate-limiter.js';

/**
 * CartesiaAI TTS Plugin
 */
export class CartesiaTTSPlugin extends BaseTTSPlugin {
  readonly metadata: TTSProviderMetadata;
  private cloudCredentialManager: CloudCredentialManager | null = null;
  private rateLimiter: CloudRateLimiter | null = null;
  private streamHandler: BaseStreamHandler | null = null;

  constructor(private config: CartesiaConfig) {
    super();

    // Build metadata from config
    this.metadata = {
      id: 'cartesia-tts',
      name: 'CartesiaAI TTS',
      description: `Ultra-fast voice synthesis with ${config.model} model`,
      version: '1.0.0',
      capabilities: this.buildCapabilities(),
    };
  }

  /**
   * Create CartesiaAI executor instance
   */
  protected createExecutor(config?: Record<string, unknown>): CartesiaExecutor {
    // Merge provided config with constructor config
    const finalConfig = { ...this.config, ...(config || {}) } as CartesiaConfig;
    return new CartesiaExecutor(finalConfig);
  }

  /**
   * Build capabilities from executor
   */
  private buildCapabilities(): TTSCapabilities {
    const isUltraFast = this.config.model === 'sonic-turbo';

    return {
      formats: ['pcm', 'mp3'],
      sampleRates: [16000, 24000, 44100, 48000],
      voices: this.getVoices(),
      supportsStreaming: true,
      languages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'pl', 'nl', 'ru', 'uk', 'ja', 'ko',
        'zh', 'tr', 'ar', 'hi', 'th', 'vi', 'id', 'fi', 'sv', 'no', 'da', 'cs',
        'hu', 'ro', 'bg', 'hr', 'sk', 'sl', 'el', 'he', 'fa', 'bn', 'pa', 'ta',
      ],
    };
  }

  /**
   * Get available voices
   */
  private getVoices(): TTSVoice[] {
    // Default voices - will be populated dynamically after initialization
    return [
      {
        id: 'default',
        name: 'Default Voice',
        language: 'en',
        gender: 'neutral',
        characteristics: ['expressive', 'natural'],
      },
    ];
  }

  /**
   * List available voices (dynamically populated)
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
            characteristics: voice.description ? [voice.description] : undefined,
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
   * - WebSocket streaming for ultra-fast voice synthesis
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
      process.env.CARTESIA_API_KEY ||
      (await this.cloudCredentialManager.getCredential('cartesia'))?.apiKey;

    if (!apiKey) {
      throw new Error(
        'CartesiaAI API key not found. Set CARTESIA_API_KEY environment variable or provide it in config.',
      );
    }

    // Validate credential
    const validation = await this.cloudCredentialManager.validateCredential('cartesia', {
      provider: 'cartesia',
      apiKey,
      endpoint: config?.endpoint || 'wss://api.cartesia.ai/websocket',
    });

    if (!validation.valid) {
      throw new Error(`CartesiaAI API key validation failed: ${validation.error}`);
    }

    // Store credential for future use
    await this.cloudCredentialManager.storeCredential({
      provider: 'cartesia',
      apiKey,
      endpoint: config?.endpoint,
    });

    // Initialize rate limiter
    this.rateLimiter = new CloudRateLimiter();
    this.rateLimiter.registerProvider('cartesia', DEFAULT_CONFIGS.cartesia);

    // Initialize WebSocket stream handler
    const streamConfig: StreamConfig = {
      url: 'wss://api.cartesia.ai/websocket',
      apiKey,
      timeout: 30000,
    };

    this.streamHandler = createStreamHandler('websocket', streamConfig);

    // Setup error handling
    this.streamHandler.on('error', (error) => {
      console.error('CartesiaAI stream error:', error);
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

    const status = this.rateLimiter.getStatus('cartesia');
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
