"""Feature F9: an expense said (or typed) in one sentence."""

from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.core.dates import format_month
from app.ml.quick_add import parse
from tests.helpers import API, category_uuid, set_budget, signup

TODAY = date(2026, 10, 30)
YESTERDAY = TODAY - timedelta(days=1)


@pytest.mark.parametrize(
    ("text", "amount", "currency", "description", "day"),
    [
        ("coffee 45 lira yesterday", "45", "TRY", "Coffee", YESTERDAY),
        ("قهوة بخمسين ليرة مبارح", "50", "TRY", "قهوة", YESTERDAY),
        ("dün 120 TL market", "120", "TRY", "Market", YESTERDAY),
        ("Döner 150tl", "150", "TRY", "Döner", TODAY),
        ("صرفت ٧٥ على مواصلات", "75", None, "مواصلات", TODAY),
        ("spent 12.50 dollars on lunch", "12.50", "USD", "Lunch", TODAY),
        ("elli lira kahve", "50", "TRY", "Kahve", TODAY),
        ("خمسة و عشرين ليرة سندويشة", "25", "TRY", "سندويشة", TODAY),
        ("Netflix $10", "10", "USD", "Netflix", TODAY),
        ("Kira 1.250", "1250", None, "Kira", TODAY),
        ("bir kahve 45", "45", None, "Bir kahve", TODAY),  # "bir" is a word when digits are said
        ("rent one thousand two hundred lira", "1200", "TRY", "Rent", TODAY),
        ("market", None, None, "Market", TODAY),
    ],
)
def test_one_sentence(text, amount, currency, description, day):
    found = parse(text, TODAY)
    assert found.amount == (Decimal(amount) if amount else None)
    assert (found.currency, found.description, found.spent_at) == (currency, description, day)


async def test_the_endpoint_suggests_a_category_and_saves_nothing(client):
    me = await signup(client)
    await set_budget(client, me, format_month(date.today().replace(day=1)))
    transport = await category_uuid(client, me, "transport")
    await client.post(
        f"{API}/expenses",
        headers=me,
        json={"amount": "60", "description": "Taxi", "category_uuid": transport},
    )
    response = await client.post(
        f"{API}/expenses/quick", headers=me, json={"text": "taxi 80 lira yesterday"}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert (body["amount"], body["currency"], body["description"]) == ("80", "TRY", "Taxi")
    assert body["spent_at"] == str(date.today() - timedelta(days=1))
    assert body["category"] is not None and body["category"]["slug"] == "transport"
    assert len((await client.get(f"{API}/expenses", headers=me)).json()) == 1  # saves nothing
    assert (
        await client.post(f"{API}/expenses/quick", headers=me, json={"text": ""})
    ).status_code == 422
