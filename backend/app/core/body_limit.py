"""No request body bigger than 1 MB (threat D1, phase 5), except a receipt photo (6 MB).

Every JSON body this API takes is small: the biggest is an expense split between 100
people, a few kilobytes. Without a limit, someone could send gigabytes and keep the server
busy reading them.

The body is read here first, up to the limit, and handed to the app only if it fits:
too big is 413, before the app sees any of it. A body that says its size (Content-Length)
is refused without reading it; one sent in pieces (chunked) is refused as soon as it
passes the limit."""

from starlette.types import ASGIApp, Message, Receive, Scope, Send

MAX_BODY_BYTES = 1_000_000
# The one exception: a receipt photo (feature F10). The website shrinks it first (about
# 0.5 MB); the app sends it at low JPEG quality.
LARGER = {"/api/v1/expenses/receipt": 6_000_000}


class BodySizeLimitMiddleware:
    def __init__(self, app: ASGIApp, max_bytes: int = MAX_BODY_BYTES) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        limit = LARGER.get(scope.get("path", ""), self.max_bytes)
        declared = dict(scope["headers"]).get(b"content-length")
        if declared is not None and (not declared.isdigit() or int(declared) > limit):
            await _too_large(send)
            return

        chunks: list[bytes] = []
        size = 0
        while True:
            message = await receive()
            if message["type"] != "http.request":  # the client went away
                return
            body = message.get("body", b"")
            size += len(body)
            if size > limit:
                await _too_large(send)
                return
            chunks.append(body)
            if not message.get("more_body", False):
                break

        whole = {"type": "http.request", "body": b"".join(chunks), "more_body": False}
        delivered = False

        async def replay() -> Message:
            nonlocal delivered
            if not delivered:
                delivered = True
                return whole
            return await receive()  # after the body: only "disconnect" comes

        await self.app(scope, replay, send)


async def _too_large(send: Send) -> None:
    body = b'{"detail":"The request is too large."}'
    await send(
        {
            "type": "http.response.start",
            "status": 413,
            "headers": [
                (b"content-type", b"application/json"),
                (b"content-length", str(len(body)).encode()),
            ],
        }
    )
    await send({"type": "http.response.body", "body": body})
