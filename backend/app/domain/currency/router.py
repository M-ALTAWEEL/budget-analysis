"""GET /currency/rates: lets the frontend show amounts in the secondary currency.
GET /currency/list: the currencies people can pick (the sign-up form needs it too)."""

from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.money import CurrencyCode
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.catalog import CurrencyCatalog
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.currency.service import CurrencyService

router = APIRouter(prefix="/currency", tags=["currency"])

FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


class RatesResponse(BaseModel):
    base: str
    rates: dict[str, Decimal]


class CurrencyNames(BaseModel):
    en: str
    ar: str
    tr: str


class CurrencyInfo(BaseModel):
    code: str
    names: CurrencyNames
    hidden: bool  # not offered for new choices; still shown for whoever already uses it


@router.get("/rates")
async def get_rates(
    user: CurrentUser, db: DbSession, fx: FxClient, base: CurrencyCode | None = None
) -> RatesResponse:
    """Rates from `base` (default: the user's base currency) to every currency."""
    base = base or user.base_currency
    rates = await CurrencyService(db, fx).get_rates(base)
    return RatesResponse(base=base, rates=rates)


@router.get("/list")
async def list_currencies(db: DbSession) -> list[CurrencyInfo]:
    """Every currency with its names in the three languages. No sign-in needed."""
    return [
        CurrencyInfo(
            code=c.code,
            names=CurrencyNames(en=c.name_en, ar=c.name_ar, tr=c.name_tr),
            hidden=c.hidden,
        )
        for c in await CurrencyCatalog(db).list()
    ]
