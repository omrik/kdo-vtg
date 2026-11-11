# Running KDO Video Tagger on a NAS

KDO Video Tagger ships one multi-arch image (`linux/amd64` + `linux/arm64`):

```
ghcr.io/omrik/kdo-vtg:<version>      # or :latest
docker.io/omrikedem/kdo-vtg:<version>
```

Every NAS install has the same three mounts:

| Container path | Mode | What |
|---|---|---|
| `/media` | **read-only** | Your footage. KDO never writes to it. |
| `/app/config` | read-write | Database, thumbnails, Whisper/YOLO model cache. |
| port `8000` | | Web UI (publish it on e.g. 8080). |

## File permissions (PUID / PGID)

NAS shares are owned by your NAS user, not by the image's default uid 1000.
The image supports both NAS conventions:

- **PUID/PGID (recommended on NAS).** Start the container as root
  (`user: "0:0"`) and set `PUID`/`PGID` to a user that can read your media
  share. On start the entrypoint chowns **only** `/app/config` to that user,
  then drops root and runs the app as `PUID:PGID`.
- **`--user uid:gid`.** Runs directly as that uid (no root at all). The config
  folder must already be writable by it.

If the config folder isn't writable, the container stops with a message that
says how to fix it, instead of a database traceback.

| NAS | Typical PUID | Typical PGID | How to check |
|---|---|---|---|
| Synology DSM | `1026` (first user) | `100` (users) | SSH: `id <user>` |
| UGREEN UGOS Pro | `1000` | `10` (admin) / `100` | SSH: `id <user>` |
| Unraid | `99` (nobody) | `100` (users) | defaults |
| QNAP QTS | `1000` | `100` (everyone) | SSH: `id <user>` |
| TrueNAS SCALE | `568` (apps) | `568` (apps) | defaults |

---

## UGREEN (UGOS Pro, App Center)

A native App Center package (`.upk`) lives in [`ugreen/`](../ugreen/README.md).
Requires UGOS Pro 1.13+ and Docker 1.7+ (DXP series, DH4300 Plus).

```bash
cd ugreen
scripts/export-images.sh "$(cat ../VERSION)"
scripts/build-upk.sh "$(cat ../VERSION)" 1
```

Sideload with **App Center → Manual Install**. Pick the media folder in the
install dialog; the app opens on the Web UI port.

## Synology (DSM 7.2+)

### Option A: Package Center package (.spk)

[`synology/`](../synology) builds a DSM package that depends on **Container
Manager** and uses its Docker Project worker, so the app installs, starts,
stops and uninstalls from Package Center like any other app.

```bash
synology/build-spk.sh          # -> synology/build/KDOVideoTagger-<version>.spk
```

Install with **Package Center → Manual Install**. The wizard asks for the media
share (e.g. `/volume1/video`), the Web UI port, PUID/PGID and an optional
Gemini key. Data lives in `/var/packages/KDOVideoTagger/var/config`.

> The package is unsigned, so DSM shows a third-party publisher warning.
> Needs DSM 7.2.1+ with Container Manager installed.

### Option B: Container Manager project (no package)

1. **File Station**: create `docker/kdo-vtg` on `volume1`.
2. **Container Manager → Project → Create**, path `/volume1/docker/kdo-vtg`,
   source **Create docker-compose.yml**, paste [`synology/compose.yaml`](../synology/compose.yaml).
3. Change the media path, port and PUID, then **Next → Done**.
4. Open `http://<nas-ip>:8080` and create the admin account.

## Unraid

Template: [`unraid/kdo-vtg.xml`](../unraid/kdo-vtg.xml).
**Docker → Add Container → Template repositories**, add
`https://github.com/omrik/kdo-vtg`, or paste the template URL. Set **Media** to
your footage share (default `/mnt/user/media`).

## CasaOS / ZimaOS

**App Store → Custom Install → Import**, paste
[`casaos/docker-compose.yml`](../casaos/docker-compose.yml).

## QNAP (Container Station 3) and TrueNAS SCALE

Use the generic compose ([`docker/docker-compose.prod.yml`](../docker/docker-compose.prod.yml))
as an Application / Custom App. Set the two volume paths and PUID/PGID from
the table above.

---

## Getting into the app stores

| Store | Status | What's needed |
|---|---|---|
| UGREEN App Center | UPK builds in-repo | Developer account + `ugdev.sig`, sideload test, submit at developer.ugnas.com |
| Synology Package Center | SPK builds in-repo | Sideload test on DSM 7.2.1+; apply to Synology's third-party developer program for listing |
| Unraid Community Applications | Template in-repo | Submit a template repo through the CA app-submission form |
| CasaOS App Store | App file in-repo | PR to `IceWhaleTech/CasaOS-AppStore` (`Apps/KDOVideoTagger/docker-compose.yml` + icon + screenshots) |
| TrueNAS Apps | not yet | PR to `truenas/apps` (catalog format) |
| Portainer / Umbrel | not yet | template JSON / umbrelOS app manifest |
