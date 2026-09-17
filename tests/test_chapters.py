"""
Unit tests for backend.chapters — no container required.

    pytest tests/test_chapters.py -v
"""

import pytest

from backend.chapters import (
    filter_scene_cuts,
    build_prompt,
    generate_chapters,
    parse_timestamp,
    to_hhmmss,
)


class FakeVideo:
    def __init__(self, **kwargs):
        self.filename = kwargs.get("filename", "clip.mp4")
        self.duration = kwargs.get("duration", 355.0)
        self.fps = kwargs.get("fps", 30.0)
        self.camera_type = kwargs.get("camera_type", "Unknown")
        self.gps_data = kwargs.get("gps_data")
        self.color_palette = kwargs.get("color_palette")
        self.tags = kwargs.get("tags", ["person", "car"])
        self.scenes = kwargs.get("scenes")
        self.shot_types = kwargs.get("shot_types")
        self.transcript = kwargs.get("transcript")


class TestFilterSceneCuts:
    def test_drops_noisy_short_scenes(self):
        scenes = [
            {"start_time": 0.0, "duration": 0.03},   # noisy single frame
            {"start_time": 17.4, "duration": 12.0},
            {"start_time": 30.5, "duration": 0.03},
            {"start_time": 45.1, "duration": 8.0},
        ]
        result = filter_scene_cuts(scenes, min_duration=2.0, min_gap=5.0)
        assert len(result) == 2
        assert [s["start_time"] for s in result] == [17.4, 45.1]

    def test_merges_cuts_closer_than_min_gap(self):
        scenes = [
            {"start_time": 10.0, "duration": 4.0},
            {"start_time": 12.0, "duration": 4.0},   # only 2s after previous -> dropped
            {"start_time": 20.0, "duration": 4.0},
        ]
        result = filter_scene_cuts(scenes, min_duration=2.0, min_gap=5.0)
        assert [s["start_time"] for s in result] == [10.0, 20.0]

    def test_empty_input(self):
        assert filter_scene_cuts([]) == []
        assert filter_scene_cuts(None) == []

    def test_caps_list_length(self):
        scenes = [{"start_time": i * 10.0, "duration": 5.0} for i in range(100)]
        result = filter_scene_cuts(scenes, min_duration=2.0, min_gap=5.0, max_cuts=3)
        assert len(result) == 3


class TestPrompt:
    def test_build_prompt_includes_metadata_and_rules(self):
        video = FakeVideo(
            scenes=[
                {"start_time": 17.4, "duration": 12.0},
                {"start_time": 45.1, "duration": 8.0},
            ],
            transcript=[{"start": 1.0, "end": 3.0, "text": "hello everyone"}],
        )
        prompt = build_prompt(video, video.transcript, series_context="Project: Travel", extra_rules="Keep titles short")
        assert "Project: Travel" in prompt
        assert "clip.mp4" in prompt
        assert "17.4s" in prompt
        assert "hello everyone" in prompt
        assert "Keep titles short" in prompt
        assert "0:00" in prompt

    def test_build_prompt_no_transcript(self):
        video = FakeVideo(scenes=[{"start_time": 5.0, "duration": 10.0}])
        prompt = build_prompt(video, [], series_context=None)
        assert "TRANSCRIPT: none available." in prompt
        assert "SERIES_CONTEXT" in prompt


class TestGenerateChapters:
    def test_no_key_raises(self):
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            generate_chapters("prompt", api_key=None)

    def test_explicit_empty_env_is_ignored(self, monkeypatch):
        monkeypatch.setenv("GEMINI_API_KEY", "")
        with pytest.raises(ValueError, match="GEMINI_API_KEY"):
            generate_chapters("prompt")

    def test_parses_gemini_json_response(self, monkeypatch):
        import json
        import backend.chapters as chapters_module

        payload = {
            "candidates": [{
                "content": {
                    "parts": [{
                        "text": '[{"time": 0, "title": "Hook"}, {"time": 17, "title": "The climb"}]'
                    }]
                }
            }]
        }

        class FakeResponse:
            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

            def read(self):
                return json.dumps(payload).encode("utf-8")

        def fake_urlopen(request, timeout=0):
            assert "generateContent" in request.full_url
            assert "key=test-key" in request.full_url
            return FakeResponse()

        monkeypatch.setattr(chapters_module.urllib.request, "urlopen", fake_urlopen)
        result = generate_chapters("prompt", api_key="test-key")
        assert result == [
            {"time": 0, "title": "Hook"},
            {"time": 17, "title": "The climb"},
        ]


class TestTimestamps:
    def test_to_hhmmss(self):
        assert to_hhmmss(0) == "00:00"
        assert to_hhmmss(65) == "01:05"
        assert to_hhmmss(3661) == "1:01:01"

    def test_parse_timestamp(self):
        assert parse_timestamp("0:00") == 0
        assert parse_timestamp("1:05") == 65
        assert parse_timestamp("1:01:01") == 3661
        assert parse_timestamp("garbage") == 0