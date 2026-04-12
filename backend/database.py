from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base, relationship
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON, Table, ForeignKey
from datetime import datetime
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./config/kdo-vtg.db")

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False},
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=3600,
    pool_pre_ping=True,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    email = Column(String, unique=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    filepath = Column(String, nullable=False)
    resolution = Column(String, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    duration = Column(Float, nullable=True)
    fps = Column(Float, nullable=True)
    codec = Column(String, nullable=True)
    bitrate = Column(String, nullable=True)
    camera_type = Column(String, nullable=True)
    date_created = Column(DateTime, nullable=True)
    file_size = Column(Integer, nullable=True)
    tags = Column(JSON, nullable=True)
    thumbnail = Column(String, nullable=True)
    yolo_enabled = Column(Boolean, default=False)
    scenes = Column(JSON, nullable=True)
    scene_detection_enabled = Column(Boolean, default=False)
    shot_types = Column(JSON, nullable=True)
    color_palette = Column(JSON, nullable=True)
    gps_data = Column(JSON, nullable=True)
    rating = Column(Integer, nullable=True)
    folder_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    scan_id = Column(Integer, nullable=True)


class ScanJob(Base):
    __tablename__ = "scan_jobs"

    id = Column(Integer, primary_key=True, index=True)
    folder_path = Column(String, nullable=False)
    status = Column(String, default="pending")
    total_files = Column(Integer, default=0)
    processed_files = Column(Integer, default=0)
    yolo_enabled = Column(Boolean, default=False)
    sample_interval = Column(Integer, default=10)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    path = Column(String, unique=True, nullable=False)
    name = Column(String, nullable=False)
    video_count = Column(Integer, default=0)
    last_scanned = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Settings(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(String, nullable=True)


collection_videos = Table(
    'collection_videos',
    Base.metadata,
    Column('collection_id', Integer, ForeignKey('collections.id'), primary_key=True),
    Column('video_id', Integer, ForeignKey('videos.id'), primary_key=True),
    Column('added_at', DateTime, default=datetime.utcnow)
)

project_videos = Table(
    'project_videos',
    Base.metadata,
    Column('project_id', Integer, ForeignKey('projects.id'), primary_key=True),
    Column('video_id', Integer, ForeignKey('videos.id'), primary_key=True),
    Column('added_at', DateTime, default=datetime.utcnow)
)


class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    color = Column(String, default="#58a6ff")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    videos = relationship("Video", secondary=collection_videos, backref="collections")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    status = Column(String, default="active")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    videos = relationship("Video", secondary=project_videos, backref="projects")



def migrate_db():
    """Add missing columns to existing database for schema upgrades."""
    from sqlalchemy import text
    with engine.connect() as conn:
        # Get existing columns for videos table
        result = conn.execute(text("PRAGMA table_info(videos)"))
        columns = [row[1] for row in result]
        
        # Add missing columns
        migrations = [
            ('thumbnail', 'TEXT'),
            ('tags', 'TEXT'),
            ('scan_id', 'INTEGER'),
            ('updated_at', 'TIMESTAMP'),
        ]
        
        for col_name, col_type in migrations:
            if col_name not in columns:
                try:
                    conn.execute(text(f"ALTER TABLE videos ADD COLUMN {col_name} {col_type}"))
                    print(f"Added column: {col_name}")
                except Exception as e:
                    print(f"Could not add column {col_name}: {e}")
        
        # Create collection_videos table if not exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS collection_videos (
                collection_id INTEGER NOT NULL,
                video_id INTEGER NOT NULL,
                added_at TIMESTAMP,
                PRIMARY KEY (collection_id, video_id),
                FOREIGN KEY(collection_id) REFERENCES collections (id),
                FOREIGN KEY(video_id) REFERENCES videos (id)
            )
        """))
        
        # Create project_videos table if not exists
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS project_videos (
                project_id INTEGER NOT NULL,
                video_id INTEGER NOT NULL,
                added_at TIMESTAMP,
                PRIMARY KEY (project_id, video_id),
                FOREIGN KEY(project_id) REFERENCES projects (id),
                FOREIGN KEY(video_id) REFERENCES videos (id)
            )
        """))
        
        conn.commit()


def init_db():
    Base.metadata.create_all(bind=engine)
    migrate_db()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
