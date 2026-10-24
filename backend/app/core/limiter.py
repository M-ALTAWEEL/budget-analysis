"""Request rate limiting (SlowAPI). Protects login from password guessing.

The counters live in Redis when REDIS_URL is set. With more than one server, counters kept
in each server's memory would let an attacker spread their attempts over the servers and
get N times the limit. Locally and in tests (no REDIS_URL) they stay in memory.
If Redis stops answering, the limiter falls back to memory instead of failing requests.
"""

from slowapi import Limiter

from app.config import settings
from app.core.client_ip import client_ip

limiter = Limiter(
    key_func=client_ip,  # one counter per visitor IP; see app/core/client_ip.py (S6)
    storage_uri=settings.redis_url or "memory://",
    in_memory_fallback_enabled=True,
)
