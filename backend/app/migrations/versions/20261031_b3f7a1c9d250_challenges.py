"""savings challenges, alone or shared with a group

Revision ID: b3f7a1c9d250
Revises: a9d3e5b7c120
Create Date: 2026-10-31 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b3f7a1c9d250"
down_revision: str | None = "a9d3e5b7c120"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "challenges",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=True),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("target_days", sa.Integer(), nullable=True),
        sa.Column("starts_on", sa.Date(), nullable=False),
        sa.Column("ends_on", sa.Date(), nullable=False),
        sa.Column("group_id", sa.Integer(), nullable=True),
        sa.Column("origin_id", sa.Integer(), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "kind IN ('no_spend_category', 'spend_under', 'no_spend_days')",
            name=op.f("ck_challenges_kind"),
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_challenges_user_id_users"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name=op.f("fk_challenges_category_id_categories")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_challenges_group_id_groups"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["origin_id"],
            ["challenges.id"],
            name=op.f("fk_challenges_origin_id_challenges"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_challenges")),
    )
    op.create_index(op.f("ix_challenges_user_id"), "challenges", ["user_id"])
    op.create_index(op.f("ix_challenges_uuid"), "challenges", ["uuid"], unique=True)
    op.create_index(op.f("ix_challenges_group_id"), "challenges", ["group_id"])
    op.create_index(op.f("ix_challenges_origin_id"), "challenges", ["origin_id"])


def downgrade() -> None:
    op.drop_table("challenges")
