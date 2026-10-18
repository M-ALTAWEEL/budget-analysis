"""Currency conversion with a database cache and a graceful fallback."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.money import Currency, to_money, to_rate
from app.domain.currency.client import ExchangeRateClient, FxUnavailableError
from app.domain.currency.repository import ExchangeRateRepository


class CurrencyService:
    def __init__(self, session: AsyncSession, client: ExchangeRateClient) -> None:
        self.session = session
        self.client = client
        self.rates = ExchangeRateRepository(session)

    async def get_rates(self, base: Currency) -> dict[str, Decimal]:
        """Rates from `base` to every supported currency.

        1. Fresh cache (younger than FX_CACHE_HOURS)  -> use it, no network call.
        2. Otherwise ask the provider and update the cache.
        3. Provider down -> use the old cache if we have one ("stale but available").
        4. No cache at all -> 503.
        """
        cached = await self.rates.list_for_base(base.value)
        now = datetime.now(UTC)
        max_age = timedelta(hours=settings.fx_cache_hours)

        complete = {row.quote for row in cached} >= {c.value for c in Currency}
        if complete and all(now - row.fetched_at < max_age for row in cached):
            return {row.quote: row.rate for row in cached}

        try:
            fetched = await self.client.fetch_rates(base)
        except FxUnavailableError:
            if complete:
                return {row.quote: row.rate for row in cached}
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "Exchange rates are temporarily unavailable. Try again later.",
            ) from None

        rounded = {quote: to_rate(rate) for quote, rate in fetched.items()}
        await self.rates.save_rates(base.value, rounded, now)
        await self.session.commit()
        return rounded

    async def get_rate(self, base: Currency, quote: Currency) -> Decimal:
        if base == quote:
            return to_rate(1)
        rates = await self.get_rates(base)
        return rates[quote.value]

    async def convert(
        self, amount: Decimal, source: Currency, target: Currency
    ) -> tuple[Decimal, Decimal]:
        """Return (converted amount, rate used). The rate is stored with the expense
        as a snapshot, so later rate changes never rewrite history."""
        rate = await self.get_rate(source, target)
        return to_money(amount * rate), rate
