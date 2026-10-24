"""phase 3d: where a personal expense came from ('manual' or 'group')

Revision ID: d9f5b3e7a260
Revises: c8e4a2d6f159
Create Date: 2026-10-25 05:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "d9f5b3e7a260"
down_revision: str | None = "c8e4a2d6f159"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Every expense so far was typed by hand: the default fills them in.
    op.add_column(
        "expenses",
        sa.Column("source", sa.String(length=10), server_default="manual", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("expenses", "source")
