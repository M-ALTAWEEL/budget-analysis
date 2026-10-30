"""Importing a bank statement (feature F11): read it, suggest what each line is, then add
the lines the person picked. Rules: docs/BUSINESS_LOGIC.md, section 6.9."""

from __future__ import annotations

import base64
import binascii
import hashlib
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.budget.schema import CategoryRead
from app.domain.currency.client import ExchangeRateClient
from app.domain.expense.categorizer import CategorySuggester
from app.domain.expense.model import Expense
from app.domain.expense.schema import ExpenseCreate
from app.domain.expense.service import ExpenseService
from app.domain.imports.schema import (
    ImportRequest,
    ImportResult,
    Preview,
    PreviewRow,
    StatementFile,
)
from app.domain.income.model import Income
from app.domain.income.schema import IncomeCreate
from app.domain.income.service import IncomeService
from app.domain.user.model import User
from app.ml import statement

# Money out that is spending: checked by default. Transfers to people may be rent, a share
# of a bill or a loan, so the person decides; a credit-card payment repeats purchases that
# were already counted on the card.
_SUGGEST = {
    "purchase": "expense",
    "bill": "expense",
    "other": "expense",
    "transfer_out": "skip",
    "card_payment": "skip",
    "transfer_in": "skip",
    "deposit": "skip",
    "refund": "skip",
}


def client_id(user: User, day, amount: Decimal, description: str) -> str:
    """The same line imported twice gets the same id: the second time adds nothing."""
    raw = f"{user.uuid}|{day.isoformat()}|{amount}|{description}".encode()
    return hashlib.sha256(raw).hexdigest()[:32]


class ImportService:
    def __init__(self, session: AsyncSession, fx_client: ExchangeRateClient) -> None:
        self.session = session
        self.fx_client = fx_client

    async def preview(self, user: User, data: StatementFile) -> Preview:
        try:
            content = base64.b64decode(data.content.split(",")[-1], validate=True)
        except (binascii.Error, ValueError):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Not a file.") from None
        try:
            found = statement.read(content, data.filename)
        except ValueError as exc:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, str(exc)) from None

        calendar = BudgetCalendar.of(user)
        budgets = BudgetRepository(self.session)
        suggester = CategorySuggester(self.session)
        categories = CategoryRepository(self.session)
        bills = await categories.get_default("bills")
        months: dict = {}
        first, last = min(t.day for t in found), max(t.day for t in found)
        existing = {
            (day, amount)
            for day, amount in await self.session.execute(
                select(Expense.spent_at, Expense.amount).where(
                    Expense.user_id == user.id, Expense.spent_at >= first, Expense.spent_at <= last
                )
            )
        }
        rows: list[PreviewRow] = []
        money_out = money_in = Decimal("0")
        for t in found:
            reading = statement.understand(t)
            amount = abs(t.amount)
            direction = "out" if t.amount < 0 else "in"
            if direction == "out":
                money_out += amount
            else:
                money_in += amount
            month = calendar.month_of(t.day)
            if month not in months:
                months[month] = await budgets.get_for_month(user.id, month) is not None
            category = None
            if direction == "out":
                if reading.kind == "bill":
                    category = bills
                else:
                    guess = await suggester.suggest(user, reading.label)
                    category = guess.category if guess else None
            rows.append(
                PreviewRow(
                    day=t.day,
                    label=reading.label,
                    original=t.description[:300],
                    amount=amount,
                    direction=direction,
                    kind=reading.kind,
                    suggestion=_SUGGEST[reading.kind] if direction == "out" else "skip",
                    category=CategoryRead.model_validate(category) if category else None,
                    duplicate=(t.day, amount) in existing,
                    has_budget=months[month],
                )
            )
        return Preview(
            rows=rows,
            currency=user.base_currency,
            first_day=first,
            last_day=last,
            money_out=money_out,
            money_in=money_in,
        )

    async def add(self, user: User, data: ImportRequest) -> ImportResult:
        currency = data.currency or user.base_currency
        expenses = ExpenseService(self.session, self.fx_client)
        incomes = IncomeService(self.session, self.fx_client)
        other = await CategoryRepository(self.session).get_default("other")
        result = ImportResult(expenses=0, income=0, already_there=0, no_budget=0)
        for row in data.rows:
            if row.as_ == "expense":
                key = client_id(user, row.day, row.amount, row.description)
                there = await self.session.scalar(
                    select(Expense.id).where(Expense.user_id == user.id, Expense.client_id == key)
                )
                if there is not None:
                    result.already_there += 1
                    continue
                try:
                    await expenses.create(
                        user,
                        ExpenseCreate(
                            amount=row.amount,
                            currency=currency,
                            description=row.description,
                            category_uuid=row.category_uuid or other.uuid,
                            spent_at=row.day,
                            client_id=key,
                        ),
                    )
                except HTTPException as exc:
                    if exc.status_code == status.HTTP_409_CONFLICT:  # no budget that month
                        result.no_budget += 1
                        continue
                    raise
                result.expenses += 1
            else:
                there = await self.session.scalar(
                    select(Income.id).where(
                        Income.user_id == user.id,
                        Income.received_on == row.day,
                        Income.amount == row.amount,
                        Income.source == row.description[:100],
                    )
                )
                if there is not None:
                    result.already_there += 1
                    continue
                await incomes.create(
                    user,
                    IncomeCreate(
                        source=row.description[:100],
                        kind=row.income_kind,
                        amount=row.amount,
                        currency=currency,
                        received_on=row.day,
                    ),
                )
                result.income += 1
        return result
