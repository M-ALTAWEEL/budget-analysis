"""Database tables of the admin dashboard. Design: docs/design/admin.md."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class PlatformAdmin(BaseModel):
    """Who may open the admin dashboard. A table of its own, not a column on `users`: no
    code that registers or updates a user ever touches it, so no request field can make
    someone an admin. Only the command line can (app/cli.py)."""

    __tablename__ = "platform_admins"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    # Who ran the command (free text, e.g. "riza"): the person has server access, not
    # necessarily an account here.
    granted_by: Mapped[str] = mapped_column(String(100))
    # Revoking keeps the row, so the history stays; granting again clears it.
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    revoked_by: Mapped[str | None] = mapped_column(String(100))


class AdminAuditLog(BaseModel):
    """Every admin action and every grant or revoke. Append only: nothing changes or
    deletes a row."""

    __tablename__ = "admin_audit_log"
    __table_args__ = (Index("ix_admin_audit_log_created_at", "created_at"),)

    # The admin's account (None for the command line, or once the account is deleted).
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    # Who it was at the time: the admin's email, or "cli:<name>". Kept if the account goes.
    actor_label: Mapped[str] = mapped_column(String(255))
    # 'grant_admin' | 'revoke_admin' | 'disable_user' | 'enable_user' | 'sign_out_user'
    # | 'resend_verification'
    action: Mapped[str] = mapped_column(String(40))
    target_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # Who the target was at the time (email or uuid), kept if the account is deleted.
    target_label: Mapped[str | None] = mapped_column(String(255))
    detail: Mapped[str | None] = mapped_column(String(255))
    country: Mapped[str | None] = mapped_column(String(2))
