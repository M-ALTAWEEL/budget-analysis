"""Request rate limiting (SlowAPI). Protects login from password guessing.

The counters live in Redis when REDIS_URL is set. With more than one server, counters kept
in each server's memory would let an attacker spread their attempts over the servers and
get N times the limit. Locally and in tests (no REDIS_URL) they stay in memory.
If Redis stops answering, the limiter falls back to memory instead of failing requests.
"""

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings

limiter = Limiter(
    key_func=get_remote_address,  # one counter per client IP address
    storage_uri=settings.redis_url or "memory://",
    in_memory_fallback_enabled=True,
)
