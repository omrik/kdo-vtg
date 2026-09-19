"""KDO Video Tagger - Settings Unit Tests (in-memory DB)"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.database import Base
from backend import settings as s


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False})
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    engine.dispose()


class TestDefaults:
    def test_payload_defaults(self, db):
        payload = s.settings_payload(db)
        assert payload["gemini_api_key_set"] is False
        assert payload["gemini_api_key_masked"] == ""
        assert payload["media_root"] == "/media"
        assert payload["whisper_model"] == "base"
        assert payload["scan_defaults"]["sample_interval"] == 10
        assert payload["scan_defaults"]["yolo_enabled"] is False
        assert payload["scan_defaults"]["after_scan"] == "none"


class TestGetSet:
    def test_set_and_get(self, db):
        s.set_setting(db, s.KEY_WHISPER_MODEL, "medium")
        assert s.get_setting(db, s.KEY_WHISPER_MODEL) == "medium"

    def test_bool_setting(self, db):
        assert s.get_setting_bool(db, s.KEY_SCAN_YOLO) is False
        s.set_setting(db, s.KEY_SCAN_YOLO, "1")
        assert s.get_setting_bool(db, s.KEY_SCAN_YOLO) is True
        s.set_setting(db, s.KEY_SCAN_YOLO, "0")
        assert s.get_setting_bool(db, s.KEY_SCAN_YOLO) is False

    def test_none_is_ignored(self, db):
        s.set_setting(db, s.KEY_WHISPER_MODEL, "base")
        s.set_setting(db, s.KEY_WHISPER_MODEL, None)
        assert s.get_setting(db, s.KEY_WHISPER_MODEL) == "base"


class TestMasking:
    def test_key_masked_in_payload(self, db):
        s.set_setting(db, s.KEY_GEMINI_API_KEY, "AIzaSy-my-secret-key-1234")
        payload = s.settings_payload(db)
        assert payload["gemini_api_key_set"] is True
        assert payload["gemini_api_key_masked"] == "\u2022\u2022\u2022\u20221234"
        assert "AIzaSy" not in payload["gemini_api_key_masked"]

    def test_clear_key(self, db):
        s.set_setting(db, s.KEY_GEMINI_API_KEY, "foo")
        assert s.settings_payload(db)["gemini_api_key_set"] is True
        s.set_setting(db, s.KEY_GEMINI_API_KEY, "")
        assert s.get_setting(db, s.KEY_GEMINI_API_KEY) is None
        assert s.settings_payload(db)["gemini_api_key_set"] is False