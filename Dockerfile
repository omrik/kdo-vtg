# Stage 1: Build frontend locally first
# RUN: cd frontend && npm install && npm run build

FROM python:3.12-alpine

WORKDIR /app

# Install only essential dependencies
RUN apk add --no-cache ffmpeg

# Install Python packages
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    sqlalchemy \
    ffmpeg-python \
    python-multipart

# Copy backend
COPY backend/ ./backend/

# Copy pre-built frontend (run npm run build in frontend/ first)
COPY frontend/dist/ ./static/

# Create directories
RUN mkdir -p /app/config /app/media

# Environment
ENV PYTHONUNBUFFERED=1
ENV HOST=0.0.0.0
ENV PORT=8000
ENV DATABASE_URL=sqlite:///./config/kdo-vtg.db
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
