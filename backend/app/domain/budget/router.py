"""HTTP endpoints for categories (/categories) and monthly budgets (/budgets)."""

from fastapi import APIRouter, status

from app.core.dates import MonthPath, parse_month
from app.core.money import to_money
from app.dependencies import CurrentUser, DbSession
from app.domain.budget.schema import (
    AllocationsSet,
    BudgetSet,
    BudgetSummary,
    CategoryCreate,
    CategoryRead,
    CategoryUpdate,
    DailySpending,
    Tips,
)
from app.domain.budget.service import BudgetService, CategoryService

categories_router = APIRouter(prefix="/categories", tags=["categories"])
budgets_router = APIRouter(prefix="/budgets", tags=["budgets"])


# ── /categories ──────────────────────────────────────────────────────────────


@categories_router.get("")
async def list_categories(user: CurrentUser, db: DbSession) -> list[CategoryRead]:
    categories = await CategoryService(db).list(user)
    return [CategoryRead.model_validate(category) for category in categories]


@categories_router.post("", status_code=status.HTTP_201_CREATED)
async def create_category(data: CategoryCreate, user: CurrentUser, db: DbSession) -> CategoryRead:
    return CategoryRead.model_validate(await CategoryService(db).create(user, data))


@categories_router.patch("/{category_uuid}")
async def update_category(
    category_uuid: str, data: CategoryUpdate, user: CurrentUser, db: DbSession
) -> CategoryRead:
    return CategoryRead.model_validate(await CategoryService(db).update(user, category_uuid, data))


@categories_router.delete("/{category_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_category(category_uuid: str, user: CurrentUser, db: DbSession) -> None:
    await CategoryService(db).archive(user, category_uuid)


# ── /budgets ─────────────────────────────────────────────────────────────────


@budgets_router.get("/{month}")
async def get_budget(month: MonthPath, user: CurrentUser, db: DbSession) -> BudgetSummary:
    """The month's plan and how much was spent: total, per category, remaining."""
    return await BudgetService(db).summary(user, parse_month(month))


@budgets_router.get("/{month}/daily")
async def get_daily_spending(month: MonthPath, user: CurrentUser, db: DbSession) -> DailySpending:
    """Spending per day for the whole month (zeros included), for the pace chart."""
    return await BudgetService(db).daily(user, parse_month(month))


@budgets_router.get("/{month}/tips")
async def get_tips(month: MonthPath, user: CurrentUser, db: DbSession) -> Tips:
    """Repeated purchases this month, and the most expensive day of the week."""
    return await BudgetService(db).tips(user, parse_month(month))


@budgets_router.put("/{month}")
async def set_budget(
    month: MonthPath, data: BudgetSet, user: CurrentUser, db: DbSession
) -> BudgetSummary:
    """Create the month's budget, or change its total."""
    service = BudgetService(db)
    first_day = parse_month(month)
    await service.set_total(user, first_day, to_money(data.total_amount))
    return await service.summary(user, first_day)


@budgets_router.put("/{month}/allocations")
async def set_allocations(
    month: MonthPath, data: AllocationsSet, user: CurrentUser, db: DbSession
) -> BudgetSummary:
    """Replace the month's category limits with the list sent."""
    service = BudgetService(db)
    first_day = parse_month(month)
    await service.set_allocations(user, first_day, data)
    return await service.summary(user, first_day)
