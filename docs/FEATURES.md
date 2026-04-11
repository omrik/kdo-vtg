# KDO Video Tagger - Feature Roadmap

## Current Features (Working)

| Feature | Status | Description |
|---------|--------|-------------|
| Folder Navigation | ✅ | Browse NAS folders via web UI |
| Metadata Extraction | ✅ | Resolution, FPS, duration, codec, file size |
| Camera Detection | ✅ | Detects DJI, GoPro, iPhone, Insta360 from filename/encoder |
| Date Extraction | ✅ | Parses dates from filenames |
| YOLO Object Detection | ✅ | Optional, toggleable, multiple models |
| Scan Progress | ✅ | Real-time progress with cancel |
| Export | ✅ | CSV and Excel download |
| Stats Dashboard | ✅ | Total videos, duration, resolutions, cameras |

---

## Potential Features to Add

### Metadata & Analysis
- [ ] Thumbnail generation
- [ ] Scene cut detection
- [ ] Color palette/average color extraction
- [ ] Audio track analysis (bitrate, channels, codec)
- [ ] GPS location from video metadata
- [ ] Video quality score (bitrate vs resolution)
- [ ] Duplicate detection (hash comparison)

### Organization
- [ ] Custom tags (user-defined)
- [ ] Collections/projects (group videos)
- [ ] Favorites/rating system
- [ ] Smart folders (saved filters)
- [ ] Batch tag editing
- [ ] Notes/comments per video

### Search & Filter
- [ ] Advanced filters (resolution, date range, duration, camera)
- [ ] Full-text search in filenames
- [ ] Filter by detected objects
- [ ] Combine multiple filters

### UI/UX
- [ ] Dark/light mode toggle
- [ ] Responsive mobile layout
- [ ] Grid vs list view toggle
- [ ] Bulk selection for actions
- [ ] Keyboard shortcuts

---

## Features for Video Editor Planning a Movie

### Pre-Production Research
| Feature | Value |
|---------|-------|
| Shot type analysis (WS/MS/CU/ECU) | Know what shots you have |
| Object detection tagging | Find "beach", "car", "sunset" scenes |
| Scene detection | Identify usable segments |
| Location grouping | Cluster by GPS or scene content |
| B-roll catalog | Find "cutaway" footage |

### Organization
| Feature | Value |
|---------|-------|
| Project/sequence folders | Group clips for scenes |
| Custom metadata fields | Add director notes, scene #, take # |
| Color tags | Mark for review, approved, rejected |
| Star rating | Quick quality assessment |
| Timeline markers | Mark in/out points |

### Analysis & Planning
| Feature | Value |
|---------|-------|
| Duration by camera | Plan shoot ratio |
| Coverage ratio (WS/MS/CU) | Identify coverage gaps |
| Time-of-day detection | Organize by lighting |
| Similar scene finder | Avoid duplicate setups |
| Total runtime calculator | Plan final edit length |

### Export & Integration
| Feature | Value |
|---------|-------|
| EDL/FCP XML export | Import to Premiere/DaVinci |
| Storyboard PDF | Pre-visualization |
| Shot list CSV | Share with crew |
| Project file export | Portable project backup |

---

## Recommended Priority (MVP for Video Editors)

### Phase 1 - Essential
1. Grid thumbnails (visual browsing)
2. Custom tags & notes
3. Advanced filters
4. Collections/projects

### Phase 2 - Valuable
5. Scene detection
6. Shot type analysis
7. Color palette extraction
8. Batch operations

### Phase 3 - Power Features
9. EDL/XML export
10. Duplicate detection
11. GPS timeline visualization
12. AI scene descriptions

---

## Competitor Analysis

### Similar Projects
- [MediaLyze](https://github.com/frederikemmer/MediaLyze) - Video metadata extraction with web UI
- [VideoDB](https://videodb.io/) - Cloud video organization platform
- [Jellyfin](https://jellyfin.org/) - Media server with metadata and thumbnails
- [Plex](https://www.plex.tv/) - Commercial media management
- [tinyMediaManager](https://www.tinymediamanager.org/) - Desktop media management

### Key Differentiators for KDO-VTG
1. **NAS-First**: Optimized for UGREEN NAS with Dockhand
2. **Video Editor Focus**: Shot analysis, EDL export, B-roll catalog
3. **Lightweight**: Single container, minimal dependencies
4. **Privacy**: Self-hosted, no cloud dependency
