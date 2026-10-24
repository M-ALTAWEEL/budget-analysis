"""The only place in the code base that deals with passwords, tokens and hashing."""

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.config import settings

# ── Passwords ────────────────────────────────────────────────────────────────


def hash_password(password: str) -> str:
    """bcrypt with a random salt. The salt is stored inside the resulting string."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        # Malformed hash, or a password longer than bcrypt's 72-byte limit.
        return False


# A real hash of a random value. Login checks unknown emails against it so that
# "email not found" takes as long as "wrong password" (no timing leak).
DUMMY_PASSWORD_HASH = hash_password(secrets.token_urlsafe(16))


# ── Access tokens (JWT) ──────────────────────────────────────────────────────


@dataclass(frozen=True)
class AccessClaims:
    user_uuid: str
    session_uuid: str


def create_access_token(user_uuid: str, session_uuid: str) -> str:
    """`sid` ties the token to one session, so signing that session out stops this token
    on the very next request instead of up to 15 minutes later."""
    now = datetime.now(UTC)
    payload = {
        "sub": user_uuid,
        "sid": session_uuid,
        "type": "access",
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_minutes),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> AccessClaims | None:
    """None if the token is invalid, tampered with, expired, or from before sessions
    existed (no `sid`): the client then refreshes and gets a new one."""
    try:
        payload = jwt.decode(
            token,
            settings.secret_key,
            algorithms=[settings.jwt_algorithm],
            options={"require": ["sub", "sid", "exp", "type"]},
        )
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    return AccessClaims(user_uuid=payload["sub"], session_uuid=payload["sid"])


# ── Refresh tokens ───────────────────────────────────────────────────────────


def generate_refresh_token() -> str:
    """A long random string. Only its hash is stored in the database."""
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    """SHA-256 is enough here: the token is random and long, so it cannot be guessed.
    (bcrypt's slowness is only needed for human-chosen passwords.)"""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()
