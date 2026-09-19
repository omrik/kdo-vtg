#!/usr/bin/env bash
#
# KDO Video Tagger - one-command installer
# Pulls the image and starts the container with sane defaults.
#
# Usage:
#   ./install.sh                  # default: ./kdo-data for config, /media read-only for videos
#   MEDIA_PATH=/path/to/videos ./install.sh
#   PORT=9000 ./install.sh
#
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/omrik/kdo-vtg:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-kdo-vtg}"
PORT="${PORT:-8080}"
MEDIA_PATH="${MEDIA_PATH:-}"
CONFIG_DIR="${CONFIG_DIR:-./kdo-data}"
TZ="${TZ:-$(cat /etc/timezone 2>/dev/null || echo "UTC")}"

echo "==> KDO Video Tagger installer"
echo "    Image : ${IMAGE}"
echo "    Port  : ${PORT}"

if [ -z "${MEDIA_PATH}" ]; then
  echo "    Media : (none) - set MEDIA_PATH=/path/to/videos to mount your footage"
fi

mkdir -p "${CONFIG_DIR}"
echo "    Config: ${CONFIG_DIR}"

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  echo "==> Stopping existing container '${CONTAINER_NAME}'..."
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "==> Pulling image..."
docker pull "${IMAGE}"

VOLUME_ARGS=(-v "${CONFIG_DIR}:/app/config:rw")
if [ -n "${MEDIA_PATH}" ]; then
  VOLUME_ARGS+=(-v "${MEDIA_PATH}:/media:ro")
fi

echo "==> Starting container..."
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  -p "${PORT}:8000" \
  "${VOLUME_ARGS[@]}" \
  -e "TZ=${TZ}" \
  -e "GEMINI_API_KEY=${GEMINI_API_KEY:-}" \
  "${IMAGE}" >/dev/null

echo "==> Done. Open http://localhost:${PORT} (or http://<nas-ip>:${PORT})"