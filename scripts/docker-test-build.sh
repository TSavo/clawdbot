#!/bin/bash
set -e

# Docker test environment builder script
# Builds the Dockerfile.test image for voice provider UI testing

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Configuration
IMAGE_NAME="${1:-clawdbot-test}"
BUILD_TAG="${2:-latest}"
DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
PROGRESS="${PROGRESS:-auto}"

export DOCKER_BUILDKIT
export BUILDKIT_PROGRESS=$PROGRESS

echo "==============================================================="
echo "Building Clawdbot Voice Provider Test Environment"
echo "==============================================================="
echo ""
echo "Image: $IMAGE_NAME:$BUILD_TAG"
echo "Dockerfile: Dockerfile.test"
echo "BuildKit: $DOCKER_BUILDKIT"
echo "Progress: $PROGRESS"
echo ""

# Verify Dockerfile exists
if [ ! -f "$PROJECT_ROOT/Dockerfile.test" ]; then
    echo "ERROR: $PROJECT_ROOT/Dockerfile.test not found"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Build with layer caching for speed
echo "Starting Docker build (with layer caching)..."
echo ""

docker build \
    --file Dockerfile.test \
    --tag "$IMAGE_NAME:$BUILD_TAG" \
    --tag "$IMAGE_NAME:latest" \
    --progress="$PROGRESS" \
    --build-arg BUILDKIT_INLINE_CACHE=1 \
    .

BUILD_EXIT_CODE=$?

echo ""
echo "==============================================================="

if [ $BUILD_EXIT_CODE -eq 0 ]; then
    echo "Build completed successfully!"
    echo ""

    # Get image details
    IMAGE_ID=$(docker images -q "$IMAGE_NAME:$BUILD_TAG" | head -1)
    IMAGE_SIZE=$(docker images "$IMAGE_NAME:$BUILD_TAG" --format "{{.Size}}")

    echo "Image Details:"
    echo "  ID: $IMAGE_ID"
    echo "  Size: $IMAGE_SIZE"
    echo "  Name: $IMAGE_NAME:$BUILD_TAG"
    echo "  Also tagged as: $IMAGE_NAME:latest"
    echo ""
    echo "Next steps:"
    echo "  Run test environment:"
    echo "    bash scripts/docker-test-run.sh"
    echo ""
    echo "  Or run directly:"
    echo "    docker run -d \\"
    echo "      --name clawdbot-test-instance \\"
    echo "      -p 3000:3000 \\"
    echo "      -p 6080:6080 \\"
    echo "      -p 18791:18791 \\"
    echo "      -v \$(pwd):/app \\"
    echo "      $IMAGE_NAME:$BUILD_TAG"
    echo ""
else
    echo "Build failed with exit code $BUILD_EXIT_CODE"
    exit $BUILD_EXIT_CODE
fi

echo "==============================================================="
