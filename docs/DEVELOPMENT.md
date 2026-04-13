# KDO Video Tagger - Development Plan

## Development Strategy

### Development Environment Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Local Development → GitHub → Container Registry → Target    │
│         ↓                                    ↓              │
│    localhost:8080                    NAS (Docker) or PC/Mac  │
│                                                             │
│  Testing:                                                   │
│  1. Local Dev (npm/uvicorn)                               │
│  2. Local Docker (PC/Mac/NAS)                             │
│  3. Dockhand UI (NAS production)                           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Testing Strategy

| Stage | Environment | When | Purpose |
|-------|-------------|------|---------|
| **1. Local Dev** | `localhost:8080` | Every commit | Fast iteration |
| **2. Local Docker** | Docker on PC/Mac | After each feature | Production-like test |
| **3. NAS Docker** | SSH to NAS | Daily/Before merge | Real hardware |
| **4. Dockhand** | NAS Dockhand UI | Before release | Production deployment |

---

## Deployment Options

### Option 1: NAS (Recommended for centralized storage)
- UGREEN NAS DXP4800 Plus or similar
- Run via Dockhand or Docker CLI
- Access videos from NAS storage

### Option 2: Local PC/Mac (For video editing workflow)
- Run as local Docker container
- Scan videos from local hard drives
- Perfect for Premiere Pro/DaVinci Resolve project prep

---

## Development Phases

### Phase 1: Foundation (Current)
- [x] Basic folder navigation
- [x] Metadata extraction (ffprobe)
- [x] YOLO object detection
- [x] Web UI (React)
- [x] Export (CSV/Excel)
- [x] Docker container
- [x] CI/CD pipeline
- [x] User authentication

### Phase 2: Video Editor Essentials
- [x] **Thumbnails** - Extract frame at 10% of video
- [x] **Grid view** - Visual browsing with thumbnails
- [x] **Custom tags** - User-defined tags per video
- [x] **Collections** - Group videos into projects
- [x] **Advanced filters** - Resolution, duration, date range

### Phase 3: Analysis Features
- [x] **Scene detection** - Identify shot boundaries
- [x] **Shot type analysis** - WS/MS/CU/ECU detection via YOLO
- [x] **Color palette** - Extract dominant colors
- [x] **GPS timeline** - Parse and visualize locations

### Phase 4: Production Features
- [x] **EDL export** - For Premiere/DaVinci Resolve
- [x] **Shot list generator** - PDF export
- [x] **Batch operations** - Bulk tag/edit
- [x] **Rating system** - Stars per video
- [x] **Duplicate detection** - Hash-based

---

## Local Development Workflow

### Prerequisites
```bash
# Install dependencies
cd backend && pip install -e .
cd frontend && npm install
```

### Run Locally (without Docker)
```bash
# Terminal 1: Backend
cd backend
uvicorn backend.main:app --reload --port 8000

# Terminal 2: Frontend (dev mode with proxy)
cd frontend
npm run dev
# Access at http://localhost:5173
```

---

## Docker Deployment

### Run with Docker (Local PC/Mac)

Perfect for scanning local video files for video editing projects:

```bash
# Build locally
docker build -t kdo-vtg:local .

# Run - mount your video folders
docker run -d -p 8080:8000 \
  -v /path/to/your/videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg-local \
  kdo-vtg:local

# Access at http://localhost:8080

# View logs
docker logs -f kdo-vtg-local

# Stop
docker stop kdo-vtg-local && docker rm kdo-vtg-local
```

### Run Pre-built Image (PC/Mac/NAS)

```bash
# Pull latest image
docker pull ghcr.io/omrik/kdo-vtg:main

# Run on PC/Mac
docker run -d -p 8080:8000 \
  -v /Users/yourname/Movies:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:main

# Access at http://localhost:8080
```

### Testing on NAS via SSH

```bash
# SSH to NAS
ssh user@<nas-ip>

# Pull latest image
docker pull ghcr.io/omrik/kdo-vtg:main

# Run with volume mounts (adjust path for your NAS)
docker run -d -p 8080:8000 \
  -v /volume1/media:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:main

# Check logs
docker logs -f kdo-vtg

# Cleanup
docker stop kdo-vtg && docker rm kdo-vtg
```

---

## Dockhand API Control

### Current Dockhand Status
Dockhand (v1.0.24) is primarily a **web UI** for Docker management. It has:
- ✅ Git integration for deployment
- ✅ Container management (start/stop/restart)
- ✅ Compose stack management
- ✅ File browser
- ✅ Webhooks for CI/CD triggers
- ❌ **No public REST API** for programmatic control

### Dockhand Capabilities
| Feature | Available | Notes |
|---------|-----------|-------|
| Git deploy | ✅ | Pull from GitHub |
| Container control | ✅ | Via web UI |
| Logs viewer | ✅ | Via web UI |
| File browser | ✅ | Via web UI |
| Webhooks | ✅ | Trigger on events |
| REST API | ❌ | Not available |

### Direct Docker Control via SSH

Since Dockhand doesn't have a REST API, control Docker directly via SSH:

```bash
# SSH and run commands on NAS
ssh user@<nas-ip> "docker ps"

# Redeploy container
ssh user@<nas-ip> "docker pull ghcr.io/omrik/kdo-vtg:main && \
  docker stop kdo-vtg || true && \
  docker rm kdo-vtg || true && \
  docker run -d -p 8080:8000 \
    -v /volume1/media:/media:ro \
    -v kdo-vtg-config:/app/config \
    --name kdo-vtg \
    ghcr.io/omrik/kdo-vtg:main"
```

### Recommended: Git-based Deploy via Dockhand

Dockhand supports **Git integration** for automatic deployments:

1. In Dockhand → Settings → Git
2. Connect GitHub repo
3. Enable auto-deploy on push

This way: `git push` → Dockhand auto-builds & deploys.

---

## CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Push to main/stage                                         │
│       ↓                                                    │
│  ┌─────────────────────────────────────┐                  │
│  │ 1. Build Frontend (npm)              │                  │
│  │ 2. Build Docker Image                 │                  │
│  │ 3. Push to ghcr.io                  │                  │
│  │ 4. Create image tags                 │                  │
│  └─────────────────────────────────────┘                  │
│       ↓                                                    │
│  Deploy via: Dockhand, SSH, or pull manually               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Testing Checklist

### Before Each Feature Merge
- [ ] Local Docker test passes
- [ ] Metadata extraction works (ffprobe)
- [ ] UI renders correctly
- [ ] Export functions work

### Before Release
- [ ] Test on NAS Docker (via SSH)
- [ ] Test via Dockhand deployment
- [ ] Check logs for errors
- [ ] Verify volume mounts work

### Performance Testing
- [ ] Scan 100+ videos without memory issues
- [ ] UI responsive with 1000+ videos in DB
- [ ] Export handles large datasets

---

## Quick Commands Reference

```bash
# --- Local Development ---
cd ~/Documents/kdo-vtg
npm run dev --prefix frontend  # Frontend dev
cd backend && uvicorn main:app --reload  # Backend dev

# --- Local Docker (PC/Mac) ---
docker build -t kdo-vtg:dev .
docker run -p 8080:8000 -v ~/Movies:/media:ro kdo-vtg:dev

# --- NAS SSH Commands ---
ssh user@<nas-ip> "docker pull ghcr.io/omrik/kdo-vtg:main"
ssh user@<nas-ip> "docker logs kdo-vtg --tail 100"

# --- Git Workflow ---
git checkout -b feature/new-feature
git add . && git commit -m 'feat: description'
git push origin feature/new-feature
# Create PR → Merge to main → CI builds → Deploy
```
