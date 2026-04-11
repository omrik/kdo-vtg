# KDO Video Tagger (kdo-vtg)

**KDO Video Tagger** - A self-hosted video metadata tagger with web UI for NAS and local Docker. Extracts technical metadata using ffprobe and optionally detects objects using YOLOv8.

## Features

- **Web UI** - Modern React interface for browsing, scanning, and managing videos
- **Metadata Extraction** - Resolution, duration, FPS, codec, bitrate, camera type, date
- **Object Detection** - Optional YOLOv8 tagging (toggleable for performance)
- **Folder Browsing** - Navigate video folders directly from the UI
- **Progress Tracking** - Real-time scan progress with cancel support
- **Export** - Download results as CSV or Excel files
- **User Authentication** - Secure login for multi-user environments
- **NAS & Docker Desktop** - Works on UGREEN NAS or local PC/Mac

## Quick Start

### NAS Installation

See [docs/INSTALLATION.md](docs/INSTALLATION.md#option-1-ugreen-nas-recommended-for-centralized-storage)

### Local PC/Mac

```bash
docker pull ghcr.io/omrik/kdo-vtg:latest
docker run -d -p 8080:8000 \
  -v ~/Movies:/media:ro \
  -v kdo-vtg-config:/app/config \
  ghcr.io/omrik/kdo-vtg:latest
```

Access at `http://localhost:8080`

## Documentation

- [Installation Guide](docs/INSTALLATION.md) - NAS and PC/Mac setup
- [User Stories](docs/user-stories.md) - Workflow documentation
- [Development Guide](docs/DEVELOPMENT.md) - For contributors
- [Feature Roadmap](docs/FEATURES.md) - Planned features

## Usage

1. **Login** - Create account on first run
2. **Browse** - Navigate to your video folder
3. **Scan** - Extract metadata (enable YOLO for object detection)
4. **Review** - Browse scanned videos with all metadata
5. **Export** - Download CSV or Excel for your editing software

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `JWT_SECRET` | Secret for JWT tokens | Required for production |
| `DATABASE_URL` | SQLite database path | `sqlite:///./config/kdo-vtg.db` |
| `TZ` | Timezone | `UTC` |

### YOLO Model Options

| Model | Speed | Accuracy | RAM Usage |
|-------|-------|----------|-----------|
| `yolov8n.pt` | Fastest | Good | ~1GB |
| `yolov8s.pt` | Fast | Better | ~2GB |
| `yolov8m.pt` | Medium | Great | ~4GB |

## Tech Stack

- **Backend**: Python, FastAPI, SQLAlchemy, SQLite
- **Frontend**: React, TypeScript, Vite
- **Metadata**: FFprobe (FFmpeg)
- **Object Detection**: Ultralytics YOLOv8
- **Deployment**: Docker

## License

MIT License - See [LICENSE](LICENSE)
