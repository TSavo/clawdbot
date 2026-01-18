/**
 * Faster-Whisper STT Plugin Wrapper
 *
 * Wraps the FasterWhisperExecutor to conform to the STTProvider interface.
 * Optimized Whisper implementation with GPU support and compute type selection.
 *
 * System Mode Features:
 * - GPU acceleration (CUDA, MPS, ROCm) auto-detection
 * - Compute type optimization (int8, float16, float32)
 * - CPU thread configuration
 * - Beam search tuning
 * - Cross-platform installation via package managers
 */

import { BaseSTTPlugin } from './base.js';
import type {
  STTProviderMetadata,
  STTCapabilities,
} from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';

/**
 * Faster-Whisper STT Plugin
 *
 * High-performance Whisper implementation with:
 * - GPU acceleration (CUDA, MPS, ROCm)
 * - Compute type optimization (int8, float16, float32)
 * - CPU thread configuration
 * - Beam search tuning
 */
export class FasterWhisperSTTPlugin extends BaseSTTPlugin {
  readonly metadata: STTProviderMetadata;

  constructor(deploymentConfig?: DeploymentConfig) {
    super(deploymentConfig);

    // Define provider metadata
    this.metadata = {
      id: 'faster-whisper-stt',
      name: 'Faster-Whisper',
      description: 'Optimized Whisper STT with GPU support and compute type selection',
      version: '1.0.0',
      capabilities: this.getFasterWhisperCapabilities(),
      configSchema: {
        validate: (config: unknown) => {
          if (!config || typeof config !== 'object') {
            return { ok: false, errors: ['Config must be an object'] };
          }

          const cfg = config as Record<string, unknown>;

          if (cfg.mode && cfg.mode !== 'system') {
            return {
              ok: false,
              errors: ['Faster-Whisper only supports "system" mode'],
            };
          }

          if (cfg.computeType && !['int8', 'float16', 'float32'].includes(cfg.computeType as string)) {
            return {
              ok: false,
              errors: ['computeType must be "int8", "float16", or "float32"'],
            };
          }

          return { ok: true };
        },
        properties: {
          mode: {
            type: 'string',
            description: 'Deployment mode (must be "system")',
          },
          modelSize: {
            type: 'string',
            description: 'Whisper model size: tiny, small, base, medium, large',
          },
          computeType: {
            type: 'string',
            description: 'Compute type: int8 (fast), float16 (balanced), float32 (accurate)',
          },
          language: {
            type: 'string',
            description: 'Default language for transcription (ISO 639-1 code)',
          },
          cpuThreads: {
            type: 'number',
            description: 'Number of CPU threads for parallel processing',
          },
          beamSize: {
            type: 'number',
            description: 'Beam search size for accuracy tuning (1-512)',
          },
          device: {
            type: 'string',
            description: 'Device: auto, cpu, cuda, mps, rocm',
          },
        },
      },
    };
  }

  /**
   * Create FasterWhisperExecutor instance
   */
  protected createExecutor(): VoiceProviderExecutor {
    // Import FasterWhisperExecutor
    const { FasterWhisperExecutor } = require('../../../../../src/media/voice-providers/faster-whisper.js');

    // Build configuration from deployment config
    const config = this.buildFasterWhisperConfig();

    // Create executor
    return new FasterWhisperExecutor('faster-whisper-stt', config);
  }

  /**
   * Build Faster-Whisper configuration from deployment config
   */
  private buildFasterWhisperConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {
      modelSize: 'base',
      computeType: 'float16',
      cpuThreads: 4,
      beamSize: 5,
    };

    if (!this.deploymentConfig) {
      return config;
    }

    // Map deployment config to Faster-Whisper config
    if (this.deploymentConfig.mode === 'system') {
      const systemConfig = this.deploymentConfig as any;

      // Model configuration
      if (systemConfig.models?.path) {
        config.modelPath = systemConfig.models.path;
      }

      // CLI flags
      if (systemConfig.cliFlags?.defaults) {
        const flags = systemConfig.cliFlags.defaults;
        if (flags.computeType) config.computeType = flags.computeType;
        if (flags.cpuThreads) config.cpuThreads = flags.cpuThreads;
        if (flags.beamSize) config.beamSize = flags.beamSize;
        if (flags.device) config.device = flags.device;
      }
    }

    // Apply environment variables and tags
    if (this.deploymentConfig.env) {
      Object.assign(config, this.deploymentConfig.env);
    }

    if (this.deploymentConfig.tags) {
      if (this.deploymentConfig.tags.modelSize) {
        config.modelSize = this.deploymentConfig.tags.modelSize;
      }
      if (this.deploymentConfig.tags.language) {
        config.language = this.deploymentConfig.tags.language;
      }
    }

    return config;
  }

  /**
   * Get Faster-Whisper-specific capabilities
   */
  private getFasterWhisperCapabilities(): STTCapabilities {
    return {
      formats: ['wav', 'mp3', 'opus'],
      sampleRates: [8000, 16000, 32000, 44100, 48000],
      supportsStreaming: true,
      supportsPartialTranscripts: true,
      languages: [
        'en', 'zh', 'de', 'es', 'ru', 'ko', 'fr', 'ja', 'pt', 'tr',
        'pl', 'ca', 'nl', 'ar', 'sv', 'it', 'id', 'hi', 'fi', 'vi',
        'he', 'uk', 'el', 'ms', 'cs', 'ro', 'da', 'hu', 'ta', 'no',
        'th', 'ur', 'hr', 'bg', 'lt', 'la', 'mi', 'ml', 'cy', 'sk',
        'te', 'fa', 'lv', 'bn', 'sr', 'az', 'sl', 'kn', 'et', 'mk',
        'br', 'eu', 'is', 'hy', 'ne', 'mn', 'bs', 'kk', 'sq', 'sw',
        'gl', 'mr', 'pa', 'si', 'km', 'sn', 'so', 'af', 'oc', 'ka',
        'be', 'tg', 'sd', 'gu', 'am', 'yi', 'lo', 'uz', 'fo', 'mt',
      ],
      maxDurationSeconds: null,
    };
  }
}
