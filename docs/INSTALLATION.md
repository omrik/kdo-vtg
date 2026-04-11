# KDO Video Tagger - Installation Guide

## Option 1: UGREEN NAS (Recommended for centralized storage)

### Prerequisites

- **Hardware:** UGREEN NASync DXP4800 Plus or similar NAS with Docker
- **Storage:** Videos stored on NAS volumes
- **Network:** NAS accessible on your local network

### Step 1: Install Dockhand

Dockhand is a Docker management UI for NAS systems.

1. Open **Docker** app on your UGREEN NAS
2. Go to **Project** → **Create**
3. Name: `dockhand`
4. Create folder: `dockhand`
5. Select → **Confirm**
6. Paste and deploy:

```yaml
services:
  dockhand:
    image: fnsys/dockhand:latest
    container_name: Dockhand
    ports:
      - 3866:3000
    volumes:
      - /volume1/docker/dockhand:/app/data:rw
      - /var/run/docker.sock:/var/run/docker.sock
    restart: always
```

7. Access Dockhand at `http://<your-nas-ip>:3866`

### Step 2: Add GitHub Container Registry

1. In Dockhand, go to **Settings** → **Registries**
2. Click **+ Add registry**
3. Name: `GitHub`
4. URL: `https://ghcr.io`
5. Click **+ Add**

### Step 3: Deploy kdo-vtg

1. Go to **Stacks** → **+ Create**
2. Name: `kdo-vtg`
3. Create folder `/volume1/docker/kdo-vtg/` via UGREEN Files app
4. Paste the compose:

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
      - TZ=Europe/Bucharest
      - PUID=1000
      - PGID=100
      - JWT_SECRET=your-secret-key-here
    restart: unless-stopped

volumes:
  kdo_vtg_config:
```

5. Click **Create & Start**
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
| Can't access Dockhand | Check port 3866 is not in use |
| kdo-vtg won't start | Check logs in Dockhand |
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

# Run with your Movies folder
docker run -d -p 8080:8000 \
  -v ~/Movies:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:latest

# Access at http://localhost:8080
```

### Custom Video Path

Replace `~/Movies` with your video folder:

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
| `JWT_SECRET` | Secret for JWT tokens | `change-this-in-production` |
| `DATABASE_URL` | SQLite database path | `sqlite:///./config/kdo-vtg.db` |
| `TZ` | Timezone | `UTC` |
| `PUID` | User ID (Linux) | `1000` |
| `PGID` | Group ID (Linux) | `100` |

### Set JWT Secret

**Important:** Change the JWT secret for production use!

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
