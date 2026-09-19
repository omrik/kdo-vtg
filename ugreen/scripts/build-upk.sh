#!/usr/bin/env bash
# Pin the version into project.yaml + docker-compose.yaml, verify the image
# tars are present, then run ugcli check + pack for both architectures.
#
# Usage: scripts/build-upk.sh <version> [build-number]
set -euo pipefail

VERSION="${1:?usage: build-upk.sh <version> [build-number]}"
BUILD="${2:-1}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE="${ROOT}/rootfs_common/docker-compose.yaml"
PROJECT="${ROOT}/project.yaml"

if ! command -v ugcli >/dev/null 2>&1; then
  echo "Error: 'ugcli' not found. Install it first (see ugreen/README.md)." >&2
  exit 1
fi

echo "==> Pinning image tag ${VERSION} in compose"
sed -i.bak -E "s|image: ghcr.io/omrik/kdo-vtg:.*|image: ghcr.io/omrik/kdo-vtg:${VERSION}|" "${COMPOSE}"
rm -f "${COMPOSE}.bak"

echo "==> Setting project version ${VERSION}"
sed -i.bak -E "s|^version: \".*\"|version: \"${VERSION}\"|" "${PROJECT}"
rm -f "${PROJECT}.bak"

for arch in amd64 arm64; do
  tar="${ROOT}/rootfs_${arch}/images/kdo-vtg-${VERSION}.tar"
  if [ ! -f "${tar}" ]; then
    echo "Error: missing ${tar}. Run scripts/export-images.sh ${VERSION} first." >&2
    exit 1
  fi
done

echo "==> ugcli check"
ugcli check

echo "==> ugcli pack --build ${BUILD}"
ugcli pack --arch all --build "${BUILD}"

echo "Done. UPK packages are under build/pkgs/upk/ (or --build_dir)."