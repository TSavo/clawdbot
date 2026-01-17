/**
 * Whisper Docker Deployment Handler Tests
 *
 * Comprehensive tests for Docker container lifecycle, port discovery,
 * health checks, and transcription via Docker API.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AudioBuffer } from './executor.js';
import { AudioFormat, VoiceProviderError } from './executor.js';

vi.mock('node:child_process');
vi.mock('node:util');

/**
 * Helper to create test audio buffer
 */
function createTestAudioBuffer(
  duration: number = 1000,
  sampleRate: number = 16000,
): AudioBuffer {
  const samples = Math.floor((duration * sampleRate) / 1000);
  const data = new Uint8Array(samples * 2);

  // Fill with silence (zeros)
  data.fill(0);

  return {
    data,
    format: AudioFormat.PCM_16,
    sampleRate,
    duration,
    channels: 1,
  };
}

/**
 * Helper to create a mock exec async function
 */
function createMockExecAsync(
  implementation: (cmd: string) => { stdout: string; stderr?: string } | null,
) {
  return async (cmd: string) => {
    const result = implementation(cmd);
    if (!result) {
      throw new Error('Command execution failed');
    }
    return result;
  };
}

describe('WhisperDockerDeploymentHandler', () => {
  let handler: any;
  let mockExecAsync: any;
  let commandResponses: Map<string, string>;

  beforeEach(async () => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Setup command responses
    commandResponses = new Map();

    // Create a mock exec async function
    mockExecAsync = vi.fn(async (cmd: string) => {
      const response = commandResponses.get(cmd);
      if (response === undefined) {
        // Check for partial matches
        for (const [key, value] of commandResponses) {
          if (cmd.includes(key.split(' ')[0])) {
            return { stdout: value, stderr: '' };
          }
        }
        throw new Error(`Unexpected command: ${cmd}`);
      }
      return { stdout: response, stderr: '' };
    });

    // Mock promisify
    vi.mocked(promisify).mockImplementation((fn: any) => {
      return mockExecAsync;
    });

    // Mock exec - just return a dummy object with event methods
    vi.mocked(exec).mockImplementation(() => {
      return { kill: vi.fn(), on: vi.fn() } as any;
    });

    // Now import the handler AFTER mocking
    const { WhisperDockerDeploymentHandler } = await import(
      './whisper.docker.js'
    );
    handler = new WhisperDockerDeploymentHandler({
      port: 8000,
      dockerImage: 'fedirz/faster-whisper-server:latest-cpu',
      containerName: 'test-whisper',
      modelSize: 'base',
    });
  });

  afterEach(async () => {
    try {
      if (handler?.getContainerId?.()) {
        commandResponses.set('docker stop test-whisper', '');
        commandResponses.set('docker rm test-whisper', '');
        commandResponses.set(
          'docker ps -a --filter "name=test-whisper" --format "{{.ID}}|{{.Status}}"',
          '',
        );
        await handler.stop();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      // Import fresh after mocks are in place
      const module = await import('./whisper.docker.js');
      const h = new module.WhisperDockerDeploymentHandler();
      const config = h.getConfig();

      expect(config.port).toBe(8000);
      expect(config.modelSize).toBe('base');
      expect(config.containerName).toBe('whisper-stt');
    });

    it('should initialize with custom configuration', () => {
      const config = handler.getConfig();

      expect(config.port).toBe(8000);
      expect(config.containerName).toBe('test-whisper');
      expect(config.modelSize).toBe('base');
    });

    it('should have correct initial state', () => {
      expect(handler.isRunning()).toBe(false);
      expect(handler.getContainerId()).toBeUndefined();
      expect(handler.getAssignedPortNumber()).toBeNull();
    });

    it('should return correct API URL', () => {
      const url = handler.getApiUrl();
      expect(url).toBe('http://localhost:8000');
    });
  });

  describe('Port Discovery', () => {
    it('should discover assigned port after container start', async () => {
      // Setup mock responses
      commandResponses.set(
        'docker pull fedirz/faster-whisper-server:latest-cpu',
        'Successfully pulled image\n',
      );
      commandResponses.set('docker run -d --name test-whisper -p 8000:8000 -e WHISPER_MODEL=base fedirz/faster-whisper-server:latest-cpu', 'container-id-123\n');
      commandResponses.set(
        'docker ps -a --filter "name=test-whisper" --format "{{.ID}}|{{.Status}}"',
        'container-id-123|Up 2 seconds\n',
      );
      commandResponses.set(
        "docker inspect container-id-123 --format='{{range .NetworkSettings.Ports}}{{index (split (index (split .[] \"/\") 0) \":\") 1}}{{end}}'",
        '32768\n',
      );

      // Mock fetch for health check
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok' }),
      });

      await handler.start();

      expect(handler.getAssignedPortNumber()).toBe(32768);
      expect(handler.getApiUrl()).toBe('http://localhost:32768');
      expect(handler.isRunning()).toBe(true);
    });

    it('should handle port discovery failure gracefully', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          // ensureImageAvailable
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          // createAndStartContainer
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          // getContainerStatus
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          // getAssignedPort - failure
          setImmediate(() =>
            cb(new Error('Failed to inspect port')),
          );
        }
      });

      await expect(handler.start()).rejects.toThrow();
    });
  });

  describe('Container Lifecycle', () => {
    it('should start container successfully', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          // pull image
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          // docker run
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          // getContainerStatus
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          // getAssignedPort
          setImmediate(() => cb(null, '32768\n', ''));
        } else if (execCount === 5) {
          // health check
          setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
        }
      });

      await handler.start();

      expect(handler.isRunning()).toBe(true);
      expect(handler.getContainerId()).toBe('container-id-123');
      expect(handler.getAssignedPortNumber()).toBe(32768);
    });

    it('should stop container gracefully', async () => {
      let stopCount = 0;

      // Setup start
      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        stopCount++;

        if (stopCount <= 5) {
          // Start sequence
          if (stopCount === 1) {
            setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
          } else if (stopCount === 2) {
            setImmediate(() => cb(null, 'container-id-123\n', ''));
          } else if (stopCount === 3) {
            setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
          } else if (stopCount === 4) {
            setImmediate(() => cb(null, '32768\n', ''));
          } else if (stopCount === 5) {
            setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
          }
        } else if (stopCount === 6) {
          // health check interval cleared
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (stopCount === 7) {
          // docker stop
          setImmediate(() => cb(null, '', ''));
        } else if (stopCount === 8) {
          // docker rm
          setImmediate(() => cb(null, '', ''));
        }
      });

      await handler.start();
      await handler.stop();

      expect(handler.isRunning()).toBe(false);
      expect(handler.getContainerId()).toBeUndefined();
      expect(handler.getAssignedPortNumber()).toBeNull();
    });

    it('should force kill if graceful stop fails', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount <= 5) {
          // Start sequence
          if (execCount === 1) {
            setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
          } else if (execCount === 2) {
            setImmediate(() => cb(null, 'container-id-123\n', ''));
          } else if (execCount === 3) {
            setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
          } else if (execCount === 4) {
            setImmediate(() => cb(null, '32768\n', ''));
          } else if (execCount === 5) {
            setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
          }
        } else if (execCount === 6) {
          // health check interval
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 7) {
          // docker stop - fails
          setImmediate(() => cb(new Error('timeout')));
        } else if (execCount === 8) {
          // docker kill
          setImmediate(() => cb(null, '', ''));
        } else if (execCount === 9) {
          // docker rm
          setImmediate(() => cb(null, '', ''));
        }
      });

      await handler.start();
      await handler.stop();

      expect(handler.isRunning()).toBe(false);
    });

    it('should reuse running container on second start', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        // First start
        if (execCount === 1) {
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          setImmediate(() => cb(null, '32768\n', ''));
        } else if (execCount === 5) {
          setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
        } else if (execCount === 6) {
          // Second start - check status
          setImmediate(() => cb(null, 'container-id-123|Up 1 minute\n', ''));
        } else if (execCount === 7) {
          // Get port from existing container
          setImmediate(() => cb(null, '32768\n', ''));
        }
      });

      await handler.start();
      const firstPort = handler.getAssignedPortNumber();

      await handler.start();
      const secondPort = handler.getAssignedPortNumber();

      expect(firstPort).toBe(32768);
      expect(secondPort).toBe(32768);
      expect(handler.getContainerId()).toBe('container-id-123');
    });
  });

  describe('Health Check', () => {
    it('should perform health checks', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount <= 5) {
          // Start sequence
          if (execCount === 1) {
            setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
          } else if (execCount === 2) {
            setImmediate(() => cb(null, 'container-id-123\n', ''));
          } else if (execCount === 3) {
            setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
          } else if (execCount === 4) {
            setImmediate(() => cb(null, '32768\n', ''));
          } else if (execCount === 5) {
            setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
          }
        }
      });

      await handler.start();
      const healthy = await handler.healthCheck();

      expect(healthy).toBe(true);
    });
  });

  describe('Transcription', () => {
    beforeEach(async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          setImmediate(() => cb(null, '32768\n', ''));
        } else if (execCount === 5) {
          setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
        }
      });

      await handler.start();
    });

    it('should reject transcription if container not running', async () => {
      const stoppedHandler = new (await import('./whisper.docker.js'))
        .WhisperDockerDeploymentHandler();

      const audio = createTestAudioBuffer();

      await expect(stoppedHandler.transcribe(audio)).rejects.toThrow(
        VoiceProviderError,
      );
    });

    it('should send transcription request to correct port', async () => {
      const audio = createTestAudioBuffer();

      // Mock fetch for transcription
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: 'Hello world',
          language: 'en',
          duration: 1000,
          confidence: 0.95,
        }),
      });

      const result = await handler.transcribe(audio, { language: 'en' });

      expect(result.text).toBe('Hello world');
      expect(result.language).toBe('en');
      expect(result.provider).toBe('whisper-docker');

      // Verify the request was made to the dynamically assigned port
      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain('32768');
    });

    it('should handle transcription errors', async () => {
      const audio = createTestAudioBuffer();

      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

      await expect(handler.transcribe(audio)).rejects.toThrow(
        VoiceProviderError,
      );
    });

    it('should include options in transcription request', async () => {
      const audio = createTestAudioBuffer();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          text: 'Hola mundo',
          language: 'es',
          duration: 1000,
        }),
      });

      await handler.transcribe(audio, {
        language: 'es',
        timeout: 30000,
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should throw VoiceProviderError on startup failure', async () => {
      mockExecSync.mockImplementationOnce((cmd: string, cb: any) => {
        setImmediate(() => cb(new Error('docker: command not found')));
      });

      await expect(handler.start()).rejects.toThrow(VoiceProviderError);
    });

    it('should handle missing container ID on startup', async () => {
      mockExecSync.mockImplementationOnce((cmd: string, cb: any) => {
        setImmediate(() => cb(new Error('docker: command not found')));
      });

      await expect(handler.start()).rejects.toThrow(
        'Failed to start Docker container',
      );
    });

    it('should handle invalid port numbers', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          // Invalid port
          setImmediate(() => cb(null, 'invalid-port\n', ''));
        }
      });

      await expect(handler.start()).rejects.toThrow();
    });
  });

  describe('Container Info', () => {
    it('should return container info', async () => {
      let execCount = 0;

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          setImmediate(() => cb(null, '32768\n', ''));
        } else if (execCount === 5) {
          setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
        } else if (execCount === 6) {
          // getLogs or getStats
          setImmediate(() => cb(null, 'Container logs\n', ''));
        }
      });

      await handler.start();
      const logs = await handler.getLogs(10);

      expect(logs).toContain('Container logs');
      expect(handler.getContainerId()).toBe('container-id-123');
    });

    it('should return config', () => {
      const config = handler.getConfig();

      expect(config.port).toBe(8000);
      expect(config.dockerImage).toBe(
        'fedirz/faster-whisper-server:latest-cpu',
      );
      expect(config.containerName).toBe('test-whisper');
      expect(config.modelSize).toBe('base');
    });
  });

  describe('Dynamic Port Usage', () => {
    it('should use dynamic port for all API calls', async () => {
      let execCount = 0;
      const recordedUrls: string[] = [];

      mockExecSync.mockImplementation((cmd: string, cb: any) => {
        execCount++;

        if (execCount === 1) {
          setImmediate(() => cb(null, 'Successfully pulled image\n', ''));
        } else if (execCount === 2) {
          setImmediate(() => cb(null, 'container-id-123\n', ''));
        } else if (execCount === 3) {
          setImmediate(() => cb(null, 'Up 2 seconds\n', ''));
        } else if (execCount === 4) {
          setImmediate(() => cb(null, '39000\n', ''));
        } else if (execCount === 5) {
          setImmediate(() => cb(null, '{"status":"ok"}\n', ''));
        }
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: 'ok',
          text: 'Test',
        }),
      });

      await handler.start();

      // Make a transcription request
      const audio = createTestAudioBuffer();
      await handler.transcribe(audio);

      // Check that fetch was called with the dynamic port
      const calls = (global.fetch as any).mock.calls;
      expect(calls.some((call: any[]) => call[0].includes('39000'))).toBe(true);
    });
  });
});
