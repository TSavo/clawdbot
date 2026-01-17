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

/**
 * CartesiaAI TTS Plugin
 */
export class CartesiaTTSPlugin extends BaseTTSPlugin {
  readonly metadata: TTSProviderMetadata;

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
}
