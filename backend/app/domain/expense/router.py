"""HTTP endpoints for expenses."""

from datetime import date
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status

from app.core.dates import MONTH_PATTERN, parse_month
from app.core.push import PushSender, get_push_sender
from app.dependencies import CurrentUser, DbSession
from app.domain.budget.schema import CategoryRead
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.currency.service import CurrencyService
from app.domain.expense.categorizer import CategorySuggester
from app.domain.expense.schema import (
    CategorySuggestion,
    ExpenseCreate,
    ExpenseRead,
    ExpenseUpdate,
    QuickAddInput,
    QuickAddRead,
)
from app.domain.expense.service import ExpenseService
from app.domain.notify.budget_alerts import BudgetAlerts
from app.domain.notify.service import deliver
from app.domain.recurring.service import RecurringService
from app.ml.quick_add import parse

router = APIRouter(prefix="/expenses", tags=["expenses"])

FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]
Push = Annotated[PushSender | None, Depends(get_push_sender)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    background: BackgroundTasks,
    push: Push,
) -> ExpenseRead:
    expense = ExpenseRead.model_validate(await ExpenseService(db, fx).create(user, data))
    if push is not None:  # "Food is at 85% of its limit", once a month (phase 6i)
        background.add_task(deliver, push, await BudgetAlerts(db).check(user, expense.spent_at))
    return expense


@router.get("")
async def list_expenses(
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    month: Annotated[str | None, Query(pattern=MONTH_PATTERN, examples=["2026-10"])] = None,
    category_uuid: str | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[ExpenseRead]:
    await RecurringService(db, fx).catch_up(user)  # rent day may have come since last time
    expenses = await ExpenseService(db, fx).list(
        user, parse_month(month) if month else None, category_uuid, limit, offset
    )
    return [ExpenseRead.model_validate(expense) for expense in expenses]


# Declared before "/{expense_uuid}", or FastAPI would read "category-suggestion" as a uuid.
@router.post("/quick")
async def quick_add(
    data: QuickAddInput, user: CurrentUser, db: DbSession, fx: FxClient
) -> QuickAddRead:
    """Feature F9: read an expense out of one sentence (voice or typed). Saves nothing."""
    found = parse(data.text, date.today())
    currency = found.currency
    if currency is not None:
        try:
            await CurrencyService(db, fx).catalog.require_offered(currency, user.base_currency)
        except HTTPException:  # a currency the app doesn't offer: the form keeps its own
            currency = None
    suggestion = (
        await CategorySuggester(db).suggest(user, found.description) if found.description else None
    )
    return QuickAddRead(
        amount=found.amount,
        currency=currency,
        description=found.description,
        spent_at=found.spent_at,
        category=CategoryRead.model_validate(suggestion.category) if suggestion else None,
    )


@router.get("/category-suggestion")
async def suggest_category(
    user: CurrentUser,
    db: DbSession,
    description: Annotated[str, Query(min_length=1, max_length=200)],
) -> CategorySuggestion:
    suggestion = await CategorySuggester(db).suggest(user, description)
    if suggestion is None:
        return CategorySuggestion()
    return CategorySuggestion(
        category=CategoryRead.model_validate(suggestion.category),
        confidence=round(suggestion.confidence, 2),
        source=suggestion.source,
    )


@router.get("/{expense_uuid}")
async def get_expense(
    expense_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> ExpenseRead:
    return ExpenseRead.model_validate(await ExpenseService(db, fx).get(user, expense_uuid))


@router.patch("/{expense_uuid}")
async def update_expense(
    expense_uuid: str,
    data: ExpenseUpdate,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
    background: BackgroundTasks,
    push: Push,
) -> ExpenseRead:
    expense = ExpenseRead.model_validate(
        await ExpenseService(db, fx).update(user, expense_uuid, data)
    )
    if push is not None:
        background.add_task(deliver, push, await BudgetAlerts(db).check(user, expense.spent_at))
    return expense


@router.delete("/{expense_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await ExpenseService(db, fx).delete(user, expense_uuid)
