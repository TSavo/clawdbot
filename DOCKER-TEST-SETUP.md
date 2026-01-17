# Docker Test Environment for Voice Provider UI Testing

Complete setup guide for the isolated Docker environment used for automated voice provider UI testing with agent-browser integration.

## Overview

This setup provides an isolated, multi-service Docker environment designed for comprehensive voice provider UI testing. It includes:

- **Clawdbot application** running in test mode
- **Chromium browser** with DevTools Protocol for automation
- **Virtual X display** (Xvfb) for headless browser execution
- **VNC server** (X11VNC + noVNC) for visual debugging
- **PulseAudio** for audio/voice processing
- **Whisper** for speech-to-text validation
- **Multiple port exposures** for different testing interfaces

## Quick Start

### 1. Build the test environment:
```bash
bash scripts/docker-test-build.sh clawdbot-test latest
```

Expected output:
```
Building Clawdbot Voice Provider Test Environment
Image: clawdbot-test:latest
...
Build completed successfully!
Image Size: ~2GB
```

### 2. Start the container:
```bash
bash scripts/docker-test-run.sh clawdbot-test latest
```

Expected output:
```
Container started: abc123def456
Waiting for services to initialize...
Container is ready!

Connection Details:
  Web UI: http://localhost:3000
  Visual Inspection: http://localhost:6080/vnc.html
  Browser Control: http://localhost:18791
```

### 3. Access the services:

**Web UI** (Voice Provider Testing)
```
http://localhost:3000
```

**Visual Debugging** (noVNC)
```
http://localhost:6080/vnc.html
```

**Browser Automation** (agent-browser)
```
curl -X POST http://localhost:18791/json/new?url=about:blank
```

## Architecture

### Service Architecture

```
Docker Container
├── Supervisor (Process Manager)
│   ├── Xvfb (:99) → X11VNC (5900) → WebSocketify (6080) → noVNC
│   ├── PulseAudio (Audio/Voice)
│   ├── Clawdbot UI (3000)
│   └── Chromium Browser (9222/18791)
```

### Port Mapping

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | Clawdbot UI | Web interface for voice provider testing |
| 5900 | VNC Server | Raw VNC access |
| 6080 | noVNC | Browser-based VNC viewer |
| 18791 | agent-browser | Browser control/automation (CDP) |
| 9222 | Chrome DevTools | Direct browser debugging |
| 9001 | Supervisor | Service management interface |

## File Organization

```
clawdbot/
├── Dockerfile.test                     # Multi-stage Docker build
├── DOCKER-TEST-SETUP.md               # This file
├── scripts/
│   ├── docker-test-build.sh           # Build the Docker image
│   ├── docker-test-run.sh             # Run the Docker container
│   ├── docker-test-verify.sh          # Verify container health
│   ├── docker-test-cleanup.sh         # Clean up containers/images
│   ├── TEST-ENVIRONMENT.md            # Detailed environment guide
│   └── sandbox-browser-entrypoint.sh  # Browser sandbox startup
├── dist/                              # Built application
├── ui/                                # React/Vue UI components
└── logs/                              # Container logs (mounted from host)
```

## Usage Workflows

### Workflow 1: Interactive Testing

```bash
# 1. Build
bash scripts/docker-test-build.sh

# 2. Run in background
bash scripts/docker-test-run.sh

# 3. Test the UI
open http://localhost:3000

# 4. Visual debugging
open http://localhost:6080/vnc.html

# 5. Verify everything works
bash scripts/docker-test-verify.sh <container-id>

# 6. Cleanup when done
bash scripts/docker-test-cleanup.sh --containers
```

### Workflow 2: Automated Testing

```bash
# 1. Build and run
bash scripts/docker-test-build.sh
bash scripts/docker-test-run.sh

# 2. Get container ID
CONTAINER_ID=$(docker ps -q -f "ancestor=clawdbot-test" | head -1)

# 3. Run automated tests
NODE_ENV=test \
VOICE_TEST_URL=http://localhost:3000 \
BROWSER_ENDPOINT=http://localhost:18791 \
pnpm test:voice-providers

# 4. Cleanup
docker stop $CONTAINER_ID
docker rm $CONTAINER_ID
```

### Workflow 3: Development with Live Reload

```bash
# 1. Build and run
bash scripts/docker-test-build.sh
bash scripts/docker-test-run.sh

# 2. Edit source code on host (mounted volume)
# Changes automatically sync to /app in container

# 3. Rebuild in container if needed
docker exec <container> pnpm build

# 4. Access live UI
open http://localhost:3000
```

## Service Details

### Xvfb (Virtual X Display)
- **Purpose:** Headless X11 display for browser automation
- **Display:** :99
- **Resolution:** 1280x1024x24 (8-bit color)
- **Log:** `/app/logs/xvfb.log`

### X11VNC (VNC Server)
- **Purpose:** Remote access to virtual display
- **Port:** 5900 (raw VNC)
- **Authentication:** Disabled (password: none)
- **Log:** `/app/logs/x11vnc.log`

### WebSocketify (noVNC Bridge)
- **Purpose:** Bridge between VNC and WebSocket for browser access
- **Port:** 6080
- **Path:** `/novnc/`
- **Log:** `/app/logs/websockify.log`

### PulseAudio (Audio Server)
- **Purpose:** Audio input/output for voice testing
- **User:** testuser
- **Sinks:** Dummy sink for recording/playback
- **Log:** `/app/logs/pulseaudio.log`

### Clawdbot UI (Test Application)
- **Purpose:** Voice provider testing interface
- **Port:** 3000
- **Environment:** NODE_ENV=test
- **User:** testuser
- **Log:** `/app/logs/clawdbot-ui.log`

### Chromium Browser
- **Purpose:** Automated browser testing
- **Display:** :99
- **DevTools:** Port 9222
- **agent-browser:** Port 18791 (CDP over WebSocket)

## Health Checks

### Automatic Health Check
The container includes a built-in health check that runs every 10 seconds:

```bash
# Manual health check
docker exec <container> /app/healthcheck.sh
```

### Service Status
```bash
# Check supervisor status
docker exec <container> supervisorctl status

# View service logs
docker exec <container> tail -f /app/logs/clawdbot-ui.log
```

### Port Verification
```bash
# Check if ports are responding
docker exec <container> nc -z localhost 3000
docker exec <container> nc -z localhost 6080
docker exec <container> nc -z localhost 18791
```

## Common Tasks

### View Logs

```bash
# Tail all logs
docker exec <container> tail -f /app/logs/*.log

# Specific service log
docker exec <container> tail -f /app/logs/clawdbot-ui.log

# Copy logs to host
docker cp <container>:/app/logs ./my-test-logs
```

### Run Shell Commands in Container

```bash
# Interactive shell
docker exec -it <container> bash

# Single command
docker exec <container> npm list

# Test voice provider
docker exec <container> curl http://localhost:3000
```

### Restart Services

```bash
# Restart specific service
docker exec <container> supervisorctl restart clawdbot-ui

# Restart all services
docker exec <container> supervisorctl restart all

# Stop a service
docker exec <container> supervisorctl stop clawdbot-ui
```

### Update Application

```bash
# Rebuild only (source mounted)
docker exec <container> pnpm build

# Restart after rebuild
docker exec <container> supervisorctl restart clawdbot-ui
```

## Troubleshooting

### Container won't start

```bash
# Check image exists
docker images | grep clawdbot-test

# View build logs
docker logs <container> 2>&1 | head -100

# Try running with attached output
docker run -it clawdbot-test bash
```

### Services not ready (port 3000 not responding)

```bash
# Check supervisor status
docker exec <container> supervisorctl status

# View application logs
docker exec <container> tail -50 /app/logs/clawdbot-ui.log

# Restart application
docker exec <container> supervisorctl restart clawdbot-ui

# Wait 10-15 seconds and retry
sleep 15
curl http://localhost:3000
```

### noVNC not connecting

```bash
# Check X display
docker exec <container> DISPLAY=:99 xset q

# Check VNC server process
docker exec <container> ps aux | grep vnc

# Restart X services
docker exec <container> supervisorctl restart xvfb x11vnc websockify
```

### Browser control not responding

```bash
# Check Chromium process
docker exec <container> ps aux | grep chromium

# Check port
docker exec <container> lsof -i :18791 || nc -z localhost 18791

# Restart browser/UI
docker exec <container> supervisorctl restart clawdbot-ui
```

### High memory usage

```bash
# Check memory stats
docker stats <container>

# Limit container memory
docker run --memory=2g --memory-swap=2g <image>

# Clear cache
docker exec <container> npm cache clean --force
```

## Performance Tips

### Build Optimization
- First build: ~3-5 minutes
- Cached rebuild: ~30-60 seconds
- No changes rebuild: ~10-20 seconds

Use the build cache effectively:
```bash
# Regular rebuild (uses cache)
bash scripts/docker-test-build.sh

# Force clean rebuild
docker rmi clawdbot-test:latest
bash scripts/docker-test-build.sh
```

### Container Performance
- **Shared memory:** 2GB (for browser rendering)
- **CPU:** No limits (uses all available)
- **Memory:** No hard limit, but recommended 2GB+

### Display Performance
- Resolution: 1280x1024 (balance between fidelity and performance)
- Color depth: 24-bit (8-bit per channel)
- Framerate: ~30fps via noVNC

## Development Tips

### Local Development Workflow

```bash
# 1. Start container in background
bash scripts/docker-test-build.sh
bash scripts/docker-test-run.sh

# 2. Get container ID
CONTAINER=$(docker ps -q -f "ancestor=clawdbot-test" | head -1)

# 3. Watch for file changes (on host)
pnpm watch &

# 4. Rebuild in container when notified
docker exec $CONTAINER pnpm build

# 5. Restart services as needed
docker exec $CONTAINER supervisorctl restart clawdbot-ui

# 6. Access updated UI
open http://localhost:3000
```

### Testing Specific Provider

```bash
# Set environment and run tests
VOICE_PROVIDER=openai \
NODE_ENV=test \
VOICE_TEST_URL=http://localhost:3000 \
pnpm test:voice-providers

# Or manually test via UI
open http://localhost:3000
# Navigate to Settings > Voice Providers
# Configure and test provider
```

### Debugging with Browser DevTools

```bash
# Access Chrome DevTools
open chrome://inspect

# Configure target:
# Devices -> Configure -> localhost:9222

# Or direct to container browser
curl http://localhost:9222/json
```

## Environment Variables

```bash
# Container environment
NODE_ENV=test              # Test mode configuration
DISPLAY=:99               # X11 virtual display
XAUTHORITY=/tmp/.Xauthority
```

## Network Configuration

- **Network Mode:** Bridge (isolated from host)
- **Port Forwarding:** Explicit port mappings
- **DNS:** Uses Docker's default

```bash
# View network info
docker inspect <container> | grep -A 5 NetworkSettings
```

## Security Considerations

- **Non-root execution:** testuser runs most services
- **No authentication:** VNC password disabled (test environment)
- **Isolated network:** Bridge mode provides isolation
- **SYS_ADMIN capability:** Only for Chromium sandbox

## Cleanup

### Remove test containers

```bash
bash scripts/docker-test-cleanup.sh --containers
```

### Remove test image

```bash
bash scripts/docker-test-cleanup.sh --image
```

### Full cleanup (image, containers, build cache)

```bash
bash scripts/docker-test-cleanup.sh --all
```

### Manual cleanup

```bash
# Stop containers
docker stop $(docker ps -q -f "ancestor=clawdbot-test")

# Remove containers
docker rm $(docker ps -aq -f "ancestor=clawdbot-test")

# Remove image
docker rmi clawdbot-test:latest

# Remove build cache
docker builder prune -af
```

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Voice Provider Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build test environment
        run: bash scripts/docker-test-build.sh

      - name: Start container
        run: |
          bash scripts/docker-test-run.sh
          CONTAINER=$(docker ps -q -f "ancestor=clawdbot-test" | head -1)
          docker exec $CONTAINER /app/healthcheck.sh

      - name: Run tests
        run: |
          NODE_ENV=test \
          VOICE_TEST_URL=http://localhost:3000 \
          pnpm test:voice-providers

      - name: Collect logs on failure
        if: failure()
        run: docker cp $(docker ps -q -f "ancestor=clawdbot-test" | head -1):/app/logs ./logs

      - name: Upload logs
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: test-logs
          path: logs/

      - name: Cleanup
        if: always()
        run: bash scripts/docker-test-cleanup.sh --all
```

## References

- [Docker Documentation](https://docs.docker.com/)
- [Supervisor Documentation](http://supervisord.org/)
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [noVNC Documentation](https://novnc.com/)
- [OpenAI Whisper](https://github.com/openai/whisper)

## Support

For detailed information about the test environment:
- See `scripts/TEST-ENVIRONMENT.md` for environment details
- Check container logs: `docker logs <container>`
- Run health check: `docker exec <container> /app/healthcheck.sh`
- Review supervisor status: `docker exec <container> supervisorctl status`
