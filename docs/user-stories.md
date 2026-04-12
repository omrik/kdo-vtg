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
4. User is redirected to main dashboard
5. User can browse folders and start scanning

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| First-run detection | ✅ | `/api/auth/setup-status` returns needs_setup |
| Admin creation flow | ✅ | Shows modal on first run |
| Media path configuration | ✅ | Hardcoded to /media |

---

## Story 3: Video Editor Usage

**Actor:** Video editor who wants to catalog footage before editing

### Flow

1. User logs in
2. User browses to folder containing project footage
3. User clicks "Scan" with YOLO enabled
4. System extracts metadata and runs object detection
5. User views results in grid or table view
6. User filters by resolution, duration, camera, tags
7. User creates a "Project" for this edit
8. User adds clips to the project
9. User exports shot list for reference

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| Login | ✅ | Working |
| Browse folders | ✅ | Working with navigation UX |
| Scan with metadata | ✅ | Working |
| Scan with YOLO | ✅ | Working (ultralytics) |
| View results | ✅ | Grid and table views |
| Filter videos | ✅ | Resolution, duration, camera, tag |
| Create Project | ✅ | Working |
| Add clips to project | ✅ | Working |
| Export shot list | ✅ | CSV and Excel export |

---

## Story 4: Export & External Software

**Actor:** Video editor who wants to use catalog in Premiere/DaVinci Resolve

### Flow

1. User has scanned and tagged videos
2. User selects videos for export
3. User clicks "Export"
4. System generates CSV/Excel with metadata
5. User opens in spreadsheet to plan edit

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| Select videos | ✅ | Multi-select with checkboxes |
| CSV export | ✅ | Working |
| Excel export | ✅ | Working |
| Export all or selected | ✅ | Export buttons always visible |

---

## Story 5: Organization with Collections

**Actor:** User who wants to organize videos by category

### Flow

1. User scans videos with tags (via YOLO or manual)
2. User clicks "By Tag" to auto-create collections
3. Each unique tag becomes a collection
4. Videos with that tag are automatically added
5. User can manually add/remove videos from collections

### Implementation Status

| Step | Status | Notes |
|------|--------|-------|
| Auto-create collections by tag | ✅ | POST /api/settings/auto-create-collections-by-tag |
| Manual collection creation | ✅ | Working |
| Add videos to collection | ✅ | Working |
| View collection videos | ✅ | Grid/list toggle |

---

## Story 6: Troubleshooting

**Actor:** User encountering issues

### Common Issues

| Issue | Symptoms | Solution |
|-------|----------|----------|
| No videos found | Empty folder list | Check `/media` mount path |
| Scan stuck | Progress not updating | Cancel and restart scan |
| YOLO fails | Out of memory | Use smaller model or disable |
| Login broken | Can't authenticate | Check JWT_SECRET env var |
| Database error | "no such column" | Reset database or Settings > Reset |
| Slow response | High CPU usage | Disable YOLO, limit concurrent scans |

### Implementation Status

| Item | Status | Notes |
|------|--------|-------|
| Health check endpoint | ✅ | `/api/health` |
| Error messages | ✅ | Better error handling in UI |
| Database export | ✅ | Settings > Export |
| Database import | ✅ | Settings > Import |
| Database reset | ✅ | Settings > Reset |
| Database migration | ✅ | Auto-adds missing columns |

---

## User Personas

### Persona 1: NAS Owner
- Has a UGREEN NAS with terabytes of video
- Wants to organize and find footage quickly
- Uses the app occasionally for cataloging
- **Primary workflow:** Browse → Scan → Filter → Export

### Persona 2: Video Editor
- Works on Mac/PC with local video files
- Planning a new edit, needs to catalog B-roll
- Uses the app to plan before opening Premiere
- **Primary workflow:** Browse → Scan (YOLO) → Tag → Filter → Export

### Persona 3: Content Creator
- Has multiple cameras (DJI, GoPro, iPhone)
- Needs to sort footage by camera/date
- Wants quick overview of what they have
- **Primary workflow:** Scan all → Filter by camera → Browse results

---

## MVP Checklist

Before first release:

- [x] First-run setup wizard
- [x] User authentication (login/register)
- [x] Folder browsing
- [x] Video scanning (metadata + YOLO)
- [x] Thumbnails
- [x] Results view (grid/table)
- [x] Advanced filters (resolution, duration, camera, tag)
- [x] Video tagging
- [x] Collections (manual + auto-create by tag)
- [x] Projects
- [x] Multi-select videos
- [x] Export (CSV/Excel)
- [x] Database management (export/import/reset)
- [x] Installation documentation
- [x] Troubleshooting info in docs

---

## Feature Summary

### Core Features
| Feature | Status | Notes |
|---------|--------|-------|
| JWT Authentication | ✅ | First user becomes admin |
| Folder Navigation | ✅ | Breadcrumb navigation |
| Video Scanning | ✅ | ffprobe metadata extraction |
| YOLO Detection | ✅ | Object detection on videos |
| Thumbnails | ✅ | Auto-extract at 10% duration |
| Database Migration | ✅ | Auto-adds missing columns |

### UI Features
| Feature | Status | Notes |
|---------|--------|-------|
| Grid/List Toggle | ✅ | Results, Collections, Projects |
| Multi-select | ✅ | Checkbox selection |
| Filters | ✅ | Resolution, camera, duration, tag |
| Tags UI | ✅ | Add/remove per video |
| Scan Progress | ✅ | Real-time progress bar |

### Data Management
| Feature | Status | Notes |
|---------|--------|-------|
| Collections | ✅ | Create, view, auto-create by tag |
| Projects | ✅ | Create, view, add videos |
| CSV Export | ✅ | All or selected videos |
| Excel Export | ✅ | All or selected videos |
| Database Backup | ✅ | Export to file |
| Database Restore | ✅ | Import from file |
| Database Reset | ✅ | Clear all data |

---

## Changelog

### v0.2.0 (Current - Stage Branch)
- Added thumbnails for videos
- Added grid/list view toggle
- Added advanced filters (resolution, camera, duration, tag)
- Added video tagging API and UI
- Added auto-create collections by tag
- Added database management (export/import/reset)
- Added multi-select for videos
- Added export buttons (always visible)
- Fixed folder navigation UX
- Fixed YOLO scanning (added ultralytics)
- Fixed thumbnail auth (removed for img tags)
- Fixed database migration
- Fixed add to collection/project UX

### v0.1.0
- Initial release
- Basic authentication
- Folder browsing
- Video scanning
- CSV/Excel export
