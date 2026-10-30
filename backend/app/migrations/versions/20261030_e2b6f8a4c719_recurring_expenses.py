"""recurring expenses: rules for rent, bills and subscriptions, and the expenses they add

Revision ID: e2b6f8a4c719
Revises: d7a3c1e9f402
Create Date: 2026-10-30 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e2b6f8a4c719"
down_revision: str | None = "d7a3c1e9f402"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "recurring_expenses",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("day_of_month", sa.Integer(), nullable=False),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=True),
        sa.Column("remind", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("paused", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("last_added_on", sa.Date(), nullable=True),
        sa.Column("last_reminded_on", sa.Date(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "day_of_month BETWEEN 1 AND 31", name=op.f("ck_recurring_expenses_day_of_month")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_recurring_expenses_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_recurring_expenses_category_id_categories"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_recurring_expenses")),
    )
    op.create_index(op.f("ix_recurring_expenses_user_id"), "recurring_expenses", ["user_id"])
    op.create_index(op.f("ix_recurring_expenses_uuid"), "recurring_expenses", ["uuid"], unique=True)

    op.add_column("expenses", sa.Column("recurring_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_expenses_recurring_id_recurring_expenses"),
        "expenses",
        "recurring_expenses",
        ["recurring_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(op.f("ix_expenses_recurring_id"), "expenses", ["recurring_id"])
    op.create_unique_constraint(
        op.f("uq_expenses_recurring_id_spent_at"), "expenses", ["recurring_id", "spent_at"]
    )


def downgrade() -> None:
    op.drop_constraint(op.f("uq_expenses_recurring_id_spent_at"), "expenses", type_="unique")
    op.drop_index(op.f("ix_expenses_recurring_id"), table_name="expenses")
    op.drop_constraint(
        op.f("fk_expenses_recurring_id_recurring_expenses"), "expenses", type_="foreignkey"
    )
    op.drop_column("expenses", "recurring_id")
    op.drop_index(op.f("ix_recurring_expenses_uuid"), table_name="recurring_expenses")
    op.drop_index(op.f("ix_recurring_expenses_user_id"), table_name="recurring_expenses")
    op.drop_table("recurring_expenses")
