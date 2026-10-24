"""Time-based one-time codes (TOTP, RFC 6238): the 6 digits in Google Authenticator,
Authy or 1Password. Written out here (30 lines) instead of adding a library, and checked
against the RFC's own test values in tests/test_two_factor.py."""

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote, urlencode

STEP_SECONDS = 30
DIGITS = 6
ISSUER = "Budget Analysis"


def new_secret() -> str:
    """160 random bits, in the base32 form authenticator apps expect."""
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _key(secret: str) -> bytes:
    return base64.b32decode(secret + "=" * (-len(secret) % 8), casefold=True)


def code_at(secret: str, step: int, digits: int = DIGITS, digest=hashlib.sha1) -> str:
    mac = hmac.new(_key(secret), struct.pack(">Q", step), digest).digest()
    offset = mac[-1] & 0x0F
    number = struct.unpack(">I", mac[offset : offset + 4])[0] & 0x7FFFFFFF
    return str(number % 10**digits).zfill(digits)


def current_step(now: float | None = None) -> int:
    return int((time.time() if now is None else now) // STEP_SECONDS)


def matching_step(secret: str, code: str, now: float | None = None) -> int | None:
    """The time step the code belongs to, accepting one step of clock drift each way
    (±30 seconds). None if it doesn't match. The caller refuses steps already used."""
    code = code.strip().replace(" ", "")
    if len(code) != DIGITS or not code.isdigit():
        return None
    step = current_step(now)
    for candidate in (step - 1, step, step + 1):
        if hmac.compare_digest(code_at(secret, candidate), code):
            return candidate
    return None


def provisioning_uri(secret: str, account: str) -> str:
    """otpauth://… : what the QR code holds. On a phone, opening it adds the account."""
    label = quote(f"{ISSUER}:{account}")
    query = urlencode({"secret": secret, "issuer": ISSUER, "digits": DIGITS, "period": 30})
    return f"otpauth://totp/{label}?{query}"
