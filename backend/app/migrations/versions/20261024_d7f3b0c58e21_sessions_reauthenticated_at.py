"""phase 2c: sessions.reauthenticated_at (sensitive actions need a recent sign-in)

Revision ID: d7f3b0c58e21
Revises: c6e2a9d417f3
Create Date: 2026-10-24 19:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d7f3b0c58e21"
down_revision: str | None = "c6e2a9d417f3"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "sessions", sa.Column("reauthenticated_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    op.drop_column("sessions", "reauthenticated_at")
