"""HTTP endpoints for reports (/reports)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.dates import MonthPath, parse_month
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.report.schema import Wrapped
from app.domain.report.service import WrappedService

router = APIRouter(prefix="/reports", tags=["reports"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.get("/{month}/wrapped")
async def wrapped(month: MonthPath, user: CurrentUser, db: DbSession, fx: FxClient) -> Wrapped:
    """The month in a few numbers (feature F4); "so far" while the month is still going."""
    return await WrappedService(db, fx).month(user, parse_month(month))
