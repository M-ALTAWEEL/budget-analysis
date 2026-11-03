"""customer support: conversations between people and the team

Revision ID: f2c6e8a1b539
Revises: e1b5d7f3a428
Create Date: 2026-10-31 02:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2c6e8a1b539"
down_revision: str | None = "e1b5d7f3a428"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base() -> list[sa.Column]:
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
        "support_tickets",
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("email", sa.String(length=254), nullable=True),
        sa.Column("name", sa.String(length=100), nullable=True),
        sa.Column("locale", sa.String(length=5), nullable=False),
        sa.Column("topic", sa.String(length=10), nullable=False),
        sa.Column("subject", sa.String(length=120), nullable=False),
        sa.Column("platform", sa.String(length=60), nullable=True),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("unread_by_user", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_base(),
        sa.CheckConstraint(
            "topic IN ('problem', 'idea', 'question', 'account', 'other')",
            name=op.f("ck_support_tickets_topic"),
        ),
        sa.CheckConstraint(
            "status IN ('open', 'answered', 'closed')", name=op.f("ck_support_tickets_status")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_support_tickets_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_tickets")),
    )
    op.create_index(op.f("ix_support_tickets_user_id"), "support_tickets", ["user_id"])
    op.create_index(op.f("ix_support_tickets_status"), "support_tickets", ["status"])
    op.create_index(op.f("ix_support_tickets_uuid"), "support_tickets", ["uuid"], unique=True)

    op.create_table(
        "support_messages",
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("from_support", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("author", sa.String(length=100), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        *_base(),
        sa.ForeignKeyConstraint(
            ["ticket_id"],
            ["support_tickets.id"],
            name=op.f("fk_support_messages_ticket_id_support_tickets"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_support_messages")),
    )
    op.create_index(op.f("ix_support_messages_ticket_id"), "support_messages", ["ticket_id"])
    op.create_index(op.f("ix_support_messages_uuid"), "support_messages", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_table("support_messages")
    op.drop_table("support_tickets")
