"""HTTP client for the exchange-rate provider. The only file that knows its URL format.

Provider: ExchangeRate-API open access endpoint (https://www.exchangerate-api.com),
free and without an API key. Rates update once a day.
"""

from decimal import Decimal, InvalidOperation

import httpx

from app.config import settings
from app.core.money import Currency

# The provider's path for each currency, built from our own list. The URL we call never
# contains text that came from a request, not even text that validation already limited
# to six values (CodeQL alert #1, "partial server-side request forgery": defence in depth).
_CURRENCY_PATHS: dict[Currency, str] = {currency: currency.name for currency in Currency}


class FxUnavailableError(Exception):
    """The provider could not be reached or answered with something unusable."""


class ExchangeRateClient:
    def __init__(self, base_url: str, timeout: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def rates_url(self, base: Currency) -> str:
        return f"{self.base_url}/{_CURRENCY_PATHS[base]}"

    async def fetch_rates(self, base: Currency) -> dict[str, Decimal]:
        """Return {quote: rate} for every supported currency, where 1 base = rate quote."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.rates_url(base))
                response.raise_for_status()
                data = response.json()
            if data.get("result") != "success":
                raise FxUnavailableError(f"Provider answered: {data.get('error-type')}")
            rates = data["rates"]
            # str() first: Decimal(0.1) would keep the float's binary error.
            return {currency.value: Decimal(str(rates[currency.value])) for currency in Currency}
        except (httpx.HTTPError, KeyError, ValueError, InvalidOperation) as exc:
            raise FxUnavailableError(str(exc)) from exc


exchange_rate_client = ExchangeRateClient(settings.fx_api_url, settings.fx_timeout_seconds)


def get_fx_client() -> ExchangeRateClient:
    """FastAPI dependency. Tests replace it with a fake that never touches the network."""
    return exchange_rate_client
