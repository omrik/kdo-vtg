# Getting tagged footage into your editor

KDO exports straight into the formats NLEs import natively, so tags, scene
cuts, chapters and ratings arrive with the clips.

| Export | Use it for | Brings across |
|---|---|---|
| **FCPXML** | Final Cut Pro 10.6+, DaVinci Resolve 17+ | Keywords (tags + shot type), scene-cut markers, AI chapter markers, favorites (4-5★), notes, a **KDO Selects** timeline |
| **Premiere XML** | Adobe Premiere Pro | A bin of master clips with markers, log notes (tags), description, Good flag (4-5★), and a **KDO Selects** sequence |
| **Resolve CSV** | DaVinci Resolve (clips already in the Media Pool) | Keywords, Description, Comments (transcript), Shot, Good Take, Camera Type, Location |
| **EDL** | Any NLE | Clips end to end from `01:00:00:00` at the first clip's frame rate, clip names, source paths, markers as comments |
| CSV / Excel / PDF | Spreadsheets, shot lists, producers | All metadata |

Exports use the current selection, in the order you selected the clips. With
nothing selected they use every clip in the results.

## 1. Set the Editor Media Path (once)

KDO sees your footage at `/media/...` inside the container. Your editing
machine sees the same files on the mounted NAS share. Tell KDO where that is in
**Settings → Editor Media Path**:

| Your editing machine | Example value |
|---|---|
| macOS (SMB mount) | `/Volumes/video` |
| Windows, mapped drive | `Z:\video` |
| Windows, UNC | `\\NAS\video` |

`/media/Trip/clip.mp4` is then exported as `/Volumes/video/Trip/clip.mp4`, so
the NLE links media without a relink step. Leave it empty to keep container
paths.

## 2. Import

**Final Cut Pro**: *File → Import → XML…*, pick the `.fcpxml`. You get an
event with keyword collections per tag, plus the *KDO Selects* project.

**DaVinci Resolve (new project)**: *File → Import → Timeline…*, pick the
`.fcpxml`. Leave "Automatically import source clips into media pool" on. Clips
arrive with keywords and markers, plus the selects timeline.

**DaVinci Resolve (clips already imported)**: in the Media Pool select the
clips, *right-click → Import Metadata* (in some versions: *File → Import
Metadata To → Media Pool*), pick the Resolve CSV. Matching is by file name.

**Premiere Pro**: *File → Import…*, pick the `.xml`. You get a *KDO Video
Tagger* bin with master clips (tags in Log Note, markers on the clip) and the
*KDO Selects* sequence.

## Tips

- Rate clips 4-5★ to mark them favorite in FCP and Good Take in Resolve and
  Premiere. Filter by rating before exporting to get a selects reel.
- Scene markers skip the sub-second "flash" cuts the detector produces. Only
  real cuts at least 5 s apart are kept.
- Run **AI Chapters** first if you want chapter markers in the export.
