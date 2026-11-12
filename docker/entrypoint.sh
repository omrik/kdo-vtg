#!/bin/sh
# KDO Video Tagger container entrypoint.
#
# NAS-friendly user handling:
#   * Default: the image runs as the non-root user `kdo` (uid 1000).
#   * `--user <uid>:<gid>` / compose `user:` works for any uid (no passwd entry
#     needed): HOME and model caches move into the writable config volume.
#   * Started as root with PUID/PGID set (the LinuxServer.io convention used by
#     Synology, UGREEN, Unraid, CasaOS templates): the config dir is chowned to
#     PUID:PGID and the app is re-executed as that user. The media mount is
#     never chowned (it is expected read-only).
set -e

CONFIG_DIR="${KDO_CONFIG_DIR:-/app/config}"

if [ "$(id -u)" = "0" ]; then
    # No PUID given (e.g. an optional install field left empty): fall back to
    # the image's own unprivileged user instead of staying root.
    if [ -z "${PUID}" ]; then
        PUID=1000
        PGID="${PGID:-1000}"
    fi
    if [ "${PUID}" != "0" ]; then
        PGID="${PGID:-${PUID}}"
        mkdir -p "${CONFIG_DIR}"
        # Only walk the tree when ownership is actually wrong (large thumbnail
        # dirs make an unconditional chown -R slow on every restart).
        if [ "$(stat -c %u:%g "${CONFIG_DIR}")" != "${PUID}:${PGID}" ]; then
            echo "[kdo-vtg] Setting ownership of ${CONFIG_DIR} to ${PUID}:${PGID}"
            chown -R "${PUID}:${PGID}" "${CONFIG_DIR}"
        fi
        # Make PUID a known user so tools that look up the passwd entry work.
        if ! getent passwd "${PUID}" >/dev/null 2>&1; then
            usermod -o -u "${PUID}" kdo >/dev/null 2>&1 || true
        fi
        if ! getent group "${PGID}" >/dev/null 2>&1; then
            groupmod -o -g "${PGID}" kdo >/dev/null 2>&1 || true
        fi
        echo "[kdo-vtg] Running as uid ${PUID} gid ${PGID}"
        export HOME="${CONFIG_DIR}/.home"
        exec setpriv --reuid="${PUID}" --regid="${PGID}" --clear-groups -- "$0" "$@"
    fi
    echo "[kdo-vtg] WARNING: PUID=0, running as root."
fi

# Fail fast with an actionable message instead of a SQLite traceback.
if ! ( mkdir -p "${CONFIG_DIR}" && : > "${CONFIG_DIR}/.write-test" ) 2>/dev/null; then
    cat >&2 <<EOF
[kdo-vtg] ERROR: ${CONFIG_DIR} is not writable by uid $(id -u) / gid $(id -g).
[kdo-vtg] Fix one of:
[kdo-vtg]   - set PUID/PGID to the owner of your config folder and start the
[kdo-vtg]     container as root (compose: user: "0:0"), or
[kdo-vtg]   - run with --user <uid>:<gid> matching the config folder owner, or
[kdo-vtg]   - chown the config folder on the host: chown -R $(id -u):$(id -g) <dir>
EOF
    exit 1
fi
rm -f "${CONFIG_DIR}/.write-test"

# Arbitrary uids have no writable home; keep caches in the config volume so
# Whisper/YOLO downloads also survive container re-creation and app updates.
if [ -z "${HOME}" ] || ! [ -w "${HOME}" ]; then
    export HOME="${CONFIG_DIR}/.home"
fi
mkdir -p "${HOME}" 2>/dev/null || true
export XDG_CACHE_HOME="${XDG_CACHE_HOME:-${CONFIG_DIR}/cache}"
export HF_HOME="${HF_HOME:-${XDG_CACHE_HOME}/huggingface}"
export YOLO_CONFIG_DIR="${YOLO_CONFIG_DIR:-${XDG_CACHE_HOME}/ultralytics}"
mkdir -p "${XDG_CACHE_HOME}" "${HF_HOME}" "${YOLO_CONFIG_DIR}" 2>/dev/null || true

exec "$@"
