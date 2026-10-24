"""Database tables owned by the user domain. Design: docs/design/accounts.md, section 3."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, true
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True)
    # When we know the person owns the email: Google/Apple said so, or (phase 2b) they
    # clicked our link. Until then a provider sign-in with this email takes the account
    # over instead of joining it (threat S7).
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # None for accounts made with Google: they have no password here.
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # LEGACY: replaced by user_identities. Still in the database so the previous version
    # of the code keeps working if we roll back; dropped by a later migration.
    google_sub: Mapped[str | None] = mapped_column(String(255), unique=True)
    full_name: Mapped[str] = mapped_column(String(100))
    base_currency: Mapped[str] = mapped_column(String(3), server_default="TRY")
    secondary_currency: Mapped[str | None] = mapped_column(String(3))
    locale: Mapped[str] = mapped_column(String(5), server_default="en")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=true())


class UserIdentity(BaseModel):
    """One row per outside way to sign in (Google now; Apple and phone later)."""

    __tablename__ = "user_identities"
    __table_args__ = (UniqueConstraint("provider", "subject"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    provider: Mapped[str] = mapped_column(String(20))  # 'google' | 'apple' | 'phone'
    # The provider's permanent id for the person ("sub"), or the phone number in E.164.
    subject: Mapped[str] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))  # what the provider said
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class UserSession(BaseModel):
    """One signed-in device. The refresh token is never stored, only its hash."""

    __tablename__ = "sessions"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    refresh_hash: Mapped[str] = mapped_column(String(64), unique=True)
    # The token this one replaced, still accepted for a few seconds after `rotated_at`
    # (two tabs refreshing at once). Later than that, it means the token was copied.
    previous_hash: Mapped[str | None] = mapped_column(String(64), index=True)
    rotated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    device: Mapped[str] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(2))  # the IP itself is not stored
    last_used_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # 'logout' | 'logout_all' | 'reuse' | 'signed_out_remotely' | 'account_taken_over'
    revoked_reason: Mapped[str | None] = mapped_column(String(30))


class SecurityEvent(BaseModel):
    """What the user sees under "Security activity". Never holds a password or token."""

    __tablename__ = "security_events"
    __table_args__ = (Index("ix_security_events_user_id_created_at", "user_id", "created_at"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # 'sign_in' | 'sign_in_failed' | 'session_revoked' | 'token_reuse' | 'identity_linked'
    # | 'account_taken_over' (more types arrive with phase 2b–2f)
    type: Mapped[str] = mapped_column(String(30))
    device: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(2))


class RefreshToken(BaseModel):
    """LEGACY: replaced by `sessions`. Kept until the clean-up migration (see the
    google_sub note above)."""

    __tablename__ = "refresh_tokens"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
