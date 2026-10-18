"""Request rate limiting (SlowAPI). Protects login from password guessing."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Counts requests per client IP address, in memory.
limiter = Limiter(key_func=get_remote_address)
