"""phase 3b: group expenses and their shares

Revision ID: b5d2f8a1c364
Revises: a3c7e5f9b812
Create Date: 2026-10-25 03:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b5d2f8a1c364"
down_revision: str | None = "a3c7e5f9b812"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    return [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    op.create_table(
        "group_expenses",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("paid_by", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("category_slug", sa.String(length=30), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("original_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("original_currency", sa.String(length=3), nullable=False),
        sa.Column("fx_rate", sa.Numeric(18, 8), nullable=False),
        sa.Column("split_method", sa.String(length=10), nullable=False),
        sa.Column("spent_at", sa.Date(), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        *_base_columns(),
        sa.CheckConstraint("amount > 0", name=op.f("ck_group_expenses_amount_positive")),
        sa.CheckConstraint(
            "split_method IN ('equal', 'exact', 'percent', 'shares')",
            name=op.f("ck_group_expenses_split_method_known"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_expenses_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["paid_by"],
            ["group_members.id"],
            name=op.f("fk_group_expenses_paid_by_group_members"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["group_members.id"],
            name=op.f("fk_group_expenses_created_by_group_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_expenses")),
    )
    op.create_index(
        "ix_group_expenses_group_id_spent_at", "group_expenses", ["group_id", "spent_at"]
    )
    op.create_index(op.f("ix_group_expenses_uuid"), "group_expenses", ["uuid"], unique=True)

    op.create_table(
        "group_expense_shares",
        sa.Column("group_expense_id", sa.Integer(), nullable=False),
        sa.Column("member_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("weight", sa.Numeric(14, 4), nullable=True),
        sa.Column("status", sa.String(length=10), server_default="pending", nullable=False),
        sa.Column("personal_expense_id", sa.Integer(), nullable=True),
        *_base_columns(),
        sa.CheckConstraint("amount >= 0", name=op.f("ck_group_expense_shares_amount_not_negative")),
        sa.CheckConstraint(
            "status IN ('pending', 'added', 'dismissed')",
            name=op.f("ck_group_expense_shares_status_known"),
        ),
        sa.ForeignKeyConstraint(
            ["group_expense_id"],
            ["group_expenses.id"],
            name=op.f("fk_group_expense_shares_group_expense_id_group_expenses"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["member_id"],
            ["group_members.id"],
            name=op.f("fk_group_expense_shares_member_id_group_members"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["personal_expense_id"],
            ["expenses.id"],
            name=op.f("fk_group_expense_shares_personal_expense_id_expenses"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_expense_shares")),
        sa.UniqueConstraint(
            "group_expense_id",
            "member_id",
            name=op.f("uq_group_expense_shares_group_expense_id_member_id"),
        ),
        sa.UniqueConstraint(
            "personal_expense_id", name=op.f("uq_group_expense_shares_personal_expense_id")
        ),
    )
    op.create_index(
        op.f("ix_group_expense_shares_group_expense_id"),
        "group_expense_shares",
        ["group_expense_id"],
    )
    op.create_index(
        op.f("ix_group_expense_shares_member_id"), "group_expense_shares", ["member_id"]
    )
    op.create_index(
        op.f("ix_group_expense_shares_uuid"), "group_expense_shares", ["uuid"], unique=True
    )


def downgrade() -> None:
    op.drop_table("group_expense_shares")
    op.drop_table("group_expenses")
