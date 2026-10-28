"""HTTP client for the exchange-rate provider. The only file that knows its URL format.

Provider: ExchangeRate-API open access endpoint (https://www.exchangerate-api.com),
free and without an API key. Rates update once a day.
"""

import re
from decimal import Decimal, InvalidOperation

import httpx

from app.config import settings
from app.core.money import CURRENCY_PATTERN


class FxUnavailableError(Exception):
    """The provider could not be reached or answered with something unusable."""


class ExchangeRateClient:
    def __init__(self, base_url: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def rates_url(self, base: str) -> str:
        # The caller only passes a code from our `currencies` table (CurrencyService checks
        # it), and the table only holds three capital letters. Checked again here, so the
        # URL can never carry anything else (CodeQL alert #1, "partial server-side request
        # forgery": defence in depth).
        if not re.fullmatch(CURRENCY_PATTERN, base):
            raise ValueError("Not a currency code.")
        return f"{self.base_url}/{base}"

    async def fetch_all(self, base: str) -> dict[str, Decimal]:
        """Every rate the provider has, {quote: rate} where 1 base = rate quote. Admins
        use it to check that a new currency can be converted at all."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.rates_url(base))
                response.raise_for_status()
                data = response.json()
            if data.get("result") != "success":
                raise FxUnavailableError(f"Provider answered: {data.get('error-type')}")
            # str() first: Decimal(0.1) would keep the float's binary error.
            return {quote: Decimal(str(rate)) for quote, rate in data["rates"].items()}
        except (httpx.HTTPError, KeyError, ValueError, InvalidOperation, AttributeError) as exc:
            raise FxUnavailableError(str(exc)) from exc

    async def fetch_rates(self, base: str, quotes: set[str]) -> dict[str, Decimal]:
        """Return {quote: rate} for each of `quotes` (our currencies)."""
        rates = await self.fetch_all(base)
        try:
            return {quote: rates[quote] for quote in quotes}
        except KeyError as exc:
            raise FxUnavailableError(f"The provider has no rate for {exc}") from exc


exchange_rate_client = ExchangeRateClient(settings.fx_api_url, settings.fx_timeout_seconds)


def get_fx_client() -> ExchangeRateClient:
    """FastAPI dependency. Tests replace it with a fake that never touches the network."""
    return exchange_rate_client
