"""categories, budgets, allocations, expenses and exchange rates

Revision ID: 8c4e2a7f9b13
Revises: 3f1a9c2b7d4e
Create Date: 2026-10-18 07:00:00
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "8c4e2a7f9b13"
down_revision: str | None = "3f1a9c2b7d4e"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

# Copied here on purpose (not imported from app code): a migration must keep doing
# exactly the same thing forever, even if the app's default list changes later.
DEFAULT_CATEGORIES = [
    ("4155d4b9-493a-4a35-ae21-67cdb6381f20", "food", "Food", "utensils", "#F97316"),
    ("eedf1e95-f114-4054-9386-3a9fa5d57da8", "transport", "Transport", "bus", "#3B82F6"),
    ("34ec0f3f-0e8b-47a3-91eb-2cd908f09050", "study", "Study", "book-open", "#8B5CF6"),
    (
        "01fcff38-eeee-46e8-8563-01a5a7d873ec",
        "entertainment",
        "Entertainment",
        "gamepad-2",
        "#EC4899",
    ),
    ("31c46dd5-91ec-40f1-b256-c4bfe56ce3f2", "shopping", "Shopping", "shopping-bag", "#14B8A6"),
    ("d69f22e9-bc06-4034-b838-e79c4787e8ff", "health", "Health", "heart-pulse", "#EF4444"),
    ("4085222f-05eb-4c5d-8109-4040e809c0ee", "bills", "Bills", "receipt", "#EAB308"),
    ("8f256f5a-bc5e-46da-b900-4b20cdb4a4cd", "other", "Other", "circle-ellipsis", "#64748B"),
]


def _base_columns() -> list[sa.Column]:
    """The four columns every table inherits from BaseModel."""
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
    # ── categories ──
    categories = op.create_table(
        "categories",
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("slug", sa.String(length=30), nullable=True),
        sa.Column("name", sa.String(length=50), nullable=False),
        sa.Column("icon", sa.String(length=30), nullable=False),
        sa.Column("color", sa.String(length=7), nullable=False),
        sa.Column("is_archived", sa.Boolean(), server_default=sa.false(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_categories_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categories")),
    )
    op.create_index(op.f("ix_categories_user_id"), "categories", ["user_id"])
    op.create_index(op.f("ix_categories_uuid"), "categories", ["uuid"], unique=True)
    op.bulk_insert(
        categories,
        [
            {"uuid": uuid, "slug": slug, "name": name, "icon": icon, "color": color}
            for uuid, slug, name, icon, color in DEFAULT_CATEGORIES
        ],
    )

    # ── budgets ──
    op.create_table(
        "budgets",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("month", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_budgets_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budgets")),
        sa.UniqueConstraint("user_id", "month", name=op.f("uq_budgets_user_id_month")),
    )
    op.create_index(op.f("ix_budgets_user_id"), "budgets", ["user_id"])
    op.create_index(op.f("ix_budgets_uuid"), "budgets", ["uuid"], unique=True)

    # ── budget_allocations ──
    op.create_table(
        "budget_allocations",
        sa.Column("budget_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("limit_amount", sa.Numeric(precision=12, scale=2), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["budget_id"],
            ["budgets.id"],
            name=op.f("fk_budget_allocations_budget_id_budgets"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["category_id"],
            ["categories.id"],
            name=op.f("fk_budget_allocations_category_id_categories"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_budget_allocations")),
        sa.UniqueConstraint(
            "budget_id", "category_id", name=op.f("uq_budget_allocations_budget_id_category_id")
        ),
    )
    op.create_index(op.f("ix_budget_allocations_budget_id"), "budget_allocations", ["budget_id"])
    op.create_index(op.f("ix_budget_allocations_uuid"), "budget_allocations", ["uuid"], unique=True)

    # ── expenses ──
    op.create_table(
        "expenses",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("category_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("amount_base", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("fx_rate", sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column("description", sa.String(length=200), nullable=False),
        sa.Column("spent_at", sa.Date(), nullable=False),
        sa.Column("categorized_by", sa.String(length=10), server_default="user", nullable=False),
        sa.Column("ai_confidence", sa.Numeric(precision=3, scale=2), nullable=True),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["category_id"], ["categories.id"], name=op.f("fk_expenses_category_id_categories")
        ),
        sa.ForeignKeyConstraint(
            ["user_id"], ["users.id"], name=op.f("fk_expenses_user_id_users"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_expenses")),
    )
    op.create_index(op.f("ix_expenses_category_id"), "expenses", ["category_id"])
    op.create_index("ix_expenses_user_id_spent_at", "expenses", ["user_id", "spent_at"])
    op.create_index(op.f("ix_expenses_uuid"), "expenses", ["uuid"], unique=True)

    # ── exchange_rates ──
    op.create_table(
        "exchange_rates",
        sa.Column("base", sa.String(length=3), nullable=False),
        sa.Column("quote", sa.String(length=3), nullable=False),
        sa.Column("rate", sa.Numeric(precision=18, scale=8), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        *_base_columns(),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_exchange_rates")),
        sa.UniqueConstraint("base", "quote", name=op.f("uq_exchange_rates_base_quote")),
    )
    op.create_index(op.f("ix_exchange_rates_uuid"), "exchange_rates", ["uuid"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_exchange_rates_uuid"), table_name="exchange_rates")
    op.drop_table("exchange_rates")
    op.drop_index(op.f("ix_expenses_uuid"), table_name="expenses")
    op.drop_index("ix_expenses_user_id_spent_at", table_name="expenses")
    op.drop_index(op.f("ix_expenses_category_id"), table_name="expenses")
    op.drop_table("expenses")
    op.drop_index(op.f("ix_budget_allocations_uuid"), table_name="budget_allocations")
    op.drop_index(op.f("ix_budget_allocations_budget_id"), table_name="budget_allocations")
    op.drop_table("budget_allocations")
    op.drop_index(op.f("ix_budgets_uuid"), table_name="budgets")
    op.drop_index(op.f("ix_budgets_user_id"), table_name="budgets")
    op.drop_table("budgets")
    op.drop_index(op.f("ix_categories_uuid"), table_name="categories")
    op.drop_index(op.f("ix_categories_user_id"), table_name="categories")
    op.drop_table("categories")
