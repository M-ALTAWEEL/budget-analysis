"""Test doubles that replace external services."""

from decimal import Decimal

from app.core.money import Currency
from app.domain.currency.client import FxUnavailableError

# Value of 1 USD in each currency (realistic numbers, fixed so tests are predictable).
USD_RATES = {
    "USD": Decimal("1"),
    "TRY": Decimal("34"),
    "AED": Decimal("3.6725"),
    "SAR": Decimal("3.75"),
    "QAR": Decimal("3.64"),
    "EUR": Decimal("0.92"),
}


class FakeFxClient:
    """Behaves like ExchangeRateClient without any network call."""

    def __init__(self) -> None:
        self.calls = 0
        self.fail = False  # set True to simulate the provider being down

    async def fetch_rates(self, base: Currency) -> dict[str, Decimal]:
        self.calls += 1
        if self.fail:
            raise FxUnavailableError("simulated outage")
        return {quote: rate / USD_RATES[base.value] for quote, rate in USD_RATES.items()}
