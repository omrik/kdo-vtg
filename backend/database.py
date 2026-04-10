from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, JSON
from datetime import datetime
import os

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./config/kdo-video.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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
    yolo_enabled = Column(Boolean, default=False)
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


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
