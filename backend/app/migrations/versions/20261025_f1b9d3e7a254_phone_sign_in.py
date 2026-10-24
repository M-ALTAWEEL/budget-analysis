"""phase 2e: sign in with a phone number (phone_codes; users.email becomes optional)

Revision ID: f1b9d3e7a254
Revises: e8a41c2f6b90
Create Date: 2026-10-25 01:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f1b9d3e7a254"
down_revision: str | None = "e8a41c2f6b90"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Phone-only accounts have no email. The UNIQUE constraint stays: PostgreSQL allows
    # any number of NULLs in a unique column.
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=True)
    op.create_table(
        "phone_codes",
        sa.Column("phone", sa.String(length=20), nullable=False),
        sa.Column("code_hash", sa.String(length=64), nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_phone_codes")),
    )
    op.create_index("ix_phone_codes_phone_created_at", "phone_codes", ["phone", "created_at"])
    op.create_index(op.f("ix_phone_codes_uuid"), "phone_codes", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_phone_codes_uuid"), table_name="phone_codes")
    op.drop_index("ix_phone_codes_phone_created_at", table_name="phone_codes")
    op.drop_table("phone_codes")
    # Accounts made with only a phone number cannot exist without an email.
    op.execute("DELETE FROM users WHERE email IS NULL")
    op.alter_column("users", "email", existing_type=sa.String(length=255), nullable=False)
