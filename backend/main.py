import os
from contextlib import asynccontextmanager
from typing import Optional, List
from pathlib import Path

from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks, Query
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


@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "kdo-vtg"}


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
    yolo_enabled: bool
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


def scan_task(db_url: str, scan_id: int, folder_path: str, yolo_enabled: bool, sample_interval: int, model_name: str):
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
                model_name=model_name
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
    user: User = Depends(get_current_user),
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
