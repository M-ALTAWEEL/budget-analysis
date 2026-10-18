FROM python:3.12-slim

# No .pyc files, logs appear immediately, and pip is patient on slow networks
# (default timeout is 15 s, which fails on unstable connections).
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DEFAULT_TIMEOUT=120 \
    PIP_RETRIES=10 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

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
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
