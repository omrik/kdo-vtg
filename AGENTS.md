# Working conventions (from user)

- New feature work goes on branch `stage` only. Build and test locally; image promotion to `main` (and CI-triggered republish) only after the user approves.
- Use `~/Documents/opencode` for all temp/scratch work (temp files, scratch config dirs, DB backups, etc.). The user pre-approves access there and will always allow writes — nothing there needs permission prompts, and nothing else outside this project should be written without asking.
- Live test container: `kdo-vtg`, port 8080, admin/admin123, image `ghcr.io/omrik/kdo-vtg:latest`, mounts `/Users/omrik/Movies:/media:ro` + `<repo>/config:/app/config` (preserve on recreate), network `kdo-vtg_default`, restart `unless-stopped`.
- Local test image tag: `kdo-vtg-yolofix`; run test container on 8091 with a scratch config dir under `~/Documents/opencode`.
- push pattern: `git push origin HEAD:stage && git branch -f main origin/main` (verify with user before touching main).
- Seed admin via `from backend.database import SessionLocal, User` + `passlib.hash.bcrypt` (NOT `backend.models`).
- `ugreen/project.yaml` and `docs/screenshots/*` are pre-existing unrelated changes — leave untouched/staged separately.
- Log significant bugs found & fixed in `docs/BUGS-FOUND.md` (Impact / Root cause / Fix / Verified), and reference it when relevant.