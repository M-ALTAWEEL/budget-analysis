"""phase 3c: usernames, and invitations to a group by username

Revision ID: c8e4a2d6f159
Revises: b5d2f8a1c364
Create Date: 2026-10-25 04:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "c8e4a2d6f159"
down_revision: str | None = "b5d2f8a1c364"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Nullable: existing accounts choose one later in Settings. Stored in lower case, so a
    # plain UNIQUE constraint is enough to make "Sara" and "sara" the same name.
    op.add_column("users", sa.Column("username", sa.String(length=20), nullable=True))
    op.create_unique_constraint(op.f("uq_users_username"), "users", ["username"])

    op.create_table(
        "group_requests",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("invited_by", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(length=10), server_default="pending", nullable=False),
        sa.Column("responded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint(
            "status IN ('pending', 'accepted', 'declined', 'cancelled')",
            name=op.f("ck_group_requests_status_known"),
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_requests_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_group_requests_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["invited_by"],
            ["group_members.id"],
            name=op.f("fk_group_requests_invited_by_group_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_requests")),
        sa.UniqueConstraint("group_id", "user_id", name=op.f("uq_group_requests_group_id_user_id")),
    )
    op.create_index(op.f("ix_group_requests_group_id"), "group_requests", ["group_id"])
    op.create_index(op.f("ix_group_requests_user_id"), "group_requests", ["user_id"])
    op.create_index(op.f("ix_group_requests_uuid"), "group_requests", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("group_requests")
    op.drop_constraint(op.f("uq_users_username"), "users", type_="unique")
    op.drop_column("users", "username")
