import json
import os
import urllib.error
import urllib.request

GEMINI_DEFAULT_MODEL = "gemini-2.5-flash"
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def filter_scene_cuts(scenes: list, min_duration: float = 2.0, min_gap: float = 5.0, max_cuts: int = 40) -> list:
    """Drop noisy short scenes and cuts too close to the previous kept cut.

    Keep the earliest cut; de-dupes the ~0.03s single-frame cuts that the frame
    differencing scene detector emits. Returns a list of scene dicts sorted by
    start_time.
    """
    if not scenes:
        return []

    valid = [s for s in scenes if s.get("duration", 0) >= min_duration]
    valid.sort(key=lambda s: s.get("start_time", 0))

    kept = []
    last_kept_time = None
    for scene in valid:
        start = scene.get("start_time", 0)
        if last_kept_time is not None and start - last_kept_time < min_gap:
            continue
        kept.append(scene)
        last_kept_time = start
        if len(kept) >= max_cuts:
            break

    return kept


def to_hhmmss(seconds: float) -> str:
    seconds = max(0, int(round(seconds)))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    if h:
        return f"{h}:{m:02d}:{s:02d}"
    return f"{m:02d}:{s:02d}"


def parse_timestamp(value: str) -> int:
    """Parse '0:00', '00:00', '1:23:45' style timestamps to seconds."""
    value = value.strip().replace(",", ".")
    parts = [p for p in value.split(":") if p.strip() != ""]
    seconds = 0
    for part in parts:
        try:
            seconds = seconds * 60 + float(part)
        except ValueError:
            return 0
    return int(round(seconds))


def build_prompt(
    video: object,
    transcript: list,
    series_context: str = None,
    extra_rules: str = None,
) -> str:
    """Assemble the chapter-planning prompt from existing kdo-vtg index data."""
    lines = []
    lines.append("You are planning YouTube chapters for a creator's video series. "
                 "Use only the real scene-cut timestamps provided. Never invent timestamps. "
                 "Chapter titles should come from on-screen and spoken cues.")

    if series_context:
        lines.append("\nSERIES_CONTEXT:\n" + series_context.strip())
    else:
        lines.append("\nSERIES_CONTEXT: standalone video (no series).")

    meta = []
    meta.append(f"filename: {video.filename}")
    if video.duration:
        meta.append(f"duration: {round(video.duration)}s")
    if video.fps:
        meta.append(f"fps: {video.fps}")
    if video.camera_type:
        meta.append(f"camera_type: {video.camera_type}")
    if video.gps_data:
        meta.append(f"gps: {json.dumps(video.gps_data, ensure_ascii=False)}")
    if video.color_palette:
        meta.append(f"color_palette: {json.dumps(video.color_palette, ensure_ascii=False)}")
    lines.append("\nVIDEO METADATA:\n" + "\n".join(meta))

    tags = video.tags or []
    if tags:
        lines.append("\nOBJECTS DETECTED (YOLO tags):\n" + ", ".join(sorted(set(tags))))

    scenes = video.scenes or []
    cuts = filter_scene_cuts(scenes)
    if cuts:
        lines.append("\nSCENE CUTS (seconds, filtered):\n" +
                     ", ".join(f"{c.get('start_time', 0):.1f}s" for c in cuts))
        scene_objects = []
        for c in cuts[:40]:
            scene_objects.append(
                f"scene@{c.get('start_time', 0):.1f}s: {', '.join(sorted(set(tags))) or 'no objects'}"
            )
        lines.append("\nPER-SCENE YOLO:\n" + "\n".join(scene_objects))
    else:
        lines.append("\nSCENE CUTS: none detected (use transcript timing).")

    shot_types = video.shot_types
    if shot_types:
        lines.append("\nSHOT TYPES:\n" + json.dumps(shot_types, ensure_ascii=False))

    if transcript:
        transcript_lines = [
            f"[{to_hhmmss(item.get('start', 0))}] {item.get('text', '')}"
            for item in transcript
        ]
        lines.append("\nTRANSCRIPT (timestamped):\n" + "\n".join(transcript_lines))
    else:
        lines.append("\nTRANSCRIPT: none available.")

    rules = [
        "Max 4 chapters per 10 minutes of video.",
        "First chapter must be a hook and start at 0:00, title <= 60s worth of content concern.",
        "Use real scene-cut timestamps; title from on-screen and spoken cues.",
        "Match naming style of sibling episodes when provided in SERIES_CONTEXT.",
    ]
    if extra_rules:
        rules.append(extra_rules.strip())
    lines.append("\nRULES:\n" + "\n".join("- " + r for r in rules))

    lines.append("\nOUTPUT: strict JSON array only, no markdown, no prose. "
                 "Format: [{\"time\": 0, \"title\": \"...\"}, ...] where time is integer seconds "
                 "rounded down to the nearest chapter second from the scene cuts above.")
    return "\n".join(lines)


def _extract_json_array(text: str) -> list:
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON array in model response")
    raw = text[start:end + 1]
    return json.loads(raw)


def generate_chapters(prompt: str, api_key: str = None, model: str = GEMINI_DEFAULT_MODEL) -> list:
    """Call Gemini to plan chapters. Returns [{"time": int, "title": str}, ...].

    Raises ValueError if no api_key is provided (or GEMINI_API_KEY env not set).
    """
    key = api_key or os.environ.get("GEMINI_API_KEY")
    if not key:
        raise ValueError("GEMINI_API_KEY is not set")

    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
        },
    }
    url = GEMINI_ENDPOINT.format(model=model) + f"?key={key}"
    request = urllib.request.Request(
        url,
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise ValueError(f"Gemini API error {e.code}: {detail}") from e
    except urllib.error.URLError as e:
        raise ValueError(f"Gemini API network error: {e.reason}") from e

    try:
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
    except (KeyError, IndexError, TypeError) as e:
        raise ValueError(f"Unexpected Gemini response: {json.dumps(payload)[:500]}") from e

    chapters = _extract_json_array(text)
    return [
        {"time": int(item.get("time", 0)), "title": str(item.get("title", "")).strip()}
        for item in chapters
        if str(item.get("title", "")).strip()
    ]