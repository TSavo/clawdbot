/**
 * System Mode Integration for STT Providers
 *
 * This module integrates system mode support with the plugin-installer pattern.
 * It provides a unified interface for initializing STT providers in system mode
 * across all supported providers (Whisper, Faster-Whisper, Deepgram).
 *
 * Usage:
 * ```typescript
 * import {
 *   initializeSTTProvider,
 *   initializeAllProviders,
 *   getSystemModeStatus,
 * } from './system-mode-integration';
 *
 * // Initialize a single provider
 * const result = await initializeSTTProvider('whisper', {
 *   modelSize: 'base',
 *   device: 'auto',
 * }, { verbose: true });
 *
 * // Initialize all providers
 * const allResults = await initializeAllProviders({ verbose: true });
 * ```
 */

import type {
  WhisperSTTPlugin,
  FasterWhisperSTTPlugin,
  DeepgramSTTPlugin,
} from './providers/stt/index.js';
import {
  initializeSystemMode,
  validateSystemModeConfig,
  getProviderDependencies,
  listSupportedProviders,
  getPlatformInfo,
  type SystemModeConfig,
} from './providers/stt/system-mode.js';

/**
 * Supported STT provider types
 */
export type STTProviderType = 'whisper' | 'faster-whisper' | 'deepgram';

/**
 * System mode initialization result
 */
export interface SystemModeInitResult {
  provider: STTProviderType;
  success: boolean;
  config?: SystemModeConfig;
  details?: Record<string, unknown>;
  error?: string;
  timestamp: Date;
}

/**
 * Initialize a specific STT provider in system mode
 */
export async function initializeSTTProvider(
  provider: STTProviderType,
  config?: SystemModeConfig,
  options?: { verbose?: boolean },
): Promise<SystemModeInitResult> {
  const { verbose = false } = options || {};
  const startTime = new Date();

  try {
    if (verbose) {
      console.log(`\nInitializing ${provider} in system mode...`);
      console.log('Platform:', JSON.stringify(getPlatformInfo(), null, 2));
    }

    // Validate provider name
    const supportedProviders = listSupportedProviders();
    if (!supportedProviders.find((p) => p.name === provider)) {
      throw new Error(`Unknown provider: ${provider}. Supported: ${supportedProviders.map((p) => p.name).join(', ')}`);
    }

    // Validate configuration if provided
    if (config) {
      const validation = validateSystemModeConfig(config);
      if (!validation.valid) {
        throw new Error(`Configuration validation failed: ${validation.errors.join(', ')}`);
      }
    }

    // Initialize system mode
    const result = await initializeSystemMode(provider, config, verbose);

    if (verbose) {
      if (result.success) {
        console.log(`✓ ${provider} system mode initialized successfully`);
        console.log('Configuration:', JSON.stringify(result.config, null, 2));
      } else {
        console.log(`✗ ${provider} system mode initialization failed: ${result.error}`);
      }
    }

    return {
      provider,
      success: result.success,
      config: result.config,
      details: result.details,
      error: result.error,
      timestamp: startTime,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.error(`✗ Error initializing ${provider}: ${errorMsg}`);
    }

    return {
      provider,
      success: false,
      error: errorMsg,
      timestamp: startTime,
    };
  }
}

/**
 * Initialize all STT providers in system mode
 */
export async function initializeAllProviders(
  config?: SystemModeConfig,
  options?: { verbose?: boolean },
): Promise<SystemModeInitResult[]> {
  const { verbose = false } = options || {};
  const providers: STTProviderType[] = ['whisper', 'faster-whisper', 'deepgram'];

  if (verbose) {
    console.log('\nInitializing all STT providers in system mode...');
    console.log('-'.repeat(50));
  }

  const results: SystemModeInitResult[] = [];

  for (const provider of providers) {
    const result = await initializeSTTProvider(provider, config, { verbose });
    results.push(result);
  }

  if (verbose) {
    console.log('-'.repeat(50));
    const successCount = results.filter((r) => r.success).length;
    console.log(`\nInitialization complete: ${successCount}/${results.length} providers initialized`);
  }

  return results;
}

/**
 * Get current system mode status for all providers
 */
export async function getSystemModeStatus(): Promise<Record<string, unknown>> {
  const providers = listSupportedProviders();

  const status: Record<string, unknown> = {
    platform: getPlatformInfo(),
    providers: {},
  };

  const providersObj = status.providers as Record<string, unknown>;

  for (const provider of providers) {
    const deps = getProviderDependencies(provider.name);
    providersObj[provider.name] = {
      name: provider.name,
      description: provider.description,
      dependencies: {
        binaries: deps?.binaries,
        pipPackages: deps?.pipPackages,
      },
    };
  }

  return status;
}

/**
 * Create STT provider instances with system mode configuration
 * This integrates with the plugin-installer pattern
 */
export async function createSTTProviderWithSystemMode(
  providerType: STTProviderType,
  options?: { verbose?: boolean; autoInitialize?: boolean },
) {
  const { verbose = false, autoInitialize = true } = options || {};

  // Dynamically import the provider class
  const { WhisperSTTPlugin, FasterWhisperSTTPlugin, DeepgramSTTPlugin } = await import(
    './providers/stt/index.js'
  );

  let providerClass: any;

  switch (providerType) {
    case 'whisper':
      providerClass = WhisperSTTPlugin;
      break;
    case 'faster-whisper':
      providerClass = FasterWhisperSTTPlugin;
      break;
    case 'deepgram':
      providerClass = DeepgramSTTPlugin;
      break;
    default:
      throw new Error(`Unknown provider: ${providerType}`);
  }

  // Create provider instance
  const provider = new providerClass();

  // Initialize system mode if requested
  if (autoInitialize) {
    const result = await provider.initializeSystemMode({}, verbose);

    if (!result.success) {
      throw new Error(`Failed to initialize ${providerType} in system mode: ${result.error}`);
    }
  }

  return provider;
}

/**
 * Validate all providers' system mode dependencies
 */
export async function validateSystemModeDependencies(
  verbose = false,
): Promise<Record<STTProviderType, { valid: boolean; issues: string[] }>> {
  const result: Record<STTProviderType, { valid: boolean; issues: string[] }> = {
    whisper: { valid: true, issues: [] },
    'faster-whisper': { valid: true, issues: [] },
    deepgram: { valid: true, issues: [] },
  };

  const providers: STTProviderType[] = ['whisper', 'faster-whisper', 'deepgram'];

  for (const provider of providers) {
    try {
      const initResult = await initializeSystemMode(provider, {}, verbose);

      if (!initResult.success) {
        result[provider].valid = false;
        result[provider].issues.push(initResult.error || 'Unknown error');
      }
    } catch (error) {
      result[provider].valid = false;
      result[provider].issues.push(
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  return result;
}

/**
 * Export system mode utilities for advanced usage
 */
export {
  initializeSystemMode,
  validateSystemModeConfig,
  getProviderDependencies,
  listSupportedProviders,
  getPlatformInfo,
  type SystemModeConfig,
} from './providers/stt/system-mode.js';
