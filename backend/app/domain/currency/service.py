"""Currency conversion with a database cache and a graceful fallback."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.money import Currency, to_money, to_rate
from app.domain.currency.client import ExchangeRateClient, FxUnavailableError
from app.domain.currency.repository import ExchangeRateRepository

# The last rates each server process saw, per base currency, with when they were fetched
# (phase 4). Rates change twice a day at most and are already allowed to be 12 hours old,
# so a process doesn't need to ask the database for them on every expense.
_memory: dict[str, tuple[datetime, dict[str, Decimal]]] = {}


def forget_rates() -> None:
    """Empty the in-memory copy (tests start from nothing)."""
    _memory.clear()


class CurrencyService:
    def __init__(self, session: AsyncSession, client: ExchangeRateClient) -> None:
        self.session = session
        self.client = client
        self.rates = ExchangeRateRepository(session)

    async def get_rates(self, base: Currency) -> dict[str, Decimal]:
        """Rates from `base` to every supported currency.

        0. This process saw fresh rates      -> use them, no query (phase 4).
        1. Fresh cache (younger than FX_CACHE_HOURS)  -> use it, no network call.
        2. Otherwise ask the provider and update the cache.
        3. Provider down -> use the old cache if we have one ("stale but available").
        4. No cache at all -> 503.
        """
        now = datetime.now(UTC)
        max_age = timedelta(hours=settings.fx_cache_hours)
        remembered = _memory.get(base.value)
        if remembered is not None and now - remembered[0] < max_age:
            return remembered[1]  # 0. this process already has fresh rates: no query at all

        cached = await self.rates.list_for_base(base.value)

        complete = {row.quote for row in cached} >= {c.value for c in Currency}
        if complete and all(now - row.fetched_at < max_age for row in cached):
            rates = {row.quote: row.rate for row in cached}
            _memory[base.value] = (min(row.fetched_at for row in cached), rates)
            return rates

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
        _memory[base.value] = (now, rounded)
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
