# KDO Video Tagger — Bugs Found & Fixed

_Cumulative log of significant bugs discovered and resolved. Add new entries at the top._

---

## 2026-09-21 — Stage branch: backfill / thumbnail bugs (5 found, all fixed)

Found while validating the in-flight `only_missing` backfill feature and thumbnail
fix on the `stage` branch. Deployed to localhost:8080 (`kdo-vtg`) and scratch
container on 8091 (`kdo-vtg-yolofix`) for verification.

### BUG-005 — Vertical-video thumbnails stretched + unstable thumbnail filenames

**Impact:** "Mixed thumbnails" on the Results grid — portrait/vertical clips were
forced into a 320×180 landscape frame (`s='320x180'`), so they appeared stretched
or squashed with inconsistent aspect ratios; the grid cell sized itself via the
video resolution, making rows uneven.

**Root cause:** Two separate issues in the old thumbnail pipeline:
1. `extract_thumbnail` used ffmpeg `s='320x180'` which **hard-scales** the frame,
   distorting vertical video.
2. Thumbnail filenames used `str(abs(hash(filepath)))` — Python's built-in
   `hash()` is salted per-process, so the same video produced a **different
   filename on every run**, and the frontend had no stable way to pair a video
   to its thumbnail.

**Fix:**
- `backend/scanner.py`: replaced `s='320x180'` with
  `vf="scale=320:180:force_original_aspect_ratio=decrease,pad=320:180:(ow-iw)/2:(oh-ih)/2:color=black"`
  (fit + letterbox, no distortion).
- `backend/scanner.py`: switched the filename hash to
  `hashlib.md5(filepath.encode('utf-8')).hexdigest()[:16]` (stable, collision-safe).
  (This is the change that introduced the missing-import BUG-001.)
- `frontend/src/App.tsx`: removed the per-resolution `thumbnailAspect()` style from
  the grid cell so all thumbnails render at a fixed aspect and rows stay aligned.

**Verified:** localhost:8080 serving the new bundle; backend thumbnail hashing is
deterministic; grid no longer varies cell aspect per resolution.

### BUG-001 — Missing `import hashlib` in `backend/scanner.py`

**Impact:** `NameError` on every thumbnail extraction attempt — thumbnails could
never be generated or served. All new scans (and existing scans without a
thumbnail) would hit this silently, as the error was caught and returned `None`.

**Root cause:** The yolofix switched from `abs(hash(filepath))` to
`hashlib.md5(...)` for thumbnail filenames (to avoid hash collisions), but the
`import hashlib` statement was never added to the file's imports.

**Fix:** Added `import hashlib` to the top-level imports in `scanner.py`.

**Verified:** Backend syntax OK; container rebuilt and healthy; thumbnail path
hashing now deterministic and collision-safe.

---

### BUG-002 — `get_scan_status` omits `skipped_files` → API crash on scan poll

**Impact:** Any call to `GET /api/scan/{scan_id}` failed with a Pydantic
`ValidationError` the moment a scan job existed, because `ScanJobResponse`
declared `skipped_files: int` (required, no default) but the endpoint never
passed it.

**Root cause:** `skipped_files` was added to the `ScanJobResponse` model in the
same changeset as the backfill feature, but `get_scan_status` in `main.py` was
not updated to include it when constructing the response.

**Fix:** Pass `skipped_files=scan.skipped_files or 0` in the `ScanJobResponse`
constructor inside `get_scan_status`.

**Verified:** `GET /api/scan/14` on localhost:8080 now returns the full JSON
including `"skipped_files": 0` without crashing. All 58 pytest tests pass.

---

### BUG-003 — `only_missing` not threaded through `scan_task` / `start_scan`

**Impact:** The backfill feature was completely non-functional via the API.
Sending `"only_missing": true` in a scan request was silently ignored — the
background task created a `VideoScanner` without the flag, so every video was
always re-processed.

**Root cause:** `ScanRequest.only_missing` was added to the Pydantic model, and
`VideoScanner` accepted it in its constructor, but neither `scan_task()` nor
`start_scan()` forwarded it from the request to the background task parameters.

**Fix:**
- Added `only_missing: bool = False` parameter to `scan_task()` signature.
- Forwarded `request.only_missing` from `start_scan()` into the background task
  call.
- Passed `only_missing=only_missing` when constructing `VideoScanner` inside
  `scan_task()`.

**Verified on scratch container (8091):**
- skip path: 5 files all-complete → `processed=0, skipped=5`
- fill path: 1 video's `color_palette` nulled → `processed=1, skipped=4`;
  palette restored, all rows complete again.

---

### BUG-004 — Migration adds `skipped_files` to wrong table (`videos` instead of `scan_jobs`)

**Impact:** On startup the migration ran `ALTER TABLE videos ADD COLUMN
skipped_files …` instead of targeting `scan_jobs`. This:
1. Left `scan_jobs.skipped_files` missing → every scan status poll crashed
   (related to BUG-002).
2. Added an unused bogus column to the `videos` table (harmless but wrong).

**Root cause:** The `skipped_files` entry was placed in the `videos` migrations
list in `migrate_db()`. The `ScanJob` model defines `skipped_files` but there
was no corresponding `scan_jobs` migration block.

**Fix:**
- Removed `skipped_files` from the `videos` migrations list.
- Added a dedicated `scan_jobs` migration section in `migrate_db()` that checks
  `PRAGMA table_info(scan_jobs)` and adds `skipped_files INTEGER DEFAULT 0`
  when missing.
- Dropped the bogus `videos.skipped_files` column from the live DB.

**Verified:** After redeploy, `scan_jobs` has `skipped_files` column; `videos`
table clean; container healthy; all pytest tests pass; backfill skip + fill
paths both work end-to-end.

---

### Frontend note: "Scan Only Missing" toggle (not a bug, but completed)

The backfill feature had no UI entry point. Added an "Scan Only Missing"
checkbox to the Scan tab options grid, wired into `scanSettings.only_missing`,
which flows through the existing `startScan()` → `POST /api/scan` path without
any further backend changes needed. TypeScript build clean (`tsc && vite build`).

---

## Adding new bugs

When a new bug is found and fixed, add an entry at the top following the format
above: heading with date/summary, Impact, Root cause, Fix, Verified sections.
Reference `docs/test-scenarios.md` or relevant test IDs when applicable.
