"""personal debts: money lent or borrowed outside groups, and payments back

Revision ID: f4c8a2d6b931
Revises: e2b6f8a4c719
Create Date: 2026-10-30 20:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f4c8a2d6b931"
down_revision: str | None = "e2b6f8a4c719"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base() -> list[sa.Column]:
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
        "debts",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("person", sa.String(length=100), nullable=False),
        sa.Column("direction", sa.String(length=8), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("started_on", sa.Date(), nullable=False),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("settled_on", sa.Date(), nullable=True),
        sa.Column("last_reminded_on", sa.Date(), nullable=True),
        *_base(),
        sa.CheckConstraint("direction IN ('lent', 'borrowed')", name=op.f("ck_debts_direction")),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_debts_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_debts")),
    )
    op.create_index(op.f("ix_debts_user_id"), "debts", ["user_id"])
    op.create_index(op.f("ix_debts_uuid"), "debts", ["uuid"], unique=True)

    op.create_table(
        "debt_payments",
        sa.Column("debt_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("paid_on", sa.Date(), nullable=False),
        *_base(),
        sa.ForeignKeyConstraint(
            ["debt_id"],
            ["debts.id"],
            name=op.f("fk_debt_payments_debt_id_debts"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_debt_payments")),
    )
    op.create_index(op.f("ix_debt_payments_debt_id"), "debt_payments", ["debt_id"])
    op.create_index(op.f("ix_debt_payments_uuid"), "debt_payments", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("debt_payments")
    op.drop_table("debts")
