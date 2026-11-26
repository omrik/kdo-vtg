# UGREEN App Center submission kit

Everything to paste into the UGREEN developer center
(<https://developer.ugnas.com>) for **KDO Video Tagger**.

Process: register → identity verification (individual) → **App Management →
Create application** (sections 1–4 below) → **Submit version** (sections 5–8)
→ review. Questions: developers_bd@ugreen.com.

---

## 1. Basic information

| Field | Value |
|---|---|
| App name | KDO Video Tagger |
| App ID | `com.omrik.docker.kdovideotagger` |
| Category | Multimedia (alternative: Productivity / Utilities) |
| Type | Docker application |
| Supported models | DXP series, DH4300 Plus (UGOS Pro 1.13+, Docker 1.7+) |
| Architectures | amd64, arm64 |
| Price | Free (open source, MIT) |
| Website | https://github.com/omrik/kdo-vtg |
| Support | https://github.com/omrik/kdo-vtg/issues |
| Help / user guide | https://github.com/omrik/kdo-vtg/blob/main/docs/USAGE.md |
| Privacy policy | https://github.com/omrik/kdo-vtg/blob/main/PRIVACY.md |
| Web UI | port 8080, opens in a new tab |

## 2. Descriptions

### English

**Short (one line)**
Tag and search your video footage on your NAS, then export it straight into Final Cut, DaVinci Resolve or Premiere.

**Long**
KDO Video Tagger turns a folder of camera clips into a searchable, tagged
library, right on your UGREEN NAS.

Point it at your footage and it reads every clip's resolution, frame rate,
codec, duration, camera and GPS location. It can also find scene cuts, detect
objects (people, cars, animals…), classify shots (wide, medium, close-up),
extract colour palettes and transcribe speech, all on the NAS.

Rate your best clips, group them into collections and projects, and find
duplicates. When you're ready to edit, export a selection as:
- FCPXML for Final Cut Pro and DaVinci Resolve, with keywords, scene and
  chapter markers and a ready-made selects timeline
- Premiere Pro XML with a bin of tagged clips and a sequence
- DaVinci Resolve metadata CSV, EDL, CSV, Excel or a PDF shot list

Set your NAS share path once and clips link in your editor without relinking.

Private by design: your footage is mounted read-only and never leaves your
NAS. Optional AI chapter titles use your own Google Gemini key.

**Release notes (0.6.53)**
- First App Center release.
- Export to Final Cut Pro, DaVinci Resolve and Premiere Pro.
- Local speech-to-text, scene, shot and object detection.
- Object-detection analytics switched off: nothing leaves your NAS.

### 简体中文 (please have a native speaker check before submitting)

**简短介绍**
在 NAS 上为视频素材自动打标签并快速检索，一键导出到 Final Cut、DaVinci Resolve 或 Premiere。

**详细介绍**
KDO Video Tagger 可以把一个文件夹里的相机素材变成可搜索、带标签的素材库，全部在您的绿联 NAS 上完成。

选择素材文件夹后，它会读取每个片段的分辨率、帧率、编码、时长、相机型号和 GPS 位置，并可在 NAS 本地完成镜头切换检测、物体识别（人物、车辆、动物等）、景别分类（远景、中景、特写）、色彩提取和语音转文字。

您可以为片段评分、整理到合集和项目中、查找重复素材。准备剪辑时，可将所选片段导出为：
- FCPXML（Final Cut Pro、DaVinci Resolve），包含关键词、场景与章节标记以及精选时间线
- Premiere Pro XML，包含带标签的素材箱和序列
- DaVinci Resolve 元数据 CSV、EDL、CSV、Excel 或 PDF 镜头清单

只需设置一次 NAS 共享路径，剪辑软件即可直接链接素材，无需重新链接。

注重隐私：素材以只读方式挂载，永远不会离开您的 NAS。可选的 AI 章节标题功能使用您自己的 Google Gemini 密钥。

## 3. Keywords

video tagging, footage organizer, media library, Final Cut Pro, DaVinci Resolve, Premiere Pro, FCPXML, EDL, transcription, Whisper, object detection, video editor

## 4. Compliance materials

- **Privacy policy:** `PRIVACY.md` (URL above).
- **Open-source licence:** MIT, `LICENSE`. Main third-party components:
  FFmpeg (LGPL), Ultralytics YOLO (AGPL-3.0), faster-whisper (MIT),
  FastAPI (MIT), React (MIT). ⚠️ Ultralytics is AGPL-3.0; KDO is itself fully
  open source, which satisfies it, but mention it if asked.
- **Network permission** (`NETWORK.ACCESS_INTERNET`): only for downloading
  speech models on first use and the optional Gemini chapters. See the
  privacy policy table.
- **Data:** stored in the app data folder only; media mounted read-only.

## 5. Packages to upload

Built by `ugreen/scripts/build-upk.sh`:

- `amd64_nasync_com.omrik.docker.kdovideotagger_<version>.0001.upk`
- `arm64_nasync_com.omrik.docker.kdovideotagger_<version>.0001.upk`

## 6. Main workflow description

1. Install from App Center and choose the media folder(s) the app may read.
   User ID / Group ID can be left empty.
2. Open the app (port 8080) and create the admin account on first launch.
3. **Folders** tab: browse to a folder. **Scan** tab: choose which analyses
   to run (object detection, scene detection, shot types, colours,
   transcription) and start the scan.
4. **Results** tab: browse results as a grid or list, filter by tag, folder,
   rating or resolution, open a clip to see its details, scenes and
   transcript, rate it and add tags.
5. Organise clips into **Collections** and **Projects**.
6. Select clips and export: FCPXML, Premiere XML, Resolve CSV, EDL, CSV,
   Excel or PDF.
7. **Settings:** editor media path, default scan options, Whisper model,
   optional Gemini key, database export/import.

## 7. Self-test cases

| # | Test | Steps | Expected |
|---|---|---|---|
| 1 | Install | App Center → install, pick a media folder, leave User/Group ID empty | Installs; app icon appears; status running |
| 2 | Open | Click the app icon | Web UI opens on port 8080, shows first-run account setup |
| 3 | First account | Create admin user | Logged in, empty library |
| 4 | Browse | Folders tab | Authorised media folder and its subfolders are listed |
| 5 | Basic scan | Pick a folder, Scan tab → start scan on a folder with 3–5 clips, default options | Scan completes; each clip shows thumbnail, resolution, duration, codec |
| 6 | AI scan | Rescan with object detection + scene detection + shot types | Clips get object tags, scene count and shot type |
| 7 | Transcription | Open a clip with speech → Transcribe on device | Timestamped transcript appears (first run downloads the model) |
| 8 | Organise | Rate a clip 5★, add a tag, add to a new collection | Changes persist after page reload |
| 9 | Export | Select 2 clips → FCPXML, Premiere XML, Resolve CSV, EDL, CSV, Excel, PDF | Each downloads a valid file |
| 10 | Read-only media | After scans, check the media folder | No files added or modified |
| 11 | Restart | Stop and start the app in App Center | Library, login and settings are kept |
| 12 | Update | Install the next version over the existing one | Library kept; app opens on 8080 |
| 13 | Uninstall | Uninstall from App Center | App and its data folder removed; media untouched |
| 14 | Offline | Disconnect NAS from internet, scan with object detection | Scan completes; nothing besides optional features needs internet |

## 8. Screenshots

Take at 1920×1080 from the NAS install (fill with real footage):
1. Results grid with thumbnails and tags
2. Clip details: metadata, scenes, transcript
3. Scan options
4. Collections / Projects
5. Export buttons with a selection
6. Settings (editor media path)

Existing ones from the Mac test install are in `docs/screenshots/` and can be
used as a fallback.

---

## Open question for UGREEN

The container starts as root only to make its data folder writable by the
user set in User ID / Group ID (or uid 1000 if left empty), then switches to
that user for the rest of its life. `ugcli` warns about this but passes.
Suggested email to developers_bd@ugreen.com:

> Hello, I'm preparing KDO Video Tagger (com.omrik.docker.kdovideotagger), a
> Docker app, for App Center. ugcli warns that the service uses
> `user: "0:0"`. The container starts as root only to change ownership of its
> own data folder to an unprivileged user, then drops root permanently before
> the app runs. Is this acceptable for review, or should the compose run as a
> fixed non-root user? If so, which uid/gid owns the app's data folder on a
> fresh install? Also, could you share the review criteria and typical review
> time? Thank you.
