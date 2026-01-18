#!/bin/bash

# Docker test environment cleanup script
# Safely removes test containers and optionally the image

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
FORCE_REMOVE="${FORCE_REMOVE:-false}"
REMOVE_IMAGE="${REMOVE_IMAGE:-false}"
REMOVE_BUILD_CACHE="${REMOVE_BUILD_CACHE:-false}"

echo "==============================================================="
echo "Clawdbot Test Environment Cleanup"
echo "==============================================================="
echo ""

# Handle interactive mode if no arguments
if [ $# -eq 0 ]; then
    echo "Cleanup options:"
    echo "1. Remove test containers"
    echo "2. Remove test image"
    echo "3. Remove build cache"
    echo "4. Full cleanup (all of above)"
    echo "5. Exit without changes"
    echo ""
    read -p "Select option (1-5): " -n 1 OPTION
    echo ""
    echo ""

    case $OPTION in
        1)
            FORCE_REMOVE="true"
            ;;
        2)
            REMOVE_IMAGE="true"
            ;;
        3)
            REMOVE_BUILD_CACHE="true"
            ;;
        4)
            FORCE_REMOVE="true"
            REMOVE_IMAGE="true"
            REMOVE_BUILD_CACHE="true"
            ;;
        5)
            echo "Cleanup cancelled"
            exit 0
            ;;
        *)
            echo "Invalid option"
            exit 1
            ;;
    esac
fi

# Process command line arguments
while [ $# -gt 0 ]; do
    case $1 in
        --containers)
            FORCE_REMOVE="true"
            shift
            ;;
        --image)
            REMOVE_IMAGE="true"
            shift
            ;;
        --cache)
            REMOVE_BUILD_CACHE="true"
            shift
            ;;
        --all)
            FORCE_REMOVE="true"
            REMOVE_IMAGE="true"
            REMOVE_BUILD_CACHE="true"
            shift
            ;;
        --force)
            # Already set
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo ""
            echo "Usage: bash scripts/docker-test-cleanup.sh [options]"
            echo ""
            echo "Options:"
            echo "  --containers    Remove test containers"
            echo "  --image         Remove test image"
            echo "  --cache         Remove Docker build cache"
            echo "  --all           All of above"
            echo "  --force         Don't ask for confirmation"
            exit 1
            ;;
    esac
done

# 1. Remove containers
if [ "$FORCE_REMOVE" = "true" ]; then
    echo "Removing test containers..."
    echo ""

    # Find all clawdbot-test containers
    CONTAINERS=$(docker ps -a -q -f "ancestor=clawdbot-test" 2>/dev/null || echo "")

    if [ -z "$CONTAINERS" ]; then
        echo "No test containers found"
    else
        COUNT=0
        while read -r CONTAINER; do
            if [ -n "$CONTAINER" ]; then
                if docker ps -q | grep -q "$CONTAINER"; then
                    echo "Stopping container: $CONTAINER"
                    docker stop "$CONTAINER" >/dev/null
                fi
                echo "Removing container: $CONTAINER"
                docker rm "$CONTAINER"
                ((COUNT++))
            fi
        done <<< "$CONTAINERS"

        echo "Removed $COUNT container(s)"
    fi
    echo ""
fi

# 2. Remove image
if [ "$REMOVE_IMAGE" = "true" ]; then
    echo "Removing test image..."
    echo ""

    if docker images "clawdbot-test" --format "{{.ID}}" 2>/dev/null | grep -q .; then
        echo "Image found: clawdbot-test"

        # Remove all tags
        docker rmi -f clawdbot-test:latest 2>/dev/null || true
        docker rmi -f clawdbot-test 2>/dev/null || true

        # Also try to remove by image ID if it still exists
        IMAGE_IDS=$(docker images "clawdbot-test" -q 2>/dev/null || echo "")
        if [ -n "$IMAGE_IDS" ]; then
            echo "Force removing image IDs: $IMAGE_IDS"
            docker rmi -f $IMAGE_IDS 2>/dev/null || true
        fi

        echo "Image removed"
    else
        echo "Image not found: clawdbot-test"
    fi
    echo ""
fi

# 3. Remove build cache
if [ "$REMOVE_BUILD_CACHE" = "true" ]; then
    echo "Cleaning Docker build cache..."
    echo ""

    # Get cache size before
    BEFORE=$(docker system df --format "{{.BuildCacheUsage}}" 2>/dev/null || echo "unknown")

    # Prune build cache
    docker builder prune -af >/dev/null 2>&1 || true

    echo "Build cache cleaned"
    echo ""
fi

# 4. System cleanup
echo "Running Docker system cleanup..."
REMOVED_INFO=$(docker system prune -f --volumes 2>&1 | tail -5)
echo "$REMOVED_INFO"
echo ""

# 5. Report final state
echo "==============================================================="
echo "Cleanup Summary"
echo "==============================================================="
echo ""

echo "Current Docker state:"
echo ""

# Containers
RUNNING=$(docker ps -q | wc -l)
STOPPED=$(docker ps -a -q | wc -l)
echo "Containers:"
echo "  Running: $RUNNING"
echo "  Total: $STOPPED"
echo ""

# Images
IMAGES=$(docker images -q | wc -l)
TEST_IMAGES=$(docker images "clawdbot-test" -q 2>/dev/null | wc -l)
echo "Images:"
echo "  Total: $IMAGES"
echo "  Test images (clawdbot-test): $TEST_IMAGES"
echo ""

# Disk usage
DISK_USAGE=$(docker system df 2>/dev/null | tail -1 | awk '{print $4}')
echo "Docker disk usage: $DISK_USAGE"
echo ""

# Logs cleanup
LOGS_DIR="$PROJECT_ROOT/logs"
if [ -d "$LOGS_DIR" ]; then
    LOGS_SIZE=$(du -sh "$LOGS_DIR" 2>/dev/null | awk '{print $1}')
    read -p "Remove local logs directory ($LOGS_SIZE)? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -rf "$LOGS_DIR"
        echo "Local logs directory removed"
    fi
fi
echo ""

echo "Cleanup complete!"
echo ""
echo "To rebuild test environment:"
echo "  bash scripts/docker-test-build.sh"
echo "  bash scripts/docker-test-run.sh"
echo ""
