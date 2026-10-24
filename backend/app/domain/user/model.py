"""Database tables owned by the user domain. Design: docs/design/accounts.md, section 3."""

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class User(BaseModel):
    __tablename__ = "users"

    # None for accounts made with a phone number (2e) until they add an email.
    email: Mapped[str | None] = mapped_column(String(255), unique=True)
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
    # Two-factor authentication (2d). The key is encrypted (app/core/secret_box.py); it
    # exists but is not enabled while the person is still scanning the QR code.
    totp_secret_enc: Mapped[str | None] = mapped_column(String(255))
    totp_enabled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # The last 30-second step a code was accepted for: the same code never works twice.
    totp_last_step: Mapped[int | None] = mapped_column(BigInteger)

    @property
    def two_factor_enabled(self) -> bool:
        return self.totp_enabled_at is not None

    @property
    def email_verified(self) -> bool:
        return self.email_verified_at is not None

    @property
    def has_password(self) -> bool:
        return self.password_hash is not None


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
    # When the person last proved it's them again (password or Google) on this device.
    # Sensitive actions need this, or the sign-in itself, within 10 minutes (section 9).
    reauthenticated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class OneTimeToken(BaseModel):
    """A link we emailed: confirm the email, reset the password. Only the hash is stored,
    and it works once, for a short time (docs/design/accounts.md, section 3)."""

    __tablename__ = "one_time_tokens"
    __table_args__ = (
        Index("ix_one_time_tokens_user_id_purpose", "user_id", "purpose", "created_at"),
    )

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # 'verify_email' | 'reset_password' | 'change_email' | 'two_factor' (sign-in step)
    purpose: Mapped[str] = mapped_column(String(20))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    payload: Mapped[str | None] = mapped_column(String(255))  # e.g. the new email (2c)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Wrong codes typed against this token (the 2FA step of signing in): 5 and it's dead.
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")


class PhoneCode(BaseModel):
    """A 6-digit sign-in code sent by SMS. Only its HMAC is stored, never the code."""

    __tablename__ = "phone_codes"
    __table_args__ = (Index("ix_phone_codes_phone_created_at", "phone", "created_at"),)

    phone: Mapped[str] = mapped_column(String(20))  # E.164, e.g. +905321234567
    code_hash: Mapped[str] = mapped_column(String(64))
    attempts: Mapped[int] = mapped_column(Integer, server_default="0")  # 5 wrong: dead
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class BackupCode(BaseModel):
    """2FA recovery codes: 10, shown once, each works once. Only the hash is stored."""

    __tablename__ = "backup_codes"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class SecurityEvent(BaseModel):
    """What the user sees under "Security activity". Never holds a password or token."""

    __tablename__ = "security_events"
    __table_args__ = (Index("ix_security_events_user_id_created_at", "user_id", "created_at"),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    # 'sign_in' | 'sign_in_failed' | 'session_revoked' | 'token_reuse' | 'identity_linked'
    # | 'account_taken_over' | 'email_verified' | 'password_changed' | 'password_reset'
    # | 'reauthenticated' | 'email_changed' | 'data_exported' | '2fa_enabled' | '2fa_disabled'
    # | 'backup_codes_created' | 'backup_code_used'
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
