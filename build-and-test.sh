#!/bin/bash

# KDO Video Tagger - Build and Test Script
# Usage: ./build-and-test.sh [--skip-tests]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

CONTAINER_NAME="${CONTAINER_NAME:-interesting_panini}"
IMAGE_NAME="${IMAGE_NAME:-kdo-vtg:stage}"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }

echo ""
echo "========================================"
echo "  KDO Video Tagger - Build & Test"
echo "========================================"

# Step 1: Build Docker image
log_info "Step 1: Building Docker image..."
cd "$(dirname "$0")"
docker build -t "$IMAGE_NAME" . --platform linux/amd64
log_success "Docker image built: $IMAGE_NAME"

# Step 2: Stop and remove old container
log_info "Step 2: Stopping old container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true
log_success "Old container cleaned up"

# Step 3: Start new container
log_info "Step 3: Starting new container..."
docker run -d -p 8080:8000 \
    -v ~/Movies:/media:ro \
    -v kdo-vtg-config:/app/config \
    --name "$CONTAINER_NAME" \
    "$IMAGE_NAME"
log_success "Container started"

# Step 4: Wait for app to be ready
log_info "Step 4: Waiting for app to be ready..."
for i in {1..15}; do
    if curl -s http://localhost:8080/api/health 2>/dev/null | grep -q "healthy"; then
        log_success "App is ready"
        break
    fi
    if [ $i -eq 15 ]; then
        echo -e "${RED}[ERROR]${NC} App failed to start"
        exit 1
    fi
    sleep 1
done

# Step 5: Run tests
if [ "$1" != "--skip-tests" ]; then
    log_info "Step 5: Running tests..."
    echo ""
    ./test.sh --all
    TEST_EXIT=$?
    echo ""
    
    if [ $TEST_EXIT -eq 0 ]; then
        log_success "All tests passed!"
    else
        echo -e "${RED}[ERROR]${NC} Some tests failed"
        exit 1
    fi
else
    log_info "Step 5: Tests skipped (--skip-tests)"
fi

echo ""
echo "========================================"
echo "  Build & Test Complete"
echo "========================================"
echo "  App: http://localhost:8080"
echo "========================================"
