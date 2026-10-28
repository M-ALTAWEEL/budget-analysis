"""admin dashboard: who is an admin, and the log of what admins did

Revision ID: b8e2d4f6a913
Revises: a7c3e9b5d214
Create Date: 2026-10-28 12:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b8e2d4f6a913"
down_revision: str | None = "a7c3e9b5d214"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
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
        "platform_admins",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("granted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("granted_by", sa.String(length=100), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_by", sa.String(length=100), nullable=True),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_platform_admins_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_platform_admins")),
        sa.UniqueConstraint("user_id", name=op.f("uq_platform_admins_user_id")),
    )
    op.create_index(op.f("ix_platform_admins_uuid"), "platform_admins", ["uuid"], unique=True)

    op.create_table(
        "admin_audit_log",
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_label", sa.String(length=255), nullable=False),
        sa.Column("action", sa.String(length=40), nullable=False),
        sa.Column("target_user_id", sa.Integer(), nullable=True),
        sa.Column("target_label", sa.String(length=255), nullable=True),
        sa.Column("detail", sa.String(length=255), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["actor_user_id"],
            ["users.id"],
            name=op.f("fk_admin_audit_log_actor_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["target_user_id"],
            ["users.id"],
            name=op.f("fk_admin_audit_log_target_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_admin_audit_log")),
    )
    op.create_index("ix_admin_audit_log_created_at", "admin_audit_log", ["created_at"])
    op.create_index(
        op.f("ix_admin_audit_log_target_user_id"), "admin_audit_log", ["target_user_id"]
    )
    op.create_index(op.f("ix_admin_audit_log_uuid"), "admin_audit_log", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("admin_audit_log")
    op.drop_table("platform_admins")
