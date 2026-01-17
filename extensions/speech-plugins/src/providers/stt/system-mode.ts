/**
 * System Mode Support for STT Providers
 *
 * Provides standardized system mode initialization across all STT providers.
 * Handles:
 * - Package manager detection (brew, apt-get, choco)
 * - Dependency installation and verification
 * - Model caching and persistence
 * - Configuration validation
 * - Error handling with fallback suggestions
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

/**
 * System mode configuration
 */
export interface SystemModeConfig {
  cachePath?: string;
  modelSize?: string;
  device?: string;
  cpuThreads?: number;
  beamSize?: number;
  computeType?: string;
  pythonPath?: string;
  [key: string]: unknown;
}

/**
 * System dependencies required for different STT providers
 */
interface DependencySet {
  binaries: string[];
  packages: Record<'brew' | 'apt' | 'choco', string[]>;
  pipPackages?: string[];
  description: string;
}

/**
 * Dependency definitions for each provider
 */
const PROVIDER_DEPENDENCIES: Record<string, DependencySet> = {
  whisper: {
    description: 'OpenAI Whisper STT',
    binaries: ['ffmpeg', 'python3'],
    packages: {
      brew: ['ffmpeg', 'python3'],
      apt: ['ffmpeg', 'python3', 'python3-dev'],
      choco: ['ffmpeg', 'python3'],
    },
    pipPackages: ['openai-whisper'],
  },
  'faster-whisper': {
    description: 'Faster-Whisper STT (optimized)',
    binaries: ['ffmpeg', 'python3'],
    packages: {
      brew: ['ffmpeg', 'python3'],
      apt: ['ffmpeg', 'python3', 'python3-dev'],
      choco: ['ffmpeg', 'python3'],
    },
    pipPackages: ['faster-whisper', 'torch', 'torchaudio'],
  },
  deepgram: {
    description: 'Deepgram STT with local support',
    binaries: ['ffmpeg', 'python3'],
    packages: {
      brew: ['ffmpeg', 'python3'],
      apt: ['ffmpeg', 'python3', 'python3-dev'],
      choco: ['ffmpeg', 'python3'],
    },
    pipPackages: ['deepgram-sdk'],
  },
};

/**
 * Detects if a binary is available on the system PATH
 */
export function detectBinary(binary: string): boolean {
  try {
    if (process.platform === 'win32') {
      execSync(`where ${binary}`, { stdio: 'ignore' });
    } else {
      execSync(`which ${binary}`, { stdio: 'ignore' });
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the appropriate package manager for the current platform
 */
export function getPackageManager(): 'brew' | 'apt' | 'choco' | null {
  const platform = process.platform;

  if (platform === 'darwin') {
    return detectBinary('brew') ? 'brew' : null;
  }

  if (platform === 'linux') {
    return detectBinary('apt-get') ? 'apt' : null;
  }

  if (platform === 'win32') {
    return detectBinary('choco') ? 'choco' : null;
  }

  return null;
}

/**
 * Install a system dependency using the detected package manager
 */
export async function installSystemDependency(
  binary: string,
  packages: string[],
  packageManager: 'brew' | 'apt' | 'choco',
  verbose = false,
): Promise<void> {
  if (detectBinary(binary)) {
    if (verbose) {
      console.log(`✓ ${binary} already installed`);
    }
    return;
  }

  const commands = {
    brew: `brew install ${packages.join(' ')}`,
    apt: `sudo apt-get update && sudo apt-get install -y ${packages.join(' ')}`,
    choco: `choco install -y ${packages.join(' ')}`,
  };

  const cmd = commands[packageManager];

  if (verbose) {
    console.log(`Installing ${binary} via ${packageManager}...`);
  }

  try {
    execSync(cmd, {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
      shell: true,
    } as any);

    // Verify installation
    if (!detectBinary(binary)) {
      throw new Error(`${binary} not found after installation`);
    }

    if (verbose) {
      console.log(`✓ ${binary} installed successfully`);
    }
  } catch (error) {
    throw new Error(
      `Failed to install ${binary} via ${packageManager}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Install Python packages via pip
 */
export async function installPythonPackage(
  packageName: string,
  pythonPath = 'python3',
  verbose = false,
): Promise<void> {
  try {
    // Check if already installed
    execSync(`${pythonPath} -m pip show ${packageName}`, {
      stdio: ['ignore', 'ignore', 'ignore'] as const,
    });

    if (verbose) {
      console.log(`✓ ${packageName} already installed`);
    }
    return;
  } catch {
    // Not installed, proceed with installation
  }

  if (verbose) {
    console.log(`Installing Python package: ${packageName}...`);
  }

  try {
    execSync(`${pythonPath} -m pip install ${packageName}`, {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
    });

    if (verbose) {
      console.log(`✓ ${packageName} installed successfully`);
    }
  } catch (error) {
    throw new Error(
      `Failed to install ${packageName}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Initialize system mode for a specific STT provider
 */
export async function initializeSystemMode(
  providerName: string,
  config: SystemModeConfig = {},
  verbose = false,
): Promise<{ success: boolean; config: SystemModeConfig; details: Record<string, unknown>; error?: string }> {
  const details: Record<string, unknown> = {};

  try {
    // Validate provider
    const deps = PROVIDER_DEPENDENCIES[providerName];
    if (!deps) {
      throw new Error(
        `Unknown provider: ${providerName}. Supported: ${Object.keys(PROVIDER_DEPENDENCIES).join(', ')}`,
      );
    }

    if (verbose) {
      console.log(`\nInitializing ${deps.description} in system mode...`);
    }

    // Detect package manager
    const pkgMgr = getPackageManager();
    if (!pkgMgr) {
      throw new Error(
        'No package manager detected. Install brew (macOS), apt (Linux), or choco (Windows) and retry.',
      );
    }

    if (verbose) {
      console.log(`Detected package manager: ${pkgMgr}`);
    }

    details.packageManager = pkgMgr;

    // Install system dependencies
    for (const binary of deps.binaries) {
      const packages = deps.packages[pkgMgr];
      const binaryPackages = packages.filter((p) => p.includes(binary) || binary.includes(p));

      await installSystemDependency(
        binary,
        binaryPackages.length > 0 ? binaryPackages : [binary],
        pkgMgr,
        verbose,
      );
    }

    details.binariesInstalled = deps.binaries;

    // Setup model cache directory
    const cachePath = config.cachePath || path.join(os.homedir(), '.cache', 'stt-models');
    if (!fs.existsSync(cachePath)) {
      fs.mkdirSync(cachePath, { recursive: true });
      if (verbose) {
        console.log(`Created model cache directory: ${cachePath}`);
      }
    }

    details.cachePath = cachePath;

    // Determine Python path
    const pythonPath = config.pythonPath || 'python3';
    if (!detectBinary(pythonPath)) {
      throw new Error(`Python not found at: ${pythonPath}`);
    }

    details.pythonPath = pythonPath;

    // Install Python packages
    if (deps.pipPackages) {
      for (const pipPackage of deps.pipPackages) {
        try {
          await installPythonPackage(pipPackage, pythonPath, verbose);
        } catch (error) {
          if (verbose) {
            console.warn(`Warning: Could not install ${pipPackage}: ${error}`);
          }
          // Continue with other packages
        }
      }

      details.pythonPackagesInstalled = deps.pipPackages;
    }

    // Build final configuration
    const finalConfig: SystemModeConfig = {
      ...config,
      cachePath,
      pythonPath,
    };

    if (verbose) {
      console.log(`✓ ${deps.description} system mode initialized successfully`);
    }

    return {
      success: true,
      config: finalConfig,
      details,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.error(`✗ System mode initialization failed: ${errorMsg}`);
      console.log('\nFallback options:');
      console.log('- Try Docker mode for containerized deployment');
      console.log('- Use Cloud mode with external API providers');
    }

    return {
      success: false,
      config,
      details,
      error: errorMsg,
    };
  }
}

/**
 * Validate system mode configuration
 */
export function validateSystemModeConfig(config: SystemModeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (config.pythonPath && !detectBinary(config.pythonPath)) {
    errors.push(`Python executable not found at: ${config.pythonPath}`);
  }

  if (config.cachePath && !fs.existsSync(config.cachePath)) {
    try {
      fs.mkdirSync(config.cachePath, { recursive: true });
    } catch (error) {
      errors.push(`Cannot create cache directory: ${config.cachePath}`);
    }
  }

  if (config.computeType && !['int8', 'float16', 'float32'].includes(config.computeType as string)) {
    errors.push(`Invalid computeType: ${config.computeType}. Must be int8, float16, or float32`);
  }

  if (config.device && !['auto', 'cpu', 'cuda', 'mps', 'rocm'].includes(config.device as string)) {
    errors.push(`Invalid device: ${config.device}. Must be auto, cpu, cuda, mps, or rocm`);
  }

  if (config.cpuThreads && (config.cpuThreads < 1 || config.cpuThreads > 256)) {
    errors.push(`Invalid cpuThreads: ${config.cpuThreads}. Must be between 1 and 256`);
  }

  if (config.beamSize && (config.beamSize < 1 || config.beamSize > 512)) {
    errors.push(`Invalid beamSize: ${config.beamSize}. Must be between 1 and 512`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get platform-specific information for debugging
 */
export function getPlatformInfo(): Record<string, unknown> {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    pythonAvailable: detectBinary('python3'),
    ffmpegAvailable: detectBinary('ffmpeg'),
    dockerAvailable: detectBinary('docker'),
    packageManager: getPackageManager(),
    homeDir: os.homedir(),
  };
}

/**
 * Get system mode provider dependencies
 */
export function getProviderDependencies(providerName: string): DependencySet | null {
  return PROVIDER_DEPENDENCIES[providerName] || null;
}

/**
 * List all supported providers with system mode support
 */
export function listSupportedProviders(): Array<{ name: string; description: string }> {
  return Object.entries(PROVIDER_DEPENDENCIES).map(([name, deps]) => ({
    name,
    description: deps.description,
  }));
}
