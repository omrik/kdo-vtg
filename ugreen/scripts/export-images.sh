#!/usr/bin/env bash
# Pull the kdo-vtg image for amd64 and arm64 and export architecture-specific
# tars into rootfs_amd64/images and rootfs_arm64/images.
#
# Usage: scripts/export-images.sh <version>
set -euo pipefail

VERSION="${1:?usage: export-images.sh <version>}"
IMAGE="ghcr.io/omrik/kdo-vtg:${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for arch in amd64 arm64; do
  out_dir="${ROOT}/rootfs_${arch}/images"
  out="${out_dir}/kdo-vtg-${VERSION}.tar"
  mkdir -p "${out_dir}"
  echo "==> ${arch}: pulling ${IMAGE}"
  docker pull --platform "linux/${arch}" "${IMAGE}"
  echo "==> ${arch}: saving ${out}"
  docker save "${IMAGE}" -o "${out}"
done

echo "Done. Tars are ready for ugcli pack."
docker images "$(echo "${IMAGE}" | cut -d: -f1)" --format '{{.Repository}}:{{.Tag}} {{.ID}}'