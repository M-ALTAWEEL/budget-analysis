"""Currency conversion: caching, fallback when the provider is down, and the API."""

from decimal import Decimal

import pytest
from fastapi import HTTPException

from app.core.money import Currency
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from tests.fakes import FakeFxClient
from tests.helpers import API, signup


async def test_convert_uses_rate_and_rounds_to_cents(db_session):
    service = CurrencyService(db_session, FakeFxClient())
    amount, rate = await service.convert(Decimal("100"), Currency.USD, Currency.TRY)
    assert rate == Decimal("34.00000000")
    assert amount == Decimal("3400.00")

    amount, rate = await service.convert(Decimal("10"), Currency.AED, Currency.TRY)
    assert rate == Decimal("9.25799864")  # 34 / 3.6725, 8 decimal places
    assert amount == Decimal("92.58")


async def test_same_currency_needs_no_rate_lookup(db_session):
    fx = FakeFxClient()
    amount, rate = await CurrencyService(db_session, fx).convert(
        Decimal("50"), Currency.TRY, Currency.TRY
    )
    assert (amount, rate) == (Decimal("50.00"), Decimal("1.00000000"))
    assert fx.calls == 0


async def test_rates_are_cached(db_session):
    fx = FakeFxClient()
    service = CurrencyService(db_session, fx)
    await service.get_rates(Currency.USD)
    await service.get_rates(Currency.USD)
    assert fx.calls == 1  # the second call was served from the database


async def test_stale_cache_is_used_when_provider_is_down(db_session, monkeypatch):
    fx = FakeFxClient()
    service = CurrencyService(db_session, fx)
    await service.get_rates(Currency.USD)

    # Make the cache "old", then break the provider.
    from app.config import settings

    monkeypatch.setattr(settings, "fx_cache_hours", 0)
    fx.fail = True
    rates = await service.get_rates(Currency.USD)
    assert rates["TRY"] == Decimal("34.00000000")
    assert fx.calls == 2  # it tried the provider first


async def test_no_cache_and_provider_down_is_503(db_session):
    fx = FakeFxClient()
    fx.fail = True
    with pytest.raises(HTTPException) as error:
        await CurrencyService(db_session, fx).get_rates(Currency.EUR)
    assert error.value.status_code == 503


async def test_rates_endpoint_defaults_to_user_base_currency(client):
    headers = await signup(client, base_currency="USD")
    response = await client.get(f"{API}/currency/rates", headers=headers)
    assert response.status_code == 200
    body = response.json()
    assert body["base"] == "USD"
    assert Decimal(body["rates"]["AED"]) == Decimal("3.6725")
    assert set(body["rates"]) == {"TRY", "USD", "AED", "SAR", "QAR", "EUR"}


def test_the_rates_url_only_ever_contains_our_own_currency_codes():
    client = ExchangeRateClient("https://rates.example/v6/latest/", timeout=1)
    assert client.rates_url(Currency.TRY) == "https://rates.example/v6/latest/TRY"
    assert {client.rates_url(c).rsplit("/", 1)[1] for c in Currency} == {c.value for c in Currency}


async def test_a_process_remembers_fresh_rates_without_asking_the_database(db_session):
    fx = FakeFxClient()
    await CurrencyService(db_session, fx).get_rates(Currency.USD)
    # A new service (a new request) in the same process: no provider call, no query.
    queries = []
    from sqlalchemy import event

    sync = db_session.sync_session.get_bind()
    listener = lambda *args: queries.append(args)  # noqa: E731
    event.listen(sync, "before_cursor_execute", listener)
    try:
        rates = await CurrencyService(db_session, fx).get_rates(Currency.USD)
    finally:
        event.remove(sync, "before_cursor_execute", listener)
    assert rates["TRY"] == Decimal("34.00000000")
    assert fx.calls == 1 and queries == []
