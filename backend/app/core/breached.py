"""Is this password in a known data breach? (Have I Been Pwned, "Pwned Passwords")

k-anonymity: we send only the first 5 characters of the password's SHA-1 and get back
every breached hash that starts with them (with padding, so even the answer's size says
nothing). The password, and even its full hash, never leave this server.
If the service can't be reached, the password is allowed (fail open) and it's logged:
an outage there must not stop people signing up here."""

import hashlib
import logging

import httpx

logger = logging.getLogger("app.breached")
RANGE_URL = "https://api.pwnedpasswords.com/range/"


class BreachChecker:
    def __init__(self, timeout: float = 3.0) -> None:
        self.timeout = timeout

    async def times_seen(self, password: str) -> int:
        digest = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()  # noqa: S324
        prefix, suffix = digest[:5], digest[5:]
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(RANGE_URL + prefix, headers={"Add-Padding": "true"})
                response.raise_for_status()
        except httpx.HTTPError:
            logger.warning("breached-password check unavailable; password allowed")
            return 0
        for line in response.text.splitlines():
            candidate, _, count = line.partition(":")
            if candidate.strip() == suffix:
                return int(count.strip() or 0)
        return 0


def get_breach_checker() -> BreachChecker:
    """FastAPI dependency (tests replace it with a fake: no network in tests)."""
    return BreachChecker()
