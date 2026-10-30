"""group budgets: one shared household budget per group and month

Revision ID: c5e9b2d4f361
Revises: b3f7a1c9d250
Create Date: 2026-10-31 15:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c5e9b2d4f361"
down_revision: str | None = "b3f7a1c9d250"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "group_budgets",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("limits", sa.JSON(), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_budgets_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_budgets")),
        sa.UniqueConstraint("group_id", "month", name=op.f("uq_group_budgets_group_id_month")),
    )
    op.create_index(op.f("ix_group_budgets_group_id"), "group_budgets", ["group_id"])
    op.create_index(op.f("ix_group_budgets_uuid"), "group_budgets", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("group_budgets")
