"""The assistant: periods and categories in a question, the intent model, the answers."""

from datetime import date, timedelta

import pytest

from app.domain.assistant.service import load_model
from app.ml.assistant_entities import CategoryRef, find_category, find_period
from tests.helpers import API, category_uuid, set_budget, signup

MONDAY = date(2026, 10, 19)


@pytest.mark.parametrize(
    ("question", "period", "start", "end"),
    [
        ("how much did I spend last month", "last_month", date(2026, 9, 1), date(2026, 10, 1)),
        ("كم صرفت الشهر الماضي", "last_month", date(2026, 9, 1), date(2026, 10, 1)),
        ("Geçen ay ne kadar harcadım", "last_month", date(2026, 9, 1), date(2026, 10, 1)),
        ("قديش صرفت هالأسبوع", "this_week", MONDAY, MONDAY + timedelta(1)),
        ("geçen hafta", "last_week", MONDAY - timedelta(7), MONDAY),
        ("كم صرفت امبارح", "yesterday", MONDAY - timedelta(1), MONDAY),
        ("Bugün ne kadar harcadım", "today", MONDAY, MONDAY + timedelta(1)),
        ("how much did I spend", "this_month", date(2026, 10, 1), date(2026, 11, 1)),
        # "باليوم" is "per day", not "today": whole words only.
        ("كم بقدر اصرف باليوم", "this_month", date(2026, 10, 1), date(2026, 11, 1)),
    ],
)
def test_the_period_is_found_in_three_languages(question, period, start, end):
    found = find_period(question, MONDAY)
    assert (found.period, found.start, found.end) == (period, start, end)


CATEGORIES = [
    CategoryRef(1, "food", "Food"),
    CategoryRef(2, "transport", "Transport"),
    CategoryRef(7, "bills", "Bills"),
    CategoryRef(10, None, "Building fees"),
]


@pytest.mark.parametrize(
    ("question", "expected"),
    [
        ("how much on food this week", "Food"),
        ("كم صرفت على الأكل", "Food"),
        ("yemeğe ne kadar harcadım", "Food"),
        ("ulaşıma ne kadar", "Transport"),
        ("قديش راح على الفواتير", "Bills"),
        ("building fees this month", "Building fees"),  # the student's own category
        ("how much did I spend", None),
    ],
)
def test_the_category_is_found(question, expected):
    found = find_category(question, CATEGORIES)
    assert (found.name if found else None) == expected


@pytest.mark.parametrize(
    ("question", "intent"),
    [
        ("how much did I spend this week", "spent"),
        ("كم صرفت هالشهر", "spent"),
        ("ne kadar kaldı", "remaining"),
        ("where does my money go", "top"),
        ("ay sonuna kadar yeter mi", "forecast"),
        ("am I spending more than last month", "compare"),
        ("hedeflerim ne durumda", "goals"),
        ("شو بتقدر تعمل", "help"),
    ],
)
def test_the_intent_model_understands_plain_questions(question, intent):
    prediction = load_model().predict(question)
    assert prediction.label == intent
    assert prediction.confidence >= 0.4


async def add_expense(client, headers, amount, description, slug, day):
    response = await client.post(
        f"{API}/expenses",
        headers=headers,
        json={
            "amount": amount,
            "description": description,
            "category_uuid": await category_uuid(client, headers, slug),
            "spent_at": day.isoformat(),
        },
    )
    assert response.status_code == 201, response.text


async def ask(client, headers, question):
    response = await client.post(
        f"{API}/assistant/ask", headers=headers, json={"question": question}
    )
    assert response.status_code == 200, response.text
    return response.json()


async def test_spent_answers_with_real_numbers(client):
    headers = await signup(client)
    today = date.today()
    await set_budget(client, headers, month=today.strftime("%Y-%m"), total="10000")
    await add_expense(client, headers, "150", "Lunch", "food", today)
    await add_expense(client, headers, "40", "Bus", "transport", today)

    everything = await ask(client, headers, "how much did I spend this month")
    assert everything["intent"] == "spent"
    assert (everything["amount"], everything["count"]) == ("190.00", 2)
    assert everything["currency"] == "TRY"

    food = await ask(client, headers, "كم صرفت على الأكل هالشهر")
    assert (food["amount"], food["category"]["slug"]) == ("150.00", "food")


async def test_remaining_and_top(client):
    headers = await signup(client)
    today = date.today()
    await set_budget(client, headers, month=today.strftime("%Y-%m"), total="1000")
    await add_expense(client, headers, "300", "Lunch", "food", today)

    left = await ask(client, headers, "how much is left")
    assert left["intent"] == "remaining"
    assert (left["total"], left["remaining"]) == ("1000.00", "700.00")
    assert left["days_left"] >= 1

    top = await ask(client, headers, "where does my money go")
    assert [row["category"]["slug"] for row in top["categories"]] == ["food"]


async def test_without_a_budget_the_assistant_says_so(client):
    headers = await signup(client)
    assert (await ask(client, headers, "how much is left"))["intent"] == "no_budget"


async def test_nonsense_is_not_answered_and_the_assistant_needs_a_login(client):
    headers = await signup(client)
    assert (await ask(client, headers, "zzzz qqqq"))["intent"] in {"unknown", "help"}
    response = await client.post(f"{API}/assistant/ask", json={"question": "hi"})
    assert response.status_code == 401
