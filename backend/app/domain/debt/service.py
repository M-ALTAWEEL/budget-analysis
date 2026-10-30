"""Personal debts (feature F2): who owes whom outside groups, paying back in parts, and a
reminder on the due day. Rules: docs/BUSINESS_LOGIC.md, section 11.8."""

# Annotations stay strings: the classes have a method called `list`, which would
# otherwise hide the built-in list[...] in the annotations that follow it.
from __future__ import annotations

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import to_money
from app.core.push import PushMessage
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.debt.model import Debt, DebtPayment
from app.domain.debt.schema import (
    DebtCreate,
    DebtList,
    DebtRead,
    DebtUpdate,
    PaymentCreate,
    PaymentRead,
)
from app.domain.notify.model import PushDevice
from app.domain.notify.texts import money, text
from app.domain.user.model import User

MAX_OPEN = 100  # open debts per person


def paid(debt: Debt) -> Decimal:
    return to_money(sum((p.amount for p in debt.payments), Decimal("0")))


def remaining(debt: Debt) -> Decimal:
    return to_money(debt.amount - paid(debt))


class DebtService:
    def __init__(
        self, session: AsyncSession, fx_client: ExchangeRateClient, today: date | None = None
    ) -> None:
        self.session = session
        self.currency = CurrencyService(session, fx_client)
        self.today = today or date.today()

    async def list(self, user: User) -> DebtList:
        debts = await self._debts(user.id)
        owed_to_you = you_owe = Decimal("0")
        for debt in debts:
            if debt.settled_on is not None:
                continue
            try:
                left, _ = await self.currency.convert(
                    remaining(debt), debt.currency, user.base_currency
                )
            except HTTPException:  # no exchange rates right now: left out of the totals
                continue
            if debt.direction == "lent":
                owed_to_you += left
            else:
                you_owe += left
        far = date.max
        debts.sort(key=lambda d: (d.settled_on is not None, d.due_on or far, d.started_on, d.id))
        return DebtList(
            items=[self._read(d) for d in debts],
            owed_to_you=to_money(owed_to_you),
            you_owe=to_money(you_owe),
            currency=user.base_currency,
        )

    async def create(self, user: User, data: DebtCreate) -> DebtRead:
        open_count = await self.session.scalar(
            select(func.count())
            .select_from(Debt)
            .where(Debt.user_id == user.id, Debt.settled_on.is_(None))
        )
        if open_count >= MAX_OPEN:
            raise HTTPException(status.HTTP_409_CONFLICT, "Too many open debts.")
        currency = data.currency or user.base_currency
        await self.currency.catalog.require_offered(currency, current=user.base_currency)
        self._check_due(data.due_on, data.started_on)
        debt = Debt(
            user_id=user.id,
            person=data.person,
            direction=data.direction,
            amount=to_money(data.amount),
            currency=currency,
            note=data.note or None,
            started_on=data.started_on,
            due_on=data.due_on,
            payments=[],
        )
        self.session.add(debt)
        await self.session.commit()
        return self._read(debt)

    async def update(self, user: User, debt_uuid: str, data: DebtUpdate) -> DebtRead:
        debt = await self._debt(user, debt_uuid)
        changes = data.model_dump(exclude_unset=True)
        if "amount" in changes:
            amount = to_money(changes["amount"])
            if amount < paid(debt):
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "The amount can't be less than what was already paid back.",
                )
            debt.amount = amount
        if "person" in changes:
            debt.person = changes["person"]
        if "note" in changes:
            debt.note = changes["note"] or None
        if "due_on" in changes:
            self._check_due(changes["due_on"], debt.started_on)
            debt.due_on = changes["due_on"]
            debt.last_reminded_on = None  # a new due day gets its own reminder
        self._settle_if_done(debt)
        await self.session.commit()
        return self._read(debt)

    async def delete(self, user: User, debt_uuid: str) -> None:
        await self.session.delete(await self._debt(user, debt_uuid))
        await self.session.commit()

    async def pay(self, user: User, debt_uuid: str, data: PaymentCreate) -> DebtRead:
        debt = await self._debt(user, debt_uuid)
        amount = to_money(data.amount)
        if amount > remaining(debt):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "That is more than what is left."
            )
        if data.paid_on < debt.started_on:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "A payment can't be before the debt."
            )
        debt.payments.append(DebtPayment(amount=amount, paid_on=data.paid_on))
        self._settle_if_done(debt)
        await self.session.commit()
        return self._read(debt)

    async def settle(self, user: User, debt_uuid: str) -> DebtRead:
        """ "All paid back": one payment of whatever is left, today."""
        debt = await self._debt(user, debt_uuid)
        left = remaining(debt)
        if left > 0:
            debt.payments.append(DebtPayment(amount=left, paid_on=max(self.today, debt.started_on)))
        self._settle_if_done(debt)
        await self.session.commit()
        return self._read(debt)

    async def undo_payment(self, user: User, debt_uuid: str, payment_uuid: str) -> DebtRead:
        debt = await self._debt(user, debt_uuid)
        payment = next((p for p in debt.payments if p.uuid == payment_uuid), None)
        if payment is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Payment not found.")
        debt.payments.remove(payment)
        self._settle_if_done(debt)
        await self.session.commit()
        return self._read(debt)

    async def reminders(self, user: User) -> list[PushMessage]:
        """On the due day: "Ali owes you 200.00 TRY, due today". Once per due day."""
        if not user.is_active or not user.notify_budget:
            return []
        due = [
            debt
            for debt in await self._debts(user.id)
            if debt.settled_on is None
            and debt.due_on == self.today
            and debt.last_reminded_on != self.today
        ]
        if not due:
            return []
        devices = list(
            await self.session.scalars(select(PushDevice).where(PushDevice.user_id == user.id))
        )
        for debt in due:
            debt.last_reminded_on = self.today
        await self.session.commit()
        title = text(user.locale, "debt_title")
        return [
            PushMessage(
                to=device.token,
                title=title,
                body=text(
                    user.locale,
                    "debt_owed" if debt.direction == "lent" else "debt_owe",
                    person=debt.person,
                    amount=money(remaining(debt), debt.currency),
                ),
                data={"url": "/debts"},
            )
            for debt in due
            for device in devices
        ]

    # ── helpers ──────────────────────────────────────────────────────────────

    def _settle_if_done(self, debt: Debt) -> None:
        if remaining(debt) <= 0:
            if debt.settled_on is None:
                last = max((p.paid_on for p in debt.payments), default=self.today)
                debt.settled_on = last
        else:
            debt.settled_on = None

    def _check_due(self, due_on: date | None, started_on: date) -> None:
        if due_on is not None and due_on < started_on:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "The due day can't be before the debt."
            )

    async def _debts(self, user_id: int) -> list[Debt]:
        return list(await self.session.scalars(select(Debt).where(Debt.user_id == user_id)))

    async def _debt(self, user: User, debt_uuid: str) -> Debt:
        debt = await self.session.scalar(
            select(Debt).where(Debt.uuid == debt_uuid, Debt.user_id == user.id)
        )
        if debt is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Debt not found.")
        return debt

    def _read(self, debt: Debt) -> DebtRead:
        left = remaining(debt)
        return DebtRead(
            uuid=debt.uuid,
            person=debt.person,
            direction=debt.direction,
            amount=debt.amount,
            currency=debt.currency,
            note=debt.note,
            started_on=debt.started_on,
            due_on=debt.due_on,
            settled_on=debt.settled_on,
            paid=paid(debt),
            remaining=left,
            overdue=debt.settled_on is None
            and debt.due_on is not None
            and debt.due_on < self.today,
            payments=[
                PaymentRead(uuid=p.uuid, amount=p.amount, paid_on=p.paid_on) for p in debt.payments
            ],
        )


async def users_with_debts_due(session: AsyncSession, today: date) -> list[User]:
    """Everyone with an open debt due today (for the daily job)."""
    return list(
        await session.scalars(
            select(User).where(
                User.is_active.is_(True),
                User.id.in_(
                    select(Debt.user_id).where(Debt.settled_on.is_(None), Debt.due_on == today)
                ),
            )
        )
    )
