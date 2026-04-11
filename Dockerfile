# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Production
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies for ffprobe and OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender1 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir --break-system-packages \
    fastapi \
    uvicorn \
    sqlalchemy \
    ffmpeg-python \
    python-multipart \
    opencv-python-headless \
    python-jose[cryptography] \
    passlib[bcrypt]

# Copy backend files
COPY backend/ ./backend/

# Copy pre-built frontend (run npm run build in frontend/ first)
COPY frontend/dist/ ./static/

# Create directories
RUN mkdir -p /app/config /app/media

# Environment variables
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./config/kdo-vtg.db
ENV JWT_SECRET=change-this-in-production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

# Expose port
EXPOSE 8000

# Run uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
