FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    exiftool \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir --break-system-packages \
    fastapi \
    uvicorn \
    sqlalchemy \
    ffmpeg-python \
    python-multipart \
    opencv-python-headless \
    python-jose[cryptography] \
    passlib==1.7.4 \
    bcrypt==4.0.1 \
    openpyxl \
    ultralytics \
    reportlab \
    faster-whisper

COPY backend/ ./backend/
COPY VERSION ./

COPY frontend/dist/ ./static/

LABEL org.opencontainers.image.title="KDO Video Tagger"
LABEL org.opencontainers.image.description="Self-hosted video metadata tagger: scan media folders, tag clips, detect scenes/objects/colors, local Whisper transcription, and Gemini chapter planning."
LABEL org.opencontainers.image.source="https://github.com/omrik/kdo-vtg"
LABEL org.opencontainers.image.url="https://github.com/omrik/kdo-vtg"
LABEL org.opencontainers.image.documentation="https://github.com/omrik/kdo-vtg/blob/main/README.md"
LABEL org.opencontainers.image.licenses="MIT"

RUN useradd -m -u 1000 kdo \
    && mkdir -p /app/config /app/media /opt/kdo-vtg/models \
    && python -c "import urllib.request; urllib.request.urlretrieve('https://github.com/ultralytics/assets/releases/download/v8.4.0/yolov8n.pt', '/opt/kdo-vtg/models/yolov8n.pt')" \
    && chown -R kdo:kdo /app/config /app/media

ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./config/kdo-vtg.db
ENV PYTHONPATH=/app
ENV HOME=/home/kdo
ENV YOLO_WEIGHTS_DIR=/opt/kdo-vtg/models

USER kdo

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
