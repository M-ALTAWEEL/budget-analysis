"""HTTP endpoints for expenses."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, status

from app.core.dates import MONTH_PATTERN, parse_month
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.expense.schema import ExpenseCreate, ExpenseRead, ExpenseUpdate
from app.domain.expense.service import ExpenseService

router = APIRouter(prefix="/expenses", tags=["expenses"])

FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expense(
    data: ExpenseCreate, user: CurrentUser, db: DbSession, fx: FxClient
) -> ExpenseRead:
    expense = await ExpenseService(db, fx).create(user, data)
    return ExpenseRead.model_validate(expense)


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
    expenses = await ExpenseService(db, fx).list(
        user, parse_month(month) if month else None, category_uuid, limit, offset
    )
    return [ExpenseRead.model_validate(expense) for expense in expenses]


@router.get("/{expense_uuid}")
async def get_expense(
    expense_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> ExpenseRead:
    return ExpenseRead.model_validate(await ExpenseService(db, fx).get(user, expense_uuid))


@router.patch("/{expense_uuid}")
async def update_expense(
    expense_uuid: str, data: ExpenseUpdate, user: CurrentUser, db: DbSession, fx: FxClient
) -> ExpenseRead:
    expense = await ExpenseService(db, fx).update(user, expense_uuid, data)
    return ExpenseRead.model_validate(expense)


@router.delete("/{expense_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_expense(expense_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await ExpenseService(db, fx).delete(user, expense_uuid)
