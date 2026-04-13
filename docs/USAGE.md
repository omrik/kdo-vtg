# KDO Video Tagger - Usage Guide

## Overview

KDO Video Tagger is a self-hosted video metadata tagger for organizing video projects. It runs as a Docker container and provides a web UI for scanning, tagging, and managing video files.

## Features

- **Video Scanning**: Extract metadata (resolution, duration, FPS, codec, bitrate) using ffprobe
- **Object Detection**: YOLO-based detection for identifying objects in videos
- **Scene Detection**: Automatically detect shot boundaries
- **Shot Type Analysis**: Classify shots as Wide (WS), Medium (MS), Close-Up (CU), or Extreme Close-Up (ECU)
- **Color Palette**: Extract dominant colors from videos
- **GPS Location**: Read GPS coordinates from video metadata
- **Star Ratings**: Rate videos 1-5 stars
- **Custom Tags**: Add and manage tags per video
- **Collections**: Group videos into collections
- **Projects**: Organize videos into editing projects
- **Duplicate Detection**: Find potential duplicate videos
- **Export**: CSV, Excel, EDL (Premiere/DaVinci), and PDF shot lists

## Getting Started

### Installation

#### Docker (Local/Mac/PC)

```bash
# Pull the image
docker pull ghcr.io/omrik/kdo-vtg:main

# Run with your video folder mounted
docker run -d -p 8080:8000 \
  -v /path/to/your/videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  ghcr.io/omrik/kdo-vtg:main

# Access at http://localhost:8080
```

#### NAS (Docker)

```bash
docker run -d -p 8080:8000 \
  -v /path/to/videos:/media:ro \
  -v kdo-vtg-config:/app/config \
  --name kdo-vtg \
  ghcr.io/omrik/kdo-vtg:main
```

### First Run

1. Open http://localhost:8080 (or your NAS IP)
2. Create your admin account
3. Start browsing and scanning videos

## User Guide

### Browsing Videos

1. Go to the **Folders** tab
2. Navigate through your media folders
3. Select a folder to view its contents

### Scanning Videos

1. Navigate to a folder in the Folders tab
2. Click **Scan This Folder**
3. Configure scan options:
   - **Enable Object Detection (YOLO)**: Detect objects in videos
   - **Enable Scene Detection**: Find shot boundaries
   - **Enable Shot Type Analysis**: Classify shot types (requires YOLO)
   - **Enable Color Palette Extraction**: Extract dominant colors
   - **Sample Interval**: Seconds between YOLO samples (default: 10)

### Viewing Results

1. Go to the **Results** tab
2. Switch between **Grid** and **List** views
3. Use filters to narrow down results:
   - Resolution
   - Camera type
   - Min/Max duration
   - Tags

### Video Details

Click on any video to open the details modal showing:
- Metadata (resolution, duration, FPS, camera)
- Star rating
- GPS coordinates (with link to Google Maps)
- Shot type breakdown (if analyzed)
- Color palette (if extracted)
- Detected scenes (if analyzed)
- Tags

### Organizing Videos

#### Collections
- Create collections to group videos by category
- Auto-create collections by tag
- Add/remove videos from collections

#### Projects
- Create projects for editing workflows
- Add videos to projects
- Track project status

### Batch Operations

1. Select multiple videos using checkboxes
2. Use batch actions:
   - Add to Collection
   - Add to Project
   - Add/Remove Tags
   - Delete

### Exporting

Available export formats:
- **CSV**: Spreadsheet format
- **Excel**: .xlsx with formatting
- **EDL**: CMX 3600 format for Premiere Pro/DaVinci Resolve
- **PDF**: Shot list document

### Finding Duplicates

1. Go to the **Duplicates** tab
2. Click **Find Duplicates**
3. Review potential duplicates
4. Delete unwanted copies

## Troubleshooting

### No videos found
- Check that your media folder is mounted correctly
- Verify the path in the container matches your video location

### YOLO not working
- YOLO requires significant memory
- Try increasing Docker memory limits
- Use a smaller sample interval

### Database errors
- Go to Settings > Reset to start fresh
- Or Settings > Import to restore a backup

## API

The application provides a REST API at `/api/`:

- `GET /api/folders` - List media folders
- `GET /api/videos` - List all videos
- `POST /api/scan` - Start a scan job
- `GET /api/collections` - List collections
- `POST /api/export/csv` - Export as CSV
- `POST /api/export/edl` - Export as EDL
- `POST /api/export/pdf` - Export as PDF

All endpoints require authentication (JWT Bearer token).

## Architecture

```
┌─────────────────────────────────────────┐
│              React Frontend              │
│           (Served by FastAPI)            │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│              FastAPI Backend            │
├─────────────────────────────────────────┤
│  Scanner (ffprobe, OpenCV, YOLO)       │
│  Auth (JWT)                            │
│  Database (SQLite)                     │
└─────────────────────────────────────────┘
```

## License

MIT License
