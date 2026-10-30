"""HTTP endpoints for income (/incomes)."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.dates import MonthPath, parse_month
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.income.schema import IncomeCreate, IncomeMonth, IncomeRead, IncomeUpdate
from app.domain.income.service import IncomeService

router = APIRouter(prefix="/incomes", tags=["income"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.get("/{month}")
async def income_month(
    month: MonthPath, user: CurrentUser, db: DbSession, fx: FxClient
) -> IncomeMonth:
    """The month's income, by source, and what is left after spending."""
    return await IncomeService(db, fx).month(user, parse_month(month))


@router.post("/{month}/copy-previous", status_code=status.HTTP_201_CREATED)
async def copy_previous(
    month: MonthPath, user: CurrentUser, db: DbSession, fx: FxClient
) -> IncomeMonth:
    """ "Same as last month"."""
    return await IncomeService(db, fx).copy_previous(user, parse_month(month))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_income(
    data: IncomeCreate, user: CurrentUser, db: DbSession, fx: FxClient
) -> IncomeRead:
    return await IncomeService(db, fx).create(user, data)


@router.patch("/{income_uuid}")
async def update_income(
    income_uuid: str, data: IncomeUpdate, user: CurrentUser, db: DbSession, fx: FxClient
) -> IncomeRead:
    return await IncomeService(db, fx).update(user, income_uuid, data)


@router.delete("/{income_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_income(income_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await IncomeService(db, fx).delete(user, income_uuid)
