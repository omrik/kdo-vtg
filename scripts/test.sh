#!/bin/bash

# KDO Video Tagger - Test Script
#
# Prerequisites:
# 1. Build the Docker image
# 2. Run the container
#
# Usage:
#   ./scripts/test.sh              # Run all tests
#   ./scripts/test.sh --fast       # Skip DB reset (default behaviour)
#   ./scripts/test.sh --reset      # Delete the DB and restart the container first
#
# Environment:
#   BASE_URL        Base URL of the running app   (default: http://localhost:8080)
#   CONTAINER_NAME  Name of the running container (default: kdo-vtg-test)

set -e

BASE_URL="${BASE_URL:-http://localhost:8080}"
CONTAINER_NAME="${CONTAINER_NAME:-kdo-vtg-test}"

echo ""
echo "========================================"
echo "  KDO Video Tagger - Test Suite"
echo "========================================"
echo ""

# Reset the database only when explicitly requested. A reset requires the
# admin user to be re-created below before the tests can authenticate.
if [ "$1" = "--reset" ]; then
    echo "[1/4] Resetting database..."
    docker exec "$CONTAINER_NAME" rm -f /app/config/kdo-vtg.db 2>/dev/null || true
    docker restart "$CONTAINER_NAME" >/dev/null
    sleep 3
    echo "      Done"
else
    echo "[1/4] Keeping existing database (use --reset to wipe)"
fi

echo "[2/4] Waiting for app to be ready..."
for i in {1..20}; do
    if curl -s "$BASE_URL/api/health" 2>/dev/null | grep -q "healthy"; then
        echo "      App is ready"
        break
    fi
    if [ $i -eq 20 ]; then
        echo "      ERROR: app did not become ready at $BASE_URL"
        exit 1
    fi
    sleep 1
done

# Ensure the first (admin) user exists so the auth fixture can log in.
# Registration only succeeds on an empty user table; ignore errors otherwise.
curl -s -X POST "$BASE_URL/api/auth/register" \
    -H 'Content-Type: application/json' \
    -d '{"username":"admin","password":"hthr07"}' >/dev/null 2>&1 || true

# Provide a small, writable folder inside the container for scan tests.
if docker exec "$CONTAINER_NAME" mkdir -p /app/testdata 2>/dev/null; then
    export SCAN_TEST_PATH="/app/testdata"
fi

echo "[3/4] Running pytest..."
cd "$(dirname "$0")/.."
python3 -m pytest tests/ -v

echo "[4/4] Done!"
echo ""
echo "========================================"
