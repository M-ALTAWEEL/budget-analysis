"""Fill a LOCAL database with realistic data for the load tests, and write access tokens.

    cd backend
    python -m loadtest.seed --users 200            # data + tokens
    python -m loadtest.seed --tokens-only          # fresh tokens (they last 15 minutes)

Every account it makes is `load-<n>@loadtest.invalid` (".invalid" can never be a real
address), and running it again replaces them. It refuses to touch any database that
isn't on this computer: it must never run against staging or production.

Writes ../loadtest/tokens.json (ignored by git): one access token per user, and the
group they're in, for k6 to use. The tokens are made here, like a sign-in would, so the
test doesn't hammer the login (which is slow on purpose, and rate limited)."""

import argparse
import asyncio
import json
import random
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from pathlib import Path
from urllib.parse import urlparse
from uuid import uuid4

from sqlalchemy import delete, insert, select

from app.config import settings
from app.core.dates import month_start
from app.core.security import create_access_token, generate_refresh_token, hash_password, hash_token
from app.database import SessionLocal, engine
from app.domain.budget.model import Budget, Category
from app.domain.expense.model import Expense
from app.domain.goal.model import SavingsGoal
from app.domain.group.model import (
    Group,
    GroupExpense,
    GroupExpenseShare,
    GroupMember,
    GroupSettlement,
)
from app.domain.user.model import User, UserSession

EMAIL = "load-{n}@loadtest.invalid"
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "db"}
TOKENS = Path(__file__).resolve().parents[2] / "loadtest" / "tokens.json"
WORDS = [
    "Shawarma", "Bus card", "Coffee", "Groceries", "Notebook", "Pizza", "Taxi", "Cinema",
    "Phone credit", "Pharmacy", "Lunch", "Water bill", "Books", "T-shirt", "Gym",
]  # fmt: skip
SLUGS = ["food", "transport", "study", "entertainment", "shopping", "health", "bills", "other"]


def refuse_unless_local() -> None:
    host = urlparse(settings.database_url.replace("+asyncpg", "")).hostname
    if settings.deploy_env in ("production", "staging") or host not in LOCAL_HOSTS:
        raise SystemExit(f"Refusing: the database host is {host!r}. Load data is local only.")


def months_back(count: int) -> list[date]:
    first = month_start(date.today())
    months = []
    for _ in range(count):
        months.append(first)
        first = month_start(first - timedelta(days=1))
    return months


async def seed(users: int, months: int, per_month: int, group_size: int) -> None:
    rng = random.Random(42)  # the same data every time
    today = date.today()
    async with SessionLocal() as db:
        # Start over: deleting the users removes their budgets, expenses, sessions...
        await db.execute(delete(Group).where(Group.name.like("Load group %")))
        await db.execute(delete(User).where(User.email.like("load-%@loadtest.invalid")))
        await db.commit()

        password = hash_password("load-test-password")  # one hash: bcrypt is slow on purpose
        now = datetime.now(UTC)
        user_ids = (
            await db.scalars(
                insert(User).returning(User.id),
                [
                    {
                        "uuid": str(uuid4()),
                        "email": EMAIL.format(n=n),
                        "password_hash": password,
                        "full_name": f"Load {n}",
                        "base_currency": "TRY",
                        "locale": "en",
                        "email_verified_at": now,
                    }
                    for n in range(users)
                ],
            )
        ).all()
        categories = dict(
            (await db.execute(select(Category.slug, Category.id).where(Category.user_id.is_(None))))
            .tuples()
            .all()
        )

        budgets, expenses, goals = [], [], []
        for user_id in user_ids:
            for month in months_back(months):
                budgets.append(
                    {"uuid": str(uuid4()), "user_id": user_id, "month": month,
                     "total_amount": Decimal("20000"), "currency": "TRY"}
                )  # fmt: skip
                last_day = min(today, (month_start(month + timedelta(days=32)) - timedelta(1)))
                for _ in range(per_month):
                    amount = Decimal(rng.randint(1000, 80000)) / 100
                    expenses.append(
                        {
                            "uuid": str(uuid4()),
                            "user_id": user_id,
                            "category_id": categories[rng.choice(SLUGS)],
                            "amount": amount,
                            "currency": "TRY",
                            "amount_base": amount,
                            "fx_rate": Decimal(1),
                            "description": rng.choice(WORDS),
                            "spent_at": month + timedelta(days=rng.randint(0, last_day.day - 1)),
                        }
                    )
            for name in ("Laptop", "Trip"):
                goals.append(
                    {"uuid": str(uuid4()), "user_id": user_id, "name": name,
                     "target_amount": Decimal("15000"), "currency": "TRY",
                     "icon": "piggy-bank", "color": "#14B8A6"}
                )  # fmt: skip
        await db.execute(insert(Budget), budgets)
        for start in range(0, len(expenses), 5000):  # in chunks: one huge INSERT is slow
            await db.execute(insert(Expense), expenses[start : start + 5000])
        await db.execute(insert(SavingsGoal), goals)

        group_of: dict[int, str] = {}
        for start in range(0, len(user_ids) - group_size + 1, group_size):
            people = user_ids[start : start + group_size]
            group = Group(
                name=f"Load group {start // group_size}", currency="TRY",
                member_limit=10, created_by=people[0],
            )  # fmt: skip
            db.add(group)
            await db.flush()
            members = [
                GroupMember(
                    group_id=group.id,
                    user_id=u,
                    display_name=f"Load {u}",
                    role="owner" if i == 0 else "member",
                )  # fmt: skip
                for i, u in enumerate(people)
            ]
            db.add_all(members)
            await db.flush()
            for _ in range(60):
                payer = rng.choice(members)
                amount = Decimal(rng.randint(400, 4000))
                expense = GroupExpense(
                    group_id=group.id, paid_by=payer.id, created_by=payer.id,
                    description=rng.choice(WORDS), category_slug=rng.choice(SLUGS),
                    amount=amount, original_amount=amount, original_currency="TRY",
                    fx_rate=Decimal(1), split_method="equal",
                    spent_at=today - timedelta(days=rng.randint(0, 120)),
                    shares=[
                        GroupExpenseShare(member_id=m.id, amount=amount / len(members))
                        for m in members
                    ],
                )  # fmt: skip
                db.add(expense)
            for _ in range(10):
                a, b = rng.sample(members, 2)
                db.add(
                    GroupSettlement(
                        group_id=group.id,
                        from_member=a.id,
                        to_member=b.id,
                        amount=Decimal(rng.randint(10, 300)),
                        created_by=a.id,
                    )  # fmt: skip
                )
            await db.flush()
            for u in people:
                group_of[u] = group.uuid
        await db.commit()
    print(f"{users} users, {len(expenses)} expenses, {len(set(group_of.values()))} groups.")
    await write_tokens(group_of)


async def write_tokens(group_of: dict[int, str] | None = None) -> None:
    """A fresh signed-in session (and access token) for every load-test user."""
    async with SessionLocal() as db:
        rows = (
            await db.execute(
                select(User.id, User.uuid).where(User.email.like("load-%@loadtest.invalid"))
            )
        ).all()
        if group_of is None:
            group_of = dict(
                (
                    await db.execute(
                        select(GroupMember.user_id, Group.uuid)
                        .join(Group, Group.id == GroupMember.group_id)
                        .where(Group.name.like("Load group %"))
                    )
                )
                .tuples()
                .all()
            )
        now = datetime.now(UTC)
        out = []
        for user_id, user_uuid in rows:
            session_uuid = str(uuid4())
            db.add(
                UserSession(
                    uuid=session_uuid,
                    user_id=user_id,
                    refresh_hash=hash_token(generate_refresh_token()),
                    device="k6 load test",
                    last_used_at=now,
                    idle_expires_at=now + timedelta(days=1),
                    absolute_expires_at=now + timedelta(days=1),
                )  # fmt: skip
            )
            token = create_access_token(user_uuid, session_uuid)
            out.append({"token": token, "group": group_of.get(user_id)})
        await db.commit()
    TOKENS.parent.mkdir(exist_ok=True)
    TOKENS.write_text(json.dumps(out))
    print(f"{len(out)} tokens -> {TOKENS} (valid {settings.access_token_minutes} minutes)")


async def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--users", type=int, default=200)
    parser.add_argument("--months", type=int, default=12)
    parser.add_argument("--per-month", type=int, default=40, help="expenses per user per month")
    parser.add_argument("--group-size", type=int, default=4)
    parser.add_argument("--tokens-only", action="store_true")
    args = parser.parse_args()
    refuse_unless_local()
    try:
        if args.tokens_only:
            await write_tokens()
        else:
            await seed(args.users, args.months, args.per_month, args.group_size)
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
