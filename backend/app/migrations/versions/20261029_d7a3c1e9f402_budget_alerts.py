"""budget alerts as push notifications: the person's switch, and what a month already sent

Revision ID: d7a3c1e9f402
Revises: c4f1a7d2e815
Create Date: 2026-10-29 10:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7a3c1e9f402"
down_revision: str | None = "c4f1a7d2e815"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("notify_budget", sa.Boolean(), server_default=sa.true(), nullable=False),
    )
    op.add_column("budgets", sa.Column("alerts_sent", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("budgets", "alerts_sent")
    op.drop_column("users", "notify_budget")
