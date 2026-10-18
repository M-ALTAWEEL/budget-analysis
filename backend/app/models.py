"""Imports every ORM model so their tables are registered on Base.metadata.

Alembic (migrations/env.py) and the test setup import this module.
Add one line here for each new domain model file.
"""

from app.domain.user.model import RefreshToken, User

__all__ = ["RefreshToken", "User"]
