"""Encrypting small secrets kept in the database (the 2FA keys), with Fernet
(AES-128-CBC + HMAC-SHA256, from the `cryptography` package we already have).

The key is TOTP_ENCRYPTION_KEY, separate from SECRET_KEY and never in the database, so a
copy of the database alone does not reveal anyone's 2FA key."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _fernet() -> Fernet | None:
    if settings.totp_encryption_key:
        return Fernet(settings.totp_encryption_key.encode())
    if settings.deploy_env in ("staging", "production"):
        return None  # a deployed server must have its own key: no fallback there
    # Local runs and tests: a key derived from SECRET_KEY, so nothing needs setting up.
    derived = hashlib.sha256(b"totp:" + settings.secret_key.encode()).digest()
    return Fernet(base64.urlsafe_b64encode(derived))


def available() -> bool:
    return _fernet() is not None


def encrypt(plain: str) -> str:
    box = _fernet()
    if box is None:
        raise RuntimeError("TOTP_ENCRYPTION_KEY is not set.")
    return box.encrypt(plain.encode()).decode()


def decrypt(token: str) -> str | None:
    box = _fernet()
    if box is None:
        return None
    try:
        return box.decrypt(token.encode()).decode()
    except InvalidToken:
        return None
