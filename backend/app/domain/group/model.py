"""Tables for groups (shared expenses). Design: docs/design/groups.md, section 3.

Group tables never join personal ones, and personal tables never join group ones: the
only bridge (a member's share copied into their own budget) comes in phase 3c."""

from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel

ROLES = ("owner", "admin", "member")


class Group(BaseModel):
    __tablename__ = "groups"
    __table_args__ = (CheckConstraint("member_limit BETWEEN 2 AND 100", name="member_limit_range"),)

    name: Mapped[str] = mapped_column(String(60))
    currency: Mapped[str] = mapped_column(String(3))  # fixed at creation, like a budget
    member_limit: Mapped[int] = mapped_column(Integer)  # chosen by the creator
    # Who made it. NULL once that account is deleted; the group lives on.
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupMember(BaseModel):
    __tablename__ = "group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id"),
        CheckConstraint("role IN ('owner', 'admin', 'member')", name="role_known"),
    )

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    # NULL once the account is deleted: the history and balances stay correct (8.4).
    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    # What the others see. Never the email or phone number.
    display_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(10))
    auto_add_shares: Mapped[bool] = mapped_column(Boolean, server_default=true())
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupInvite(BaseModel):
    """A join link. The token itself is only in the link; the database keeps its hash."""

    __tablename__ = "group_invites"

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("group_members.id", ondelete="SET NULL")
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    max_uses: Mapped[int | None] = mapped_column(Integer)
    uses: Mapped[int] = mapped_column(Integer, server_default="0")
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
