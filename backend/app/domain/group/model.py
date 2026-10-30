"""Tables for groups (shared expenses). Design: docs/design/groups.md, section 3.

Group tables never join personal ones, and personal tables never join group ones: the
only bridge (a member's share copied into their own budget) comes in phase 3c.
Phase 3a: groups, members, invites. Phase 3b: expenses and their shares.
Phase 3c: invitations by username. Phase 3e: settlements."""

from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    true,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

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


SPLIT_METHODS = ("equal", "exact", "percent", "shares")
SHARE_STATUSES = ("pending", "added", "dismissed")


class GroupExpense(BaseModel):
    """Something one member paid for the group (phase 3b). `amount` is in the group's
    currency; `original_amount` and `original_currency` are what was actually paid."""

    __tablename__ = "group_expenses"
    __table_args__ = (
        Index("ix_group_expenses_group_id_spent_at", "group_id", "spent_at"),
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint(
            "split_method IN ('equal', 'exact', 'percent', 'shares')", name="split_method_known"
        ),
    )

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    paid_by: Mapped[int] = mapped_column(ForeignKey("group_members.id", ondelete="CASCADE"))
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("group_members.id", ondelete="SET NULL")
    )
    description: Mapped[str] = mapped_column(String(200))
    category_slug: Mapped[str] = mapped_column(String(30))  # one of the default categories
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    original_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    original_currency: Mapped[str] = mapped_column(String(3))
    fx_rate: Mapped[Decimal] = mapped_column(Numeric(18, 8))  # snapshot, like personal ones
    split_method: Mapped[str] = mapped_column(String(10))
    spent_at: Mapped[date] = mapped_column(Date)
    # Soft delete: balances and history must be explainable later.
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    shares: Mapped[list["GroupExpenseShare"]] = relationship(
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="GroupExpenseShare.id",
    )


class GroupExpenseShare(BaseModel):
    """One member's part of a group expense. The shares of an expense always add up to
    its amount exactly (docs/design/groups.md, section 4)."""

    __tablename__ = "group_expense_shares"
    __table_args__ = (
        UniqueConstraint("group_expense_id", "member_id"),
        CheckConstraint("amount >= 0", name="amount_not_negative"),
        CheckConstraint("status IN ('pending', 'added', 'dismissed')", name="status_known"),
    )

    group_expense_id: Mapped[int] = mapped_column(
        ForeignKey("group_expenses.id", ondelete="CASCADE"), index=True
    )
    member_id: Mapped[int] = mapped_column(
        ForeignKey("group_members.id", ondelete="CASCADE"), index=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # What was typed: the percent, the number of shares, or the exact amount. NULL: equal.
    weight: Mapped[Decimal | None] = mapped_column(Numeric(14, 4))
    # Phase 3c: whether the member's share was copied into their own budget.
    status: Mapped[str] = mapped_column(String(10), server_default="pending")
    personal_expense_id: Mapped[int | None] = mapped_column(
        ForeignKey("expenses.id", ondelete="SET NULL"), unique=True
    )


class GroupRequest(BaseModel):
    """An invitation sent to one person by their username (phase 3c). Nobody is put in a
    group without saying yes: they accept or decline it in their Groups page."""

    __tablename__ = "group_requests"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id"),
        CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled')", name="status_known"
        ),
    )

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    # The invited person. Deleting the account deletes their invitations.
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    invited_by: Mapped[int | None] = mapped_column(
        ForeignKey("group_members.id", ondelete="SET NULL")
    )
    status: Mapped[str] = mapped_column(String(10), server_default="pending")
    responded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupSettlement(BaseModel):
    """Money paid back between two members (phase 3e). It changes balances only, never a
    budget: paying someone back is not spending (docs/design/groups.md, principle 4)."""

    __tablename__ = "group_settlements"
    __table_args__ = (
        Index("ix_group_settlements_group_id_created_at", "group_id", "created_at"),
        CheckConstraint("amount > 0", name="amount_positive"),
        CheckConstraint("from_member <> to_member", name="not_to_self"),
    )

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"))
    from_member: Mapped[int] = mapped_column(ForeignKey("group_members.id", ondelete="CASCADE"))
    to_member: Mapped[int] = mapped_column(ForeignKey("group_members.id", ondelete="CASCADE"))
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # in the group's currency
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("group_members.id", ondelete="SET NULL")
    )
    # Set when it pays one person's share of one expense ("I paid my part of this").
    group_expense_id: Mapped[int | None] = mapped_column(
        ForeignKey("group_expenses.id", ondelete="SET NULL"), index=True
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class GroupBudget(BaseModel):
    """A shared household budget (feature F7): one monthly total for the whole group, in
    the group's currency, with optional limits per category. Calendar months."""

    __tablename__ = "group_budgets"
    __table_args__ = (UniqueConstraint("group_id", "month"),)

    group_id: Mapped[int] = mapped_column(ForeignKey("groups.id", ondelete="CASCADE"), index=True)
    month: Mapped[date] = mapped_column(Date)  # the 1st
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # {"food": "1500.00", "bills": "900.00"}: built-in category slugs only
    limits: Mapped[dict] = mapped_column(JSON, default=dict)
