"""phase 3a: groups, members and invite links

Revision ID: a3c7e5f9b812
Revises: f1b9d3e7a254
Create Date: 2026-10-25 02:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "a3c7e5f9b812"
down_revision: str | None = "f1b9d3e7a254"
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
        "groups",
        sa.Column("name", sa.String(length=60), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("member_limit", sa.Integer(), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True),
        *_base_columns(),
        sa.CheckConstraint(
            "member_limit BETWEEN 2 AND 100", name=op.f("ck_groups_member_limit_range")
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["users.id"],
            name=op.f("fk_groups_created_by_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_groups")),
    )
    op.create_index(op.f("ix_groups_uuid"), "groups", ["uuid"], unique=True)

    op.create_table(
        "group_members",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("role", sa.String(length=10), nullable=False),
        sa.Column("auto_add_shares", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        *_base_columns(),
        sa.CheckConstraint(
            "role IN ('owner', 'admin', 'member')", name=op.f("ck_group_members_role_known")
        ),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_members_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_group_members_user_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_members")),
        sa.UniqueConstraint("group_id", "user_id", name=op.f("uq_group_members_group_id_user_id")),
    )
    op.create_index(op.f("ix_group_members_group_id"), "group_members", ["group_id"])
    op.create_index(op.f("ix_group_members_user_id"), "group_members", ["user_id"])
    op.create_index(op.f("ix_group_members_uuid"), "group_members", ["uuid"], unique=True)

    op.create_table(
        "group_invites",
        sa.Column("group_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("max_uses", sa.Integer(), nullable=True),
        sa.Column("uses", sa.Integer(), server_default="0", nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["group_id"],
            ["groups.id"],
            name=op.f("fk_group_invites_group_id_groups"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["created_by"],
            ["group_members.id"],
            name=op.f("fk_group_invites_created_by_group_members"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_group_invites")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_group_invites_token_hash")),
    )
    op.create_index(op.f("ix_group_invites_group_id"), "group_invites", ["group_id"])
    op.create_index(op.f("ix_group_invites_uuid"), "group_invites", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("group_invites")
    op.drop_table("group_members")
    op.drop_table("groups")
