"""savings goals and goal contributions

Revision ID: 5d2b8e41c7a6
Revises: 8c4e2a7f9b13
Create Date: 2026-10-18 13:40:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "5d2b8e41c7a6"
down_revision: str | None = "8c4e2a7f9b13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    """The four columns every table inherits from BaseModel."""
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
    # ── savings_goals ──
    op.create_table(
        "savings_goals",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("target_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("target_date", sa.Date(), nullable=True),
        sa.Column("icon", sa.String(length=30), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_savings_goals_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_savings_goals")),
    )
    op.create_index(op.f("ix_savings_goals_user_id"), "savings_goals", ["user_id"])
    op.create_index(op.f("ix_savings_goals_uuid"), "savings_goals", ["uuid"], unique=True)

    # ── goal_contributions ──
    op.create_table(
        "goal_contributions",
        sa.Column("goal_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("note", sa.String(length=100), nullable=True),
        sa.Column("made_on", sa.Date(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["goal_id"],
            ["savings_goals.id"],
            name=op.f("fk_goal_contributions_goal_id_savings_goals"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_goal_contributions")),
    )
    op.create_index(op.f("ix_goal_contributions_goal_id"), "goal_contributions", ["goal_id"])
    op.create_index(op.f("ix_goal_contributions_uuid"), "goal_contributions", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_goal_contributions_uuid"), table_name="goal_contributions")
    op.drop_index(op.f("ix_goal_contributions_goal_id"), table_name="goal_contributions")
    op.drop_table("goal_contributions")
    op.drop_index(op.f("ix_savings_goals_uuid"), table_name="savings_goals")
    op.drop_index(op.f("ix_savings_goals_user_id"), table_name="savings_goals")
    op.drop_table("savings_goals")
