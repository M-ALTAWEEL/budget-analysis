"""phase 2d: two-factor authentication (TOTP key, backup codes, sign-in challenge attempts)

Revision ID: e8a41c2f6b90
Revises: d7f3b0c58e21
Create Date: 2026-10-25 00:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e8a41c2f6b90"
down_revision: str | None = "d7f3b0c58e21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret_enc", sa.String(length=255), nullable=True))
    op.add_column("users", sa.Column("totp_enabled_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("totp_last_step", sa.BigInteger(), nullable=True))
    op.add_column(
        "one_time_tokens",
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
    )
    op.create_table(
        "backup_codes",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
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
            name=op.f("fk_backup_codes_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_backup_codes")),
    )
    op.create_index(op.f("ix_backup_codes_user_id"), "backup_codes", ["user_id"])
    op.create_index(op.f("ix_backup_codes_uuid"), "backup_codes", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_backup_codes_uuid"), table_name="backup_codes")
    op.drop_index(op.f("ix_backup_codes_user_id"), table_name="backup_codes")
    op.drop_table("backup_codes")
    op.drop_column("one_time_tokens", "attempts")
    op.drop_column("users", "totp_last_step")
    op.drop_column("users", "totp_enabled_at")
    op.drop_column("users", "totp_secret_enc")
