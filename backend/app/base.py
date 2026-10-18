"""Shared base for every database table."""

from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, MetaData, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

# Predictable constraint names make Alembic migrations stable across databases.
NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class BaseModel(Base):
    """Abstract parent: every entity gets id, uuid, created_at and updated_at."""

    __abstract__ = True
    # Fetch server-generated values (created_at, updated_at) right after INSERT/UPDATE
    # using RETURNING, so reading them later never triggers a hidden async query.
    __mapper_args__ = {"eager_defaults": True}

    # Internal key, used for joins. Never exposed in the API.
    id: Mapped[int] = mapped_column(primary_key=True)

    # Public identifier, safe to put in URLs (cannot be guessed like 1, 2, 3...).
    uuid: Mapped[str] = mapped_column(
        String(36), unique=True, index=True, default=lambda: str(uuid4())
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
