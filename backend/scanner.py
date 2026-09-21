import os
import json
import cv2
import ffmpeg
import datetime
import hashlib
import re
import numpy as np
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
        model_name: str = "yolov8n.pt",
        scene_detection_enabled: bool = False,
        shot_type_enabled: bool = False,
        color_palette_enabled: bool = False,
        gps_extraction_enabled: bool = True,
        transcribe_enabled: bool = False,
        whisper_model: str = "base",
        only_missing: bool = False,
    ):
        self.db = db
        self.scan_job = scan_job
        self.yolo_enabled = yolo_enabled
        self.sample_interval = sample_interval
        self.model_name = model_name
        self.scene_detection_enabled = scene_detection_enabled
        self.shot_type_enabled = shot_type_enabled
        self.color_palette_enabled = color_palette_enabled
        self.gps_extraction_enabled = gps_extraction_enabled
        self.transcribe_enabled = transcribe_enabled
        self.whisper_model = whisper_model
        self.only_missing = only_missing
        self.model = None
        self._yolo_initialized = False

    def init_yolo(self):
        if self.yolo_enabled and not self._yolo_initialized:
            from ultralytics import YOLO
            weights = self._resolve_model_path()
            self.model = YOLO(weights)
            self._yolo_initialized = True

    def _resolve_model_path(self) -> str:
        model_name = os.path.basename(self.model_name) or "yolov8n.pt"
        weights_dir = os.environ.get("YOLO_WEIGHTS_DIR") or "/opt/kdo-vtg/models"
        writable_dir = os.path.join(os.environ.get("HOME") or ".", ".kdo-vtg", "models")
        os.makedirs(writable_dir, exist_ok=True)

        for candidate in (
            self.model_name,
            os.path.join(weights_dir, model_name),
            os.path.join(writable_dir, model_name),
        ):
            if candidate and os.path.exists(candidate):
                return candidate

        return self._download_weights(model_name, writable_dir)

    def _download_weights(self, model_name: str, dest_dir: str) -> str:
        import urllib.request

        dest = os.path.join(dest_dir, model_name)
        if os.path.exists(dest):
            return dest
        url = f"https://github.com/ultralytics/assets/releases/download/v8.4.0/{model_name}"
        print(f"Downloading YOLO weights: {url}")
        urllib.request.urlretrieve(url, dest)
        return dest

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

                duration = float(format_info.get("duration", 0) or 0)
                metadata["duration"] = duration

                fps_str = video_stream.get("r_frame_rate", "0/1")
                if "/" in fps_str:
                    num, den = fps_str.split("/")
                    metadata["fps"] = round(int(num) / int(den), 2) if int(den) != 0 else 0

                metadata["codec"] = video_stream.get("codec_name", "unknown")
                metadata["bitrate"] = format_info.get("bit_rate", "unknown")

            metadata["file_size"] = int(format_info.get("size", 0) or 0)

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

    @staticmethod
    def _exiftool_str(value) -> str:
        """exiftool -json returns scalars or arrays; normalize to a string."""
        if isinstance(value, list):
            return str(value[0]) if value else ""
        return str(value or "")

    def extract_gps_data(self, filepath: str, exiftool_data: Optional[dict] = None) -> Optional[dict]:
        """Extract GPS coordinates from video metadata.

        Tries, in order:
          1. exiftool GPS tags (most reliable for QuickTime/MOV/DJI/GoPro)
          2. ffprobe format tags (QuickTime ISO 6709 / plain `location`)
          3. ffprobe stream tags (data streams with GPS metadata)
        """
        try:
            if exiftool_data:
                gps = self._gps_from_exiftool(exiftool_data)
                if gps:
                    return gps

            probe = ffmpeg.probe(filepath)
            owners = [probe.get("format", {})] + probe.get("streams", [])
            for owner in owners:
                tags = owner.get("tags") or {}
                iso6709 = tags.get("com.apple.quicktime.location.ISO6709")
                if iso6709:
                    return self._parse_iso6709(iso6709)
                if tags.get("location") and not tags.get("GPSLatitude"):
                    dji = self._parse_dji_location(str(tags.get("location", "")))
                    if dji:
                        return dji
                if tags.get("GPSLatitude") and tags.get("GPSLongitude"):
                    lat = self._parse_gps_coord(tags.get("GPSLatitude"), tags.get("GPSLatitudeRef", "N"))
                    lon = self._parse_gps_coord(tags.get("GPSLongitude"), tags.get("GPSLongitudeRef", "E"))
                    if lat and lon:
                        return {
                            "latitude": lat,
                            "longitude": lon,
                            "altitude": self._safe_float(tags.get("GPSAltitude")),
                        }
            return None
        except Exception as e:
            print(f"GPS extraction error for {filepath}: {e}")
            return None

    def _gps_from_exiftool(self, exiftool_data: dict) -> Optional[dict]:
        lat = exiftool_data.get("gps_latitude") or ""
        lon = exiftool_data.get("gps_longitude") or ""
        if not lat or not lon:
            return None
        lat_ref = exiftool_data.get("gps_latitude_ref")
        lon_ref = exiftool_data.get("gps_longitude_ref")
        parsed_lat = self._parse_dms_direction(lat, lat_ref)
        parsed_lon = self._parse_dms_direction(lon, lon_ref)
        if parsed_lat is not None and parsed_lon is not None:
            return {
                "latitude": parsed_lat,
                "longitude": parsed_lon,
                "altitude": self._safe_float(exiftool_data.get("gps_altitude")),
            }
        position = exiftool_data.get("gps_position") or ""
        if position and "," in position:
            a, b = position.split(",", 1)
            parsed_lat = self._parse_dms_direction(a.strip(), lat_ref)
            parsed_lon = self._parse_dms_direction(b.strip(), lon_ref)
            if parsed_lat is not None and parsed_lon is not None:
                return {
                    "latitude": parsed_lat,
                    "longitude": parsed_lon,
                    "altitude": self._safe_float(exiftool_data.get("gps_altitude")),
                }
        return None

    @staticmethod
    def _parse_dms_direction(value: str, ref: str) -> Optional[float]:
        """Parse a DMS string like '45 deg 46' 24.60\" N' into decimal degrees."""
        try:
            if not value:
                return None
            nums = re.findall(r"\d+(?:\.\d+)?", value)
            if not nums:
                return None
            degrees = float(nums[0])
            minutes = float(nums[1]) if len(nums) > 1 else 0.0
            seconds = float(nums[2]) if len(nums) > 2 else 0.0
            decimal = degrees + minutes / 60 + seconds / 3600
            ref = (ref or "").upper()
            if ref in ("S", "W"):
                decimal *= -1
            elif ref[:1] not in ("N", "E"):
                if value.rstrip().upper().endswith(("S", "W")):
                    decimal *= -1
            return round(decimal, 6)
        except Exception:
            return None

    @staticmethod
    def _parse_dji_location(location: str) -> Optional[dict]:
        """Parse DJI `location` tag like '+27.715694+085.334994+123.5/1.00000/1.00000'."""
        match = re.match(r"([+-]?\d+\.\d+)([+-]\d+\.\d+)([+-]\d+\.\d+)?", location)
        if match:
            return {
                "latitude": float(match.group(1)),
                "longitude": float(match.group(2)),
                "altitude": float(match.group(3) or 0),
            }
        return None

    @staticmethod
    def _safe_float(value) -> float:
        try:
            return float(value)
        except (TypeError, ValueError):
            return 0

    def _parse_iso6709(self, iso6709: str) -> dict:
        """Parse ISO 6709 GPS coordinate string."""
        match = re.match(r'([+-]?\d+\.?\d*)([+-]\d+\.?\d*)([+-]\d+\.?\d*)', iso6709)
        if match:
            return {
                "latitude": float(match.group(1)),
                "longitude": float(match.group(2)),
                "altitude": float(match.group(3)) if match.group(3) else 0
            }
        return None

    def _parse_gps_coord(self, coord: str, ref: str) -> Optional[float]:
        """Parse GPS coordinate from DMS format."""
        try:
            if not coord:
                return None
            parts = re.findall(r'\d+\.?\d*', coord)
            if len(parts) >= 3:
                degrees = float(parts[0])
                minutes = float(parts[1])
                seconds = float(parts[2])
                decimal = degrees + minutes / 60 + seconds / 3600
                return decimal * (-1 if ref in ['S', 'W'] else 1)
            return float(coord)
        except:
            return None

    @staticmethod
    def _parse_exiftool_datetime(value: str) -> Optional[datetime.datetime]:
        """Parse exiftool date strings (e.g. '2025:09:18 19:39:04') into a datetime."""
        if not value:
            return None
        if isinstance(value, datetime.datetime):
            return value
        value = str(value).strip()
        for fmt in (
            "%Y:%m:%d %H:%M:%S",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y:%m:%d",
            "%Y-%m-%d",
        ):
            try:
                return datetime.datetime.strptime(value, fmt)
            except ValueError:
                continue
        match = re.match(
            r"(\d{4})[:/-](\d{1,2})[:/-](\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?",
            value,
        )
        if match:
            _, _, _, hh, mm, ss = match.groups()
            y, mo, d = (int(match.group(i)) for i in (1, 2, 3))
            return datetime.datetime(y, mo, d, int(hh), int(mm), int(ss) if ss else 0)
        return None

    def extract_metadata_exiftool(self, filepath: str) -> dict:
        """Extract extended metadata using exiftool."""
        import subprocess
        
        metadata = {}
        try:
            result = subprocess.run(
                ["exiftool", "-json", filepath],
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0 and result.stdout:
                data = json.loads(result.stdout)
                if data:
                    info = data[0]
                    create_date = self._parse_exiftool_datetime(
                        info.get("CreateDate", info.get("DateTimeOriginal", ""))
                    )
                    metadata = {
                        "encoder": info.get("Encoder", ""),
                        "camera_model": info.get("Model", info.get("CameraModel", "")),
                        "create_date": create_date,
                        "rotation": info.get("Rotation", 0),
                        "avg_bitrate": info.get("AvgBitrate", ""),
                        "megapixels": info.get("Megapixels", ""),
                        "color_primaries": info.get("ColorPrimaries", ""),
                        "transfer_chars": info.get("TransferCharacteristics", ""),
                        "gps_latitude": self._exiftool_str(info.get("GPSLatitude")),
                        "gps_longitude": self._exiftool_str(info.get("GPSLongitude")),
                        "gps_latitude_ref": self._exiftool_str(info.get("GPSLatitudeRef")),
                        "gps_longitude_ref": self._exiftool_str(info.get("GPSLongitudeRef")),
                        "gps_position": self._exiftool_str(info.get("GPSPosition")),
                        "gps_altitude": self._exiftool_str(info.get("GPSAltitude")),
                    }
                    return metadata
        except Exception as e:
            print(f"exiftool error for {filepath}: {e}")
        return metadata

    def extract_thumbnail(self, filepath: str, duration: float) -> Optional[str]:
        """Extract thumbnail at 10% of video duration."""
        try:
            timestamp = max(1, int(duration * 0.1))
            output_dir = "/app/config/thumbnails"
            os.makedirs(output_dir, exist_ok=True)
            
            filename_hash = hashlib.md5(filepath.encode('utf-8')).hexdigest()[:16]
            thumbnail_path = os.path.join(output_dir, f"{filename_hash}.jpg")
            
            if os.path.exists(thumbnail_path):
                return thumbnail_path
            
            (
                ffmpeg
                .input(filepath, ss=timestamp)
                .output(
                    thumbnail_path,
                    vframes=1,
                    format='image2',
                    vcodec='mjpeg',
                    vf="scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black",
                )
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            
            return thumbnail_path
        except Exception as e:
            print(f"Thumbnail extraction error for {filepath}: {e}")
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

    def detect_shot_types(self, filepath: str) -> dict:
        """Detect shot types (WS/MS/CU/ECU) based on YOLO object detection."""
        if not self.yolo_enabled:
            return {}
        
        self.init_yolo()
        if self.model is None:
            return {}

        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            return {}

        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        frame_skip = max(1, int(fps * self.sample_interval))
        
        shot_counts = {"WS": 0, "MS": 0, "CU": 0, "ECU": 0}
        current_frame = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if current_frame % frame_skip == 0:
                try:
                    results = self.model(frame, verbose=False)
                    max_box_area = 0
                    
                    for box in results[0].boxes:
                        x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                        box_area = (x2 - x1) * (y2 - y1)
                        frame_area = frame_width * frame_height
                        relative_size = box_area / frame_area
                        
                        if relative_size > max_box_area:
                            max_box_area = relative_size
                    
                    if max_box_area > 0:
                        if max_box_area > 0.5:
                            shot_counts["ECU"] += 1
                        elif max_box_area > 0.25:
                            shot_counts["CU"] += 1
                        elif max_box_area > 0.1:
                            shot_counts["MS"] += 1
                        else:
                            shot_counts["WS"] += 1
                            
                except Exception as e:
                    print(f"Shot type error at frame {current_frame}: {e}")
            
            current_frame += 1
            
            if self.scan_job and self.scan_job.status == "cancelled":
                break

        cap.release()
        
        dominant_shot = max(shot_counts, key=shot_counts.get) if sum(shot_counts.values()) > 0 else "WS"
        
        return {
            "dominant_shot": dominant_shot,
            "counts": shot_counts,
            "total_analyzed": sum(shot_counts.values())
        }

    def extract_color_palette(self, filepath: str, num_colors: int = 5) -> list:
        """Extract dominant colors from video frames using K-Means clustering."""
        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            return []
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        frame_skip = max(1, int(frame_count / 20))
        
        all_pixels = []
        current_frame = 0
        
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            if current_frame % frame_skip == 0:
                resized = cv2.resize(frame, (64, 64))
                pixels = resized.reshape(-1, 3)
                all_pixels.extend(pixels.tolist())
            
            current_frame += 1
            
            if self.scan_job and self.scan_job.status == "cancelled":
                break
        
        cap.release()
        
        if len(all_pixels) < num_colors:
            return []
        
        all_pixels = np.array(all_pixels, dtype=np.float32)
        
        criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
        _, labels, centers = cv2.kmeans(all_pixels, num_colors, None, criteria, 10, cv2.KMEANS_RANDOM_CENTERS)
        
        centers = centers.astype(int)
        _, counts = np.unique(labels, return_counts=True)
        
        color_indices = np.argsort(counts)[::-1]
        
        palette = []
        for i in color_indices:
            color = centers[i]
            hex_color = "#{:02x}{:02x}{:02x}".format(int(color[2]), int(color[1]), int(color[0]))
            palette.append({
                "rgb": [int(color[2]), int(color[1]), int(color[0])],
                "hex": hex_color,
                "percentage": float(counts[i]) / len(labels) * 100
            })
        
        return palette

    def detect_scenes(self, filepath: str, threshold: float = 30.0) -> list:
        """Detect scene changes using frame differencing."""
        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            return []

        fps = cap.get(cv2.CAP_PROP_FPS)
        if fps <= 0:
            fps = 30.0

        scenes = []
        prev_frame = None
        frame_idx = 0
        scene_start = 0

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (320, 180))

            if prev_frame is not None:
                diff = cv2.absdiff(prev_frame, gray)
                score = float(np.mean(diff))

                if score > threshold:
                    scenes.append({
                        "start_frame": scene_start,
                        "end_frame": frame_idx - 1,
                        "start_time": scene_start / fps,
                        "end_time": (frame_idx - 1) / fps,
                        "duration": (frame_idx - scene_start) / fps,
                        "timestamp": scene_start / fps,
                    })
                    scene_start = frame_idx

            prev_frame = gray
            frame_idx += 1

            if self.scan_job and self.scan_job.status == "cancelled":
                break

        if scene_start < frame_idx - 1:
            scenes.append({
                "start_frame": scene_start,
                "end_frame": frame_idx - 1,
                "start_time": scene_start / fps,
                "end_time": (frame_idx - 1) / fps,
                "duration": (frame_idx - scene_start) / fps,
                "timestamp": scene_start / fps,
            })

        cap.release()
        return scenes

    def transcribe_video(self, filepath: str) -> list:
        try:
            probe = ffmpeg.probe(filepath)
            has_audio = any(
                stream.get("codec_type") == "audio"
                for stream in probe.get("streams", [])
            )
            if not has_audio:
                return []

            from faster_whisper import WhisperModel
            model = WhisperModel(self.whisper_model, device="cpu", compute_type="int8")
            segments, _ = model.transcribe(filepath, language=None)
            transcript = []
            for segment in segments:
                transcript.append({
                    "start": float(segment.start),
                    "end": float(segment.end),
                    "text": segment.text.strip(),
                })
            return transcript
        except Exception as e:
            print(f"transcribe error for {filepath}: {e}")
            return None

    def scan_video(self, filepath: str) -> Video:
        filename = os.path.basename(filepath)
        
        metadata = self.extract_metadata_ffprobe(filepath)
        exiftool_data = self.extract_metadata_exiftool(filepath)
        
        metadata.update(exiftool_data)
        
        camera_type = exiftool_data.get("camera_model") or self.extract_camera_type(filepath, filename)
        date_created = self.extract_date_from_filename(filename) or exiftool_data.get("create_date")
        
        tags = self.detect_objects_yolo(filepath)
        scenes = self.detect_scenes(filepath) if self.scene_detection_enabled else None
        shot_types = self.detect_shot_types(filepath) if self.shot_type_enabled else None
        color_palette = self.extract_color_palette(filepath) if self.color_palette_enabled else None
        gps_data = self.extract_gps_data(filepath, exiftool_data) if self.gps_extraction_enabled else None
        transcript = self.transcribe_video(filepath) if self.transcribe_enabled else None
        
        duration = metadata.get("duration", 0) or 0
        thumbnail = self.extract_thumbnail(filepath, duration) if duration > 0 else None

        existing = self.db.query(Video).filter(Video.filepath == filepath).first()
        
        if existing:
            existing.resolution = metadata.get("resolution")
            existing.width = metadata.get("width")
            existing.height = metadata.get("height")
            existing.duration = metadata.get("duration")
            existing.fps = metadata.get("fps")
            existing.codec = metadata.get("codec")
            existing.bitrate = metadata.get("bitrate")
            existing.file_size = metadata.get("file_size")
            existing.camera_type = camera_type
            existing.color_profile = metadata.get("color_primaries")
            existing.date_created = date_created
            existing.tags = list(tags) if tags else existing.tags
            existing.thumbnail = thumbnail if thumbnail else existing.thumbnail
            existing.yolo_enabled = self.yolo_enabled
            existing.scenes = scenes if scenes else existing.scenes
            existing.scene_detection_enabled = self.scene_detection_enabled
            existing.shot_types = shot_types if shot_types else existing.shot_types
            existing.color_palette = color_palette if color_palette else existing.color_palette
            existing.gps_data = gps_data if gps_data else existing.gps_data
            existing.transcript = transcript if transcript is not None else existing.transcript
            existing.transcribe_enabled = self.transcribe_enabled
            existing.scan_id = self.scan_job.id
            video = existing
        else:
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
                color_profile=metadata.get("color_primaries"),
                date_created=date_created,
                tags=list(tags) if tags else [],
                thumbnail=thumbnail,
                yolo_enabled=self.yolo_enabled,
                scenes=scenes,
                scene_detection_enabled=self.scene_detection_enabled,
                shot_types=shot_types,
                color_palette=color_palette,
                gps_data=gps_data,
                transcript=transcript,
                transcribe_enabled=self.transcribe_enabled,
                scan_id=self.scan_job.id,
            )
            self.db.add(video)

        self.db.commit()
        self.db.refresh(video)
        
        self.scan_job.processed_files += 1
        self.db.commit()
        
        return video

    def _missing_analyses(self, video: Video) -> list:
        """Which enabled analyses are still missing on an existing video.

        Used by backfill scans (only_missing=True): an existing video is
        skipped when none of the requested analyses are missing.
        """
        missing = []
        if self.shot_type_enabled and not video.shot_types:
            missing.append("shot_type")
        if self.yolo_enabled and not video.yolo_enabled and not video.tags:
            missing.append("yolo")
        if self.scene_detection_enabled and not video.scene_detection_enabled and not video.scenes:
            missing.append("scene")
        if self.color_palette_enabled and not video.color_palette:
            missing.append("color_palette")
        if self.transcribe_enabled and not video.transcript:
            missing.append("transcript")
        return missing

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

        succeeded = 0
        skipped = 0
        failed = 0
        last_error = None

        for filepath in video_files:
            if self.scan_job.status == "cancelled":
                break

            if self.only_missing:
                existing = self.db.query(Video).filter(Video.filepath == filepath).first()
                if existing is not None and not self._missing_analyses(existing):
                    skipped += 1
                    self.scan_job.skipped_files = skipped
                    self.db.commit()
                    continue

            try:
                self.scan_video(filepath)
                succeeded += 1
            except Exception as e:
                failed += 1
                last_error = str(e)
                print(f"Error scanning {filepath}: {e}")
                self.db.rollback()
                self.scan_job.processed_files += 1
                self.db.commit()

        if self.scan_job.status != "cancelled":
            if succeeded == 0 and skipped == 0 and failed > 0:
                self.scan_job.status = "failed"
                self.scan_job.error_message = f"All {failed} file(s) failed to scan. Last error: {last_error}"
            else:
                if failed > 0:
                    self.scan_job.error_message = f"{failed} of {len(video_files)} file(s) failed to scan. Last error: {last_error}"
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
