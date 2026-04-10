# KDO Video Tagger Docker

## Quick Setup for UGREEN NAS

This guide uses **Dockhand**, a modern Docker management platform for UGREEN NAS.

### Using Dockhand (Recommended)

1. Install **Docker** from UGREEN App Center

2. Open **Docker** app → **Project** → **Create**
   - Name: `kdo-vtg`
   - Create folder: `kdo-vtg`
   - Select the folder → **Confirm**

3. Paste the compose configuration and **Deploy**:

```yaml
services:
  kdo-vtg:
    build: .
    container_name: kdo-vtg
    ports:
      - "8080:8000"
    volumes:
      - ./config:/app/config:rw
      - /volume1/media:/media:ro
    environment:
      - TZ=Europe/Bucharest
      - PUID=1000
      - PGID=100
    restart: unless-stopped
```

4. Create the folders via **Files** app:
   ```
   /volume1/docker/kdo-vtg/config/
   ```

5. Access the app at: `http://your-nas-ip:8080`

### Direct SSH Setup

```bash
# SSH into your NAS
ssh user@your-nas-ip

# Create directories
mkdir -p /volume1/docker/kdo-vtg/config

# Navigate to the folder
cd /volume1/docker/kdo-vtg

# Clone and run
git clone https://github.com/omrik/kdo-vtg.git .
docker compose up -d
```

## Adding to Dockhand (After Initial Setup)

If you already have Dockhand installed:

1. Open **Dockhand** at `http://your-nas-ip:3866`
2. Go to **Stacks** → **+ Create**
3. Name: `kdo-vtg`
4. Create folder `kdo-vtg` in Files app
5. Paste the compose and click **Create & Start**

## Accessing the App

Open your browser: `http://your-nas-ip:8080`
