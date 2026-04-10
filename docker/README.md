# KDO Video Tagger Docker

## Quick Setup for UGREEN NAS

### Using Portainer

1. Install **Portainer** on your UGREEN NAS via the App Center
2. Create the following folder structure in your Docker shared folder:
   ```
   /volume1/docker/kdo-vtg/
   ├── config/
   └── media/ (mount your video folders here)
   ```

3. In Portainer, go to **Stacks** → **Add stack**
4. Name it `kdo-vtg`
5. Paste the docker-compose.yml content below
6. Update `PUID` and `PGID` values (find them using `id` command via SSH)
7. Click **Deploy the stack**

### Direct SSH Setup

```bash
# SSH into your NAS
ssh user@your-nas-ip

# Create directories
mkdir -p /volume1/docker/kdo-vtg/config
mkdir -p /volume1/docker/kdo-vtg/media

# Navigate to the folder
cd /volume1/docker/kdo-vtg

# Create docker-compose.yml (or copy from this repo)
# Then run:
sudo docker compose up -d
```

## Accessing the App

Open your browser and navigate to: `http://your-nas-ip:8080`
