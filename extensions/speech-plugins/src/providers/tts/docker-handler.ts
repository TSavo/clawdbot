/**
 * TTS Docker Mode Handler
 *
 * Provides unified Docker mode initialization, port allocation, health checks,
 * and container lifecycle management for local TTS providers.
 *
 * Cloud-only providers (ElevenLabs, CartesiaAI) are not included.
 *
 * Port allocation:
 * - 8000: Kokoro (local TTS)
 * - 8001: Piper (fast offline TTS)
 * - 8002: Chatterbox (multi-mode TTS)
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execSync, spawn } from 'node:child_process';

/**
 * Docker image definitions for local TTS providers
 * Cloud-only providers (ElevenLabs, CartesiaAI) use cloud mode exclusively
 */
export const TTS_DOCKER_IMAGES = {
  kokoro: {
    image: 'kokoro:latest',
    fallback: 'python:3.11-slim',
    port: 8000,
    volumeDir: '.cache/kokoro',
    healthCheck: '/health',
  },
  piper: {
    image: 'piper:latest',
    fallback: 'python:3.11-slim',
    port: 8001,
    volumeDir: '.cache/piper',
    healthCheck: '/health',
  },
  chatterbox: {
    image: 'chatterbox:latest',
    fallback: 'python:3.11-slim',
    port: 8002,
    volumeDir: '.cache/chatterbox',
    healthCheck: '/health',
  },
} as const;

/**
 * Docker container health status
 */
export interface ContainerHealthStatus {
  running: boolean;
  healthy: boolean;
  port: number;
  containerId?: string;
  lastCheck: Date;
  error?: string;
}

/**
 * Docker mode configuration for TTS provider
 */
export interface TTSDockerConfig {
  provider: keyof typeof TTS_DOCKER_IMAGES;
  image?: string;
  port?: number;
  volumeMount?: string;
  env?: Record<string, string>;
  resourceLimits?: {
    cpus?: string;
    memory?: string;
  };
  healthCheckInterval?: number;
}

/**
 * Check if Docker is available on the system
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Pull Docker image for TTS provider
 */
export async function pullTTSImage(provider: keyof typeof TTS_DOCKER_IMAGES, verbose = false): Promise<boolean> {
  const providerConfig = TTS_DOCKER_IMAGES[provider];

  if (verbose) {
    console.log(`Pulling ${provider} image: ${providerConfig.image}`);
  }

  try {
    execSync(`docker pull ${providerConfig.image}`, {
      stdio: verbose ? ['inherit', 'inherit', 'inherit'] as const : ['ignore', 'ignore', 'ignore'] as const,
      shell: true,
    } as any);
    return true;
  } catch (error) {
    if (verbose) {
      console.warn(`Failed to pull ${provider} image, will use fallback: ${providerConfig.fallback}`);
    }
    return false;
  }
}

/**
 * Create volume directory for persistent model storage
 */
export function createVolumeDirectory(provider: keyof typeof TTS_DOCKER_IMAGES): string {
  const providerConfig = TTS_DOCKER_IMAGES[provider];
  const volumePath = path.join(os.homedir(), providerConfig.volumeDir);

  if (!fs.existsSync(volumePath)) {
    fs.mkdirSync(volumePath, { recursive: true });
  }

  return volumePath;
}

/**
 * Start a Docker container for TTS provider
 */
export async function startTTSContainer(
  provider: keyof typeof TTS_DOCKER_IMAGES,
  config?: TTSDockerConfig,
  verbose = false,
): Promise<ContainerHealthStatus> {
  if (!isDockerAvailable()) {
    return {
      running: false,
      healthy: false,
      port: TTS_DOCKER_IMAGES[provider].port,
      lastCheck: new Date(),
      error: 'Docker is not available',
    };
  }

  const providerConfig = TTS_DOCKER_IMAGES[provider];
  const image = config?.image || providerConfig.image;
  const port = config?.port || providerConfig.port;
  const volumePath = createVolumeDirectory(provider);

  if (verbose) {
    console.log(`Starting ${provider} container on port ${port}`);
  }

  try {
    // Check if container is already running
    const checkCmd = `docker ps --filter "name=${provider}-tts" --quiet`;
    let runningContainers: string;

    try {
      runningContainers = execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' }).trim();
    } catch {
      runningContainers = '';
    }

    if (runningContainers) {
      if (verbose) {
        console.log(`Container ${provider}-tts is already running`);
      }
      return {
        running: true,
        healthy: true,
        port,
        containerId: runningContainers,
        lastCheck: new Date(),
      };
    }

    // Build docker run command
    let dockerCmd = `docker run -d --name ${provider}-tts -p ${port}:3000 -v ${volumePath}:/app/data`;

    // Add resource limits if specified
    if (config?.resourceLimits) {
      if (config.resourceLimits.cpus) {
        dockerCmd += ` --cpus ${config.resourceLimits.cpus}`;
      }
      if (config.resourceLimits.memory) {
        dockerCmd += ` --memory ${config.resourceLimits.memory}`;
      }
    }

    // Add environment variables
    const env = config?.env || {};
    for (const [key, value] of Object.entries(env)) {
      dockerCmd += ` -e ${key}="${value}"`;
    }

    // Add health check
    dockerCmd += ` --health-cmd="curl -f http://localhost:3000${providerConfig.healthCheck} || exit 1"`;
    dockerCmd += ` --health-interval=10s --health-timeout=5s --health-retries=3`;

    // Add image (prefer specific image over fallback)
    dockerCmd += ` ${image}`;

    if (verbose) {
      console.log(`Running: ${dockerCmd}`);
    }

    const containerId = execSync(dockerCmd, {
      stdio: ['pipe', 'pipe', 'pipe'] as const,
      encoding: 'utf-8',
      shell: true,
    } as any).trim();

    if (verbose) {
      console.log(`✓ Container started: ${containerId}`);
    }

    return {
      running: true,
      healthy: true,
      port,
      containerId,
      lastCheck: new Date(),
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.error(`Failed to start container: ${errorMsg}`);
    }

    return {
      running: false,
      healthy: false,
      port,
      lastCheck: new Date(),
      error: errorMsg,
    };
  }
}

/**
 * Stop a running Docker container
 */
export async function stopTTSContainer(
  provider: keyof typeof TTS_DOCKER_IMAGES,
  verbose = false,
): Promise<boolean> {
  if (!isDockerAvailable()) {
    return false;
  }

  try {
    if (verbose) {
      console.log(`Stopping ${provider} container...`);
    }

    execSync(`docker stop ${provider}-tts 2>/dev/null || true`, {
      stdio: verbose ? ['inherit', 'inherit', 'inherit'] as const : ['ignore', 'ignore', 'ignore'] as const,
      shell: true,
    } as any);

    execSync(`docker rm ${provider}-tts 2>/dev/null || true`, {
      stdio: verbose ? ['inherit', 'inherit', 'inherit'] as const : ['ignore', 'ignore', 'ignore'] as const,
      shell: true,
    } as any);

    if (verbose) {
      console.log(`✓ Container stopped`);
    }

    return true;
  } catch (error) {
    if (verbose) {
      console.error(`Failed to stop container: ${error instanceof Error ? error.message : String(error)}`);
    }
    return false;
  }
}

/**
 * Check health status of a Docker container
 */
export async function checkTTSContainerHealth(
  provider: keyof typeof TTS_DOCKER_IMAGES,
  verbose = false,
): Promise<ContainerHealthStatus> {
  const providerConfig = TTS_DOCKER_IMAGES[provider];
  const port = providerConfig.port;

  try {
    // Check if Docker is available
    if (!isDockerAvailable()) {
      return {
        running: false,
        healthy: false,
        port,
        lastCheck: new Date(),
        error: 'Docker is not available',
      };
    }

    // Get container status
    const statusCmd = `docker inspect ${provider}-tts --format='{{.State.Running}}'`;
    let isRunning: boolean;

    try {
      const status = execSync(statusCmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        shell: true,
      } as any).trim();
      isRunning = status === 'true';
    } catch {
      isRunning = false;
    }

    if (!isRunning) {
      return {
        running: false,
        healthy: false,
        port,
        lastCheck: new Date(),
      };
    }

    // Get container ID
    const idCmd = `docker inspect ${provider}-tts --format='{{.Id}}'`;
    let containerId: string;

    try {
      containerId = execSync(idCmd, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'] as const,
        shell: true,
      } as any).trim();
    } catch {
      containerId = '';
    }

    // Check health endpoint
    let isHealthy = false;
    try {
      const healthCmd = `curl -sf http://localhost:${port}${providerConfig.healthCheck}`;
      execSync(healthCmd, { stdio: ['ignore', 'ignore', 'ignore'] as const, shell: true } as any);
      isHealthy = true;
    } catch {
      isHealthy = false;
    }

    return {
      running: true,
      healthy: isHealthy,
      port,
      containerId,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      running: false,
      healthy: false,
      port,
      lastCheck: new Date(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Initialize Docker mode for a TTS provider
 */
export async function initializeTTSDockerMode(
  provider: keyof typeof TTS_DOCKER_IMAGES,
  config?: TTSDockerConfig,
  verbose = false,
): Promise<{
  success: boolean;
  port: number;
  volumePath: string;
  containerId?: string;
  error?: string;
}> {
  if (!isDockerAvailable()) {
    return {
      success: false,
      port: TTS_DOCKER_IMAGES[provider].port,
      volumePath: '',
      error: 'Docker is not available. Install Docker and try again.',
    };
  }

  try {
    // Pull image
    if (verbose) {
      console.log(`Initializing ${provider} Docker mode...`);
    }

    await pullTTSImage(provider, verbose);

    // Create volume directory
    const volumePath = createVolumeDirectory(provider);
    if (verbose) {
      console.log(`Volume directory: ${volumePath}`);
    }

    // Start container
    const health = await startTTSContainer(provider, config, verbose);

    if (!health.running) {
      return {
        success: false,
        port: health.port,
        volumePath,
        error: health.error || 'Failed to start container',
      };
    }

    return {
      success: true,
      port: health.port,
      volumePath,
      containerId: health.containerId,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (verbose) {
      console.error(`Failed to initialize Docker mode: ${errorMsg}`);
    }

    return {
      success: false,
      port: TTS_DOCKER_IMAGES[provider].port,
      volumePath: '',
      error: errorMsg,
    };
  }
}

/**
 * Get all running TTS containers
 */
export async function getRunningTTSContainers(): Promise<
  Array<{
    provider: keyof typeof TTS_DOCKER_IMAGES;
    containerId: string;
    port: number;
    healthy: boolean;
  }>
> {
  if (!isDockerAvailable()) {
    return [];
  }

  const containers: Array<{
    provider: keyof typeof TTS_DOCKER_IMAGES;
    containerId: string;
    port: number;
    healthy: boolean;
  }> = [];

  for (const provider of Object.keys(TTS_DOCKER_IMAGES) as Array<keyof typeof TTS_DOCKER_IMAGES>) {
    const health = await checkTTSContainerHealth(provider);
    if (health.running && health.containerId) {
      containers.push({
        provider,
        containerId: health.containerId,
        port: health.port,
        healthy: health.healthy,
      });
    }
  }

  return containers;
}

/**
 * Cleanup: Stop all TTS containers
 */
export async function stopAllTTSContainers(verbose = false): Promise<void> {
  const containers = await getRunningTTSContainers();

  for (const container of containers) {
    await stopTTSContainer(container.provider, verbose);
  }
}
