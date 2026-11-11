#!/usr/bin/env bash
# Build a Synology DSM 7.2+ package (.spk) for KDO Video Tagger.
#
# The package depends on Container Manager and uses its Docker Project worker
# (conf/resource) to create/start/stop the compose project in package/kdo-vtg.
# The image is pulled from ghcr.io at install time (no image tar is bundled).
#
# Usage: synology/build-spk.sh [version]     (default: ../VERSION)
# Output: synology/build/KDOVideoTagger-<version>.spk
set -euo pipefail
export COPYFILE_DISABLE=1   # no macOS ._ files inside the tarballs

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "${HERE}/.." && pwd)"
VERSION="${1:-$(tr -d '[:space:]' < "${ROOT}/VERSION")}"
SRC="${HERE}/spk"
OUT="${HERE}/build"
STAGE="$(mktemp -d)"
trap 'rm -rf "${STAGE}"' EXIT

echo "==> Building KDOVideoTagger ${VERSION}"
cp -R "${SRC}/conf" "${SRC}/scripts" "${SRC}/WIZARD_UIFILES" "${STAGE}/"
chmod 0755 "${STAGE}"/scripts/*

# package.tgz -> installed to /var/packages/KDOVideoTagger/target
mkdir -p "${STAGE}/pkg"
cp -R "${SRC}/package/." "${STAGE}/pkg/"
sed -i.bak "s|__VERSION__|${VERSION}|" "${STAGE}/pkg/kdo-vtg/compose.yaml"
rm -f "${STAGE}/pkg/kdo-vtg/compose.yaml.bak"
tar -C "${STAGE}/pkg" -czf "${STAGE}/package.tgz" .
rm -rf "${STAGE}/pkg"

# Icons (64 and 256 px) from the App Center icon.
ICON="${ROOT}/ugreen/rootfs_common/icon.png"
if command -v sips >/dev/null 2>&1; then
  sips -z 64 64 "${ICON}" --out "${STAGE}/PACKAGE_ICON.PNG" >/dev/null
  sips -z 256 256 "${ICON}" --out "${STAGE}/PACKAGE_ICON_256.PNG" >/dev/null
elif command -v convert >/dev/null 2>&1; then
  convert "${ICON}" -resize 64x64 "${STAGE}/PACKAGE_ICON.PNG"
  convert "${ICON}" -resize 256x256 "${STAGE}/PACKAGE_ICON_256.PNG"
else
  cp "${ICON}" "${STAGE}/PACKAGE_ICON.PNG"
  cp "${ICON}" "${STAGE}/PACKAGE_ICON_256.PNG"
fi

CHECKSUM="$(md5sum "${STAGE}/package.tgz" 2>/dev/null | cut -d' ' -f1 || md5 -q "${STAGE}/package.tgz")"
cat > "${STAGE}/INFO" <<INFO
package="KDOVideoTagger"
version="${VERSION}-1"
os_min_ver="7.2.1-69057"
arch="noarch"
displayname="KDO Video Tagger"
description="Self-hosted video tagger for editors. Scans your footage for resolution, codec, scenes, shot types, objects, GPS and color, transcribes locally with Whisper, and exports bins-ready FCPXML, Premiere XML, DaVinci Resolve metadata CSV, EDL, CSV and Excel. Your footage never leaves your NAS."
maintainer="omrik"
maintainer_url="https://github.com/omrik/kdo-vtg"
support_url="https://github.com/omrik/kdo-vtg/issues"
helpurl="https://github.com/omrik/kdo-vtg/blob/main/docs/NAS.md"
install_dep_packages="ContainerManager>=1432"
adminprotocol="http"
adminport="8080"
adminurl="/"
startable="yes"
thirdparty="yes"
silent_upgrade="yes"
checksum="${CHECKSUM}"
INFO

mkdir -p "${OUT}"
SPK="${OUT}/KDOVideoTagger-${VERSION}.spk"
tar -C "${STAGE}" -cf "${SPK}" INFO package.tgz conf scripts WIZARD_UIFILES PACKAGE_ICON.PNG PACKAGE_ICON_256.PNG
echo "Done: ${SPK}"
