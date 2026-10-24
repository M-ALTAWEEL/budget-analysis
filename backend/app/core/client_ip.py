"""Who is calling: the visitor's IP address and country, decided in one place.

Requests arrive two ways (docs/design/accounts.md, 2.2):
- Through the website: the browser calls Next.js on Vercel, which forwards to us. Render
  then sees Vercel's address, not the visitor's. The website adds `X-Client-IP` and
  `X-Client-Country` (what Vercel saw) and `X-Edge-Secret`. We believe those two headers
  only when the secret matches.
- Directly (the mobile apps later, or anyone with curl). Then the address is the LAST
  entry of `X-Forwarded-For`: Render's own proxy appends the address that connected to it.
  The entries before it are whatever the client sent, so they are never trusted.
"""

import hmac
import ipaddress

from starlette.requests import Request

from app.config import settings

UNKNOWN_IP = "0.0.0.0"


def _valid_ip(value: str | None) -> str | None:
    if not value:
        return None
    try:
        return str(ipaddress.ip_address(value.strip()))
    except ValueError:
        return None


def from_trusted_edge(request: Request) -> bool:
    """True when the request came through our own website's server."""
    if not settings.edge_secret:
        return False
    sent = request.headers.get("x-edge-secret", "")
    # compare_digest takes the same time whatever the input, so the secret can't be
    # guessed one character at a time.
    return hmac.compare_digest(sent.encode(), settings.edge_secret.encode())


def client_ip(request: Request) -> str:
    """The visitor's IP address, as reliably as we can know it. Used by the rate limiter."""
    if from_trusted_edge(request):
        forwarded = _valid_ip(request.headers.get("x-client-ip"))
        if forwarded:
            return forwarded

    chain = request.headers.get("x-forwarded-for", "")
    if chain:
        last = _valid_ip(chain.split(",")[-1])
        if last:
            return last

    if request.client and (direct := _valid_ip(request.client.host)):
        return direct
    return UNKNOWN_IP


def client_country(request: Request) -> str | None:
    """Two-letter country code, only when our website told us. The IP is never stored."""
    if not from_trusted_edge(request):
        return None
    country = request.headers.get("x-client-country", "").strip().upper()
    return country if len(country) == 2 and country.isalpha() else None
