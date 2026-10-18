"""GET /currency/rates: lets the frontend show amounts in the secondary currency."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.money import Currency
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.currency.service import CurrencyService

router = APIRouter(prefix="/currency", tags=["currency"])

FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


class RatesResponse(BaseModel):
    base: Currency
    rates: dict[Currency, Decimal]


@router.get("/rates")
async def get_rates(
    user: CurrentUser, db: DbSession, fx: FxClient, base: Currency | None = None
) -> RatesResponse:
    """Rates from `base` (default: the user's base currency) to all six currencies."""
    base = base or Currency(user.base_currency)
    rates = await CurrencyService(db, fx).get_rates(base)
    return RatesResponse(base=base, rates=rates)
