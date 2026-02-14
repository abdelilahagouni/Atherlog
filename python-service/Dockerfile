# ---------- Stage 1: install deps ----------
FROM python:3.9-slim AS builder

WORKDIR /app

RUN pip install --upgrade pip

COPY requirements.txt .

# Install CPU-only PyTorch FIRST (saves ~1.5 GB vs full CUDA torch).
# The --extra-index-url ensures any transitive torch dep also resolves to CPU.
RUN pip install --no-cache-dir \
    torch --extra-index-url https://download.pytorch.org/whl/cpu

# Install remaining deps (torch already satisfied → no CUDA re-download)
RUN pip install --no-cache-dir \
    --extra-index-url https://download.pytorch.org/whl/cpu \
    -r requirements.txt --default-timeout=1000

# Strip tests, caches, and CUDA stubs that sneak in via transformers
RUN find /usr/local/lib/python3.9/site-packages \
    \( -name "tests" -o -name "test" -o -name "__pycache__" \
       -o -name "*.pyc" -o -name "*.pyo" \
       -o -name "cupti*" -o -name "libnvrtc*" \) \
    -exec rm -rf {} + 2>/dev/null || true

# ---------- Stage 2: slim runtime image ----------
FROM python:3.9-slim

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy only application code (respects .dockerignore)
COPY app.py .

# Create models dir for runtime model saving
RUN mkdir -p /app/models

# Render / Railway set PORT
ENV PORT=5000

# Gunicorn: 1 worker, 2 threads, 120s timeout — fits 512 MB RAM
CMD exec gunicorn --bind :$PORT --workers 1 --threads 2 --timeout 120 app:app
