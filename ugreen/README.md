# KDO Video Tagger — UGOS Pro App Package (UPK)

Packages the Docker image into a `.upk` for the UGREEN App Center
(UGOS Pro 1.13+, Docker suite 1.7+; DXP series / DH4300 Plus).

This folder mirrors what `ugcli create com.omrik.docker.kdovideotagger`
generates, so it can be built entirely from the repo.

```
ugreen/
├── project.yaml              # App metadata + install-time parameters
├── rootfs_amd64/images/      # image tar (amd64)  -- created by export-images.sh
├── rootfs_arm64/images/      # image tar (arm64)  -- created by export-images.sh
├── rootfs_common/
│   ├── icon.png                  # 256x256 App Center icon (gen: ../scripts/make-png-icon.py)
│   └── docker-compose.yaml   # Compose template (${VAR} from project.yaml)
└── scripts/
    ├── export-images.sh      # docker save amd64/arm64 tars into rootfs_*
    └── build-upk.sh          # pin version, sync tars, ugcli check + pack
```

## Prerequisites

- `ugcli` installed on the build host (Debian 12 recommended) —
  see `https://developer.ugnas.com/en/doc/tools/ugcli.html`
- `docker` with `buildx` on the build host (to pull/export both arches)
- An authorized device: upload your `ugdev.sig` to the admin's Personal
  Folder and enable **App Center → Settings → App Development Settings →
  Authorize**

## Build

```bash
VERSION=$(cat ../VERSION)
# 1. Pull + save the image for both architectures into rootfs_amd64/arm64
scripts/export-images.sh $VERSION

# 2. Copy a pinned compose that references the saved image tag
#    (build-upk.sh does this automatically by rewriting ${KDO_IMG_TAG})
scripts/build-upk.sh $VERSION 1
```

`build-upk.sh` outputs UPK packages under `build/pkgs/upk/`:

```
amd64_com.omrik.docker.kdovideotagger_<version>.upk
arm64_com.omrik.docker.kdovideotagger_<version>.upk
```

(`version` = `<VERSION>.<build>`)

## Test (sideload) then submit

1. **App Center → Manual Install** the `.upk` on your device, or SSH/disk-sideload.
2. Verify: install → grant a media folder → open the web UI at the WEBUI_PORT →
   register the admin account → scan a folder → transcribe → export.
3. Submit via `developer.ugnas.com` (security + UX review). App Center releases
   use a 30-day free-trial store model; updates flow only through App Center.

## Gotchas

- Image tag in `docker-compose.yaml` must match the tar and be a pinned
  version — `latest` is rejected. Build hosts therefore pull
  `ghcr.io/omrik/kdo-vtg:<VERSION>` (published on GitHub Releases).
- One instance per device; keep the **WEBUI_PORT fixed** — App Center opens
  exactly that port.
- Container data lives under the app's data dir; users export/re-import the DB
  (Settings → Database) to migrate from a manual Docker install.
- The container runs as a non-root user (uid **1000**); the config data dir
  (`/app/config`, mapped from `./data`) must be writable by uid 1000 — App
  Center creates it with suitable perms on install.
- `GEMINI_API_KEY` is optional; without it everything except Gemini chapters
  keeps working.