import os
import json
import cv2
import ffmpeg
import datetime
import re
from pathlib import Path
from typing import Optional
from sqlalchemy.orm import Session

from backend.database import Video, ScanJob


class VideoScanner:
    def __init__(
        self,
        db: Session,
        scan_job: ScanJob,
        yolo_enabled: bool = False,
        sample_interval: int = 10,
        model_name: str = "yolov8n.pt"
    ):
        self.db = db
        self.scan_job = scan_job
        self.yolo_enabled = yolo_enabled
        self.sample_interval = sample_interval
        self.model_name = model_name
        self.model = None
        self._yolo_initialized = False

    def init_yolo(self):
        if self.yolo_enabled and not self._yolo_initialized:
            from ultralytics import YOLO
            self.model = YOLO(self.model_name)
            self._yolo_initialized = True

    def extract_metadata_ffprobe(self, filepath: str) -> dict:
        try:
            probe = ffmpeg.probe(filepath)
            video_stream = next(
                (s for s in probe["streams"] if s["codec_type"] == "video"),
                None
            )
            format_info = probe.get("format", {})

            metadata = {
                "resolution": None,
                "width": None,
                "height": None,
                "duration": None,
                "fps": None,
                "codec": None,
                "bitrate": None,
            }

            if video_stream:
                width = int(video_stream.get("width", 0))
                height = int(video_stream.get("height", 0))
                metadata["width"] = width
                metadata["height"] = height
                metadata["resolution"] = f"{width}x{height}"

                duration = float(video_stream.get("duration", 0))
                metadata["duration"] = duration

                fps_str = video_stream.get("r_frame_rate", "0/1")
                if "/" in fps_str:
                    num, den = fps_str.split("/")
                    metadata["fps"] = round(int(num) / int(den), 2) if int(den) != 0 else 0

                metadata["codec"] = video_stream.get("codec_name", "unknown")
                metadata["bitrate"] = format_info.get("bit_rate", "unknown")

            metadata["file_size"] = int(format_info.get("duration", 0)) * int(format_info.get("bit_rate", 0)) // 8 if format_info.get("bit_rate") else 0

            return metadata
        except Exception as e:
            print(f"ffprobe error for {filepath}: {e}")
            return {}

    def extract_camera_type(self, filepath: str, filename: str) -> str:
        try:
            probe = ffmpeg.probe(filepath)
            encoder = probe["streams"][0].get("codec_long_name", "")
            
            if "DJI" in encoder.upper():
                return f"DJI {encoder.split('DJI')[1].strip()}" if "DJI" in encoder else "DJI"
            elif "DJI" in filename.upper():
                return "DJI"
            
            if "GoPro" in encoder or "GoPro" in filename:
                return "GoPro"
            if "iPhone" in filename:
                return "iPhone"
            if "Insta360" in filename:
                return "Insta360"
            
            return "Unknown"
        except:
            if "DJI" in filename.upper():
                return "DJI"
            return "Unknown"

    def extract_date_from_filename(self, filename: str) -> Optional[datetime.datetime]:
        patterns = [
            (r"(\d{8})_(\d{6})", "%Y%m%d_%H%M%S"),
            (r"(\d{8})(\d{6})", "%Y%m%d%H%M%S"),
            (r"(\d{4})-(\d{2})-(\d{2})", "%Y-%m-%d"),
            (r"(\d{4})(\d{2})(\d{2})", "%Y%m%d"),
        ]
        
        for pattern, fmt in patterns:
            match = re.search(pattern, filename)
            if match:
                try:
                    date_str = match.group(0)
                    if "_" in fmt:
                        return datetime.datetime.strptime(date_str, fmt)
                    return datetime.datetime.strptime(date_str[:8], "%Y%m%d")
                except:
                    continue
        return None

    def detect_objects_yolo(self, filepath: str) -> set:
        if not self.yolo_enabled:
            return set()
        
        self.init_yolo()
        if self.model is None:
            return set()

        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            return set()

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_skip = max(1, int(fps * self.sample_interval))
        
        tags = set()
        current_frame = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if current_frame % frame_skip == 0:
                try:
                    results = self.model(frame, verbose=False)
                    for box in results[0].boxes:
                        cls_id = int(box.cls)
                        tag = results[0].names[cls_id]
                        tags.add(tag)
                except Exception as e:
                    print(f"YOLO error at frame {current_frame}: {e}")
            
            current_frame += 1
            
            if self.scan_job.status == "cancelled":
                break

        cap.release()
        return tags

    def scan_video(self, filepath: str) -> Video:
        filename = os.path.basename(filepath)
        
        metadata = self.extract_metadata_ffprobe(filepath)
        camera_type = self.extract_camera_type(filepath, filename)
        date_created = self.extract_date_from_filename(filename)
        tags = self.detect_objects_yolo(filepath)

        video = Video(
            filename=filename,
            filepath=filepath,
            resolution=metadata.get("resolution"),
            width=metadata.get("width"),
            height=metadata.get("height"),
            duration=metadata.get("duration"),
            fps=metadata.get("fps"),
            codec=metadata.get("codec"),
            bitrate=metadata.get("bitrate"),
            file_size=metadata.get("file_size"),
            camera_type=camera_type,
            date_created=date_created,
            tags=list(tags) if tags else [],
            yolo_enabled=self.yolo_enabled,
            scan_id=self.scan_job.id,
        )

        self.db.add(video)
        self.db.commit()
        self.db.refresh(video)
        
        self.scan_job.processed_files += 1
        self.db.commit()
        
        return video

    def scan_folder(self, folder_path: str):
        self.scan_job.status = "running"
        self.scan_job.started_at = datetime.datetime.utcnow()
        self.db.commit()

        video_extensions = {".mp4", ".MP4", ".mov", ".MOV", ".m4v", ".avi", ".AVI", ".mkv"}
        video_files = []

        for root, _, files in os.walk(folder_path):
            for file in files:
                if Path(file).suffix.lower() in video_extensions:
                    video_files.append(os.path.join(root, file))

        self.scan_job.total_files = len(video_files)
        self.db.commit()

        for filepath in video_files:
            if self.scan_job.status == "cancelled":
                break
            
            try:
                self.scan_video(filepath)
            except Exception as e:
                print(f"Error scanning {filepath}: {e}")
                self.scan_job.processed_files += 1
                self.db.commit()

        self.scan_job.status = "completed"
        self.scan_job.completed_at = datetime.datetime.utcnow()
        self.db.commit()


def get_folder_videos(db: Session, folder_path: str) -> list[Video]:
    return db.query(Video).filter(Video.filepath.startswith(folder_path)).all()


def cancel_scan(db: Session, scan_id: int):
    scan = db.query(ScanJob).filter(ScanJob.id == scan_id).first()
    if scan and scan.status == "running":
        scan.status = "cancelled"
        db.commit()
