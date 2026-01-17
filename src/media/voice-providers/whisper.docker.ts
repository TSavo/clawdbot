/**
 * Whisper Docker Deployment Handler
 *
 * Manages Docker container lifecycle for Whisper STT service.
 * Handles image building, container setup, and health monitoring.
 */

import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AudioBuffer, TranscribeOptions, TranscriptionResult } from './executor.js';
import { VoiceProviderError } from './executor.js';

const execAsync = promisify(exec);

/**
 * Docker deployment configuration
 */
interface DockerDeploymentConfig {
  port: number;
  dockerImage: string;
  containerName: string;
  gpuEnabled: boolean;
  modelSize: string;
  cpuLimit?: string;
  memoryLimit?: string;
  volumeMounts?: Record<string, string>;
}

/**
 * Container status information
 */
interface ContainerStatus {
  running: boolean;
  containerId?: string;
  port?: number;
  error?: string;
}

/**
 * Comprehensive Docker deployment handler for Whisper
 */
export class WhisperDockerDeploymentHandler {
  private containerRunning = false;
  private containerId?: string;
  private assignedPort: number | null = null;  // Dynamically discovered port
  private apiBaseUrl: string;
  private config: DockerDeploymentConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(config: Partial<DockerDeploymentConfig> = {}) {
    this.config = {
      port: config.port || 8000,
      dockerImage: config.dockerImage || 'openai/whisper:latest',
      containerName: config.containerName || 'whisper-stt',
      gpuEnabled: config.gpuEnabled || false,
      modelSize: config.modelSize || 'base',
      cpuLimit: config.cpuLimit || '2',
      memoryLimit: config.memoryLimit || '4g',
      volumeMounts: config.volumeMounts || {},
    };

    this.apiBaseUrl = `http://localhost:${this.config.port}`;
  }

  /**
   * Start Whisper Docker container
   */
  async start(): Promise<void> {
    try {
      // Check if container already exists and is running
      const status = await this.getContainerStatus();

      if (status.running && status.containerId) {
        this.containerRunning = true;
        this.containerId = status.containerId;
        // Try to get the assigned port from running container
        if (this.containerId) {
          this.assignedPort = await this.getAssignedPort(this.containerId).catch(() => null);
          if (this.assignedPort) {
            this.apiBaseUrl = `http://localhost:${this.assignedPort}`;
          }
        }
        return;
      }

      // Build or pull the Docker image
      await this.ensureImageAvailable();

      // Create and start the container
      await this.createAndStartContainer();

      // Query Docker to find the assigned port
      if (this.containerId) {
        this.assignedPort = await this.getAssignedPort(this.containerId);
        this.apiBaseUrl = `http://localhost:${this.assignedPort}`;
        console.log(
          `[Whisper Docker] Container port 8000 mapped to host port ${this.assignedPort}`,
        );
      }

      // Wait for API to be ready using the dynamically discovered port
      await this.waitForApiReady();

      this.containerRunning = true;

      // Start periodic health checks
      this.startHealthCheckInterval();
    } catch (error) {
      throw new VoiceProviderError(
        `Failed to start Docker container: ${error instanceof Error ? error.message : String(error)}`,
        'whisper-docker',
        'START_FAILED',
      );
    }
  }

  /**
   * Stop and remove Whisper Docker container
   */
  async stop(): Promise<void> {
    try {
      // Stop health check interval
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }

      if (!this.containerId) {
        const status = await this.getContainerStatus();
        if (!status.containerId) {
          return;
        }
        this.containerId = status.containerId;
      }

      // Try graceful stop with timeout
      try {
        await execAsync(`docker stop -t 10 ${this.containerId}`);
      } catch (stopError) {
        console.warn('[Whisper Docker] Graceful stop failed, forcing kill...');
        await execAsync(`docker kill ${this.containerId}`);
      }

      // Remove container
      try {
        await execAsync(`docker rm ${this.containerId}`);
      } catch (rmError) {
        console.warn(
          '[Whisper Docker] Failed to remove container:',
          rmError instanceof Error ? rmError.message : String(rmError),
        );
      }

      this.containerRunning = false;
      this.containerId = undefined;
      this.assignedPort = null;
    } catch (error) {
      throw new VoiceProviderError(
        `Failed to stop Docker container: ${error instanceof Error ? error.message : String(error)}`,
        'whisper-docker',
        'STOP_FAILED',
      );
    }
  }

  /**
   * Get container status
   */
  private async getContainerStatus(): Promise<ContainerStatus> {
    try {
      const { stdout } = await execAsync(
        `docker ps -a --filter "name=${this.config.containerName}" --format "{{.ID}}|{{.Status}}"`,
      );

      const lines = stdout.trim().split('\n').filter(l => l);

      if (lines.length === 0) {
        return { running: false };
      }

      const [containerId, status] = lines[0].split('|');

      if (!containerId) {
        return { running: false };
      }

      const isRunning = status?.includes('Up');

      return {
        running: isRunning,
        containerId,
        port: this.assignedPort || this.config.port,
      };
    } catch (error) {
      return {
        running: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Query Docker to find the assigned host port for internal port 8000
   * Uses 'docker port' command which is more reliable than inspect
   */
  private async getAssignedPort(containerId: string): Promise<number> {
    try {
      const { stdout } = await execAsync(
        `docker port ${containerId} 8000/tcp`,
      );

      // Output format: "0.0.0.0:ASSIGNED_PORT"
      const portMatch = stdout.trim().match(/:(\d+)$/);
      if (portMatch && portMatch[1]) {
        const port = parseInt(portMatch[1], 10);
        if (!Number.isNaN(port)) {
          return port;
        }
      }

      throw new Error(`Could not parse port from: ${stdout.trim()}`);
    } catch (error) {
      throw new Error(
        `Failed to get assigned port for container ${containerId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Ensure Docker image is available (pull or build)
   */
  private async ensureImageAvailable(): Promise<void> {
    try {
      // Try to pull the image
      await execAsync(`docker pull ${this.config.dockerImage}`);
    } catch (error) {
      // If pull fails, attempt to build from local Dockerfile
      console.warn(`Failed to pull ${this.config.dockerImage}, building locally...`);
      await this.buildImageLocally();
    }
  }

  /**
   * Build Docker image locally from Dockerfile
   */
  private async buildImageLocally(): Promise<void> {
    try {
      await execAsync(
        `docker build -t ${this.config.dockerImage} .`,
        {
          cwd: process.cwd(),
        },
      );
    } catch (error) {
      throw new Error(
        `Failed to build Docker image: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create and start Docker container
   * Uses -p 0:8000 to let Docker automatically assign an available port
   */
  private async createAndStartContainer(): Promise<void> {
    const volumeFlags = Object.entries(this.config.volumeMounts || {})
      .map(([local, container]) => `-v ${local}:${container}`)
      .join(' ');

    const gpuFlags = this.config.gpuEnabled
      ? '--gpus all'
      : '';

    const runCommand = [
      'docker run',
      '-d',
      `--name ${this.config.containerName}`,
      '-p 0:8000',  // Let Docker assign an available port
      `--cpus=${this.config.cpuLimit}`,
      `-m ${this.config.memoryLimit}`,
      volumeFlags,
      gpuFlags,
      `-e WHISPER_MODEL_SIZE=${this.config.modelSize}`,
      this.config.dockerImage,
    ]
      .filter(Boolean)
      .join(' ');

    const { stdout } = await execAsync(runCommand);
    this.containerId = stdout.trim();

    if (!this.containerId) {
      throw new Error('No container ID returned from docker run');
    }

    // Verify container is actually running
    const status = await this.getContainerStatus();
    if (!status.running) {
      throw new Error(`Container failed to start, status: ${status.running}`);
    }
  }

  /**
   * Wait for API to be ready
   */
  private async waitForApiReady(
    maxAttempts: number = 30,
    delayMs: number = 1000,
  ): Promise<void> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.apiBaseUrl}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          return;
        }
      } catch {
        // API not ready yet
      }

      await new Promise(resolve => setTimeout(resolve, delayMs));
      attempts++;
    }

    throw new Error('API did not become ready in time');
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheckInterval(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const healthy = await this.healthCheck();

        if (!healthy) {
          console.warn('Whisper Docker container health check failed');
          // Could implement auto-recovery here if needed
        }
      } catch (error) {
        console.error('Health check error:', error);
      }
    }, 30000); // Check every 30 seconds

    // Don't keep process alive
    if (this.healthCheckInterval.unref) {
      this.healthCheckInterval.unref();
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Transcribe audio via Docker API
   */
  async transcribe(
    audio: AudioBuffer,
    options?: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    if (!this.containerRunning) {
      throw new VoiceProviderError(
        'Docker container is not running',
        'whisper-docker',
        'CONTAINER_NOT_RUNNING',
      );
    }

    try {
      const formData = new FormData();

      // Add audio as WAV blob
      formData.append(
        'audio',
        new Blob([Buffer.from(audio.data)], { type: 'audio/wav' }),
        'audio.wav',
      );

      // Add optional parameters
      if (options?.language) {
        formData.append('language', options.language);
      }

      if (this.config.modelSize) {
        formData.append('model_size', this.config.modelSize);
      }

      const response = await fetch(`${this.apiBaseUrl}/transcribe`, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(options?.timeout || 60000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API error: ${response.statusText} - ${errorText}`);
      }

      const result = (await response.json()) as {
        text: string;
        language?: string;
        duration?: number;
        confidence?: number;
      };

      return {
        text: result.text,
        language: result.language || options?.language,
        duration: result.duration || audio.duration,
        confidence: result.confidence,
        provider: 'whisper-docker',
      };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch failed')) {
        throw new VoiceProviderError(
          'Failed to connect to Whisper API',
          'whisper-docker',
          'CONNECTION_FAILED',
        );
      }

      throw new VoiceProviderError(
        `Docker transcription failed: ${error instanceof Error ? error.message : String(error)}`,
        'whisper-docker',
        'TRANSCRIPTION_FAILED',
      );
    }
  }

  /**
   * Get container logs
   */
  async getLogs(lines: number = 50): Promise<string> {
    if (!this.containerId) {
      throw new Error('Container not found');
    }

    const { stdout } = await execAsync(
      `docker logs --tail ${lines} ${this.containerId}`,
    );

    return stdout;
  }

  /**
   * Get container stats
   */
  async getStats(): Promise<Record<string, unknown>> {
    if (!this.containerId) {
      throw new Error('Container not found');
    }

    try {
      const { stdout } = await execAsync(
        `docker stats ${this.containerId} --no-stream --format "table"`,
      );

      return {
        raw: stdout,
        containerRunning: this.containerRunning,
        containerPort: this.config.port,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get API base URL
   */
  getApiUrl(): string {
    return this.apiBaseUrl;
  }

  /**
   * Get deployment config
   */
  getConfig(): DockerDeploymentConfig {
    return { ...this.config };
  }

  /**
   * Check if container is running
   */
  isRunning(): boolean {
    return this.containerRunning;
  }

  /**
   * Get container ID
   */
  getContainerId(): string | undefined {
    return this.containerId;
  }

  /**
   * Get the actual port assigned by Docker
   */
  getAssignedPortNumber(): number | null {
    return this.assignedPort;
  }
}
