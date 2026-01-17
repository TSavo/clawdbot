# Voice Provider UI Test Environment Setup

Complete guide for setting up and running the isolated Docker test environment for voice provider UI testing with agent-browser automation.

## Quick Start

### Build the test environment:
```bash
bash scripts/docker-test-build.sh
```

### Run the test environment:
```bash
bash scripts/docker-test-run.sh
```

The container will start and display connection details for all available services.

## Architecture Overview

### Multi-Service Architecture

The test environment runs multiple coordinated services:

```
┌─────────────────────────────────────────────────────────┐
│           Docker Container (Isolated Network)           │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Supervisor (Service Manager)                     │   │
│  └──────────────────────────────────────────────────┘   │
│   │                                                       │
│   ├─► Xvfb (:99) ──────────┐                            │
│   │   Virtual X Display    │                            │
│   │                        └──► X11VNC ────┐           │
│   │                         Raw VNC (5900) │           │
│   ├─► PulseAudio ────────────────────────► WebSocketify│
│   │   Audio/Voice Processing               │ noVNC     │
│   │                                         │ (6080)    │
│   └─► Clawdbot UI ──────────────────────── HTTP (3000) │
│       Voice Provider                                    │
│       Testing Interface                                 │
│                                                           │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Chromium Browser (on :99 display)                │   │
│  │ - DevTools Protocol: 9222                        │   │
│  │ - Agent Browser Control: 18791                   │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
└─────────────────────────────────────────────────────────┘
         │                    │              │
         │                    │              │
    ┌────▼────┐           ┌───▼──────┐   ┌──▼────────┐
    │ Host:   │           │ Host:    │   │ Host:     │
    │ :3000   │           │ :6080    │   │ :18791    │
    │ (UI)    │           │ (noVNC)  │   │ (Browser) │
    └─────────┘           └──────────┘   └───────────┘
```

## Connection Details

### 1. Web UI (Port 3000)
**Purpose:** Voice provider testing interface
- **URL:** http://localhost:3000
- **Protocol:** HTTP/WebSocket
- **Use Cases:**
  - Test voice provider integrations
  - Configure provider settings
  - Test TTS/STT functionality
  - Monitor voice provider status

### 2. Visual Inspection (Port 6080 - noVNC)
**Purpose:** Remote visual debugging of the display
- **URL:** http://localhost:6080/vnc.html
- **VNC Direct:** localhost:5900
- **Resolution:** 1280x1024
- **Use Cases:**
  - Watch UI interactions in real-time
  - Debug visual rendering issues
  - Verify browser automation actions
  - Screenshot and video recording

### 3. Browser Control (Port 18791 - agent-browser)
**Purpose:** Browser automation via Chrome DevTools Protocol
- **Endpoint:** http://localhost:18791
- **Protocol:** WebSocket (Chrome DevTools Protocol)
- **Use Cases:**
  - Automated UI testing
  - Voice provider integration testing
  - Headless browser control
  - Screenshot/PDF generation

### 4. Chrome DevTools (Port 9222)
**Purpose:** Direct browser debugging
- **URL:** chrome://inspect (configure targets to localhost:9222)
- **Use Cases:**
  - Debug browser console
  - Inspect elements
  - Profile performance

## Service Details

### Xvfb (Virtual X Display)
- **Display:** :99
- **Resolution:** 1280x1024x24
- **Purpose:** Virtual framebuffer for headless browser execution
- **Log:** /app/logs/xvfb.log

### X11VNC (VNC Server)
- **Port:** 5900 (raw), 6080 (websockified)
- **Authentication:** None (password disabled)
- **Purpose:** Remote access to virtual display
- **Log:** /app/logs/x11vnc.log

### WebSocketify (VNC over WebSocket)
- **Port:** 6080
- **Web Path:** /novnc
- **Purpose:** Browser-based VNC access via noVNC
- **Log:** /app/logs/websockify.log

### PulseAudio (Audio Server)
- **User:** testuser
- **Purpose:** Audio input/output for voice testing
- **Sink:** Dummy sink for recording
- **Log:** /app/logs/pulseaudio.log

### Clawdbot UI (Test Subject)
- **Port:** 3000
- **Environment:** NODE_ENV=test, DISPLAY=:99
- **User:** testuser
- **Working Directory:** /app
- **Log:** /app/logs/clawdbot-ui.log

## File Structure

```
clawdbot/
├── Dockerfile.test                 # Multi-stage test environment
├── scripts/
│   ├── docker-test-build.sh        # Build script with caching
│   ├── docker-test-run.sh          # Run script with service initialization
│   ├── TEST-ENVIRONMENT.md         # This file
│   ├── docker-test-verify.sh       # Service verification script
│   └── docker-test-cleanup.sh      # Cleanup utility
├── dist/                           # Built application
├── ui/                             # React/Vue UI components
└── logs/                           # Container logs (mounted volume)
```

## Build Process

### Stage 1: Builder
1. Start with Node.js 22 + Bookworm
2. Install Bun package manager
3. Copy dependency files (package.json, pnpm-lock.yaml)
4. Install dependencies with frozen lockfile
5. Build TypeScript → JavaScript (dist/)
6. Build UI assets

### Stage 2: Runtime
1. Start with clean Node.js 22 + Bookworm
2. Install system packages:
   - Browser: Chromium, fonts, X11 libraries
   - Display: Xvfb, X11VNC, websockify
   - Audio: Python, PulseAudio, sox, Whisper
   - Utilities: curl, git, jq, socat, nc
3. Install Python packages: Whisper, librosa, numpy, scipy, pydub
4. Copy built application from builder
5. Create non-root user (testuser) for security
6. Configure Supervisor for service management
7. Create healthcheck and connection info scripts

## Environment Variables

```bash
NODE_ENV=test              # Test environment configuration
DISPLAY=:99               # X11 virtual display
XAUTHORITY=/tmp/.Xauthority
```

## Volumes

- **Host:** Current directory (clawdbot project root)
- **Container:** /app (working directory)
- **Shared access:** All source code, built artifacts, logs

## Network

- **Mode:** Bridge (isolated from host by default)
- **Exposed Ports:**
  - 3000 → Clawdbot UI
  - 5900 → VNC (raw)
  - 6080 → noVNC (WebSocket)
  - 18791 → Browser control
  - 9222 → Chrome DevTools Protocol

## Service Startup Order

Services start in priority order (managed by Supervisor):

1. **Xvfb** (priority 100) - Virtual display
2. **PulseAudio** (priority 150) - Audio server
3. **X11VNC** (priority 200) - VNC server (depends on Xvfb)
4. **WebSocketify** (priority 300) - noVNC (depends on X11VNC)
5. **Clawdbot UI** (priority 400) - Application (depends on others)

## Health Checks

### Automated Health Check
Runs every 10 seconds (start-period 30s, retries 3):
```bash
docker exec <container> /app/healthcheck.sh
```

### Manual Health Verification
```bash
# Check supervisor status
docker exec <container> supervisorctl status

# Check port availability
docker exec <container> nc -z localhost 3000

# View connection info
docker exec <container> /app/connection-info.sh

# Tail logs
docker exec <container> tail -f /app/logs/*.log
```

## Usage Examples

### Basic Test Session

```bash
# 1. Build the image
bash scripts/docker-test-build.sh clawdbot-test latest

# 2. Start the container
bash scripts/docker-test-run.sh clawdbot-test latest

# 3. Access the UI (in browser)
# http://localhost:3000

# 4. Visual debugging (noVNC)
# http://localhost:6080/vnc.html

# 5. Automate with agent-browser (in separate terminal)
curl -X POST http://localhost:18791/json/new?url=about:blank
```

### Automated Voice Provider Testing

```bash
# Run tests against the live UI in Docker
NODE_ENV=test VOICE_TEST_URL=http://localhost:3000 pnpm test:voice-providers

# Or with specific provider
PROVIDER=openai VOICE_TEST_URL=http://localhost:3000 pnpm test:voice-providers
```

### Interactive Debugging

```bash
# Shell into container
docker exec -it <container> bash

# Check processes
docker exec <container> ps aux

# Test audio playback
docker exec <container> bash -c 'echo "Hello world" | text2speech'

# View supervisor logs
docker exec <container> tail -f /app/logs/supervisord.log
```

### Capture Logs

```bash
# Copy all logs to host
docker cp <container>:/app/logs ./test-logs

# View specific service log
docker exec <container> cat /app/logs/clawdbot-ui.log

# Stream logs in real-time
docker exec <container> tail -f /app/logs/clawdbot-ui.log
```

## Performance Optimization

### Layer Caching
The Dockerfile uses multi-stage builds with optimized layer ordering:
- Dependencies installed first (rarely change)
- Source code copied last (frequently change)
- BuildKit inline cache enables fast rebuilds

### Build Performance
```bash
# Rebuild with cache (much faster)
time bash scripts/docker-test-build.sh

# Typical times:
# - First build: 3-5 minutes
# - Cached rebuild: 30-60 seconds
# - No source changes: 10-20 seconds
```

### Container Performance
- **Memory:** 2GB shared memory (`--shm-size=2gb`)
- **CPU:** No limits (uses available)
- **Display:** Hardware-accelerated when possible

## Troubleshooting

### Container Won't Start

```bash
# Check image exists
docker images | grep clawdbot-test

# Check container logs
docker logs <container> 2>&1 | head -50

# Try running interactively
docker run -it clawdbot-test bash
```

### Services Not Ready

```bash
# Check supervisor status
docker exec <container> supervisorctl status

# Restart a service
docker exec <container> supervisorctl restart clawdbot-ui

# View service-specific logs
docker exec <container> tail -50 /app/logs/clawdbot-ui.log
```

### UI Not Accessible on Port 3000

```bash
# Check if port is in use
lsof -i :3000

# Verify port forwarding in container
docker exec <container> nc -z localhost 3000

# Check if service is running
docker exec <container> supervisorctl status clawdbot-ui
```

### noVNC Not Connecting

```bash
# Check X11 display
docker exec <container> DISPLAY=:99 xset q

# Check VNC server
docker exec <container> ps aux | grep vnc

# Restart X services
docker exec <container> supervisorctl restart xvfb x11vnc websockify
```

### Browser Control Not Responding

```bash
# Check if Chromium is running
docker exec <container> ps aux | grep chromium

# Check port
docker exec <container> nc -z localhost 18791

# View browser logs
docker exec <container> tail -50 /app/logs/clawdbot-ui.log
```

## Cleanup

```bash
# Stop container
docker stop <container>

# Remove container
docker rm <container>

# Remove image (clean build)
docker rmi clawdbot-test:latest

# Remove build cache (force rebuild)
docker builder prune
```

## Advanced Configuration

### Custom Supervisor Configuration

Edit `/etc/supervisor/conf.d/services.conf` in the Dockerfile for:
- Service restart policies
- Memory/CPU limits
- Environment variables
- Log rotation

### Display Resolution

Modify Xvfb command in services.conf:
```bash
# Change resolution (1280x1024x24 → 1920x1080x24)
Xvfb :99 -screen 0 1920x1080x24 -ac
```

### Python/Whisper Configuration

Extend Python setup in Dockerfile:
```dockerfile
RUN pip install --no-cache-dir \
    additional-packages-here
```

## Security Considerations

- **Non-root execution:** testuser runs most services
- **No authentication:** VNC password disabled (for testing)
- **Isolated network:** Bridge mode isolates from host
- **Container-only:** No privileged access to host
- **SYS_ADMIN capability:** Added only for Chromium sandbox

## Performance Metrics

### Typical Startup Time
- Build: 3-5 minutes (first), 30-60 seconds (cached)
- Container start: 2-3 minutes for full service readiness
- Healthcheck pass: 30-60 seconds from container start

### Resource Usage
- CPU: ~200-400m during idle, spikes to 100% during heavy voice processing
- Memory: ~500MB idle, ~1.5GB under load with Chromium
- Disk: ~2GB image size, ~100MB logs per hour

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Supervisor Documentation](http://supervisord.org/)
- [Chromium Debugging Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [noVNC Documentation](https://novnc.com/)
- [OpenAI Whisper](https://github.com/openai/whisper)

## Support

For issues or questions:
1. Check container logs: `docker logs <container>`
2. Verify service status: `docker exec <container> supervisorctl status`
3. Run healthcheck: `docker exec <container> /app/healthcheck.sh`
4. Review this document for troubleshooting steps
