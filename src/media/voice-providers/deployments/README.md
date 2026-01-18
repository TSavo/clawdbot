# Kokoro Deployment Handlers

This directory contains deployment handlers for the Kokoro TTS provider, supporting three deployment modes:

## Sub-Agent Tasks

Each sub-agent will implement one deployment handler. All files have corresponding `.spec.ts` files that define the interface contract.

### 1. Docker Handler (docker-handler.ts)

**Implements:** `DockerDeploymentHandler` interface

**Key responsibilities:**
- Check if Docker is installed on the system
- Pull Kokoro Docker image with exponential backoff retry
- Run container with proper port mapping and environment variables
- Wait for service to become healthy (health endpoint polling)
- Stop and remove container on shutdown
- Handle common Docker errors (port conflicts, image not found, etc.)

**Implementation file:** `docker-handler.ts`

**Tests required:**
- `docker-handler.test.ts`
  - Docker not installed
  - Image pull success
  - Image pull with retries
  - Container startup
  - Health check timeout
  - Container shutdown
  - Port conflict handling

**Key npm dependencies:**
- Use `child_process` for Docker commands (exec, execFile)
- Use `http` module for health checks
- Use `node:events` for process management

**Contract interface:**
```typescript
export interface DockerDeploymentHandler {
  checkDockerAvailable(): Promise<boolean>;
  pullImage(imageRef: string, retryCount?: number): Promise<void>;
  startContainer(config: DeploymentConfig['docker']): Promise<string>;
  waitForHealthy(endpoint: string, maxWaitMs?: number): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  getContainerStatus(containerId: string): Promise<'running' | 'stopped' | 'error'>;
}
```

---

### 2. System Handler (system-handler.ts)

**Implements:** `SystemDeploymentHandler` interface

**Key responsibilities:**
- Detect Python 3 installation (python3, python)
- Check if kokoro package is installed via pip
- Install kokoro package if missing (respects custom install commands)
- Spawn and manage Kokoro process
- Track process PID and monitor uptime
- Graceful shutdown (SIGTERM → SIGKILL with timeout)
- Handle process crashes and generate meaningful error messages

**Implementation file:** `system-handler.ts`

**Tests required:**
- `system-handler.test.ts`
  - Python detection (3.9+, 3.10+, 3.11+, 3.12+)
  - Kokoro installed check
  - Kokoro not installed (requires install)
  - Install success
  - Install failure (network, permission)
  - Process spawn success
  - Process spawn failure
  - Process shutdown graceful
  - Process shutdown forced (SIGKILL)
  - Process crash handling

**Key npm dependencies:**
- Use `child_process.spawn()` for long-running process
- Use `cross-spawn` for cross-platform compatibility
- Use `process.kill()` for shutdown
- Use standard Node.js APIs for PID tracking

**Contract interface:**
```typescript
export interface SystemDeploymentHandler {
  detectPython(): Promise<string>;
  checkKokoroInstalled(pythonPath: string): Promise<boolean>;
  installKokoro(pythonPath: string, installCmd?: string): Promise<void>;
  startProcess(config: DeploymentConfig['system']): Promise<number>;
  isProcessRunning(pid: number): Promise<boolean>;
  stopProcess(pid: number, timeoutMs?: number): Promise<void>;
  getProcessStatus(pid: number): Promise<{running: boolean; uptime?: number; memory?: number}>;
}
```

---

### 3. Cloud Handler (cloud-handler.ts)

**Implements:** `CloudDeploymentHandler` interface

**Key responsibilities:**
- Validate endpoint URL is accessible and responding
- Test API authentication with optional API key
- Implement HTTP client with connection pooling
- Send synthesize requests with proper headers
- Handle streaming responses
- Implement exponential backoff retry logic
- Track latency and connection health
- Graceful connection cleanup

**Implementation file:** `cloud-handler.ts`

**Tests required:**
- `cloud-handler.test.ts`
  - Endpoint validation success/failure
  - Authentication success/failure
  - Basic synthesis request
  - Streaming response handling
  - Retry logic (429, 5xx errors)
  - Timeout handling
  - Connection pool cleanup
  - Rate limiting

**Key npm dependencies:**
- Use `node-fetch` or `undici` for HTTP (already available)
- Implement retry with exponential backoff
- Use `AbortController` for request timeouts
- Implement connection pooling

**Contract interface:**
```typescript
export interface CloudDeploymentHandler {
  validateEndpoint(endpoint: string): Promise<boolean>;
  testAuthentication(endpoint: string, apiKey?: string): Promise<boolean>;
  synthesize(text: string, options?: {...}): Promise<Uint8Array>;
  synthesizeStream(text: string): AsyncIterable<Uint8Array>;
  getConnectionStatus(): Promise<{connected: boolean; latencyMs?: number; lastCheck?: Date}>;
  close(): Promise<void>;
}
```

---

## Integration Points

After implementation, each handler will be integrated into:

1. **KokoroExecutor** (`kokoro.ts`):
   - Methods like `initializeDocker()`, `initializeSystem()`, `initializeCloud()` will call the handlers
   - `shutdown()` will call handler cleanup methods
   - Health checking will use handler status methods

2. **Plugin Service Registration**:
   - Plugin will instantiate appropriate handler based on `DeploymentConfig.mode`
   - Plugin will manage handler lifecycle

3. **Error Handling**:
   - All handler errors should throw `VoiceProviderError` with appropriate codes
   - Common error codes: `DOCKER_NOT_INSTALLED`, `PYTHON_NOT_FOUND`, `ENDPOINT_UNREACHABLE`, etc.

---

## Testing Strategy

Each handler test file should:

1. Use Vitest for testing
2. Mock external dependencies (docker, python subprocess, HTTP)
3. Cover success and failure paths
4. Test error handling and recovery
5. Meet 70% coverage threshold (lines, branches, functions, statements)

Example mock pattern (Docker):
```typescript
// Mock child_process.exec
vi.mock('child_process', () => ({
  exec: vi.fn(),
  spawn: vi.fn(),
}));

// Test cases
describe('DockerHandler', () => {
  it('should check docker availability', async () => {
    // setup mock
    // call handler
    // assert
  });
});
```

---

## Error Codes

Standard error codes to use:

**Docker Handler:**
- `DOCKER_NOT_INSTALLED`
- `IMAGE_PULL_FAILED`
- `CONTAINER_STARTUP_FAILED`
- `HEALTH_CHECK_TIMEOUT`
- `PORT_ALREADY_IN_USE`
- `CONTAINER_SHUTDOWN_FAILED`

**System Handler:**
- `PYTHON_NOT_FOUND`
- `PYTHON_VERSION_UNSUPPORTED`
- `KOKORO_NOT_INSTALLED`
- `INSTALL_FAILED`
- `PROCESS_SPAWN_FAILED`
- `PROCESS_SHUTDOWN_FAILED`

**Cloud Handler:**
- `ENDPOINT_UNREACHABLE`
- `AUTHENTICATION_FAILED`
- `API_ERROR`
- `RATE_LIMITED`
- `REQUEST_TIMEOUT`
- `CONNECTION_FAILED`

---

## Implementation Checklist

For each sub-agent:

- [ ] Create handler class implementing interface
- [ ] Implement all interface methods
- [ ] Add TypeScript typing
- [ ] Write unit tests (70%+ coverage)
- [ ] Test with actual dependencies (Docker CLI, Python, curl)
- [ ] Add error handling with VoiceProviderError
- [ ] Document any config requirements
- [ ] Add JSDoc comments
- [ ] Follow project code style (oxlint, oxfmt compliant)
- [ ] Run `pnpm lint` and `pnpm build` locally

---

## References

- Kokoro Repository: https://github.com/remsky/Kokoro-82M
- VoiceProviderError: `/src/media/voice-providers/executor.ts`
- DeploymentConfig: `/src/media/voice-providers/kokoro.ts`
- KokoroExecutor: `/src/media/voice-providers/kokoro.ts`
