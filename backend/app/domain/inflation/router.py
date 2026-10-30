"""HTTP endpoint for the inflation and currency view (/insights/inflation)."""

from typing import Annotated

from fastapi import APIRouter, Depends

from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.inflation.schema import InflationView
from app.domain.inflation.service import InflationService

router = APIRouter(prefix="/insights", tags=["insights"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.get("/inflation")
async def inflation(user: CurrentUser, db: DbSession, fx: FxClient) -> InflationView:
    """The last six months in a steadier currency, and prices that went up (feature F8)."""
    return await InflationService(db, fx).view(user)
