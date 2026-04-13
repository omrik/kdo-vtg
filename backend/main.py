import os
import datetime
from contextlib import asynccontextmanager
from typing import Optional, List
from pathlib import Path
from io import BytesIO

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel

from backend.database import (
    init_db, get_db, Video, ScanJob, Folder, Settings, 
    User, Collection, Project, collection_videos, project_videos
)
from backend.scanner import VideoScanner, cancel_scan
from backend.export import videos_to_csv, videos_to_excel, get_latest_scan
from backend.auth import (
    verify_password, get_password_hash, create_access_token,
    get_current_user
)


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    is_admin: bool

    class Config:
        from_attributes = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    os.makedirs("./config", exist_ok=True)
    init_db()
    yield


app = FastAPI(
    title="KDO Video Tagger",
    description="Video metadata tagger with YOLO object detection",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

static_path = Path(__file__).parent.parent / "static"
if static_path.exists():
    app.mount("/assets", StaticFiles(directory=str(static_path / "assets")), name="assets")


def get_version():
    version_file = Path(__file__).parent.parent / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "unknown"


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "kdo-vtg", "version": get_version()}


@app.get("/api/version")
def get_app_version():
    return {"version": get_version()}


@app.get("/")
async def root():
    index_path = Path(__file__).parent.parent / "static" / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return {"message": "KDO Video Tagger API"}


@app.get("/api/auth/setup-status")
def get_setup_status(db: Session = Depends(get_db)):
    user_count = db.query(User).count()
    return {
        "needs_setup": user_count == 0,
        "user_count": user_count
    }


@app.post("/api/auth/register")
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    user_count = db.query(User).count()
    
    if user_count > 0:
        raise HTTPException(status_code=403, detail="Registration is closed. Please login.")
    
    existing = db.query(User).filter(User.username == request.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    user = User(
        username=request.username,
        hashed_password=get_password_hash(request.password),
        is_active=True,
        is_admin=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin}
    }


@app.post("/api/auth/login")
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"sub": str(user.id)})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {"id": user.id, "username": user.username, "is_admin": user.is_admin}
    }


@app.get("/api/auth/me")
def get_me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "is_admin": user.is_admin}


class ScanRequest(BaseModel):
    folder_path: str
    yolo_enabled: bool = False
    sample_interval: int = 10
    model_name: str = "yolov8n.pt"
    scene_detection_enabled: bool = False
    shot_type_enabled: bool = False
    color_palette_enabled: bool = False


class VideoResponse(BaseModel):
    id: int
    filename: str
    filepath: str
    resolution: Optional[str]
    width: Optional[int]
    height: Optional[int]
    duration: Optional[float]
    fps: Optional[float]
    codec: Optional[str]
    bitrate: Optional[str]
    camera_type: Optional[str]
    date_created: Optional[str]
    file_size: Optional[int]
    tags: Optional[list]
    scenes: Optional[list]
    shot_types: Optional[dict]
    color_palette: Optional[list]
    gps_data: Optional[dict]
    rating: Optional[int]
    yolo_enabled: bool
    scene_detection_enabled: bool
    created_at: str

    class Config:
        from_attributes = True


class ScanJobResponse(BaseModel):
    id: int
    folder_path: str
    status: str
    total_files: int
    processed_files: int
    yolo_enabled: bool
    sample_interval: int
    started_at: Optional[str]
    completed_at: Optional[str]
    error_message: Optional[str]
    progress: float = 0.0

    class Config:
        from_attributes = True


class CollectionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: Optional[str] = "#58a6ff"


class CollectionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: str
    created_at: str

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    status: Optional[str] = "active"


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    status: str
    created_at: str

    class Config:
        from_attributes = True


def scan_task(db_url: str, scan_id: int, folder_path: str, yolo_enabled: bool, sample_interval: int, model_name: str, scene_detection_enabled: bool = False, shot_type_enabled: bool = False, color_palette_enabled: bool = False):
    from backend.database import SessionLocal
    
    db = SessionLocal()
    try:
        scan_job = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
        if scan_job:
            scanner = VideoScanner(
                db=db,
                scan_job=scan_job,
                yolo_enabled=yolo_enabled,
                sample_interval=sample_interval,
                model_name=model_name,
                scene_detection_enabled=scene_detection_enabled,
                shot_type_enabled=shot_type_enabled,
                color_palette_enabled=color_palette_enabled
            )
            scanner.scan_folder(folder_path)
    finally:
        db.close()


@app.get("/api/folders")
def list_folders(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    media_root: str = Query("/media", description="Root directory to scan")
):
    folders = []
    if os.path.exists(media_root):
        for item in os.listdir(media_root):
            item_path = os.path.join(media_root, item)
            if os.path.isdir(item_path):
                video_count = 0
                for root, _, files in os.walk(item_path):
                    video_count += sum(1 for f in files if f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv')))
                
                folders.append({
                    "name": item,
                    "path": item_path,
                    "video_count": video_count,
                })
    
    return {"folders": folders}


@app.get("/api/folders/{path:path}")
def get_folder_contents(
    path: str, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Folder not found")
    
    contents = []
    for item in os.listdir(path):
        item_path = os.path.join(path, item)
        is_dir = os.path.isdir(item_path)
        
        if is_dir:
            video_count = sum(1 for f in os.listdir(item_path) 
                            if f.lower().endswith(('.mp4', '.mov', '.avi', '.mkv')))
            contents.append({
                "name": item,
                "path": item_path,
                "type": "folder",
                "video_count": video_count,
            })
        elif item.lower().endswith(('.mp4', '.mov', '.avi', '.mkv', '.m4v')):
            size = os.path.getsize(item_path)
            contents.append({
                "name": item,
                "path": item_path,
                "type": "video",
                "size": size,
            })

    contents.sort(key=lambda x: (x["type"] == "folder", x["name"]))
    return {"contents": contents}


@app.post("/api/scan")
def start_scan(
    request: ScanRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not os.path.exists(request.folder_path):
        raise HTTPException(status_code=404, detail="Folder not found")
    
    folder = db.query(Folder).filter(Folder.path == request.folder_path).first()
    if not folder:
        folder = Folder(
            path=request.folder_path,
            name=os.path.basename(request.folder_path)
        )
        db.add(folder)
        db.commit()
        db.refresh(folder)
    
    scan_job = ScanJob(
        folder_path=request.folder_path,
        yolo_enabled=request.yolo_enabled,
        sample_interval=request.sample_interval,
        status="pending",
    )
    db.add(scan_job)
    db.commit()
    db.refresh(scan_job)
    
    background_tasks.add_task(
        scan_task,
        str(db.bind.url),
        scan_job.id,
        request.folder_path,
        request.yolo_enabled,
        request.sample_interval,
        request.model_name,
        request.scene_detection_enabled,
        request.shot_type_enabled,
        request.color_palette_enabled,
    )
    
    return {
        "scan_id": scan_job.id,
        "status": "started",
        "folder_path": request.folder_path,
    }


@app.get("/api/scan/{scan_id}")
def get_scan_status(
    scan_id: int, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    scan = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    progress = 0.0
    if scan.total_files > 0:
        progress = (scan.processed_files / scan.total_files) * 100
    
    return ScanJobResponse(
        id=scan.id,
        folder_path=scan.folder_path,
        status=scan.status,
        total_files=scan.total_files,
        processed_files=scan.processed_files,
        yolo_enabled=scan.yolo_enabled,
        sample_interval=scan.sample_interval,
        started_at=scan.started_at.isoformat() if scan.started_at else None,
        completed_at=scan.completed_at.isoformat() if scan.completed_at else None,
        error_message=scan.error_message,
        progress=progress,
    )


@app.post("/api/scan/{scan_id}/cancel")
def cancel_scan_job(
    scan_id: int, 
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user)
):
    scan = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    
    cancel_scan(scan_id)
    scan.status = "cancelled"
    db.commit()
    
    return {"status": "cancelled", "scan_id": scan_id}


@app.get("/api/videos")
def get_videos(
    folder_path: Optional[str] = None,
    resolution: Optional[str] = Query(None, description="Filter by resolution (e.g., 3840x2160)"),
    camera_type: Optional[str] = Query(None, description="Filter by camera type (e.g., DJI)"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    min_duration: Optional[float] = Query(None, description="Minimum duration in seconds"),
    max_duration: Optional[float] = Query(None, description="Maximum duration in seconds"),
    search: Optional[str] = Query(None, description="Search in filename"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Video)
    
    if folder_path:
        query = query.filter(Video.filepath.startswith(folder_path))
    
    if resolution:
        query = query.filter(Video.resolution == resolution)
    
    if camera_type:
        query = query.filter(Video.camera_type == camera_type)
    
    if min_duration is not None:
        query = query.filter(Video.duration >= min_duration)
    
    if max_duration is not None:
        query = query.filter(Video.duration <= max_duration)
    
    if search:
        query = query.filter(Video.filename.contains(search))
    
    videos = query.order_by(Video.created_at.desc()).all()
    
    if tag:
        videos = [v for v in videos if v.tags and tag in v.tags]
    
    return {
        "videos": [
            {
                "id": v.id,
                "filename": v.filename,
                "filepath": v.filepath,
                "resolution": v.resolution,
                "width": v.width,
                "height": v.height,
                "duration": v.duration,
                "fps": v.fps,
                "codec": v.codec,
                "bitrate": v.bitrate,
                "camera_type": v.camera_type,
                "date_created": v.date_created.isoformat() if v.date_created else None,
                "file_size": v.file_size,
                "tags": v.tags or [],
                "thumbnail": v.thumbnail,
                "yolo_enabled": v.yolo_enabled,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in videos
        ]
    }


@app.get("/api/thumbnails/{video_id}")
def get_thumbnail(
    video_id: int,
    db: Session = Depends(get_db),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not video.thumbnail or not os.path.exists(video.thumbnail):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    return FileResponse(video.thumbnail, media_type="image/jpeg")


class TagRequest(BaseModel):
    tag: str


@app.get("/api/videos/{video_id}/tags")
def get_video_tags(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {"tags": video.tags or []}


@app.post("/api/videos/{video_id}/tags")
def add_video_tag(
    video_id: int,
    request: TagRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    current_tags = video.tags or []
    tag = request.tag.strip()
    if tag and tag not in current_tags:
        video.tags = current_tags + [tag]
        db.commit()
        db.refresh(video)
    
    return {"tags": video.tags or []}


@app.delete("/api/videos/{video_id}/tags/{tag}")
def remove_video_tag(
    video_id: int,
    tag: str,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    current_tags = video.tags or []
    if tag in current_tags:
        new_tags = [t for t in current_tags if t != tag]
        video.tags = new_tags
        db.commit()
    
    return {"tags": video.tags}


class BatchTagRequest(BaseModel):
    video_ids: list[int]
    tag: str


class BatchDeleteRequest(BaseModel):
    video_ids: list[int]


@app.post("/api/videos/batch/add-tag")
def batch_add_tag(
    request: BatchTagRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    videos = db.query(Video).filter(Video.id.in_(request.video_ids)).all()
    updated = 0
    for video in videos:
        current_tags = video.tags or []
        if request.tag not in current_tags:
            video.tags = current_tags + [request.tag]
            updated += 1
    db.commit()
    return {"updated": updated, "tag": request.tag}


@app.post("/api/videos/batch/remove-tag")
def batch_remove_tag(
    request: BatchTagRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    videos = db.query(Video).filter(Video.id.in_(request.video_ids)).all()
    updated = 0
    for video in videos:
        current_tags = video.tags or []
        if request.tag in current_tags:
            video.tags = [t for t in current_tags if t != request.tag]
            updated += 1
    db.commit()
    return {"updated": updated, "tag": request.tag}


@app.post("/api/videos/batch/delete")
def batch_delete_videos(
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    videos = db.query(Video).filter(Video.id.in_(request.video_ids)).all()
    deleted = len(videos)
    for video in videos:
        db.delete(video)
    db.commit()
    return {"deleted": deleted}


@app.post("/api/videos/batch/add-to-collection")
def batch_add_to_collection(
    collection_id: int,
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    videos = db.query(Video).filter(Video.id.in_(request.video_ids)).all()
    added = 0
    for video in videos:
        if video not in collection.videos:
            collection.videos.append(video)
            added += 1
    collection.video_count = len(collection.videos)
    db.commit()
    return {"added": added, "collection_id": collection_id}


@app.post("/api/videos/batch/add-to-project")
def batch_add_to_project(
    project_id: int,
    request: BatchDeleteRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    videos = db.query(Video).filter(Video.id.in_(request.video_ids)).all()
    added = 0
    for video in videos:
        if video not in project.videos:
            project.videos.append(video)
            added += 1
    project.video_count = len(project.videos)
    db.commit()
    return {"added": added, "project_id": project_id}


@app.get("/api/videos/{video_id}/scenes")
def get_video_scenes(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    return {"scenes": video.scenes or [], "scene_detection_enabled": video.scene_detection_enabled}


@app.post("/api/videos/{video_id}/scenes")
def detect_video_scenes(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if not os.path.exists(video.filepath):
        raise HTTPException(status_code=404, detail="Video file not found")
    
    from backend.scanner import VideoScanner
    scanner = VideoScanner(db=db, scan_job=None, yolo_enabled=False)
    scenes = scanner.detect_scenes(video.filepath)
    
    video.scenes = scenes
    video.scene_detection_enabled = True
    db.commit()
    db.refresh(video)
    
    return {"scenes": scenes, "scene_detection_enabled": True}


class RatingRequest(BaseModel):
    rating: int


@app.post("/api/videos/{video_id}/rating")
def set_video_rating(
    video_id: int,
    request: RatingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    rating = max(0, min(5, request.rating))
    video.rating = rating
    db.commit()
    db.refresh(video)
    
    return {"rating": video.rating}


@app.delete("/api/videos/{video_id}/rating")
def delete_video_rating(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    video.rating = None
    db.commit()
    
    return {"rating": None}


@app.get("/api/tags")
def get_all_tags(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    videos = db.query(Video).all()
    all_tags = set()
    for video in videos:
        if video.tags:
            all_tags.update(video.tags)
    return {"tags": sorted(list(all_tags))}


@app.get("/api/videos/duplicates")
def find_duplicates(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    videos = db.query(Video).all()
    
    duplicates = []
    seen = {}
    
    for video in videos:
        key = f"{video.filename}_{video.duration}_{video.resolution}_{video.file_size}"
        
        if key in seen:
            duplicates.append({
                "original_id": seen[key],
                "duplicate_id": video.id,
                "filename": video.filename,
                "duration": video.duration,
                "resolution": video.resolution,
                "file_size": video.file_size,
            })
        else:
            seen[key] = video.id
    
    original_videos = db.query(Video).filter(Video.id.in_([d["original_id"] for d in duplicates])).all()
    duplicate_videos = db.query(Video).filter(Video.id.in_([d["duplicate_id"] for d in duplicates])).all()
    
    original_map = {v.id: v for v in original_videos}
    duplicate_map = {v.id: v for v in duplicate_videos}
    
    for d in duplicates:
        d["original"] = {
            "id": d["original_id"],
            "filepath": original_map[d["original_id"]].filepath if d["original_id"] in original_map else None,
            "filename": original_map[d["original_id"]].filename if d["original_id"] in original_map else None,
        }
        d["duplicate"] = {
            "id": d["duplicate_id"],
            "filepath": duplicate_map[d["duplicate_id"]].filepath if d["duplicate_id"] in duplicate_map else None,
            "filename": duplicate_map[d["duplicate_id"]].filename if d["duplicate_id"] in duplicate_map else None,
        }
        del d["original_id"]
        del d["duplicate_id"]
    
    return {"duplicates": duplicates, "count": len(duplicates)}


@app.get("/api/stats")
def get_stats(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    total = db.query(func.count(Video.id)).scalar() or 0
    total_duration = db.query(func.sum(Video.duration)).scalar() or 0
    
    resolutions = db.query(
        Video.resolution,
        func.count(Video.id)
    ).filter(Video.resolution.isnot(None)).group_by(Video.resolution).all()
    
    cameras = db.query(
        Video.camera_type,
        func.count(Video.id)
    ).filter(Video.camera_type.isnot(None)).group_by(Video.camera_type).all()
    
    return {
        "total_videos": total,
        "total_duration_hours": round(total_duration / 3600, 2) if total_duration else 0,
        "resolutions": [{"resolution": r, "count": c} for r, c in resolutions],
        "cameras": [{"camera": c, "count": cnt} for c, cnt in cameras],
        "top_tags": [],
    }


@app.post("/api/export/csv")
def export_csv(
    request: dict = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if request and request.get("video_ids"):
        videos = db.query(Video).filter(Video.id.in_(request["video_ids"])).all()
    else:
        videos = db.query(Video).all()
    
    csv_content = videos_to_csv(videos)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=videos.csv"}
    )


@app.post("/api/export/excel")
def export_excel(
    request: dict = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if request and request.get("video_ids"):
        videos = db.query(Video).filter(Video.id.in_(request["video_ids"])).all()
    else:
        videos = db.query(Video).all()
    
    excel_content = videos_to_excel(videos)
    
    return Response(
        content=excel_content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=videos.xlsx"}
    )


def generate_edl(videos: list) -> str:
    """Generate CMX 3600 EDL from video list."""
    edl_lines = [
        "TITLE: KDO Video Tagger Export",
        "",
    ]
    
    reel_names = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    
    for i, video in enumerate(videos, 1):
        filename = video.filename
        duration_frames = int((video.duration or 1) * 30)
        
        reel_name = "KDO"
        if len(filename) > 8:
            ext = filename.split('.')[-1] if '.' in filename else ""
            name_part = filename[:8 - len(ext) - 1] if ext else filename[:8]
            reel_name = f"{name_part[:8].upper()}{ext[:3].upper()}"
        
        source_in = "00:00:00:00"
        source_out = f"{int((video.duration or 0) / 3600):02d}:{int((video.duration or 0) / 60 % 60):02d}:{int(video.duration or 0) % 60:02d}:00"
        
        record_in = f"{int((i-1) * (video.duration or 0) / 3600):02d}:{int((i-1) * (video.duration or 0) / 60 % 60):02d}:{int((i-1) * (video.duration or 0) % 60):02d}:00"
        record_out = f"{int(i * (video.duration or 0) / 3600):02d}:{int(i * (video.duration or 0) / 60 % 60):02d}:{int(i * (video.duration or 0) % 60):02d}:00"
        
        edl_lines.append(f"{i:03d}  {reel_name} V  C        {source_in} {source_out} {record_in} {record_out}")
        edl_lines.append(f"* FROM CLIP NAME: {filename}")
        edl_lines.append(f"* FILE: {video.filepath}")
        if video.resolution:
            edl_lines.append(f"* RESOLUTION: {video.resolution}")
        if video.duration:
            edl_lines.append(f"* DURATION: {video.duration:.2f}s")
        edl_lines.append("")
    
    return "\n".join(edl_lines)


@app.post("/api/export/edl")
def export_edl(
    request: dict = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if request and request.get("video_ids"):
        videos = db.query(Video).filter(Video.id.in_(request["video_ids"])).all()
    else:
        videos = db.query(Video).all()
    
    edl_content = generate_edl(videos)
    
    return Response(
        content=edl_content,
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=videos.edl"}
    )


def generate_pdf(videos: list) -> bytes:
    """Generate a PDF shot list from video list."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=18, alignment=TA_CENTER, spaceAfter=20)
    subtitle_style = ParagraphStyle('Subtitle', parent=styles['Normal'], fontSize=10, alignment=TA_CENTER, textColor=colors.grey, spaceAfter=20)
    
    elements.append(Paragraph("Shot List", title_style))
    elements.append(Paragraph(f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')} | {len(videos)} clips", subtitle_style))
    elements.append(Spacer(1, 20))
    
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=8, alignment=TA_CENTER)
    
    table_data = [['#', 'Filename', 'Duration', 'Resolution', 'Camera', 'Tags']]
    for i, video in enumerate(videos, 1):
        tags_str = ', '.join(video.tags[:5]) if video.tags else '-'
        duration_str = f"{int((video.duration or 0) / 60)}:{int(video.duration or 0) % 60:02d}" if video.duration else '-'
        row = [
            str(i),
            Paragraph(video.filename[:30], ParagraphStyle('Cell', fontSize=7, alignment=TA_LEFT)),
            duration_str,
            video.resolution or '-',
            video.camera_type or '-',
            Paragraph(tags_str[:40], ParagraphStyle('Cell', fontSize=6, alignment=TA_LEFT)),
        ]
        table_data.append(row)
    
    col_widths = [0.4*inch, 2*inch, 0.7*inch, 0.9*inch, 0.8*inch, 2.2*inch]
    table = Table(table_data, colWidths=col_widths)
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2563eb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 8),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 7),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f3f4f6')]),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
    ]))
    
    elements.append(table)
    elements.append(Spacer(1, 30))
    
    footer_style = ParagraphStyle('Footer', parent=styles['Normal'], fontSize=8, textColor=colors.grey, alignment=TA_CENTER)
    total_duration = sum(v.duration or 0 for v in videos)
    total_str = f"Total clips: {len(videos)} | Total duration: {int(total_duration / 3600)}h {int(total_duration % 3600 / 60)}m {int(total_duration % 60)}s"
    elements.append(Paragraph(total_str, footer_style))
    elements.append(Paragraph("Generated by KDO Video Tagger", footer_style))
    
    doc.build(elements)
    pdf_content = buffer.getvalue()
    buffer.close()
    
    return pdf_content


@app.post("/api/export/pdf")
def export_pdf(
    request: dict = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if request and request.get("video_ids"):
        videos = db.query(Video).filter(Video.id.in_(request["video_ids"])).all()
    else:
        videos = db.query(Video).all()
    
    pdf_content = generate_pdf(videos)
    
    return Response(
        content=pdf_content,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=shot-list.pdf"}
    )


@app.get("/api/collections")
def list_collections(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collections = db.query(Collection).all()
    return {
        "collections": [
            {
                "id": c.id,
                "name": c.name,
                "description": c.description,
                "color": c.color,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in collections
        ]
    }


@app.post("/api/collections")
def create_collection(
    request: CollectionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collection = Collection(
        name=request.name,
        description=request.description,
        color=request.color,
    )
    db.add(collection)
    db.commit()
    db.refresh(collection)
    
    return {
        "id": collection.id,
        "name": collection.name,
        "description": collection.description,
        "color": collection.color,
        "created_at": collection.created_at.isoformat() if collection.created_at else None,
    }


@app.get("/api/projects")
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    projects = db.query(Project).all()
    return {
        "projects": [
            {
                "id": p.id,
                "name": p.name,
                "description": p.description,
                "status": p.status,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "video_count": len(p.videos) if hasattr(p, 'videos') else 0,
            }
            for p in projects
        ]
    }


@app.post("/api/collections/{collection_id}/videos")
def add_video_to_collection(
    collection_id: int,
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    video_id = request.get("video_id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id required")
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video not in collection.videos:
        collection.videos.append(video)
        db.commit()
    
    return {"status": "ok", "video_count": len(collection.videos)}


@app.delete("/api/collections/{collection_id}/videos/{video_id}")
def remove_video_from_collection(
    collection_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video in collection.videos:
        collection.videos.remove(video)
        db.commit()
    
    return {"status": "ok"}


@app.get("/api/collections/{collection_id}/videos")
def get_collection_videos(
    collection_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    videos = collection.videos
    return {
        "videos": [
            {
                "id": v.id,
                "filename": v.filename,
                "filepath": v.filepath,
                "resolution": v.resolution,
                "width": v.width,
                "height": v.height,
                "duration": v.duration,
                "fps": v.fps,
                "codec": v.codec,
                "bitrate": v.bitrate,
                "camera_type": v.camera_type,
                "date_created": v.date_created.isoformat() if v.date_created else None,
                "file_size": v.file_size,
                "tags": v.tags or [],
                "thumbnail": v.thumbnail,
                "yolo_enabled": v.yolo_enabled,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in videos
        ],
        "collection": {
            "id": collection.id,
            "name": collection.name,
            "color": collection.color,
        }
    }


@app.get("/api/projects/{project_id}/videos")
def get_project_videos(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    videos = project.videos
    return {
        "videos": [
            {
                "id": v.id,
                "filename": v.filename,
                "filepath": v.filepath,
                "resolution": v.resolution,
                "width": v.width,
                "height": v.height,
                "duration": v.duration,
                "fps": v.fps,
                "codec": v.codec,
                "bitrate": v.bitrate,
                "camera_type": v.camera_type,
                "date_created": v.date_created.isoformat() if v.date_created else None,
                "file_size": v.file_size,
                "tags": v.tags or [],
                "thumbnail": v.thumbnail,
                "yolo_enabled": v.yolo_enabled,
                "created_at": v.created_at.isoformat() if v.created_at else None,
            }
            for v in videos
        ],
        "project": {
            "id": project.id,
            "name": project.name,
            "status": project.status,
        }
    }


@app.post("/api/projects/{project_id}/videos")
def add_video_to_project(
    project_id: int,
    request: dict,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    video_id = request.get("video_id")
    if not video_id:
        raise HTTPException(status_code=400, detail="video_id required")
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video not in project.videos:
        project.videos.append(video)
        db.commit()
    
    return {"status": "ok", "video_count": len(project.videos)}


@app.delete("/api/projects/{project_id}/videos/{video_id}")
def remove_video_from_project(
    project_id: int,
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    if video in project.videos:
        project.videos.remove(video)
        db.commit()
    
    return {"status": "ok"}


@app.post("/api/projects")
def create_project(
    request: ProjectCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = Project(
        name=request.name,
        description=request.description,
        status=request.status,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "status": project.status,
        "created_at": project.created_at.isoformat() if project.created_at else None,
    }



@app.get("/api/settings/export-db")
def export_database(
    user: User = Depends(get_current_user),
):
    """Export the database file for backup."""
    db_path = os.environ.get("DATABASE_URL", "sqlite:///./config/kdo-vtg.db").replace("sqlite:///", "")
    if not os.path.exists(db_path):
        raise HTTPException(status_code=404, detail="Database file not found")
    
    return FileResponse(db_path, media_type="application/octet-stream", filename="kdo-vtg.db")


@app.post("/api/settings/import-db")
async def import_database(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
):
    """Import a database file (replaces existing)."""
    db_path = os.environ.get("DATABASE_URL", "sqlite:///./config/kdo-vtg.db").replace("sqlite:///", "")
    
    try:
        with open(db_path, "wb") as f:
            content = await file.read()
            f.write(content)
        return {"status": "ok", "message": "Database imported successfully. Please restart the app."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to import database: {str(e)}")


@app.post("/api/settings/reset-db")
def reset_database(
    user: User = Depends(get_current_user),
):
    """Reset the database (deletes all data)."""
    from backend.database import Base, engine
    
    db_path = os.environ.get("DATABASE_URL", "sqlite:///./config/kdo-vtg.db").replace("sqlite:///", "")
    
    try:
        # Close all connections
        engine.dispose()
        
        # Delete database file
        if os.path.exists(db_path):
            os.remove(db_path)
        
        # Recreate tables
        Base.metadata.create_all(bind=engine)
        
        return {"status": "ok", "message": "Database reset successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {str(e)}")



@app.post("/api/settings/auto-create-collections-by-tag")
def auto_create_collections_by_tag(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Create collections based on video tags. Videos with matching tags are added to the collection."""
    videos = db.query(Video).all()
    
    # Get all unique tags from all videos
    all_tags = set()
    for video in videos:
        if video.tags:
            all_tags.update(video.tags)
    
    results = []
    for tag in sorted(all_tags):
        # Check if collection exists
        existing = db.query(Collection).filter(Collection.name == tag).first()
        if existing:
            collection = existing
            # Clear existing videos and re-add
            collection.videos = []
        else:
            # Create new collection
            collection = Collection(name=tag, color="#58a6ff")
            db.add(collection)
            db.flush()
        
        # Add videos with this tag
        for video in videos:
            if video.tags and tag in video.tags:
                if video not in collection.videos:
                    collection.videos.append(video)
        
        db.commit()
        db.refresh(collection)
        
        results.append({
            "id": collection.id,
            "name": collection.name,
            "video_count": len(collection.videos),
        })
    
    return {
        "status": "ok",
        "collections_created": len(results),
        "collections": results,
    }


@app.delete("/api/collections/{collection_id}")
def delete_collection(
    collection_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a collection."""
    collection = db.query(Collection).filter(Collection.id == collection_id).first()
    if not collection:
        raise HTTPException(status_code=404, detail="Collection not found")
    
    db.delete(collection)
    db.commit()
    
    return {"status": "ok", "message": f"Collection '{collection.name}' deleted"}


@app.delete("/api/projects/{project_id}")
def delete_project(
    project_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Delete a project."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    db.delete(project)
    db.commit()
    
    return {"status": "ok", "message": f"Project '{project.name}' deleted"}

