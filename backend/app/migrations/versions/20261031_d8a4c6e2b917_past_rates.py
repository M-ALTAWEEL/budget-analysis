"""past exchange rates, kept once fetched (inflation view)

Revision ID: d8a4c6e2b917
Revises: c5e9b2d4f361
Create Date: 2026-10-31 18:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d8a4c6e2b917"
down_revision: str | None = "c5e9b2d4f361"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "past_rates",
        sa.Column("day", sa.Date(), nullable=False),
        sa.Column("base", sa.String(length=3), nullable=False),
        sa.Column("quote", sa.String(length=3), nullable=False),
        sa.Column("rate", sa.Numeric(18, 8), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_past_rates")),
        sa.UniqueConstraint("day", "base", "quote", name=op.f("uq_past_rates_day_base_quote")),
    )
    op.create_index(op.f("ix_past_rates_uuid"), "past_rates", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("past_rates")
