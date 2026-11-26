# Privacy Policy

_KDO Video Tagger — last updated 26 November 2026_

KDO Video Tagger is self-hosted software. It runs entirely on your own NAS or
computer. The developer does not run any server for it and receives no data
from it.

## What the app stores

On your device only, in the app's data folder:

- a database with your account (username and a hashed password), video
  metadata, tags, ratings, collections, projects, transcripts and chapters;
- thumbnails of your videos;
- downloaded speech-recognition models.

Your video files are mounted read-only. The app never modifies, copies or
uploads them.

## What leaves your device

Nothing, by default. There is no analytics, telemetry, crash reporting,
advertising or account with the developer. Object detection runs with its
library's analytics switched off.

The app connects to the internet only in these cases:

| When | Where | What is sent |
|---|---|---|
| First transcription with a given Whisper model | Hugging Face (`huggingface.co`) | A download request for the model files. No video or audio is sent. |
| You choose an object-detection model that isn't bundled | GitHub (`github.com`) | A download request for the model file. |
| You add your own Google Gemini API key and click **Generate chapters** | Google Gemini API | For that video only: file name, duration, frame rate, camera type, **GPS location** (if the footage has it), colour palette, detected objects, scene cut times, the timestamped transcript, and the chapter titles of other videos in the same project. No video or audio. Google's terms for your API key apply. |

Remove the Gemini key in Settings to stop the last one. Everything else keeps
working offline.

## Your control

- Export or delete your database from **Settings → Database**.
- Uninstalling the app removes its data folder.

## Contact

Questions: open an issue at <https://github.com/omrik/kdo-vtg/issues>.
