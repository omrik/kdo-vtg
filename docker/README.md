# KDO Video Tagger Docker

## Installation on UGREEN NAS with Dockhand

### Prerequisites

1. Install **Docker** from UGREEN App Center
2. Install **Dockhand** for container management

### Install Dockhand (if not already installed)

1. Open **Docker** → **Project** → **Create**
2. Name: `dockhand`, Create folder: `dockhand`, Select → **Confirm**
3. Deploy this compose:

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

4. Access Dockhand at `http://your-nas-ip:3866`

### Add GitHub Registry

1. In Dockhand → **Settings** → **Registries**
2. Click **+ Add registry**
3. Name: `GitHub`, URL: `https://ghcr.io`
4. Click **+ Add**

### Deploy kdo-vtg

1. Go to **Stacks** → **+ Create**
2. Name: `kdo-vtg`
3. Create folder `/volume1/docker/kdo-vtg/` via Files app
4. Paste and deploy:

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
    restart: unless-stopped

volumes:
  kdo_vtg_config:
```

### Prepare Video Folder

1. Open **Files** app
2. Create folder `/volume1/media/`
3. Copy your video files there

### Access the App

Open `http://your-nas-ip:8080`

## Updating

Since Dockhand already has the GitHub registry configured, updates are automatic. To manually update:

1. In Dockhand → **Containers**
2. Find `kdo-vtg`
3. Click **Redeploy** or **Rebuild**
