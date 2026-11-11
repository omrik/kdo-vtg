"""
Unit tests for backend.editor_export — no container required.

    pytest tests/test_editor_export.py -v
"""

import csv
import io
import xml.etree.ElementTree as ET
from fractions import Fraction

from backend.editor_export import (
    frame_rate,
    frames_to_tc,
    fcp_time,
    map_path,
    to_file_url,
    generate_fcpxml,
    generate_premiere_xml,
    generate_resolve_csv,
    generate_edl,
    scene_markers,
)


class FakeVideo:
    def __init__(self, **kw):
        self.id = kw.get("id", 1)
        self.filename = kw.get("filename", "clip one.mp4")
        self.filepath = kw.get("filepath", "/media/Trip/clip one.mp4")
        self.duration = kw.get("duration", 10.0)
        self.fps = kw.get("fps", 29.97002997)
        self.width = kw.get("width", 3840)
        self.height = kw.get("height", 2160)
        self.tags = kw.get("tags", ["person", "car"])
        self.shot_types = kw.get("shot_types", {"dominant_shot": "WS"})
        self.scenes = kw.get("scenes", [
            {"start_time": 0.0, "duration": 4.0},
            {"start_time": 4.0, "duration": 0.03},   # noise, dropped
            {"start_time": 6.0, "duration": 4.0},
        ])
        self.chapters = kw.get("chapters", [{"time": 0, "title": "Intro"}, {"time": 5, "title": "Drive"}])
        self.rating = kw.get("rating", 5)
        self.camera_type = kw.get("camera_type", "DJI")
        self.gps_data = kw.get("gps_data", {"latitude": 45.1, "longitude": 7.6})
        self.transcript = kw.get("transcript", [{"start": 0, "end": 2, "text": " hello there "}])


class TestTiming:
    def test_frame_rate_snaps_ntsc(self):
        assert frame_rate(29.97002997) == Fraction(30000, 1001)
        assert frame_rate(23.976) == Fraction(24000, 1001)
        assert frame_rate(59.94) == Fraction(60000, 1001)
        assert frame_rate(25.0) == Fraction(25)
        assert frame_rate(None) == Fraction(25)

    def test_timecode(self):
        assert frames_to_tc(0, Fraction(25)) == "00:00:00:00"
        assert frames_to_tc(25 * 3661 + 7, Fraction(25)) == "01:01:01:07"
        assert frames_to_tc(30, Fraction(30000, 1001)) == "00:00:01:00"

    def test_fcp_time(self):
        assert fcp_time(0, Fraction(25)) == "0s"
        assert fcp_time(50, Fraction(25)) == "2s"
        assert fcp_time(1, Fraction(30000, 1001)) == "1001/30000s"


class TestPaths:
    def test_map_posix(self):
        assert map_path("/media/Trip/a.mp4", "/media", "/Volumes/video") == "/Volumes/video/Trip/a.mp4"

    def test_map_windows_drive_and_unc(self):
        assert map_path("/media/Trip/a.mp4", "/media", "Z:\\video") == "Z:\\video\\Trip\\a.mp4"
        assert map_path("/media/a.mp4", "/media/", "\\\\NAS\\video\\") == "\\\\NAS\\video\\a.mp4"

    def test_map_untouched_outside_root_or_unset(self):
        assert map_path("/other/a.mp4", "/media", "/Volumes/x") == "/other/a.mp4"
        assert map_path("/media/a.mp4", "/media", None) == "/media/a.mp4"
        assert map_path("/media2/a.mp4", "/media", "/Volumes/x") == "/media2/a.mp4"

    def test_file_urls(self):
        assert to_file_url("/Volumes/my video/a.mp4") == "file:///Volumes/my%20video/a.mp4"
        assert to_file_url("/x/a.mp4", localhost=True) == "file://localhost/x/a.mp4"
        assert to_file_url("Z:\\v\\a b.mp4") == "file:///Z:/v/a%20b.mp4"
        assert to_file_url("\\\\NAS\\video\\a.mp4") == "file://NAS/video/a.mp4"


class TestMarkers:
    def test_scene_markers_skip_noise_and_zero(self):
        assert scene_markers(FakeVideo()) == [(6.0, "Scene 2")]


class TestFCPXML:
    def test_wellformed_with_keywords_markers_timeline(self):
        xml = generate_fcpxml([FakeVideo(), FakeVideo(id=2, filename="b.mov", filepath="/media/b.mov", fps=25, rating=2)],
                              editor_root="/Volumes/video")
        root = ET.fromstring(xml.split("\n", 2)[2])  # skip XML decl + DOCTYPE
        assert root.tag == "fcpxml" and root.get("version") == "1.9"
        formats = root.findall("./resources/format")
        assert {f.get("frameDuration") for f in formats} == {"1001/30000s", "1/25s"}
        reps = [m.get("src") for m in root.iter("media-rep")]
        assert reps[0] == "file:///Volumes/video/Trip/clip%20one.mp4"
        event_clips = root.findall("./library/event/asset-clip")
        assert len(event_clips) == 2
        first = event_clips[0]
        assert first.find("keyword").get("value") == "person, car, WS"
        assert [m.get("value") for m in first.findall("marker")] == ["Scene 2"]
        assert [m.get("value") for m in first.findall("chapter-marker")] == ["Intro", "Drive"]
        assert first.find("rating").get("value") == "favorite"
        assert event_clips[1].find("rating") is None
        spine = root.findall("./library/event/project/sequence/spine/asset-clip")
        assert [c.get("offset") for c in spine] == ["0s", "1001/100s"]  # 300 frames @ 29.97 = 10.01s

    def test_no_timeline(self):
        xml = generate_fcpxml([FakeVideo()], include_timeline=False)
        assert "<project" not in xml


class TestPremiere:
    def test_wellformed_bin_and_sequence(self):
        xml = generate_premiere_xml([FakeVideo(), FakeVideo(id=2, filename="b.mov", filepath="/media/b.mov")],
                                    editor_root="/Volumes/video")
        root = ET.fromstring(xml.split("\n", 2)[2])
        clips = root.findall("./project/children/bin/children/clip")
        assert len(clips) == 2
        c = clips[0]
        assert c.find("rate/timebase").text == "30" and c.find("rate/ntsc").text == "TRUE"
        assert c.find("duration").text == "300"
        assert c.find("logginginfo/lognote").text == "person, car, WS"
        assert c.find("logginginfo/good").text == "TRUE"
        assert c.find(".//file/pathurl").text == "file://localhost/Volumes/video/Trip/clip%20one.mp4"
        assert [m.find("name").text for m in c.findall("marker")] == ["Scene 2", "Intro", "Drive"]
        seq = root.find("./project/children/sequence")
        v = seq.findall("./media/video/track/clipitem")
        assert [(i.find("start").text, i.find("end").text) for i in v] == [("0", "300"), ("300", "600")]
        assert len(seq.findall("./media/audio/track/clipitem")) == 2


class TestResolveCSV:
    def test_columns_and_mapping(self):
        rows = list(csv.DictReader(io.StringIO(generate_resolve_csv([FakeVideo()], editor_root="/Volumes/video"))))
        assert rows[0]["File Name"] == "clip one.mp4"
        assert rows[0]["Clip Directory"] == "/Volumes/video/Trip"
        assert rows[0]["Keywords"] == "person, car, WS"
        assert rows[0]["Good Take"] == "1"
        assert rows[0]["Comments"] == "hello there"
        assert rows[0]["Location"] == "45.1, 7.6"


class TestEDL:
    def test_record_timecodes_accumulate(self):
        edl = generate_edl([FakeVideo(fps=25, duration=10), FakeVideo(id=2, filename="b.mov", fps=25, duration=4.5)])
        events = [l for l in edl.splitlines() if l[:3].isdigit()]
        assert events[0].split()[-4:] == ["00:00:00:00", "00:00:10:00", "01:00:00:00", "01:00:10:00"]
        assert events[1].split()[-4:] == ["00:00:00:00", "00:00:04:12", "01:00:10:00", "01:00:14:12"]
        assert "* FROM CLIP NAME: b.mov" in edl
        assert "* MARKER 01:00:06:00: Scene 2" in edl
        assert "FCM: NON-DROP FRAME" in edl

    def test_ntsc_timeline_starts_at_one_hour(self):
        edl = generate_edl([FakeVideo(fps=29.97002997, duration=8.008, camera_type="Unknown")])
        event = [l for l in edl.splitlines() if l.startswith("001")][0].split()
        assert event[-4:] == ["00:00:00:00", "00:00:08:00", "01:00:00:00", "01:00:08:00"]
        assert "Unknown" not in edl

    def test_reel_names_are_valid(self):
        edl = generate_edl([FakeVideo(filename="a very long file name.mp4")])
        reel = [l for l in edl.splitlines() if l.startswith("001")][0].split()[1]
        assert len(reel) <= 8 and reel.isalnum()
