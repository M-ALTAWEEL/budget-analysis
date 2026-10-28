"""Currency conversion with a database cache and a graceful fallback."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.money import to_money, to_rate
from app.domain.currency.catalog import CurrencyCatalog
from app.domain.currency.client import ExchangeRateClient, FxUnavailableError
from app.domain.currency.repository import ExchangeRateRepository

# The last rates each server process saw, per base currency, with when they were fetched
# (phase 4). Rates change twice a day at most and are already allowed to be 12 hours old,
# so a process doesn't need to ask the database for them on every expense.
# (when fetched, the rates, which of our codes were asked for): a code the provider doesn't
# have is remembered as asked, so it can't send every request back to the provider.
_memory: dict[str, tuple[datetime, dict[str, Decimal], frozenset[str]]] = {}

NO_RATES = "Exchange rates are temporarily unavailable. Try again later."


def forget_rates() -> None:
    """Empty the in-memory copy (tests start from nothing)."""
    _memory.clear()


class CurrencyService:
    def __init__(self, session: AsyncSession, client: ExchangeRateClient) -> None:
        self.session = session
        self.client = client
        self.rates = ExchangeRateRepository(session)
        self.catalog = CurrencyCatalog(session)

    async def get_rates(self, base: str, need: str | None = None) -> dict[str, Decimal]:
        """Rates from `base` to every currency in the `currencies` table (`need`: one
        quote that must be among them).

        0. This process saw fresh rates      -> use them, no query (phase 4).
        1. Fresh cache (younger than FX_CACHE_HOURS)  -> use it, no network call.
        2. Otherwise ask the provider and update the cache.
        3. Provider down -> use the old cache if we have one ("stale but available").
        4. No cache at all -> 503.
        A currency an admin just added isn't in the cache yet: the rates are fetched again.
        A currency the provider stops quoting is left out; the others keep working.
        """
        await self.catalog.require_known(base)
        codes = await self.catalog.all(including=need)
        now = datetime.now(UTC)
        max_age = timedelta(hours=settings.fx_cache_hours)
        remembered = _memory.get(base)
        if (
            remembered is not None
            and now - remembered[0] < max_age
            and remembered[2] >= codes
        ):
            return remembered[1]  # 0. this process already has fresh rates: no query at all

        cached = await self.rates.list_for_base(base)

        complete = {row.quote for row in cached} >= codes
        if complete and all(now - row.fetched_at < max_age for row in cached):
            rates = {row.quote: row.rate for row in cached}
            _memory[base] = (min(row.fetched_at for row in cached), rates, frozenset(codes))
            return rates

        try:
            fetched = await self.client.fetch_rates(base, codes)
        except FxUnavailableError:
            # Old rates are better than none, also when only a just-added currency is missing
            # and the caller needs another one.
            stale = {row.quote: row.rate for row in cached}
            if stale and (need is None or need in stale):
                return stale
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_RATES) from None

        rounded = {quote: to_rate(rate) for quote, rate in fetched.items()}
        await self.rates.save_rates(base, rounded, now)
        await self.session.commit()
        _memory[base] = (now, rounded, frozenset(codes))
        return rounded

    async def get_rate(self, base: str, quote: str) -> Decimal:
        if base == quote:
            return to_rate(1)
        await self.catalog.require_known(quote)
        rates = await self.get_rates(base, need=quote)
        if quote not in rates:  # the provider has no rate for it today
            raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, NO_RATES)
        return rates[quote]

    async def convert(self, amount: Decimal, source: str, target: str) -> tuple[Decimal, Decimal]:
        """Return (converted amount, rate used). The rate is stored with the expense
        as a snapshot, so later rate changes never rewrite history."""
        rate = await self.get_rate(source, target)
        return to_money(amount * rate), rate
