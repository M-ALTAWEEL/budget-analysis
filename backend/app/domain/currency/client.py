"""HTTP client for the exchange-rate provider. The only file that knows its URL format.

Provider: ExchangeRate-API open access endpoint (https://www.exchangerate-api.com),
free and without an API key. Rates update once a day.
"""

import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation

import httpx

from app.config import settings
from app.core.money import CURRENCY_PATTERN

logger = logging.getLogger("app.fx")


class FxUnavailableError(Exception):
    """The provider could not be reached or answered with something unusable."""


class ExchangeRateClient:
    def __init__(self, base_url: str, timeout: float, history_url: str = "") -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.history_url = history_url.rstrip("/")

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
        """Return {quote: rate} for each of `quotes` (our currencies) the provider has. A
        currency it stops quoting is left out and logged, so one missing code never stops
        conversion between all the others."""
        rates = await self.fetch_all(base)
        missing = len(quotes - rates.keys())
        if missing:
            # Only a count: the codes came through a request and the provider's answer, and
            # a log line never carries such text (CodeQL "log injection").
            logger.warning("fx provider has no rate", extra={"fields": {"missing": missing}})
        return {quote: rates[quote] for quote in quotes if quote in rates}

    async def fetch_on(self, day: date, base: str, quote: str) -> Decimal | None:
        """The rate on a past day (feature F8), from the European Central Bank's reference
        rates through Frankfurter. None when it has no rate for one of the two currencies
        (it quotes about 30) or is unreachable: the caller shows the month without it."""
        if not (re.fullmatch(CURRENCY_PATTERN, base) and re.fullmatch(CURRENCY_PATTERN, quote)):
            raise ValueError("Not a currency code.")
        url = f"{self.history_url}/{day.isoformat()}"
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url, params={"base": base, "symbols": quote})
                if response.status_code != 200:
                    return None
                return Decimal(str(response.json()["rates"][quote]))
        except (httpx.HTTPError, KeyError, ValueError, InvalidOperation, TypeError):
            return None


exchange_rate_client = ExchangeRateClient(
    settings.fx_api_url, settings.fx_timeout_seconds, settings.fx_history_url
)


def get_fx_client() -> ExchangeRateClient:
    """FastAPI dependency. Tests replace it with a fake that never touches the network."""
    return exchange_rate_client
