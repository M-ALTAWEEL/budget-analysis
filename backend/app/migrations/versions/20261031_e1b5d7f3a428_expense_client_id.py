"""expenses.client_id: an expense sent twice from offline is added once

Revision ID: e1b5d7f3a428
Revises: d8a4c6e2b917
Create Date: 2026-10-31 21:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "e1b5d7f3a428"
down_revision: str | None = "d8a4c6e2b917"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("expenses", sa.Column("client_id", sa.String(length=36), nullable=True))
    op.create_unique_constraint(
        op.f("uq_expenses_user_id_client_id"), "expenses", ["user_id", "client_id"]
    )


def downgrade() -> None:
    op.drop_constraint(op.f("uq_expenses_user_id_client_id"), "expenses", type_="unique")
    op.drop_column("expenses", "client_id")
