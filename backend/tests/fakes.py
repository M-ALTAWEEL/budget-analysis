"""Test doubles that replace external services."""

from decimal import Decimal

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
# The provider knows more currencies than we offer: admins can add these.
PROVIDER_RATES = {**USD_RATES, "JPY": Decimal("150"), "GBP": Decimal("0.79")}


class FakeFxClient:
    """Behaves like ExchangeRateClient without any network call."""

    def __init__(self) -> None:
        self.calls = 0
        self.fail = False  # set True to simulate the provider being down

    async def fetch_all(self, base: str) -> dict[str, Decimal]:
        self.calls += 1
        if self.fail:
            raise FxUnavailableError("simulated outage")
        return {quote: rate / PROVIDER_RATES[base] for quote, rate in PROVIDER_RATES.items()}

    async def fetch_rates(self, base: str, quotes: set[str]) -> dict[str, Decimal]:
        rates = await self.fetch_all(base)
        return {quote: rates[quote] for quote in quotes if quote in rates}


class FakeEmailSender:
    """Keeps the emails instead of sending them, so tests can open the links."""

    def __init__(self) -> None:
        self.sent = []

    async def send(self, message) -> None:
        self.sent.append(message)

    def link_token(self, index: int = -1) -> str:
        """The token in the link of a sent email (the last one by default)."""
        text = self.sent[index].text
        return text.split("token=", 1)[1].split()[0]


class FakeBreachChecker:
    """Instead of Have I Been Pwned: only the passwords listed here are "breached"."""

    def __init__(self, breached: dict[str, int] | None = None) -> None:
        self.breached = breached or {}

    async def times_seen(self, password: str) -> int:
        return self.breached.get(password, 0)


class FakeSmsSender:
    """Keeps the SMS instead of sending them, so tests can read the code."""

    def __init__(self) -> None:
        self.sent: list[tuple[str, str]] = []

    async def send(self, phone: str, text: str) -> None:
        self.sent.append((phone, text))

    def last_code(self) -> str:
        import re

        return re.search(r"\b(\d{6})\b", self.sent[-1][1]).group(1)


class FakePushSender:
    """Keeps the notifications instead of sending them. `dead` tokens are reported back
    as "app removed", like Expo does."""

    def __init__(self) -> None:
        self.sent = []
        self.dead: set[str] = set()

    async def send(self, messages) -> list[str]:
        self.sent.extend(messages)
        return [m.to for m in messages if m.to in self.dead]
