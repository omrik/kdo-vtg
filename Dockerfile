# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM debian:bookworm-slim

WORKDIR /app

# Install system dependencies including Python
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        gnupg \
        curl \
        python3 \
        python3-pip \
        python3-venv \
        ffmpeg \
        libgl1 \
        libglib2.0-0 \
        libsm6 \
        libxext6 \
        libxrender1 \
    && rm -rf /var/lib/apt/lists/* \
    && ln -sf /usr/bin/python3 /usr/bin/python

# Copy backend files
COPY backend/ ./backend/
COPY pyproject.toml ./

# Create requirements.txt for simpler pip install
RUN grep -A 20 "dependencies" pyproject.toml | grep -v "dependencies" | tr -d ',"' > requirements.txt || true

# Install dependencies directly (not editable)
RUN pip install --no-cache-dir --break-system-packages \
    fastapi uvicorn sqlalchemy ffmpeg-python ultralytics opencv-python-headless supervision python-multipart openpyxl

# Copy frontend build
COPY --from=frontend-build /app/dist ./static

# Create directories
RUN mkdir -p /app/config /app/media

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./config/kdo-vtg.db
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Expose port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
