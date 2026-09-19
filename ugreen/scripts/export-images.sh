#!/usr/bin/env bash
# Export kdo-vtg architecture-specific image tars into rootfs_amd64/images
# and rootfs_arm64/images (the layout ugcli pack expects).
#
# Uses skopeo (via the official container image) because Docker Desktop's
# containerd image store cannot `docker save` single-platform tars from a
# multi-arch tag. Works on any host with a working docker daemon.
#
# Usage: scripts/export-images.sh <version>
set -euo pipefail

VERSION="${1:?usage: export-images.sh <version>}"
IMAGE="ghcr.io/omrik/kdo-vtg:${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

for arch in amd64 arm64; do
  out_dir="${ROOT}/rootfs_${arch}/images"
  tar_name="kdo-vtg-${VERSION}.tar"
  mkdir -p "${out_dir}"
  echo "==> ${arch}: exporting ${IMAGE} -> ${out_dir}/${tar_name}"
  docker run --rm \
    -v "${out_dir}:/out" \
    quay.io/skopeo/stable:latest copy \
    "--override-arch=${arch}" --override-os linux \
    "docker://${IMAGE}" \
    "docker-archive:/out/${tar_name}:${IMAGE}"
done

echo "Done. Tars are ready for ugcli pack."