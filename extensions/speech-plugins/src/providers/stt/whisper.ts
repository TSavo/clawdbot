/**
 * Whisper STT Plugin Wrapper
 *
 * Wraps the WhisperExecutor to conform to the STTProvider interface.
 * Supports Docker and System deployment modes.
 *
 * System Mode Features:
 * - Automatic ffmpeg and python3 detection/installation
 * - OpenAI Whisper package management
 * - CPU/GPU support with model caching
 * - Cross-platform package manager support (brew, apt, choco)
 */

import { BaseSTTPlugin } from './base.js';
import type {
  STTProviderMetadata,
  STTCapabilities,
} from '../../interfaces/stt-provider.js';
import type { VoiceProviderExecutor } from '@media/voice-providers/executor.js';
import type { DeploymentConfig } from '@config/deployment-config.types.js';

/**
 * Whisper STT Plugin
 *
 * Provides speech-to-text using OpenAI's Whisper model.
 * Supports both Docker and local system deployment.
 */
export class WhisperSTTPlugin extends BaseSTTPlugin {
  readonly metadata: STTProviderMetadata;

  constructor(deploymentConfig?: DeploymentConfig) {
    super(deploymentConfig);

    // Define provider metadata
    this.metadata = {
      id: 'whisper-stt',
      name: 'Whisper',
      description: 'OpenAI Whisper speech-to-text model with system, Docker, and cloud deployment support',
      version: '1.0.0',
      capabilities: this.getWhisperCapabilities(),
      configSchema: {
        validate: (config: unknown) => {
          // Basic validation for deployment config
          if (!config || typeof config !== 'object') {
            return { ok: false, errors: ['Config must be an object'] };
          }

          const cfg = config as Record<string, unknown>;

          if (cfg.mode && !['docker', 'system', 'cloud'].includes(cfg.mode as string)) {
            return {
              ok: false,
              errors: ['mode must be "docker", "system", or "cloud"'],
            };
          }

          return { ok: true };
        },
        properties: {
          mode: {
            type: 'string',
            description: 'Deployment mode: system (local), docker (containerized), or cloud (external)',
          },
          modelSize: {
            type: 'string',
            description: 'Whisper model size: tiny, small, base, medium, large',
          },
          language: {
            type: 'string',
            description: 'Default language for transcription (ISO 639-1 code)',
          },
          device: {
            type: 'string',
            description: 'Device for inference: auto, cpu, cuda, mps, rocm (system mode only)',
          },
          dockerPort: {
            type: 'number',
            description: 'Port for Docker deployment (default: 8000)',
          },
          dockerImage: {
            type: 'string',
            description: 'Docker image name (default: openai/whisper:latest)',
          },
          pythonPath: {
            type: 'string',
            description: 'Python executable path for system deployment',
          },
          cachePath: {
            type: 'string',
            description: 'Model cache directory path (default: ~/.cache/stt-models)',
          },
        },
      },
    };
  }

  /**
   * Create WhisperExecutor instance
   */
  protected createExecutor(): VoiceProviderExecutor {
    // Import WhisperExecutor
    const { WhisperExecutor } = require('../../../../../src/media/voice-providers/whisper.js');

    // Build configuration from deployment config
    const config = this.buildWhisperConfig();

    // Create executor
    return new WhisperExecutor('whisper-stt', config);
  }

  /**
   * Build Whisper configuration from deployment config
   */
  private buildWhisperConfig(): Record<string, unknown> {
    const config: Record<string, unknown> = {
      modelSize: 'base',
    };

    if (!this.deploymentConfig) {
      return config;
    }

    // Map deployment config to Whisper config
    if (this.deploymentConfig.mode === 'docker') {
      config.deploymentMode = 'docker';
      const dockerConfig = this.deploymentConfig as any;
      config.dockerPort = dockerConfig.ports?.[8000] ?? 8000;
      config.dockerImage = dockerConfig.image ?? 'openai/whisper:latest';
    } else if (this.deploymentConfig.mode === 'system') {
      config.deploymentMode = 'system';
      const systemConfig = this.deploymentConfig as any;
      config.pythonPath = systemConfig.binary ?? 'python3';
      config.cachePath = systemConfig.models?.path;
    }

    // Apply environment variables and tags
    if (this.deploymentConfig.env) {
      Object.assign(config, this.deploymentConfig.env);
    }

    return config;
  }

  /**
   * Get Whisper-specific capabilities
   */
  private getWhisperCapabilities(): STTCapabilities {
    return {
      formats: ['wav', 'mp3', 'opus', 'aac'],
      sampleRates: [16000, 44100, 48000],
      supportsStreaming: true,
      supportsPartialTranscripts: false, // Whisper buffers audio before transcribing
      languages: [
        'en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'zh', 'ja', 'ko', 'ar',
        'hi', 'tr', 'pl', 'sv', 'id', 'th', 'vi', 'he', 'cs', 'ro', 'fi', 'da',
      ],
      maxDurationSeconds: null,
    };
  }
}
