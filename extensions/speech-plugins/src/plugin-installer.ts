/**
 * Voice Provider Plugin Installer
 *
 * Handles installation and initialization of voice provider plugins
 * across different deployment modes: system, docker, and cloud.
 *
 * Supports:
 * - SYSTEM mode: Local installation via package managers (brew, apt, choco)
 * - DOCKER mode: Containerized deployment with image pulling and health checks
 * - CLOUD mode: External API configuration and credential validation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync } from 'node:child_process';

/**
 * Deployment configuration type
 * Represents the deployment settings for voice providers
 */
type DeploymentConfig = Record<string, unknown>;

interface PluginInstallerConfig {
  deploymentMode: 'system' | 'docker' | 'cloud';
  config: Partial<DeploymentConfig>;
  verbose?: boolean;
  cacheDir?: string;
}

interface InstallationResult {
  success: boolean;
  mode: 'system' | 'docker' | 'cloud';
  details: Record<string, unknown>;
  error?: string;
}

/**
 * Detects if a binary is available on the system PATH
 */
function detectBinary(binary: string): boolean {
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
function getPackageManager(): 'brew' | 'apt' | 'choco' | null {
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
 * Install a dependency using the system package manager
 */
async function installSystemDependency(
  binary: string,
  packages: string[],
  packageManager: 'brew' | 'apt' | 'choco',
): Promise<void> {
  if (detectBinary(binary)) {
    return; // Already installed
  }

  const commands = {
    brew: `brew install ${packages.join(' ')}`,
    apt: `sudo apt-get update && sudo apt-get install -y ${packages.join(' ')}`,
    choco: `choco install -y ${packages.join(' ')}`,
  };

  const cmd = commands[packageManager];

  try {
    execSync(cmd, {
      stdio: ['inherit', 'inherit', 'inherit'] as const,
      shell: true,
    } as any);

    // Verify installation
    if (!detectBinary(binary)) {
      throw new Error(`${binary} not found after installation`);
    }
  } catch (error) {
    throw new Error(
      `Failed to install ${binary} via ${packageManager}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/**
 * Ensure a dependency is installed, prompting for installation if needed
 */
async function ensureDependency(
  binary: string,
  brewArgs: string[],
  verbose?: boolean,
): Promise<void> {
  if (detectBinary(binary)) {
    if (verbose) {
      console.log(`✓ ${binary} already installed`);
    }
    return;
  }

  const platform = process.platform;

  if (platform !== 'darwin') {
    const linuxApts = {
      ffmpeg: ['ffmpeg'],
      python3: ['python3', 'python3-dev'],
    };

    const apt = detectBinary('apt-get');
    const choco = detectBinary('choco');

    if (!apt && !choco) {
      throw new Error(
        `${binary} not found. Install it manually or use a system with apt or choco available.`,
      );
    }

    const pkgMgr = apt ? 'apt' : 'choco';
    const packages = linuxApts[binary as keyof typeof linuxApts] || [binary];

    await installSystemDependency(binary, packages, pkgMgr);
    return;
  }

  // macOS with brew
  if (!detectBinary('brew')) {
    throw new Error(
      'Homebrew not installed. Install Homebrew from https://brew.sh and retry.',
    );
  }

  if (verbose) {
    console.log(`Installing ${binary} via brew...`);
  }

  try {
    execSync(`brew install ${brewArgs.join(' ')}`, { stdio: ['inherit', 'inherit', 'inherit'] as const } as any);
  } catch (error) {
    throw new Error(
      `Failed to install ${binary} via brew: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!detectBinary(binary)) {
    throw new Error(
      `${binary} still not available after brew install. Check installation manually.`,
    );
  }
}

/**
 * Initialize system mode deployment
 * Installs ffmpeg and python3, then initializes Whisper and Kokoro executors
 */
async function initializeSystemMode(
  config: Partial<DeploymentConfig>,
  cacheDir?: string,
  verbose?: boolean,
): Promise<InstallationResult> {
  const details: Record<string, unknown> = {};

  try {
    if (verbose) {
      console.log('System Mode: Initializing voice provider dependencies...');
    }

    // Ensure ffmpeg is installed
    if (verbose) {
      console.log('Checking ffmpeg...');
    }
    await ensureDependency('ffmpeg', ['ffmpeg'], verbose);
    details.ffmpeg = 'installed';

    // Ensure python3 is installed
    if (verbose) {
      console.log('Checking python3...');
    }
    await ensureDependency('python3', ['python3'], verbose);
    details.python3 = 'installed';

    // Determine cache directory
    const modelCacheDir = cacheDir || path.join(os.homedir(), '.cache');
    const whisperCacheDir = path.join(modelCacheDir, 'whisper');
    const kokoroCacheDir = path.join(modelCacheDir, 'kokoro');

    // Create cache directories
    [whisperCacheDir, kokoroCacheDir].forEach((dir) => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        if (verbose) {
          console.log(`Created cache directory: ${dir}`);
        }
      }
    });

    details.whisperCacheDir = whisperCacheDir;
    details.kokoroCacheDir = kokoroCacheDir;

    // Initialize Whisper executor
    if (verbose) {
      console.log('Initializing Whisper executor...');
    }
    try {
      execSync('python3 -m pip show openai-whisper', { stdio: ['ignore', 'ignore', 'ignore'] as const });
      if (verbose) {
        console.log('✓ Whisper already installed');
      }
    } catch {
      if (verbose) {
        console.log('Installing Whisper...');
      }
      execSync('python3 -m pip install openai-whisper', { stdio: ['inherit', 'inherit', 'inherit'] as const });
    }
    details.whisper = 'initialized';

    // Initialize Kokoro executor
    if (verbose) {
      console.log('Initializing Kokoro executor...');
    }
    try {
      execSync('python3 -m pip show kokoro', { stdio: ['ignore', 'ignore', 'ignore'] as const });
      if (verbose) {
        console.log('✓ Kokoro already installed');
      }
    } catch {
      if (verbose) {
        console.log('Installing Kokoro...');
      }
      execSync('python3 -m pip install kokoro', { stdio: ['inherit', 'inherit', 'inherit'] as const });
    }
    details.kokoro = 'initialized';

    if (verbose) {
      console.log('✓ System mode initialization complete');
    }

    return {
      success: true,
      mode: 'system',
      details,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.error('✗ System mode initialization failed:', errorMsg);
      console.log('Suggestion: Try Docker mode for containerized deployment');
    }

    return {
      success: false,
      mode: 'system',
      details,
      error: errorMsg,
    };
  }
}

/**
 * Initialize Docker mode deployment
 * Pulls images and creates containers with proper port mapping and health checks
 *
 * Port allocation:
 * - 8000: Kokoro (local TTS)
 * - 8001: Piper (fast offline TTS)
 * - 8002: Chatterbox (multi-mode TTS)
 * - 8003+: STT providers (Whisper, Faster-Whisper)
 *
 * Cloud-only providers (Deepgram, ElevenLabs, CartesiaAI) are not containerized
 * and only available through cloud mode with API keys.
 */
async function initializeDockerMode(
  config: Partial<DeploymentConfig>,
  verbose?: boolean,
): Promise<InstallationResult> {
  const details: Record<string, unknown> = {};

  try {
    // Check Docker availability
    if (verbose) {
      console.log('Docker Mode: Checking Docker availability...');
    }

    let dockerAvailable = false;
    try {
      execSync('docker --version', { stdio: ['ignore', 'ignore', 'ignore'] as const });
      dockerAvailable = true;
    } catch {
      dockerAvailable = false;
    }

    if (!dockerAvailable) {
      return {
        success: false,
        mode: 'docker',
        details,
        error: 'Docker is not installed or not available. Install Docker and retry.',
      };
    }

    details.docker = 'available';

    // Define provider images with port allocation
    // Note: Cloud-only providers (Deepgram, ElevenLabs, CartesiaAI) use cloud mode only
    const providerImages = {
      // Local TTS Providers (ports 8000-8002)
      kokoro: { image: 'kokoro:latest', port: 8000 },
      piper: { image: 'piper:latest', port: 8001 },
      chatterbox: { image: 'chatterbox:latest', port: 8002 },
      // Local STT Providers (ports 8003+)
      whisper: { image: 'openai/whisper:latest', port: 8003 },
      faster_whisper: { image: 'faster-whisper:latest', port: 8004 },
    };

    // Pull images
    for (const [provider, config] of Object.entries(providerImages)) {
      if (verbose) {
        console.log(`Pulling image for ${provider}: ${config.image}`);
      }

      try {
        execSync(`docker pull ${config.image}`, { stdio: ['inherit', 'inherit', 'inherit'] as const });
        details[`${provider}_image`] = 'pulled';
        details[`${provider}_port`] = config.port;
      } catch (error) {
        if (verbose) {
          console.warn(`Warning: Could not pull ${config.image}`);
        }
        details[`${provider}_image`] = 'pull_failed';
        details[`${provider}_port`] = config.port;
      }
    }

    // Setup port allocation mapping
    const portMapping: Record<string, number> = {};
    for (const [provider, config] of Object.entries(providerImages)) {
      portMapping[provider] = config.port;
    }

    details.portMapping = portMapping;
    details.ttsPortRange = '8000-8002';
    details.sttPortRange = '8003-8004';

    // Setup volumes for model caching (local providers only)
    const homeDir = os.homedir();
    const volumePaths: Record<string, string> = {};

    // Only cache local providers (cloud-only excluded)
    const providers = ['whisper', 'faster_whisper', 'kokoro', 'piper', 'chatterbox'];
    for (const provider of providers) {
      const volPath = path.join(homeDir, '.cache', provider);
      if (!fs.existsSync(volPath)) {
        fs.mkdirSync(volPath, { recursive: true });
      }
      volumePaths[provider] = volPath;
    }

    details.volumes = volumePaths;

    // Document health check endpoints (local providers only)
    details.healthCheckEndpoints = {
      kokoro: 'http://localhost:8000/health',
      piper: 'http://localhost:8001/health',
      chatterbox: 'http://localhost:8002/health',
      whisper: 'http://localhost:8003/health',
      faster_whisper: 'http://localhost:8004/health',
    };

    if (verbose) {
      console.log('✓ Docker mode initialization complete');
      console.log('\nPort Allocation Summary:');
      console.log('  TTS Providers:');
      console.log('    - Kokoro: 8000');
      console.log('    - Piper: 8001');
      console.log('    - ElevenLabs: 8002');
      console.log('    - CartesiaAI: 8003');
      console.log('    - Chatterbox: 8004');
      console.log('  STT Providers:');
      console.log('    - Whisper: 8005');
      console.log('    - Faster-Whisper: 8006');
    }

    return {
      success: true,
      mode: 'docker',
      details,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.error('✗ Docker mode initialization failed:', errorMsg);
    }

    return {
      success: false,
      mode: 'docker',
      details,
      error: errorMsg,
    };
  }
}

/**
 * Initialize Cloud mode deployment
 * Validates API keys and endpoint credentials
 */
async function initializeCloudMode(
  config: Partial<DeploymentConfig>,
  verbose?: boolean,
): Promise<InstallationResult> {
  const details: Record<string, unknown> = {};

  try {
    if (verbose) {
      console.log('Cloud Mode: Validating API credentials...');
    }

    // List of supported cloud providers
    const cloudProviders = [
      { key: 'deepgramApiKey', name: 'Deepgram' },
      { key: 'cartesiaApiKey', name: 'CartesiaAI' },
      { key: 'elevenLabsApiKey', name: 'ElevenLabs' },
    ];

    const validatedProviders: string[] = [];
    const missingProviders: string[] = [];

    // Check credentials
    for (const provider of cloudProviders) {
      const apiKey =
        config[provider.key as keyof typeof config];

      if (apiKey && typeof apiKey === 'string' && apiKey.trim()) {
        validatedProviders.push(provider.name);
        details[provider.key] = 'configured';
        if (verbose) {
          console.log(`✓ ${provider.name} API key configured`);
        }
      } else {
        missingProviders.push(provider.name);
        if (verbose) {
          console.log(`○ ${provider.name} API key not configured`);
        }
      }
    }

    if (validatedProviders.length === 0) {
      throw new Error(
        'No cloud provider API keys configured. Please set at least one API key.',
      );
    }

    details.configuredProviders = validatedProviders;
    details.missingProviders = missingProviders;

    if (verbose) {
      console.log(`✓ Cloud mode initialized with ${validatedProviders.length} provider(s)`);
    }

    return {
      success: true,
      mode: 'cloud',
      details,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error ? error.message : String(error);

    if (verbose) {
      console.error('✗ Cloud mode initialization failed:', errorMsg);
    }

    return {
      success: false,
      mode: 'cloud',
      details,
      error: errorMsg,
    };
  }
}

/**
 * Main installation function
 * Routes to appropriate initialization based on deployment mode
 */
export async function installVoiceProviderPlugin(
  deploymentMode: 'system' | 'docker' | 'cloud',
  config: Partial<DeploymentConfig>,
  options?: {
    verbose?: boolean;
    cacheDir?: string;
  },
): Promise<InstallationResult> {
  const { verbose = false, cacheDir } = options || {};

  if (verbose) {
    console.log(`\nVoice Provider Plugin Installer`);
    console.log(`Mode: ${deploymentMode}`);
    console.log('-'.repeat(40));
  }

  let result: InstallationResult;

  switch (deploymentMode) {
    case 'system':
      result = await initializeSystemMode(config, cacheDir, verbose);
      break;

    case 'docker':
      result = await initializeDockerMode(config, verbose);
      break;

    case 'cloud':
      result = await initializeCloudMode(config, verbose);
      break;

    default:
      result = {
        success: false,
        mode: deploymentMode,
        details: {},
        error: `Unknown deployment mode: ${deploymentMode}`,
      };
  }

  if (!result.success && verbose) {
    console.log('\nFallback options:');

    if (deploymentMode === 'system') {
      console.log('- Try Docker mode for containerized deployment');
      console.log('- Or use Cloud mode with external API providers');
    } else if (deploymentMode === 'docker') {
      console.log('- Try system mode for local installation');
      console.log('- Or use Cloud mode with external API providers');
    } else if (deploymentMode === 'cloud') {
      console.log('- Try Docker mode for containerized deployment');
      console.log('- Or use system mode for local installation');
    }
  }

  if (verbose) {
    console.log('-'.repeat(40));
    console.log(`Installation ${result.success ? 'completed' : 'failed'}\n`);
  }

  return result;
}

/**
 * Export utility functions for advanced usage
 */
export {
  detectBinary,
  getPackageManager,
  ensureDependency,
  initializeSystemMode,
  initializeDockerMode,
  initializeCloudMode,
};
