"""Checking a "Sign in with Google" credential.

The browser gets an ID token from Google (a JWT signed by Google) and sends it to us.
We never trust what it says until we have checked, ourselves:
- the signature, with Google's public keys (so nobody can forge one),
- the audience: it was issued for OUR app's client ID (not for some other website),
- the issuer is Google, and it has not expired.
No Google password or Google access token ever reaches this server.
"""

import asyncio
from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import HTTPException, status

from app.config import settings

GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs"
GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}
INVALID_GOOGLE = "Google sign-in failed. Please try again."


@dataclass(frozen=True)
class GoogleIdentity:
    sub: str  # Google's permanent id for this person; the email can change, this cannot
    email: str
    email_verified: bool
    name: str | None


@lru_cache(maxsize=1)
def _keys() -> jwt.PyJWKClient:
    return jwt.PyJWKClient(GOOGLE_KEYS_URL, cache_keys=True, lifespan=3600)


def _verify(credential: str) -> GoogleIdentity:
    try:
        key = _keys().get_signing_key_from_jwt(credential)
        claims = jwt.decode(
            credential,
            key.key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            options={"require": ["exp", "iss", "aud", "sub", "email"]},
        )
    except jwt.PyJWTError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_GOOGLE) from None
    if claims["iss"] not in GOOGLE_ISSUERS:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, INVALID_GOOGLE)
    return GoogleIdentity(
        sub=claims["sub"],
        email=claims["email"].strip().lower(),
        email_verified=claims.get("email_verified") is True,
        name=claims.get("name"),
    )


class GoogleVerifier:
    async def verify(self, credential: str) -> GoogleIdentity:
        if not settings.google_client_id:
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Google sign-in is off.")
        # Fetching Google's keys is a blocking HTTP call: keep it off the event loop.
        return await asyncio.to_thread(_verify, credential)


def get_google_verifier() -> GoogleVerifier:
    """A FastAPI dependency, so tests can swap in a fake verifier."""
    return GoogleVerifier()
