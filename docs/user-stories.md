# KDO Video Tagger - User Stories

## Overview

This document describes the key user workflows and what needs to be built to support them.

---

## Story 1: Installation

**Actor:** New user (NAS owner or video editor)

### NAS Installation

1. User has a UGREEN NAS (DXP4800 Plus or similar)
2. User has Docker installed via UGREEN App Center
3. User installs Dockhand from the Docker app catalog
4. User configures Dockhand to connect to GitHub Container Registry
5. User deploys kdo-vtg via Dockhand's stack editor
6. User mounts their video folder(s) to `/media` in the container
7. User accesses the web UI at `http://<nas-ip>:8080`

**Requirements:**
- Docker container builds successfully
- Dockhand deployment works
- Volume mount paths are configurable
- Health check passes

### PC/Mac Installation (Docker Desktop)

1. User installs Docker Desktop
2. User pulls the image: `docker pull ghcr.io/omrik/kdo-vtg:latest`
3. User runs container with local video mount:
   ```bash
   docker run -d -p 8080:8000 \
     -v ~/Movies:/media:ro \
     -v kdo-vtg-config:/app/config \
     ghcr.io/omrik/kdo-vtg:latest
   ```
4. User accesses the web UI at `http://localhost:8080`

**Requirements:**
- Image works on linux/amd64
- Clear documentation for volume mounts
- Works with Docker Desktop on Mac

---

## Story 2: First Run & Setup

**Actor:** New user, first time accessing the app

### Flow

1. User opens the app for the first time
2. **System prompts for admin account creation** (first run only)
3. User creates admin username/password
4. User sets up media folder path
5. User is redirected to main dashboard
6. User can browse folders and start scanning

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| First-run detection | ❌ | Need to check if admin exists |
| Admin creation flow | ❌ | Show modal on first run |
| Media path configuration | ❌ | Add to settings |
| Redirect to dashboard | ❌ | After setup |

**Required Work:**
- [ ] Add `/api/auth/setup-complete` endpoint to check if admin exists
- [ ] Show setup wizard if no users exist
- [ ] Create admin user during setup
- [ ] Add media path setting
- [ ] Store settings in database/config

---

## Story 3: Video Editor Usage

**Actor:** Video editor who wants to catalog footage before editing

### Flow

1. User logs in
2. User browses to folder containing project footage
3. User clicks "Scan" with YOLO enabled
4. System extracts metadata and runs object detection
5. User views results in table/grid
6. User filters by resolution, duration, detected objects
7. User creates a "Project" for this edit
8. User adds clips to the project
9. User exports shot list for reference

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| Login | ✅ | Working |
| Browse folders | ✅ | Working |
| Scan with metadata | ✅ | Working |
| Scan with YOLO | ✅ | Working |
| View results | ✅ | Working (table) |
| Filter videos | ❌ | Need advanced filters |
| Create Project | ✅ | Backend ready, UI partial |
| Add clips to project | ❌ | Need UI for this |
| Export shot list | ✅ | CSV works |

**Required Work:**
- [ ] Advanced filter UI (resolution, duration, camera, objects)
- [ ] Project management UI improvements
- [ ] Add/remove videos from project
- [ ] Notes per video in project
- [ ] PDF shot list export

---

## Story 4: Export & External Software

**Actor:** Video editor who wants to use catalog in Premiere/DaVinci Resolve

### Flow

1. User has scanned and tagged videos
2. User selects videos for export
3. User clicks "Export"
4. System generates CSV/Excel with metadata
5. User opens in spreadsheet to plan edit
6. User imports EDL or references file paths in NLE

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| Select videos | ❌ | Need multi-select |
| CSV export | ✅ | Working |
| Excel export | ✅ | Working |
| EDL export | ❌ | Not implemented |
| FCP XML export | ❌ | Not implemented |
| File path list | ❌ | Not implemented |

**Required Work:**
- [ ] Multi-select UI for videos
- [ ] EDL (Edit Decision List) export
- [ ] CSV with custom columns selection
- [ ] File path list export (for logging)

---

## Story 5: Troubleshooting

**Actor:** User encountering issues

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| No videos found | Empty folder list | Check `/media` mount path |
| Scan stuck | Progress not updating | Cancel and restart scan |
| YOLO fails | Out of memory | Use smaller model or disable |
| Login broken | Can't authenticate | Check JWT_SECRET env var |
| Database corrupted | App won't start | Delete config folder |
| Slow response | High CPU usage | Disable YOLO, limit concurrent scans |

### Implementation Status

| Item | Status | Notes |
|------|--------|-------|
| Health check endpoint | ✅ | `/api/health` |
| Error messages | Partial | Need better error UI |
| Log viewer | ❌ | Add in-app logs |
| Settings page | ✅ | Basic settings exist |

**Required Work:**
- [ ] Comprehensive error messages in UI
- [ ] In-app log viewer
- [ ] Clear troubleshooting guide
- [ ] Docker log access instructions

---

## User Personas

### Persona 1: NAS Owner
- Has a UGREEN NAS with terabytes of video
- Wants to organize and find footage quickly
- Uses the app occasionally for cataloging
- **Primary workflow:** Browse → Scan → Export

### Persona 2: Video Editor
- Works on Mac/PC with local video files
- Planning a new edit, needs to catalog B-roll
- Uses the app to plan before opening Premiere
- **Primary workflow:** Import → Tag → Filter → Export shot list

### Persona 3: Content Creator
- Has multiple cameras (DJI, GoPro, iPhone)
- Needs to sort footage by camera/date
- Wants quick overview of what they have
- **Primary workflow:** Scan all → Filter by camera → Browse results

---

## MVP Checklist

Before first release:

- [ ] First-run setup wizard
- [ ] User authentication (login/register)
- [ ] Media path configuration
- [ ] Folder browsing
- [ ] Video scanning (metadata + YOLO)
- [ ] Results view
- [ ] Basic export (CSV)
- [ ] Installation documentation
- [ ] Troubleshooting guide
