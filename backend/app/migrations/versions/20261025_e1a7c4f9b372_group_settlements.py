"""phase 3e: settlements (paying back inside a group)

Revision ID: e1a7c4f9b372
Revises: d9f5b3e7a260
Create Date: 2026-10-25 06:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1a7c4f9b372"
down_revision: str | None = "d9f5b3e7a260"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "group_settlements",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("from_member", sa.Integer(), nullable=False),
        sa.Column("to_member", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("group_expense_id", sa.Integer(), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("amount > 0", name=op.f("ck_group_settlements_amount_positive")),
        sa.CheckConstraint(
            "from_member <> to_member", name=op.f("ck_group_settlements_not_to_self")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_settlements_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["from_member"],
            ["group_members.id"],
            name=op.f("fk_group_settlements_from_member_group_members"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["to_member"],
            ["group_members.id"],
            name=op.f("fk_group_settlements_to_member_group_members"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["group_members.id"],
            name=op.f("fk_group_settlements_created_by_group_members"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["group_expense_id"],
            ["group_expenses.id"],
            name=op.f("fk_group_settlements_group_expense_id_group_expenses"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_settlements")),
    )
    op.create_index(
        "ix_group_settlements_group_id_created_at",
        "group_settlements",
        ["group_id", "created_at"],
    )
    op.create_index(
        op.f("ix_group_settlements_group_expense_id"), "group_settlements", ["group_expense_id"]
    )
    op.create_index(op.f("ix_group_settlements_uuid"), "group_settlements", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("group_settlements")
