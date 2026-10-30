"""Feature F8: spending in a steadier currency, and prices that went up."""

from datetime import date
from decimal import Decimal

from sqlalchemy import select

from app.domain.inflation.service import InflationService, stable_currency
from app.domain.user.model import User
from tests.fakes import FakeFxClient
from tests.helpers import API, category_uuid, set_budget, signup


async def buy(client, headers, amount, day, what="Kahve", slug="food"):
    category = await category_uuid(client, headers, slug)
    response = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={"amount": amount, "description": what, "category_uuid": category, "spent_at": day},
    )
    assert response.status_code == 201, response.text


async def test_spending_in_a_steadier_currency_and_rising_prices(client, db_session):
    me = await signup(client)
    for month in ("2026-07", "2026-08", "2026-09"):
        await set_budget(client, me, month, total="10000")
    await buy(client, me, "50", "2026-07-03")
    await buy(client, me, "50", "2026-07-20")
    await buy(client, me, "3950", "2026-07-25", what="Rent", slug="bills")
    await buy(client, me, "60", "2026-09-02")
    await buy(client, me, "4340", "2026-09-25", what="Rent", slug="bills")  # +10%

    fx = FakeFxClient()
    fx.history = {
        (date(2026, 7, 31), "TRY", "USD"): Decimal("0.025"),  # 40 TRY a dollar
        (date(2026, 9, 30), "TRY", "USD"): Decimal("0.02"),  # 50 TRY a dollar
    }
    user = await db_session.scalar(select(User).where(User.email == "student@example.com"))
    view = await InflationService(db_session, fx, today=date(2026, 10, 5)).view(user)

    assert view.stable_currency == "USD"
    assert [(m.month, m.spent, m.spent_stable) for m in view.months] == [
        ("2026-07", 4050, Decimal("101.25")),
        ("2026-08", 0, None),  # no rate kept for that day
        ("2026-09", 4400, 88),
    ]
    assert (view.change_local, view.change_stable) == (9, -13)  # more lira, fewer dollars
    assert [(p.label, p.first_price, p.last_price, p.change) for p in view.prices] == [
        ("Kahve", 50, 60, 20),
        ("Rent", 3950, 4340, 10),
    ]

    # Past rates are kept: asking again doesn't call the provider.
    calls = fx.calls
    await InflationService(db_session, fx, today=date(2026, 10, 5)).view(user)
    assert fx.calls == calls


async def test_the_steady_currency_follows_the_second_currency(client):
    me = await signup(client)
    await client.patch(f"{API}/users/me", headers=me, json={"secondary_currency": "EUR"})
    response = await client.get(f"{API}/insights/inflation", headers=me)
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["stable_currency"], body["months"], body["prices"]) == ("EUR", [], [])


def test_people_who_spend_in_dollars_compare_with_euros():
    assert stable_currency(User(base_currency="USD", secondary_currency=None)) == "EUR"
    assert stable_currency(User(base_currency="TRY", secondary_currency="TRY")) == "USD"
