"""Knowing what the server is doing: logs, request ids and error reports.

- **Logs are JSON**, one object per line, so a log service can search and count them
  ("all 500s in the last hour"). They never contain bodies, tokens, query strings,
  emails or amounts: logs are read by more people and tools than the database.
- **Every request gets an id** (X-Request-ID). It is in the log line and in the response
  header, so a user's "it failed at 14:02" can be found in seconds.
- **Errors go to Sentry** when SENTRY_DSN is set, without personal data.
"""

import json
import logging
import re
import time
import uuid
from datetime import UTC, datetime

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.config import settings

logger = logging.getLogger("app.request")

# Health checks every few seconds would drown everything else.
QUIET_PATHS = {f"{settings.api_prefix}/ping"}

# Accept a request id from the caller only if it looks like one: never log arbitrary text.
_SAFE_ID = re.compile(r"^[A-Za-z0-9-]{8,64}$")


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        entry = {
            "time": datetime.fromtimestamp(record.created, UTC).isoformat(timespec="milliseconds"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        entry.update(getattr(record, "fields", {}))
        if record.exc_info:
            entry["error"] = self.formatException(record.exc_info)
        return json.dumps(entry, ensure_ascii=False)


def setup_logging() -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.INFO)
    # Our middleware logs each request once; uvicorn's own access log would repeat it.
    logging.getLogger("uvicorn.access").disabled = True


class RequestContextMiddleware:
    """Pure ASGI middleware (no BaseHTTPMiddleware): adds X-Request-ID to the response and
    writes one log line per request with the method, path, status and duration."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope["headers"]).get(b"x-request-id", b"").decode("latin-1")
        request_id = incoming if _SAFE_ID.match(incoming) else uuid.uuid4().hex
        scope.setdefault("state", {})["request_id"] = request_id
        start = time.perf_counter()
        status = 500  # if the app crashes before answering

        async def send_with_id(message: Message) -> None:
            nonlocal status
            if message["type"] == "http.response.start":
                status = message["status"]
                message.setdefault("headers", []).append((b"x-request-id", request_id.encode()))
            await send(message)

        try:
            await self.app(scope, receive, send_with_id)
        finally:
            path = scope["path"]  # without the query string: it can hold personal data
            if path not in QUIET_PATHS:
                logger.info(
                    "request",
                    extra={
                        "fields": {
                            "request_id": request_id,
                            "method": scope["method"],
                            "path": path,
                            "status": status,
                            "duration_ms": round((time.perf_counter() - start) * 1000, 1),
                        }
                    },
                )


def setup_sentry() -> None:
    if not settings.sentry_dsn:
        return
    import sentry_sdk  # only needed when error reporting is on

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.deploy_env,
        release=settings.git_commit,
        send_default_pii=False,  # no IP addresses, cookies or request headers
        traces_sample_rate=settings.sentry_traces_sample_rate,
    )
