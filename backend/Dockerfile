FROM python:3.12-slim

# No .pyc files, logs appear immediately, and pip is patient on slow networks
# (default timeout is 15 s, which fails on unstable connections).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

# Tesseract reads receipt photos (feature F10), in Turkish, English and Arabic.
RUN apt-get update \
    && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-tur tesseract-ocr-ara \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies first. This layer is cached until pyproject.toml changes,
# so rebuilding after a code change is fast.
# The cache mount keeps downloaded packages between builds, so a failed build
# does not download everything again.
COPY pyproject.toml ./
RUN --mount=type=cache,target=/root/.cache/pip pip install .

COPY . .

# Never run the server as root inside the container.
RUN useradd --create-home appuser
USER appuser

EXPOSE 8000

# Apply pending migrations, then start the server. Railway provides $PORT.
# No --proxy-headers: uvicorn would take the FIRST X-Forwarded-For entry, which the client
# writes itself. app/core/client_ip.py decides the visitor's IP instead (threat S6).
# --no-access-log: app/core/observability.py logs each request once, as JSON.
# WEB_CONCURRENCY: how many server processes (phase 4). One process answers one request
# at a time on the CPU; with more CPUs, more processes answer more people at once. Keep it
# at the number of CPUs the host gives (Render's free plan: 1). With more than one, set
# REDIS_URL too: rate-limit counters kept in each process's memory would multiply the limits.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --no-access-log --workers ${WEB_CONCURRENCY:-1}"]
