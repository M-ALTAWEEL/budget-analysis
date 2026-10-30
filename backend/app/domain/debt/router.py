"""HTTP endpoints for personal debts (/debts)."""

from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.debt.schema import DebtCreate, DebtList, DebtRead, DebtUpdate, PaymentCreate
from app.domain.debt.service import DebtService

router = APIRouter(prefix="/debts", tags=["debts"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.get("")
async def list_debts(user: CurrentUser, db: DbSession, fx: FxClient) -> DebtList:
    return await DebtService(db, fx).list(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_debt(data: DebtCreate, user: CurrentUser, db: DbSession, fx: FxClient) -> DebtRead:
    return await DebtService(db, fx).create(user, data)


@router.patch("/{debt_uuid}")
async def update_debt(
    debt_uuid: str, data: DebtUpdate, user: CurrentUser, db: DbSession, fx: FxClient
) -> DebtRead:
    return await DebtService(db, fx).update(user, debt_uuid, data)


@router.delete("/{debt_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_debt(debt_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await DebtService(db, fx).delete(user, debt_uuid)


@router.post("/{debt_uuid}/payments", status_code=status.HTTP_201_CREATED)
async def add_payment(
    debt_uuid: str, data: PaymentCreate, user: CurrentUser, db: DbSession, fx: FxClient
) -> DebtRead:
    return await DebtService(db, fx).pay(user, debt_uuid, data)


@router.post("/{debt_uuid}/settle")
async def settle_debt(debt_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> DebtRead:
    """All paid back: one payment of whatever is left."""
    return await DebtService(db, fx).settle(user, debt_uuid)


@router.delete("/{debt_uuid}/payments/{payment_uuid}")
async def undo_payment(
    debt_uuid: str, payment_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient
) -> DebtRead:
    return await DebtService(db, fx).undo_payment(user, debt_uuid, payment_uuid)
