"""budget month start day and "start fresh"

Revision ID: f2b8d5a1c483
Revises: e1a7c4f9b372
Create Date: 2026-10-26 02:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "f2b8d5a1c483"
down_revision: str | None = "e1a7c4f9b372"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # server_default 1: every existing account keeps calendar months.
    op.add_column(
        "users", sa.Column("month_start_day", sa.Integer(), server_default="1", nullable=False)
    )
    op.create_check_constraint("month_start_day_range", "users", "month_start_day BETWEEN 1 AND 28")
    op.add_column("users", sa.Column("fresh_start_on", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "fresh_start_on")
    op.drop_constraint("month_start_day_range", "users", type_="check")
    op.drop_column("users", "month_start_day")
