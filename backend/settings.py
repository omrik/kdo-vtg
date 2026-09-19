"""Persistent application settings backed by the generic Settings key/value table."""

import os
from typing import Optional

from backend.database import Settings

KEY_GEMINI_API_KEY = "gemini_api_key"
KEY_GEMINI_MODEL = "gemini_model"
KEY_WHISPER_MODEL = "whisper_model"
KEY_MEDIA_ROOT = "media_root"
KEY_SCAN_YOLO = "scan_yolo_enabled"
KEY_SCAN_SCENE = "scan_scene_detection_enabled"
KEY_SCAN_SHOT = "scan_shot_type_enabled"
KEY_SCAN_COLOR = "scan_color_palette_enabled"
KEY_SCAN_SAMPLE_INTERVAL = "scan_sample_interval"
KEY_SCAN_AFTER = "scan_after_scan"

DEFAULT_MEDIA_ROOT = "/media"
DEFAULT_WHISPER_MODEL = "base"
DEFAULT_GEMINI_MODEL = "gemini-3.6-flash"
DEFAULT_SAMPLE_INTERVAL = 10

SCAN_DEFAULT_KEYS = [
    (KEY_SCAN_YOLO, "yolo_enabled"),
    (KEY_SCAN_SCENE, "scene_detection_enabled"),
    (KEY_SCAN_SHOT, "shot_type_enabled"),
    (KEY_SCAN_COLOR, "color_palette_enabled"),
]


def get_setting(db, key: str, default: Optional[str] = None) -> Optional[str]:
    row = db.query(Settings).filter(Settings.key == key).first()
    if row is not None and row.value not in (None, ""):
        return row.value
    return default


def get_setting_bool(db, key: str, default: bool = False) -> bool:
    value = get_setting(db, key)
    if value is None:
        return default
    return str(value).strip().lower() in ("1", "true", "yes", "on")


def set_setting(db, key: str, value: Optional[str]) -> None:
    if value is None:
        return
    row = db.query(Settings).filter(Settings.key == key).first()
    value = str(value).strip()
    if not value:
        if row is not None:
            db.delete(row)
        db.commit()
        return
    if row is None:
        row = Settings(key=key)
        db.add(row)
    row.value = value
    db.commit()


def settings_payload(db) -> dict:
    """Public, key-safe settings snapshot (never exposes the raw API key)."""
    db_key = get_setting(db, KEY_GEMINI_API_KEY) or ""
    env_key = os.environ.get("GEMINI_API_KEY") or ""
    api_key = db_key or env_key
    source = "db" if db_key else ("env" if env_key else "none")
    return {
        "gemini_api_key_set": bool(api_key),
        "gemini_api_key_masked": ("\u2022\u2022\u2022\u2022" + api_key[-4:]) if api_key else "",
        "gemini_api_key_source": source,
        "gemini_model": get_setting(db, KEY_GEMINI_MODEL, "") or DEFAULT_GEMINI_MODEL,
        "whisper_model": get_setting(db, KEY_WHISPER_MODEL, DEFAULT_WHISPER_MODEL),
        "media_root": get_setting(db, KEY_MEDIA_ROOT, DEFAULT_MEDIA_ROOT),
        "scan_defaults": {
            "yolo_enabled": get_setting_bool(db, KEY_SCAN_YOLO),
            "scene_detection_enabled": get_setting_bool(db, KEY_SCAN_SCENE),
            "shot_type_enabled": get_setting_bool(db, KEY_SCAN_SHOT),
            "color_palette_enabled": get_setting_bool(db, KEY_SCAN_COLOR),
            "sample_interval": int(get_setting(db, KEY_SCAN_SAMPLE_INTERVAL, DEFAULT_SAMPLE_INTERVAL) or DEFAULT_SAMPLE_INTERVAL),
            "after_scan": get_setting(db, KEY_SCAN_AFTER, "none") or "none",
        },
    }