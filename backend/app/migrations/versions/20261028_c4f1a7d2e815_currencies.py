"""currencies: the list moves from the code into a table, so admins can add more

Revision ID: c4f1a7d2e815
Revises: b8e2d4f6a913
Create Date: 2026-10-28 18:00:00
"""

from collections.abc import Sequence
from uuid import uuid4

import sqlalchemy as sa
from alembic import op

revision: str = "c4f1a7d2e815"
down_revision: str | None = "b8e2d4f6a913"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# The six the app started with (also in app/domain/currency/defaults.py, for the tests).
CURRENCIES = [
    ("TRY", "Turkish lira", "الليرة التركية", "Türk lirası"),
    ("USD", "US dollar", "الدولار الأمريكي", "ABD doları"),
    ("AED", "UAE dirham", "الدرهم الإماراتي", "BAE dirhemi"),
    ("SAR", "Saudi riyal", "الريال السعودي", "Suudi riyali"),
    ("QAR", "Qatari riyal", "الريال القطري", "Katar riyali"),
    ("EUR", "Euro", "اليورو", "Euro"),
]


def upgrade() -> None:
    table = op.create_table(
        "currencies",
        sa.Column("code", sa.String(length=3), nullable=False),
        sa.Column("name_en", sa.String(length=40), nullable=False),
        sa.Column("name_ar", sa.String(length=40), nullable=False),
        sa.Column("name_tr", sa.String(length=40), nullable=False),
        sa.Column("hidden", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("added_by", sa.String(length=255), nullable=False),
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.CheckConstraint("code ~ '^[A-Z]{3}$'", name=op.f("ck_currencies_code_format")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_currencies")),
        sa.UniqueConstraint("code", name=op.f("uq_currencies_code")),
    )
    op.create_index(op.f("ix_currencies_uuid"), "currencies", ["uuid"], unique=True)
    op.bulk_insert(
        table,
        [
            {
                "uuid": str(uuid4()),
                "code": code,
                "name_en": en,
                "name_ar": ar,
                "name_tr": tr,
                "added_by": "seed",
            }
            for code, en, ar, tr in CURRENCIES
        ],
    )


def downgrade() -> None:
    op.drop_table("currencies")
