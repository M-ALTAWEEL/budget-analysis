"""Sign-in attempts per account, not only per IP (threat S2, phase 5).

The per-IP limit (5 a minute) doesn't stop someone guessing one person's password from
many addresses (a botnet). So every account also gets at most 10 attempts in 15 minutes,
from anywhere. Then the password isn't even checked until the window passes.

The count is kept for any email typed, real account or not, so the "too many attempts"
answer can't be used to find out which emails have an account. Only a hash of the email
is kept in the counter store (Redis), never the email itself."""

import hashlib

from limits import parse

from app.core.limiter import limiter

SIGN_IN_PER_ACCOUNT = parse("10/15 minutes")
TOO_MANY = "Too many sign-in attempts for this account. Try again in 15 minutes."


def allow_sign_in_attempt(identifier: str) -> bool:
    """Counts one attempt for this email (or phone number) and says if it may go on."""
    if not limiter.enabled:  # tests switch the limits off, except the tests about them
        return True
    key = hashlib.sha256(identifier.strip().lower().encode()).hexdigest()
    try:
        return limiter.limiter.hit(SIGN_IN_PER_ACCOUNT, "sign-in-account", key)
    except Exception:  # the counter store is down: the per-IP limit still applies
        return True
