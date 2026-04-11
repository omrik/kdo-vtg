# KDO Video Tagger - Development Plan

## Development Strategy

### Development Environment Setup

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Local Development → GitHub → Docker Hub → NAS (Dockhand)   │
│         ↓                                    ↓              │
│    localhost:8080                         kedemstorage:8080 │
│                                                             │
│  Testing:                                                   │
│  1. Local Docker (this machine)                           │
│  2. NAS Docker via SSH (fallback)                         │
│  3. Dockhand UI (production-like)                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Testing Strategy

| Stage | Environment | When | Purpose |
|-------|-------------|------|---------|
| **1. Local Dev** | `localhost:8080` | Every commit | Fast iteration |
| **2. Local Docker** | Docker on Mac | After each feature | Production-like test |
| **3. NAS Docker** | SSH to NAS | Daily/Before merge | Real hardware |
| **4. Dockhand** | `kedemstorage:3866` | Before release | Production deployment |

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

### Phase 2: Video Editor Essentials
- [ ] **Thumbnails** - Extract frame at 10% of video
- [ ] **Grid view** - Visual browsing with thumbnails
- [ ] **Custom tags** - User-defined tags per video
- [ ] **Collections** - Group videos into projects
- [ ] **Advanced filters** - Resolution, duration, date range

### Phase 3: Analysis Features
- [ ] **Scene detection** - Identify shot boundaries
- [ ] **Shot type analysis** - WS/MS/CU/ECU detection via YOLO
- [ ] **Color palette** - Extract dominant colors
- [ ] **GPS timeline** - Parse and visualize locations

### Phase 4: Production Features
- [ ] **EDL export** - For Premiere/DaVinci Resolve
- [ ] **Shot list generator** - PDF export
- [ ] **Batch operations** - Bulk tag/edit
- [ ] **Rating system** - Stars per video
- [ ] **Duplicate detection** - Hash-based

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

### Run with Docker (Local)
```bash
# Build locally
docker build -t kdo-vtg:local .

# Run with volume mounts
docker run -d -p 8080:8000 \
  -v /path/to/videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg-local \
  kdo-vtg:local

# View logs
docker logs -f kdo-vtg-local

# Stop
docker stop kdo-vtg-local && docker rm kdo-vtg-local
```

### Testing on NAS via SSH

```bash
# SSH to NAS
ssh user@kedemstorage

# Pull latest image
docker pull ghcr.io/omrik/kdo-vtg:main

# Run with volume mounts
docker run -d -p 8081:8000 \
  -v /volume1/media:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg-test \
  ghcr.io/omrik/kdo-vtg:main

# Check logs
docker logs -f kdo-vtg-test

# Access at http://kedemstorage:8081

# Cleanup
docker stop kdo-vtg-test && docker rm kdo-vtg-test
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
ssh user@kedemstorage "docker ps"

# Redeploy container
ssh user@kedemstorage "docker pull ghcr.io/omrik/kdo-vtg:main && \
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

### Alternative: Webhook-based CI/CD

Use GitHub Actions + SSH to deploy:

```yaml
# In .github/workflows/deploy.yml
- name: Deploy to NAS
  run: |
    ssh user@kedemstorage "docker pull ghcr.io/omrik/kdo-vtg:main && \
      docker stop kdo-vtg && docker rm kdo-vtg && \
      docker run -d -p 8080:8000 \
        -v /volume1/media:/media:ro \
        -v kdo-vtg-config:/app/config \
        --name kdo-vtg ghcr.io/omrik/kdo-vtg:main"
```

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
│  Manual trigger: Redeploy on NAS                            │
│  (via SSH or Dockhand UI)                                 │
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

# --- Local Docker ---
docker build -t kdo-vtg:dev .
docker run -p 8080:8000 -v ~/Movies:/media:ro kdo-vtg:dev

# --- NAS SSH Commands ---
ssh user@kedemstorage "docker pull ghcr.io/omrik/kdo-vtg:main"
ssh user@kedemstorage "docker logs kdo-vtg --tail 100"

# --- Git Workflow ---
git checkout -b feature/new-feature
git add . && git commit -m 'feat: description'
git push origin feature/new-feature
# Create PR → Merge to main → CI builds → Deploy
```
