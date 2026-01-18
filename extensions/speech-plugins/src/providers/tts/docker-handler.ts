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
 *
 * containerPort: Fixed internal container port used in the container
 * Docker dynamically assigns host ports via -p 0:containerPort
 */
export const TTS_DOCKER_IMAGES = {
  kokoro: {
    image: 'kokoro:latest',
    fallback: 'python:3.11-slim',
    containerPort: 8000,
    volumeDir: '.cache/kokoro',
    healthCheck: '/health',
  },
  piper: {
    image: 'piper:latest',
    fallback: 'python:3.11-slim',
    containerPort: 8001,
    volumeDir: '.cache/piper',
    healthCheck: '/health',
  },
  chatterbox: {
    image: 'chatterbox:latest',
    fallback: 'python:3.11-slim',
    containerPort: 8002,
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
  containerPort: number;  // Internal container port (fixed)
  assignedPort?: number;  // Dynamically assigned host port (null if not running)
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
  containerPort?: number;
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
 * Get the dynamically assigned host port for a container's internal port
 * Uses `docker port <containerId> <containerPort>/tcp`
 * Returns the host port that Docker assigned (e.g., 45123 from "0.0.0.0:45123")
 */
export function getAssignedPort(
  containerId: string,
  containerPort: number,
): number | null {
  try {
    const portOutput = execSync(
      `docker port ${containerId} ${containerPort}/tcp`,
      { encoding: 'utf-8', stdio: 'pipe' as any, shell: true } as any,
    ).trim();

    // Output format: "0.0.0.0:ASSIGNED_PORT"
    const portMatch = portOutput.match(/:(\d+)$/);
    if (portMatch && portMatch[1]) {
      const port = parseInt(portMatch[1], 10);
      if (!Number.isNaN(port)) {
        return port;
      }
    }
  } catch {
    // Container might not exist or port not mapped
  }
  return null;
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
      containerPort: TTS_DOCKER_IMAGES[provider].containerPort,
      lastCheck: new Date(),
      error: 'Docker is not available',
    };
  }

  const providerConfig = TTS_DOCKER_IMAGES[provider];
  const image = config?.image || providerConfig.image;
  const containerPort = (providerConfig as any).containerPort || config?.containerPort || 8000;
  const volumePath = createVolumeDirectory(provider);

  if (verbose) {
    console.log(`Starting ${provider} container on container port ${containerPort}`);
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
      // Get dynamically assigned host port
      const assignedPort = getAssignedPort(runningContainers, containerPort);
      return {
        running: true,
        healthy: true,
        containerPort,
        assignedPort: assignedPort || undefined,
        containerId: runningContainers,
        lastCheck: new Date(),
      };
    }

    // Build docker run command with dynamic port assignment
    // Use -p 0:CONTAINERPORT to let Docker choose available port for internal container port
    let dockerCmd = `docker run -d --name ${provider}-tts -p 0:${containerPort} -v ${volumePath}:/app/data`;

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

    // Add health check (uses internal container port)
    dockerCmd += ` --health-cmd="curl -f http://localhost:${containerPort}${providerConfig.healthCheck} || exit 1"`;
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

    // Get the dynamically assigned host port
    const assignedPort = getAssignedPort(containerId, containerPort);
    if (verbose && assignedPort) {
      console.log(
        `  Container port ${containerPort} mapped to host port ${assignedPort}`,
      );
    }

    return {
      running: true,
      healthy: true,
      containerPort,
      assignedPort: assignedPort || undefined,
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
      containerPort,
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
  const containerPort = providerConfig.containerPort;

  try {
    // Check if Docker is available
    if (!isDockerAvailable()) {
      return {
        running: false,
        healthy: false,
        containerPort,
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
        containerPort,
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

    // Get assigned host port for health check
    const assignedPort = getAssignedPort(containerId, containerPort);

    // Check health endpoint
    let isHealthy = false;
    try {
      if (assignedPort) {
        const healthCmd = `curl -sf http://localhost:${assignedPort}${providerConfig.healthCheck}`;
        execSync(healthCmd, { stdio: ['ignore', 'ignore', 'ignore'] as const, shell: true } as any);
        isHealthy = true;
      }
    } catch {
      isHealthy = false;
    }

    return {
      running: true,
      healthy: isHealthy,
      containerPort,
      assignedPort: assignedPort || undefined,
      containerId,
      lastCheck: new Date(),
    };
  } catch (error) {
    return {
      running: false,
      healthy: false,
      containerPort,
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
  containerPort: number;
  assignedPort?: number;
  volumePath: string;
  containerId?: string;
  error?: string;
}> {
  if (!isDockerAvailable()) {
    return {
      success: false,
      containerPort: TTS_DOCKER_IMAGES[provider].containerPort,
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
        containerPort: health.containerPort,
        volumePath,
        error: health.error || 'Failed to start container',
      };
    }

    return {
      success: true,
      containerPort: health.containerPort,
      assignedPort: health.assignedPort,
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
      containerPort: TTS_DOCKER_IMAGES[provider].containerPort,
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
    containerPort: number;
    assignedPort?: number;
    healthy: boolean;
  }>
> {
  if (!isDockerAvailable()) {
    return [];
  }

  const containers: Array<{
    provider: keyof typeof TTS_DOCKER_IMAGES;
    containerId: string;
    containerPort: number;
    assignedPort?: number;
    healthy: boolean;
  }> = [];

  for (const provider of Object.keys(TTS_DOCKER_IMAGES) as Array<keyof typeof TTS_DOCKER_IMAGES>) {
    const health = await checkTTSContainerHealth(provider);
    if (health.running && health.containerId) {
      containers.push({
        provider,
        containerId: health.containerId,
        containerPort: health.containerPort,
        assignedPort: health.assignedPort,
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
