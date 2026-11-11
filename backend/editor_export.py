"""NLE-native exports: FCPXML, Premiere (FCP7 XML), DaVinci Resolve metadata CSV, CMX 3600 EDL.

Pure functions over Video-like objects (anything with the Video model's
attributes), so they can be unit tested without a database.

Paths: the container sees footage under ``/media`` while the editor's machine
sees the same files at e.g. ``/Volumes/video`` (macOS SMB mount),
``Z:\\video`` or ``\\\\NAS\\video`` (Windows). ``map_path`` rewrites the
container prefix to the editor's prefix so the NLE can link media directly.
"""

from __future__ import annotations

import csv
import io
import os
import posixpath
from fractions import Fraction
from typing import Iterable, Optional
from urllib.parse import quote
from xml.sax.saxutils import escape, quoteattr

from backend.chapters import filter_scene_cuts

DEFAULT_FPS = 25.0
APP_NAME = "KDO Video Tagger"

# Standard broadcast rates, keyed by the rounded value of fps * 1000.
_NTSC_RATES = {
    23976: Fraction(24000, 1001),
    29970: Fraction(30000, 1001),
    47952: Fraction(48000, 1001),
    59940: Fraction(60000, 1001),
    119880: Fraction(120000, 1001),
}


# ---------------------------------------------------------------- helpers

def frame_rate(fps: Optional[float]) -> Fraction:
    """Exact frame rate for a probed (possibly float-noisy) fps value."""
    if not fps or fps <= 0:
        fps = DEFAULT_FPS
    for key, exact in _NTSC_RATES.items():
        if abs(fps * 1000 - key) < 15:
            return exact
    rounded = round(fps)
    if abs(fps - rounded) < 0.01:
        return Fraction(rounded, 1)
    return Fraction(fps).limit_denominator(1001)


def is_ntsc(rate: Fraction) -> bool:
    return rate.denominator == 1001


def timebase(rate: Fraction) -> int:
    """Integer timebase as used by timecode and FCP7 XML (29.97 -> 30)."""
    return int(round(float(rate)))


def to_frames(seconds: Optional[float], rate: Fraction) -> int:
    return max(0, int(round((seconds or 0) * rate)))


def frames_to_tc(frames: int, rate: Fraction) -> str:
    """Non-drop-frame SMPTE timecode HH:MM:SS:FF."""
    fps = timebase(rate)
    frames = max(0, int(frames))
    ff = frames % fps
    total_seconds = frames // fps
    return f"{total_seconds // 3600:02d}:{total_seconds // 60 % 60:02d}:{total_seconds % 60:02d}:{ff:02d}"


def fcp_time(frames: int, rate: Fraction) -> str:
    """FCPXML rational time for a whole number of frames, e.g. '3003/30000s'."""
    value = Fraction(int(frames)) / rate
    if value == 0:
        return "0s"
    if value.denominator == 1:
        return f"{value.numerator}s"
    return f"{value.numerator}/{value.denominator}s"


def frame_duration(rate: Fraction) -> str:
    return fcp_time(1, rate)


def map_path(filepath: str, media_root: str = "/media", editor_root: Optional[str] = None) -> str:
    """Rewrite a container path to the path the editor's machine uses."""
    if not editor_root:
        return filepath
    media_root = (media_root or "/media").rstrip("/") or "/"
    norm = filepath.replace("\\", "/")
    if norm == media_root:
        rel = ""
    elif norm.startswith(media_root.rstrip("/") + "/"):
        rel = norm[len(media_root.rstrip("/")) + 1:]
    else:
        return filepath
    root = editor_root.rstrip("/\\")
    windows = "\\" in editor_root or (len(root) >= 2 and root[1] == ":")
    if windows:
        return root + ("\\" + rel.replace("/", "\\") if rel else "")
    return root + ("/" + rel if rel else "")


def to_file_url(path: str, localhost: bool = False) -> str:
    """file:// URL for a POSIX, Windows-drive or UNC path."""
    if path.startswith("\\\\"):  # UNC \\server\share\dir\file
        parts = path.lstrip("\\").split("\\")
        return "file://" + quote(parts[0]) + "/" + "/".join(quote(p) for p in parts[1:])
    if len(path) >= 2 and path[1] == ":":  # C:\dir\file
        rest = path.replace("\\", "/")
        prefix = "file://localhost/" if localhost else "file:///"
        return prefix + rest[:2] + quote(rest[2:])
    host = "localhost" if localhost else ""
    return f"file://{host}" + quote(path.replace("\\", "/"))


def clip_name(video) -> str:
    return os.path.splitext(video.filename or "clip")[0]


def keywords_for(video) -> list[str]:
    words: list[str] = []
    for tag in video.tags or []:
        if tag and tag not in words:
            words.append(str(tag))
    shot = (video.shot_types or {}).get("dominant_shot") if video.shot_types else None
    if shot and shot not in words:
        words.append(shot)
    return words


def description_for(video) -> str:
    bits = []
    if video.rating:
        bits.append("★" * int(video.rating))
    shot = (video.shot_types or {}).get("dominant_shot") if video.shot_types else None
    if shot:
        bits.append(f"Shot: {shot}")
    if video.camera_type and video.camera_type.lower() != "unknown":
        bits.append(f"Camera: {video.camera_type}")
    gps = video.gps_data or {}
    if gps.get("latitude") is not None and gps.get("longitude") is not None:
        bits.append(f"GPS: {gps['latitude']}, {gps['longitude']}")
    return " | ".join(bits)


def transcript_text(video, limit: int = 2000) -> str:
    text = " ".join((seg.get("text") or "").strip() for seg in (video.transcript or []))
    text = " ".join(text.split())
    return text[:limit]


def scene_markers(video, max_markers: int = 40) -> list[tuple[float, str]]:
    """(seconds, label) for meaningful scene cuts. Scene 1 starts at 0 and
    gets no marker; later cuts are labelled Scene 2, Scene 3, ..."""
    cuts = filter_scene_cuts(video.scenes or [], max_cuts=max_markers)
    starts = [float(s.get("start_time") or 0) for s in cuts]
    starts = [t for t in starts if t > 0.05]
    return [(t, f"Scene {n}") for n, t in enumerate(starts, 2)]


def chapter_markers(video) -> list[tuple[float, str]]:
    out = []
    for ch in video.chapters or []:
        try:
            out.append((float(ch.get("time") or 0), str(ch.get("title") or "Chapter")))
        except (TypeError, ValueError, AttributeError):
            continue
    return out


def clip_frames(video, rate: Fraction) -> int:
    return max(1, to_frames(video.duration or 0, rate))


# ---------------------------------------------------------------- FCPXML

def generate_fcpxml(
    videos: Iterable,
    media_root: str = "/media",
    editor_root: Optional[str] = None,
    event_name: str = APP_NAME,
    include_timeline: bool = True,
    timeline_name: str = "KDO Selects",
) -> str:
    """FCPXML 1.9: an event with one tagged asset-clip per video plus an
    optional selects timeline. Imports into Final Cut Pro 10.6+ and DaVinci
    Resolve 17+ (File > Import > Timeline). Tags become keywords (FCP keyword
    collections / Resolve keywords), scene cuts become markers, AI chapters
    become chapter markers, 4-5 star clips are marked favorite.
    """
    videos = list(videos)
    formats: dict[tuple, str] = {}
    res_lines: list[str] = []
    clips: list[tuple] = []
    next_id = 1

    for video in videos:
        rate = frame_rate(video.fps)
        key = (rate, video.width or 1920, video.height or 1080)
        if key not in formats:
            fid = f"r{next_id}"
            next_id += 1
            formats[key] = fid
            res_lines.append(
                f'    <format id="{fid}" frameDuration="{frame_duration(rate)}" '
                f'width="{key[1]}" height="{key[2]}"/>'
            )
        aid = f"r{next_id}"
        next_id += 1
        frames = clip_frames(video, rate)
        url = to_file_url(map_path(video.filepath, media_root, editor_root))
        res_lines.append(
            f'    <asset id="{aid}" name={quoteattr(clip_name(video))} start="0s" '
            f'duration="{fcp_time(frames, rate)}" hasVideo="1" format="{formats[key]}" '
            f'hasAudio="1" videoSources="1" audioSources="1" audioChannels="2" audioRate="48000">'
        )
        res_lines.append(f'      <media-rep kind="original-media" src={quoteattr(url)}/>')
        res_lines.append("    </asset>")
        clips.append((video, aid, formats[key], rate, frames))

    def clip_body(video, rate, frames, indent):
        pad = " " * indent
        lines = []
        desc = description_for(video)
        if desc:
            lines.append(f"{pad}<note>{escape(desc)}</note>")
        one = frame_duration(rate)
        for seconds, label in scene_markers(video):
            f = to_frames(seconds, rate)
            if f < frames:
                lines.append(f'{pad}<marker start="{fcp_time(f, rate)}" duration="{one}" value={quoteattr(label)}/>')
        for seconds, title in chapter_markers(video):
            f = to_frames(seconds, rate)
            if f < frames:
                lines.append(
                    f'{pad}<chapter-marker start="{fcp_time(f, rate)}" duration="{one}" '
                    f'value={quoteattr(title)} posterOffset="0s"/>'
                )
        if video.rating and int(video.rating) >= 4:
            lines.append(f'{pad}<rating start="0s" duration="{fcp_time(frames, rate)}" value="favorite"/>')
        words = keywords_for(video)
        if words:
            lines.append(
                f'{pad}<keyword start="0s" duration="{fcp_time(frames, rate)}" '
                f'value={quoteattr(", ".join(w.replace(",", " ") for w in words))}/>'
            )
        return lines

    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<!DOCTYPE fcpxml>", '<fcpxml version="1.9">', "  <resources>"]
    out.extend(res_lines)
    out.append("  </resources>")
    out.append("  <library>")
    out.append(f"    <event name={quoteattr(event_name)}>")
    for video, aid, fid, rate, frames in clips:
        out.append(
            f'      <asset-clip ref="{aid}" name={quoteattr(clip_name(video))} start="0s" '
            f'duration="{fcp_time(frames, rate)}" format="{fid}" tcFormat="NDF">'
        )
        out.extend(clip_body(video, rate, frames, 8))
        out.append("      </asset-clip>")

    if include_timeline and clips:
        seq_rate = clips[0][3]
        seq_fid = clips[0][2]
        offset = 0
        spine = []
        for video, aid, fid, rate, frames in clips:
            # Express each clip on the sequence's frame grid.
            seq_frames = max(1, int(Fraction(frames) / rate * seq_rate))
            spine.append(
                f'            <asset-clip ref="{aid}" name={quoteattr(clip_name(video))} '
                f'offset="{fcp_time(offset, seq_rate)}" start="0s" '
                f'duration="{fcp_time(seq_frames, seq_rate)}" format="{fid}" tcFormat="NDF">'
            )
            spine.extend(clip_body(video, rate, frames, 14))
            spine.append("            </asset-clip>")
            offset += seq_frames
        out.append(f"      <project name={quoteattr(timeline_name)}>")
        out.append(
            f'        <sequence format="{seq_fid}" duration="{fcp_time(offset, seq_rate)}" '
            f'tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">'
        )
        out.append("          <spine>")
        out.extend(spine)
        out.append("          </spine>")
        out.append("        </sequence>")
        out.append("      </project>")

    out.append("    </event>")
    out.append("  </library>")
    out.append("</fcpxml>")
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- Premiere (FCP7 xmeml)

def _rate_xml(rate: Fraction, pad: str) -> list[str]:
    return [
        f"{pad}<rate>",
        f"{pad}  <timebase>{timebase(rate)}</timebase>",
        f"{pad}  <ntsc>{'TRUE' if is_ntsc(rate) else 'FALSE'}</ntsc>",
        f"{pad}</rate>",
    ]


def _xmeml_frames(video, rate: Fraction) -> int:
    # xmeml counts frames at the integer timebase (29.97 counted as 30).
    return max(1, int(round((video.duration or 0) * float(rate))))


def generate_premiere_xml(
    videos: Iterable,
    media_root: str = "/media",
    editor_root: Optional[str] = None,
    bin_name: str = APP_NAME,
    include_timeline: bool = True,
    timeline_name: str = "KDO Selects",
) -> str:
    """Final Cut Pro 7 XML (xmeml v4), the interchange format Premiere Pro
    imports via File > Import. Produces a bin of master clips with markers,
    log notes (tags) and a description, plus an optional selects sequence.
    """
    videos = list(videos)
    out = ['<?xml version="1.0" encoding="UTF-8"?>', "<!DOCTYPE xmeml>", '<xmeml version="4">', "  <project>",
           f"    <name>{escape(bin_name)}</name>", "    <children>", "      <bin>",
           f"        <name>{escape(bin_name)}</name>", "        <children>"]

    def file_xml(idx, video, rate, frames, pad, full=True):
        if not full:
            return [f'{pad}<file id="file-{idx}"/>']
        path = map_path(video.filepath, media_root, editor_root)
        lines = [f'{pad}<file id="file-{idx}">',
                 f"{pad}  <name>{escape(video.filename or '')}</name>",
                 f"{pad}  <pathurl>{escape(to_file_url(path, localhost=True))}</pathurl>"]
        lines += _rate_xml(rate, pad + "  ")
        lines += [f"{pad}  <duration>{frames}</duration>",
                  f"{pad}  <media>",
                  f"{pad}    <video>",
                  f"{pad}      <samplecharacteristics>"]
        lines += _rate_xml(rate, pad + "        ")
        lines += [f"{pad}        <width>{video.width or 1920}</width>",
                  f"{pad}        <height>{video.height or 1080}</height>",
                  f"{pad}      </samplecharacteristics>",
                  f"{pad}    </video>",
                  f"{pad}    <audio>",
                  f"{pad}      <channelcount>2</channelcount>",
                  f"{pad}    </audio>",
                  f"{pad}  </media>",
                  f"{pad}</file>"]
        return lines

    def markers_xml(video, rate, frames, pad):
        lines = []
        for seconds, label in scene_markers(video) + chapter_markers(video):
            f = int(round(seconds * float(rate)))
            if f < frames:
                lines += [f"{pad}<marker>", f"{pad}  <name>{escape(label)}</name>", f"{pad}  <comment></comment>",
                          f"{pad}  <in>{f}</in>", f"{pad}  <out>-1</out>", f"{pad}</marker>"]
        return lines

    clip_meta = []
    for idx, video in enumerate(videos, 1):
        rate = frame_rate(video.fps)
        frames = _xmeml_frames(video, rate)
        clip_meta.append((idx, video, rate, frames))
        pad = "          "
        out.append(f'{pad}<clip id="masterclip-{idx}">')
        out.append(f"{pad}  <name>{escape(video.filename or '')}</name>")
        out.append(f"{pad}  <duration>{frames}</duration>")
        out += _rate_xml(rate, pad + "  ")
        out += [f"{pad}  <in>-1</in>", f"{pad}  <out>-1</out>",
                f"{pad}  <masterclipid>masterclip-{idx}</masterclipid>",
                f"{pad}  <ismasterclip>TRUE</ismasterclip>",
                f"{pad}  <logginginfo>",
                f"{pad}    <description>{escape(description_for(video))}</description>",
                f"{pad}    <scene>{escape((video.shot_types or {}).get('dominant_shot', '') if video.shot_types else '')}</scene>",
                f"{pad}    <shottake></shottake>",
                f"{pad}    <lognote>{escape(', '.join(keywords_for(video)))}</lognote>",
                f"{pad}    <good>{'TRUE' if (video.rating or 0) >= 4 else 'FALSE'}</good>",
                f"{pad}  </logginginfo>",
                f"{pad}  <comments>",
                f"{pad}    <mastercomment1>{escape(', '.join(keywords_for(video)))}</mastercomment1>",
                f"{pad}    <mastercomment2>{escape(transcript_text(video, 500))}</mastercomment2>",
                f"{pad}  </comments>"]
        out += markers_xml(video, rate, frames, pad + "  ")
        out += [f"{pad}  <media>", f"{pad}    <video>", f"{pad}      <track>",
                f'{pad}        <clipitem id="clipitem-{idx}">',
                f"{pad}          <masterclipid>masterclip-{idx}</masterclipid>",
                f"{pad}          <name>{escape(video.filename or '')}</name>",
                f"{pad}          <duration>{frames}</duration>"]
        out += _rate_xml(rate, pad + "          ")
        out += [f"{pad}          <start>0</start>", f"{pad}          <end>{frames}</end>",
                f"{pad}          <in>0</in>", f"{pad}          <out>{frames}</out>"]
        out += file_xml(idx, video, rate, frames, pad + "          ")
        out += [f"{pad}        </clipitem>", f"{pad}      </track>", f"{pad}    </video>", f"{pad}  </media>",
                f"{pad}</clip>"]

    out += ["        </children>", "      </bin>"]

    if include_timeline and clip_meta:
        seq_rate = clip_meta[0][2]
        pad = "      "
        total = 0
        v_items, a_items = [], []
        for idx, video, rate, frames in clip_meta:
            seq_frames = max(1, int(round((video.duration or 0) * float(seq_rate))))
            for kind, items in (("v", v_items), ("a", a_items)):
                ip = pad + "          "
                items.append(f'{ip}<clipitem id="seq-{kind}-{idx}">')
                items += [f"{ip}  <masterclipid>masterclip-{idx}</masterclipid>",
                          f"{ip}  <name>{escape(video.filename or '')}</name>",
                          f"{ip}  <duration>{frames}</duration>"]
                items += _rate_xml(seq_rate, ip + "  ")
                items += [f"{ip}  <start>{total}</start>", f"{ip}  <end>{total + seq_frames}</end>",
                          f"{ip}  <in>0</in>", f"{ip}  <out>{seq_frames}</out>"]
                items += file_xml(idx, video, rate, frames, ip + "  ", full=False)
                if kind == "a":
                    items += [f"{ip}  <sourcetrack>", f"{ip}    <mediatype>audio</mediatype>",
                              f"{ip}    <trackindex>1</trackindex>", f"{ip}  </sourcetrack>"]
                items.append(f"{ip}</clipitem>")
            total += seq_frames
        out.append(f'{pad}<sequence id="sequence-1">')
        out.append(f"{pad}  <name>{escape(timeline_name)}</name>")
        out.append(f"{pad}  <duration>{total}</duration>")
        out += _rate_xml(seq_rate, pad + "  ")
        first = clip_meta[0][1]
        out += [f"{pad}  <media>", f"{pad}    <video>", f"{pad}      <format>", f"{pad}        <samplecharacteristics>"]
        out += _rate_xml(seq_rate, pad + "          ")
        out += [f"{pad}          <width>{first.width or 1920}</width>",
                f"{pad}          <height>{first.height or 1080}</height>",
                f"{pad}        </samplecharacteristics>", f"{pad}      </format>",
                f"{pad}      <track>"]
        out += v_items
        out += [f"{pad}      </track>", f"{pad}    </video>", f"{pad}    <audio>", f"{pad}      <track>"]
        out += a_items
        out += [f"{pad}      </track>", f"{pad}    </audio>", f"{pad}  </media>", f"{pad}</sequence>"]

    out += ["    </children>", "  </project>", "</xmeml>"]
    return "\n".join(out) + "\n"


# ---------------------------------------------------------------- DaVinci Resolve metadata CSV

RESOLVE_COLUMNS = [
    "File Name", "Clip Directory", "Keywords", "Description", "Comments",
    "Shot", "Scene", "Good Take", "Camera Type", "Location",
]


def generate_resolve_csv(videos: Iterable, media_root: str = "/media", editor_root: Optional[str] = None) -> str:
    """CSV for DaVinci Resolve Media Pool > select clips > right-click >
    Import Metadata. Resolve matches rows by File Name (and Clip Directory
    when the path mapping is set), then fills Keywords, Description, etc.
    """
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(RESOLVE_COLUMNS)
    for video in videos:
        path = map_path(video.filepath, media_root, editor_root)
        directory = path.rsplit("\\", 1)[0] if ("\\" in path and "/" not in path) else posixpath.dirname(path)
        gps = video.gps_data or {}
        location = ""
        if gps.get("latitude") is not None and gps.get("longitude") is not None:
            location = f"{gps['latitude']}, {gps['longitude']}"
        shot = (video.shot_types or {}).get("dominant_shot", "") if video.shot_types else ""
        writer.writerow([
            video.filename,
            directory,
            ", ".join(keywords_for(video)),
            description_for(video),
            transcript_text(video, 1000),
            shot,
            "",
            "1" if (video.rating or 0) >= 4 else "",
            "" if (video.camera_type or "").lower() == "unknown" else (video.camera_type or ""),
            location,
        ])
    return buf.getvalue()


# ---------------------------------------------------------------- CMX 3600 EDL

def _reel_name(index: int) -> str:
    return f"AX{index:03d}"[:8]


def generate_edl(
    videos: Iterable,
    media_root: str = "/media",
    editor_root: Optional[str] = None,
    title: str = "KDO Selects",
    fps: Optional[float] = None,
    with_markers: bool = True,
) -> str:
    """CMX 3600 EDL laying every clip end to end on one video track.

    Record timecodes accumulate on a single timeline rate (``fps``, default:
    the first clip's rate), clip names and source paths ride in comments so
    Premiere and Resolve can relink, and scene cuts/chapters become Resolve
    ``* MARKER`` comments.
    """
    videos = list(videos)
    rate = frame_rate(fps or (videos[0].fps if videos else None))
    lines = [f"TITLE: {title}", "FCM: NON-DROP FRAME", ""]
    record = 3600 * timebase(rate)  # 01:00:00:00 in non-drop timecode
    for i, video in enumerate(videos, 1):
        length = clip_frames(video, rate)
        src_in, src_out = 0, length
        rec_in, rec_out = record, record + length
        lines.append(
            f"{i:03d}  {_reel_name(i):<8} V     C        "
            f"{frames_to_tc(src_in, rate)} {frames_to_tc(src_out, rate)} "
            f"{frames_to_tc(rec_in, rate)} {frames_to_tc(rec_out, rate)}"
        )
        lines.append(f"* FROM CLIP NAME: {video.filename}")
        lines.append(f"* SOURCE FILE: {map_path(video.filepath, media_root, editor_root)}")
        words = keywords_for(video)
        if words:
            lines.append(f"* KEYWORDS: {', '.join(words)}")
        desc = description_for(video)
        if desc:
            lines.append(f"* COMMENT: {desc}")
        if with_markers:
            for seconds, label in scene_markers(video) + chapter_markers(video):
                f = to_frames(seconds, rate)
                if f < length:
                    lines.append(f"* MARKER {frames_to_tc(rec_in + f, rate)}: {label}")
        lines.append("")
        record = rec_out
    return "\n".join(lines)
