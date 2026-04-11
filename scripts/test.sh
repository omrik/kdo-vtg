#!/bin/bash

# KDO Video Tagger - Test Script
# 
# Prerequisites:
# 1. Build the Docker image
# 2. Run the container
# 3. Reset the database (if needed)
#
# Usage:
#   ./scripts/test.sh              # Run all tests
#   ./scripts/test.sh --fast      # Skip DB reset (faster)

set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"
CONTAINER_NAME="${CONTAINER_NAME:-kdo-vtg}"

echo ""
echo "========================================"
echo "  KDO Video Tagger - Test Suite"
echo "========================================"
echo ""

# Fast mode skips DB reset
if [ "$1" != "--fast" ]; then
    echo "[1/4] Resetting database..."
    docker exec "$CONTAINER_NAME" rm -f /app/config/kdo-vtg.db 2>/dev/null || true
    docker restart "$CONTAINER_NAME" >/dev/null
    sleep 3
    echo "      Done"
fi

echo "[2/4] Waiting for app to be ready..."
for i in {1..10}; do
    if curl -s "$BASE_URL/api/health" 2>/dev/null | grep -q "healthy"; then
        echo "      App is ready"
        break
    fi
    sleep 1
done

echo "[3/4] Running pytest..."
cd "$(dirname "$0")/.."
python3 -m pytest tests/ -v

echo "[4/4] Done!"
echo ""
echo "========================================"
