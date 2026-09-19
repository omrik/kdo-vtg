# KDO Video Tagger - Installation Guide

## One-command installer (Linux / macOS)

```bash
curl -fsSL -o install.sh https://raw.githubusercontent.com/omrik/kdo-vtg/main/install.sh
MEDIA_PATH=/path/to/your/videos bash install.sh
```

Mounts your footage read-only at `/media`, stores config in `./kdo-data`, and exposes
the UI on port `8080`. Override with `PORT=9000`, `CONFIG_DIR=...`, or
`GEMINI_API_KEY=...` before running. Prefer the manual paths below for NAS systems.

---

## Option 1: UGREEN NAS (Recommended for centralized storage)

### Prerequisites

- **Hardware:** UGREEN NASync DXP4800 Plus or similar NAS with Docker
- **Storage:** Videos stored on NAS volumes
- **Network:** NAS accessible on your local network

### Step 1: Deploy kdo-vtg with the built-in Docker app

UGOS Pro ships a Docker app with a Compose editor — no extra management UI needed.

1. Open **App Center** and install the **Docker** app (if not already installed)
2. Open **Docker** → **Project** → **Create**
3. Name: `kdo-vtg`
4. Create folder `/volume1/docker/kdo-vtg/` via the UGREEN Files app
5. Paste the compose, then **Create & Start**:

```yaml
services:
  kdo-vtg:
    image: ghcr.io/omrik/kdo-vtg:latest
    container_name: kdo-vtg
    ports:
      - "8080:8000"
    volumes:
      - kdo_vtg_config:/app/config
      - /volume1/media:/media:ro
    environment:
      - TZ=UTC
      - PUID=1000
      - PGID=100
    restart: unless-stopped

volumes:
  kdo_vtg_config:
```

> `JWT_SECRET` is optional — if unset, the app generates and persists a random
> signing secret on first start. `GEMINI_API_KEY` is only needed for AI chapter
> generation (see the [Usage Guide](USAGE.md)).

6. Access at `http://<your-nas-ip>:8080`

### Step 4: Mount Your Videos

Your videos must be accessible at `/media` inside the container:

**Option A: Create a media folder**
1. Open UGREEN Files app
2. Create `/volume1/media/`
3. Copy or move videos there

**Option B: Mount existing folder**
Change the volume mount in the compose:
```yaml
volumes:
  - /volume1/YourVideos:/media:ro
```

### Troubleshooting NAS Installation

| Problem | Solution |
|---------|----------|
| kdo-vtg won't start | Open Docker → Project → check kdo-vtg logs |
| Port 8080 already in use | Change to `"8081:8000"` in the compose |
| No folders showing | Verify volume mount path exists |
| "Out of memory" during scan | Disable YOLO or use smaller model |

---

## Option 2: Local PC/Mac (Docker Desktop)

### Prerequisites

- **Docker Desktop** installed ([download for Mac](https://www.docker.com/products/docker-desktop/) | [Windows](https://www.docker.com/products/docker-desktop/))
- **4GB RAM minimum** (8GB recommended)
- Videos stored locally

### Quick Start

```bash
# Pull the image
docker pull ghcr.io/omrik/kdo-vtg:latest

# Run with your video folder
docker run -d -p 8080:8000 \
  -v /path/to/your/videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:latest

# Access at http://localhost:8080
```

### Custom Video Path

Replace `/path/to/your/videos` with your video folder:

```bash
# Example for Windows
docker run -d -p 8080:8000 \
  -v C:\Users\YourName\Videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:latest
```

### Managing the Container

```bash
# View logs
docker logs -f kdo-vtg

# Stop
docker stop kdo-vtg

# Start
docker start kdo-vtg

# Remove
docker stop kdo-vtg && docker rm kdo-vtg

# Update to latest version
docker pull ghcr.io/omrik/kdo-vtg:latest
docker stop kdo-vtg && docker rm kdo-vtg
# Then run the docker run command again
```

### Troubleshooting Docker Desktop

| Problem | Solution |
|---------|----------|
| Port 8080 in use | Change to `-p 8081:8000` |
| Videos not showing | Check volume mount path |
| Container won't start | Run `docker logs kdo-vtg` |
| Slow performance | Move videos to SSD |

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT tokens (random, persisted secret generated if unset) | *(auto-generated)* |
| `DATABASE_URL` | SQLite database path | `sqlite:///./config/kdo-vtg.db` |
| `TZ` | Timezone | `UTC` |
| `PUID` | User ID (Linux) | `1000` |
| `PGID` | Group ID (Linux) | `100` |
| `GEMINI_API_KEY` | Optional key for AI chapter generation | *(unset)* |

### Set JWT Secret (optional)

By default the app generates and persists a random signing secret on first start.
You can pin your own for multi-instance or backup-restore scenarios:

```yaml
environment:
  - JWT_SECRET=your-super-secret-key-here-min-32-chars
```

---

## File Structure

The app stores data in:
- `/app/config/` - SQLite database and settings
- `/app/media/` - Mount point for videos (read-only)

Data persists in the `kdo_vtg_config` Docker volume.

To backup:
```bash
docker run --rm -v kdo-vtg-config:/data -v $(pwd):/backup alpine tar czf /backup/kdo-vtg-backup.tar.gz -C /data .
```

---

## Network Access

### From Local Network
Access from any device on your network: `http://<host-ip>:8080`

### From Internet (Optional)
For remote access, consider:
- VPN (recommended for security)
- Reverse proxy with authentication
- Tailscale/Cloudflare Tunnel

**Warning:** Don't expose the app without authentication!
