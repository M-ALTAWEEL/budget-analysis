"""phase 2b: one_time_tokens (email verification, password reset)

Revision ID: c6e2a9d417f3
Revises: b4d81f6e2c39
Create Date: 2026-10-24 16:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c6e2a9d417f3"
down_revision: str | None = "b4d81f6e2c39"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "one_time_tokens",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("purpose", sa.String(length=20), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("payload", sa.String(length=255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_one_time_tokens_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_one_time_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_one_time_tokens_token_hash")),
    )
    op.create_index(
        "ix_one_time_tokens_user_id_purpose",
        "one_time_tokens",
        ["user_id", "purpose", "created_at"],
    )
    op.create_index(op.f("ix_one_time_tokens_uuid"), "one_time_tokens", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_one_time_tokens_uuid"), table_name="one_time_tokens")
    op.drop_index("ix_one_time_tokens_user_id_purpose", table_name="one_time_tokens")
    op.drop_table("one_time_tokens")
