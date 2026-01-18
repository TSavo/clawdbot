#!/bin/bash
set -e

# Docker test environment runner script
# Starts an isolated test container with all voice provider UI testing services

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
IMAGE_NAME="${1:-clawdbot-test}"
BUILD_TAG="${2:-latest}"
CONTAINER_NAME="${CONTAINER_NAME:-clawdbot-test-$(date +%s)}"
NETWORK_MODE="${NETWORK_MODE:-bridge}"
DETACH_MODE="${DETACH_MODE:-true}"

echo "==============================================================="
echo "Starting Clawdbot Voice Provider Test Environment"
echo "==============================================================="
echo ""
echo "Configuration:"
echo "  Image: $IMAGE_NAME:$BUILD_TAG"
echo "  Container: $CONTAINER_NAME"
echo "  Network: $NETWORK_MODE"
echo "  Detached: $DETACH_MODE"
echo ""

# Verify image exists
if ! docker images "$IMAGE_NAME:$BUILD_TAG" | grep -q "$IMAGE_NAME"; then
    echo "ERROR: Image $IMAGE_NAME:$BUILD_TAG not found"
    echo "Please build it first:"
    echo "  bash scripts/docker-test-build.sh"
    exit 1
fi

# Check if container name already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "WARNING: Container $CONTAINER_NAME already exists"
    read -p "Remove existing container? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rm -f "$CONTAINER_NAME" || true
    else
        echo "Using existing container"
        CONTAINER_ID=$(docker ps -a -q -f "name=^${CONTAINER_NAME}$")
        if ! docker ps -q -f "id=$CONTAINER_ID" | grep -q .; then
            docker start "$CONTAINER_NAME"
        fi
        CONTAINER_NAME=$(docker ps -q -f "name=^${CONTAINER_NAME}$" | head -1)
    fi
fi

# Determine detach flag
DETACH_FLAG=""
if [ "$DETACH_MODE" = "true" ]; then
    DETACH_FLAG="-d"
fi

# Create logs directory
mkdir -p "$PROJECT_ROOT/logs"

echo "Starting container..."
echo ""

# Run container with proper configuration
CONTAINER_ID=$(docker run \
    $DETACH_FLAG \
    --name "$CONTAINER_NAME" \
    --network "$NETWORK_MODE" \
    -p 3000:3000 \
    -p 5900:5900 \
    -p 6080:6080 \
    -p 18791:18791 \
    -p 9222:9222 \
    -p 9001:9001 \
    -v "$PROJECT_ROOT:/app" \
    -e NODE_ENV=test \
    -e DISPLAY=:99 \
    --cap-add=SYS_ADMIN \
    --shm-size=2gb \
    "$IMAGE_NAME:$BUILD_TAG")

RUN_EXIT_CODE=$?

if [ $RUN_EXIT_CODE -ne 0 ]; then
    echo "ERROR: Failed to start container"
    exit $RUN_EXIT_CODE
fi

echo "Container started: $CONTAINER_ID"
echo ""

# Wait for container to be ready if detached
if [ "$DETACH_MODE" = "true" ]; then
    echo "Waiting for services to initialize (this may take 30-60 seconds)..."
    echo ""

    # Wait for healthcheck to pass
    MAX_ATTEMPTS=60
    ATTEMPT=0
    CONTAINER_READY=false

    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
        if docker exec "$CONTAINER_ID" /app/healthcheck.sh >/dev/null 2>&1; then
            CONTAINER_READY=true
            break
        fi
        ATTEMPT=$((ATTEMPT + 1))
        echo "  [$ATTEMPT/$MAX_ATTEMPTS] Waiting for services to be ready..."
        sleep 1
    done

    if [ "$CONTAINER_READY" = "true" ]; then
        echo ""
        echo "Container is ready!"
    else
        echo ""
        echo "WARNING: Container may still be initializing. Check logs:"
        echo "  docker exec $CONTAINER_ID tail -f /app/logs/*.log"
    fi
else
    echo "Container attached (press Ctrl+C to detach)"
    echo ""
fi

# Display connection details
echo ""
echo "==============================================================="
echo "Voice Provider UI Test Environment Ready"
echo "==============================================================="
echo ""
echo "Container ID: $CONTAINER_ID"
echo "Container Name: $CONTAINER_NAME"
echo ""
echo "Access Points:"
echo "  Web UI: http://localhost:3000"
echo "    - Default voice provider testing interface"
echo "    - Test different providers and configurations"
echo ""
echo "  Visual Inspection (noVNC):"
echo "    - URL: http://localhost:6080/vnc.html"
echo "    - VNC Direct: localhost:5900 (in VNC client)"
echo "    - For visual debugging of voice provider UI"
echo ""
echo "  Browser Control (agent-browser):"
echo "    - Endpoint: http://localhost:18791"
echo "    - CDP/WebSocket automation"
echo "    - Chromium on :99 display"
echo ""
echo "  CDP Debugger:"
echo "    - chrome://inspect -> configure targets"
echo "    - localhost:9222"
echo ""
echo "Logs:"
echo "  View in container:"
echo "    docker exec $CONTAINER_ID tail -f /app/logs/*.log"
echo ""
echo "  Or copy to host:"
echo "    docker cp $CONTAINER_ID:/app/logs ./logs"
echo ""
echo "Service Connection Info:"
echo "  docker exec $CONTAINER_ID /app/connection-info.sh"
echo ""
echo "Testing Commands:"
echo "  Check health: docker exec $CONTAINER_ID /app/healthcheck.sh"
echo "  View supervisor status:"
echo "    docker exec $CONTAINER_ID supervisorctl status"
echo "  Connect to shell:"
echo "    docker exec -it $CONTAINER_ID bash"
echo ""
echo "Cleanup:"
echo "  Stop container:  docker stop $CONTAINER_ID"
echo "  Remove container: docker rm $CONTAINER_ID"
echo "  Remove image: docker rmi $IMAGE_NAME"
echo ""
echo "==============================================================="
echo ""

# If detached, provide cleanup info
if [ "$DETACH_MODE" = "true" ]; then
    echo "Container is running in background."
    echo "Run this to follow logs:"
    echo "  docker logs -f $CONTAINER_ID"
    echo ""
fi
