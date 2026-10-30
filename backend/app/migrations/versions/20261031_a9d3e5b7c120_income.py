"""income: money received, from one or more sources

Revision ID: a9d3e5b7c120
Revises: f4c8a2d6b931
Create Date: 2026-10-31 09:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a9d3e5b7c120"
down_revision: str | None = "f4c8a2d6b931"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "incomes",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("source", sa.String(length=100), nullable=False),
        sa.Column("kind", sa.String(length=12), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("received_on", sa.Date(), nullable=False),
        sa.Column("note", sa.String(length=200), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "kind IN ('job', 'scholarship', 'family', 'freelance', 'other')",
            name=op.f("ck_incomes_kind"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_incomes_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_incomes")),
    )
    op.create_index(op.f("ix_incomes_user_id"), "incomes", ["user_id"])
    op.create_index(op.f("ix_incomes_uuid"), "incomes", ["uuid"], unique=True)
    op.create_index(op.f("ix_incomes_received_on"), "incomes", ["received_on"])


def downgrade() -> None:
    op.drop_table("incomes")
