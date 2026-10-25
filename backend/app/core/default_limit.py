"""A rate limit on every endpoint that doesn't have its own (threat D1, phase 5).

Endpoints with `@limiter.limit(...)` (sign-in, codes, invites, exports) keep their own,
stricter limits; `@limiter.exempt` ones (the health check) have none. Every other one
gets `RATE_LIMIT_DEFAULT` (300 a minute) per visitor IP, counted in the same store as the
others (Redis in production).

Written here instead of slowapi's middleware, which sends the start of an answer twice
when it is sent in more than one piece."""

from limits import parse
from starlette.requests import Request
from starlette.routing import Match
from starlette.types import ASGIApp, Receive, Scope, Send

from app.config import settings
from app.core.client_ip import client_ip
from app.core.limiter import limiter

DEFAULT = parse(settings.rate_limit_default)


class DefaultRateLimitMiddleware:
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or not limiter.enabled or not self._needs_default(scope):
            await self.app(scope, receive, send)
            return
        try:
            allowed = limiter.limiter.hit(DEFAULT, "default", client_ip(Request(scope)))
        except Exception:  # the counter store is down: better slow than broken
            allowed = True
        if allowed:
            await self.app(scope, receive, send)
            return
        body = b'{"detail":"Too many requests. Please slow down a little."}'
        await send(
            {
                "type": "http.response.start",
                "status": 429,
                "headers": [
                    (b"content-type", b"application/json"),
                    (b"content-length", str(len(body)).encode()),
                    (b"retry-after", b"60"),
                ],
            }
        )
        await send({"type": "http.response.body", "body": body})

    @staticmethod
    def _needs_default(scope: Scope) -> bool:
        for route in scope["app"].routes:
            match, _ = route.matches(scope)
            if match == Match.FULL and hasattr(route, "endpoint"):
                name = f"{route.endpoint.__module__}.{route.endpoint.__name__}"
                # slowapi keeps these two lists: routes with their own limit, and exempt ones.
                return name not in limiter._route_limits and name not in limiter._exempt_routes
        return False  # no such route: a 404 costs nothing
