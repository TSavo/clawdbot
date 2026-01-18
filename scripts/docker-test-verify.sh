#!/bin/bash
set -e

# Docker test environment verification script
# Comprehensive verification of running test container

CONTAINER_ID="${1:-}"

if [ -z "$CONTAINER_ID" ]; then
    # Try to find a running clawdbot-test container
    CONTAINER_ID=$(docker ps -q -f "ancestor=clawdbot-test" | head -1)
    if [ -z "$CONTAINER_ID" ]; then
        echo "ERROR: No running clawdbot-test container found"
        echo "Usage: bash scripts/docker-test-verify.sh [container-id]"
        echo ""
        echo "Running containers:"
        docker ps --format "table {{.ID}}\t{{.Image}}\t{{.Names}}"
        exit 1
    fi
fi

echo "==============================================================="
echo "Clawdbot Test Environment Verification"
echo "==============================================================="
echo ""
echo "Container: $CONTAINER_ID"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        return 1
    fi
}

PASSED=0
FAILED=0

# 1. Container Status
echo "1. Container Status"
if docker ps -q | grep -q "$CONTAINER_ID"; then
    check_result 0 "Container is running"
    ((PASSED++))
else
    check_result 1 "Container is running"
    ((FAILED++))
fi

# 2. Network Connectivity
echo ""
echo "2. Network & Port Verification"

# Check each port
ports=(
    "3000:Clawdbot UI"
    "5900:VNC (raw)"
    "6080:noVNC (WebSocket)"
    "18791:Browser Control"
    "9222:Chrome DevTools"
)

for port_info in "${ports[@]}"; do
    port="${port_info%:*}"
    name="${port_info#*:}"
    if docker exec "$CONTAINER_ID" nc -z localhost "$port" 2>/dev/null; then
        check_result 0 "Port $port ($name) is accessible"
        ((PASSED++))
    else
        check_result 1 "Port $port ($name) is accessible"
        ((FAILED++))
    fi
done

# 3. Service Status
echo ""
echo "3. Supervisor Service Status"

SUPERVISOR_STATUS=$(docker exec "$CONTAINER_ID" supervisorctl status 2>&1)
echo "$SUPERVISOR_STATUS" | while read line; do
    if echo "$line" | grep -q "RUNNING"; then
        SERVICE_NAME=$(echo "$line" | awk '{print $1}')
        check_result 0 "Service $SERVICE_NAME is running"
    elif echo "$line" | grep -q "STOPPED\|FATAL\|ERROR"; then
        SERVICE_NAME=$(echo "$line" | awk '{print $1}')
        check_result 1 "Service $SERVICE_NAME is healthy"
    fi
done

# 4. Display & VNC
echo ""
echo "4. Display & VNC Server"

if docker exec "$CONTAINER_ID" DISPLAY=:99 xset q >/dev/null 2>&1; then
    check_result 0 "X display :99 is accessible"
    ((PASSED++))
else
    check_result 1 "X display :99 is accessible"
    ((FAILED++))
fi

# 5. Audio/Voice Processing
echo ""
echo "5. Audio & Voice Processing"

if docker exec "$CONTAINER_ID" which whisper >/dev/null 2>&1; then
    WHISPER_VER=$(docker exec "$CONTAINER_ID" pip show openai-whisper 2>/dev/null | grep Version | awk '{print $2}')
    check_result 0 "Whisper is installed (version: $WHISPER_VER)"
    ((PASSED++))
else
    check_result 1 "Whisper is installed"
    ((FAILED++))
fi

if docker exec "$CONTAINER_ID" ps aux | grep -q '[p]ulseaudio'; then
    check_result 0 "PulseAudio is running"
    ((PASSED++))
else
    check_result 1 "PulseAudio is running"
    ((FAILED++))
fi

# 6. Application
echo ""
echo "6. Clawdbot Application"

if docker exec "$CONTAINER_ID" test -d /app/dist; then
    check_result 0 "Built application (dist/) exists"
    ((PASSED++))
else
    check_result 1 "Built application (dist/) exists"
    ((FAILED++))
fi

if docker exec "$CONTAINER_ID" test -d /app/ui/dist; then
    check_result 0 "Built UI assets exist"
    ((PASSED++))
else
    check_result 1 "Built UI assets exist"
    ((FAILED++))
fi

# 7. Dependencies
echo ""
echo "7. Runtime Dependencies"

NODE_VER=$(docker exec "$CONTAINER_ID" node --version 2>/dev/null)
check_result 0 "Node.js is available ($NODE_VER)"
((PASSED++))

if docker exec "$CONTAINER_ID" which chromium >/dev/null 2>&1; then
    CHROMIUM_VER=$(docker exec "$CONTAINER_ID" chromium --version 2>/dev/null | head -c 50)
    check_result 0 "Chromium is installed ($CHROMIUM_VER)"
    ((PASSED++))
else
    check_result 1 "Chromium is installed"
    ((FAILED++))
fi

PYTHON_VER=$(docker exec "$CONTAINER_ID" python3 --version 2>/dev/null)
check_result 0 "Python 3 is available ($PYTHON_VER)"
((PASSED++))

# 8. Volumes & Mounts
echo ""
echo "8. Volumes & Mounts"

if docker exec "$CONTAINER_ID" test -d /app; then
    check_result 0 "/app volume is mounted"
    ((PASSED++))
else
    check_result 1 "/app volume is mounted"
    ((FAILED++))
fi

# 9. Logs
echo ""
echo "9. Log Files"

LOG_FILES=(
    "/app/logs/supervisord.log:Supervisor log"
    "/app/logs/clawdbot-ui.log:Clawdbot UI log"
    "/app/logs/xvfb.log:Xvfb log"
    "/app/logs/x11vnc.log:X11VNC log"
    "/app/logs/websockify.log:WebSocketify log"
)

for log_info in "${LOG_FILES[@]}"; do
    log_file="${log_info%:*}"
    log_name="${log_info#*:}"
    if docker exec "$CONTAINER_ID" test -f "$log_file"; then
        SIZE=$(docker exec "$CONTAINER_ID" du -h "$log_file" 2>/dev/null | awk '{print $1}')
        check_result 0 "$log_name exists ($SIZE)"
        ((PASSED++))
    else
        check_result 1 "$log_name exists"
        ((FAILED++))
    fi
done

# 10. Healthcheck
echo ""
echo "10. Container Healthcheck"

if docker exec "$CONTAINER_ID" /app/healthcheck.sh >/dev/null 2>&1; then
    check_result 0 "Container healthcheck passes"
    ((PASSED++))
else
    check_result 1 "Container healthcheck passes"
    ((FAILED++))
fi

# Summary
echo ""
echo "==============================================================="
echo "Verification Summary"
echo "==============================================================="
echo ""
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All checks passed!${NC}"
    echo ""
    echo "Connection Details:"
    docker exec "$CONTAINER_ID" /app/connection-info.sh 2>/dev/null || true
    exit 0
else
    echo -e "${RED}$FAILED check(s) failed${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. View container logs:"
    echo "   docker logs $CONTAINER_ID"
    echo ""
    echo "2. Check supervisor status:"
    echo "   docker exec $CONTAINER_ID supervisorctl status"
    echo ""
    echo "3. View service logs:"
    echo "   docker exec $CONTAINER_ID tail -50 /app/logs/*.log"
    echo ""
    exit 1
fi
