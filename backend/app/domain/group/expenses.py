"""Group expenses and how they are split (phase 3b).
Design: docs/design/groups.md, sections 3, 4 and 7.

- Every member can add an expense. The one who added it, and the group's admins, can
  change or delete it.
- The shares always add up to the amount exactly (split.py).
- An expense paid in another currency is converted to the group's currency once, and the
  rate is kept (a snapshot, like personal expenses).
- Deleting is soft: the row stays, so balances can always be explained later."""

# The class has a method called `list`: without this, `list[...]` in the annotations
# below would mean that method, not the built-in type.
from __future__ import annotations

from datetime import UTC, datetime
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import Currency, to_rate
from app.domain.currency.client import ExchangeRateClient
from app.domain.currency.service import CurrencyService
from app.domain.group.model import (
    Group,
    GroupExpense,
    GroupExpenseShare,
    GroupMember,
    GroupSettlement,
)
from app.domain.group.schema import GroupExpenseInput, GroupExpenseRead, MemberRef, ShareRead
from app.domain.group.service import GroupService
from app.domain.group.shares import ShareCopies
from app.domain.group.split import split_amount
from app.domain.user.model import User

EXPENSE_NOT_FOUND = "Expense not found."
NOT_IN_GROUP = "Someone in this expense isn't in the group."


class GroupExpenseService:
    def __init__(self, session: AsyncSession, fx_client: ExchangeRateClient) -> None:
        self.session = session
        self.groups = GroupService(session)
        self.currency = CurrencyService(session, fx_client)
        self.copies = ShareCopies(session, self.currency)

    async def list(
        self, user: User, group_uuid: str, limit: int, offset: int
    ) -> list[GroupExpenseRead]:
        group, me = await self.groups.membership(user, group_uuid)
        expenses = (
            await self.session.scalars(
                select(GroupExpense)
                .where(GroupExpense.group_id == group.id, GroupExpense.deleted_at.is_(None))
                .order_by(GroupExpense.spent_at.desc(), GroupExpense.id.desc())
                .limit(limit)
                .offset(offset)
            )
        ).all()
        return await self.read_many(group, me, list(expenses))

    async def read_many(
        self, group: Group, me: GroupMember, expenses: list[GroupExpense]
    ) -> list[GroupExpenseRead]:
        members = await self._members(group.id)
        paid_back = await self._paid_back([e.id for e in expenses])
        return [self._read(e, me, members, paid_back.get(e.id, set())) for e in expenses]

    async def create(
        self, user: User, group_uuid: str, data: GroupExpenseInput
    ) -> GroupExpenseRead:
        group, me = await self.groups.membership(user, group_uuid)
        expense = GroupExpense(group_id=group.id, created_by=me.id, shares=[])
        members = await self._fill(group, me, expense, data)
        self.session.add(expense)
        await self.session.flush()
        await self.copies.sync(group, expense, members)
        await self.session.commit()
        return await self._fresh(group, me, expense.id)

    async def update(
        self, user: User, group_uuid: str, expense_uuid: str, data: GroupExpenseInput
    ) -> GroupExpenseRead:
        group, me = await self.groups.membership(user, group_uuid)
        expense = await self._editable(group, me, expense_uuid)
        members = await self._fill(group, me, expense, data)
        await self.session.flush()  # new shares get their defaults (status "pending")
        await self.copies.sync(group, expense, members)
        await self.session.commit()
        return await self._fresh(group, me, expense.id)

    async def delete(self, user: User, group_uuid: str, expense_uuid: str) -> None:
        group, me = await self.groups.membership(user, group_uuid)
        expense = await self._editable(group, me, expense_uuid)
        expense.deleted_at = datetime.now(UTC)
        # Everyone's copy goes too (except copies people changed: those are theirs).
        await self.copies.sync(group, expense, await self._members(group.id))
        await self.session.commit()

    # ── the rules ────────────────────────────────────────────────────────────

    async def _fill(
        self, group: Group, me: GroupMember, expense: GroupExpense, data: GroupExpenseInput
    ) -> dict[int, GroupMember]:
        """Set the expense and its shares from the input; people taken out of it lose their
        copy. Returns the group's members."""
        members = await self._members(group.id)
        by_uuid = {m.uuid: m for m in members.values()}
        # Who can be in it: today's members, plus anyone already in this expense (someone
        # who has left since still keeps their part of an old expense).
        already = {s.member_id for s in expense.shares} | (
            {expense.paid_by} if expense.paid_by else set()
        )

        def usable(member_uuid: str) -> GroupMember:
            member = by_uuid.get(member_uuid)
            if member is None or (member.left_at is not None and member.id not in already):
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_IN_GROUP)
            return member

        payer = usable(data.paid_by) if data.paid_by else me
        people = [usable(share.member) for share in data.shares]

        paid_in = data.currency or Currency(group.currency)
        if paid_in.value == group.currency:
            amount, rate = data.amount, to_rate(1)
        else:
            amount, rate = await self.currency.convert(
                data.amount, paid_in, Currency(group.currency)
            )

        typed = [share.value for share in data.shares]
        if data.split_method == "equal":
            parts = split_amount(amount, [1] * len(people))
            typed = [None] * len(people)
        else:
            # Exact amounts typed in another currency are converted in proportion, so
            # they still add up to the converted total exactly.
            parts = split_amount(amount, typed)

        expense.paid_by = payer.id
        expense.description = data.description
        expense.category_slug = data.category
        expense.amount = amount
        expense.original_amount = data.amount
        expense.original_currency = paid_in.value
        expense.fx_rate = rate
        expense.split_method = data.split_method
        expense.spent_at = data.spent_at

        # Keep the rows of people who stay in it (phase 3c links them to personal copies),
        # change their amounts, add the new people, drop the ones taken out.
        current = {share.member_id: share for share in expense.shares}
        kept = []
        for person, part, weight in zip(people, parts, typed, strict=True):
            share = current.get(person.id) or GroupExpenseShare(member_id=person.id)
            share.amount = part
            share.weight = weight
            kept.append(share)
        staying = {share.member_id for share in kept}
        removed = [share for share in current.values() if share.member_id not in staying]
        # Their copies first: the share rows themselves are deleted with the new list.
        await self.copies.drop(removed)
        expense.shares = kept
        return members

    async def _editable(self, group: Group, me: GroupMember, expense_uuid: str) -> GroupExpense:
        expense = await self.session.scalar(
            select(GroupExpense).where(
                GroupExpense.group_id == group.id,
                GroupExpense.uuid == expense_uuid,
                GroupExpense.deleted_at.is_(None),
            )
        )
        if expense is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, EXPENSE_NOT_FOUND)
        if not self._can_edit(expense, me):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Only who added it, or an admin, can change it."
            )
        return expense

    # ── reading ──────────────────────────────────────────────────────────────

    async def _fresh(self, group: Group, me: GroupMember, expense_id: int) -> GroupExpenseRead:
        expense = await self.session.scalar(
            select(GroupExpense)
            .where(GroupExpense.id == expense_id)
            .execution_options(populate_existing=True)
        )
        return (await self.read_many(group, me, [expense]))[0]

    async def _members(self, group_id: int) -> dict[int, GroupMember]:
        rows = await self.session.scalars(
            select(GroupMember).where(GroupMember.group_id == group_id)
        )
        return {m.id: m for m in rows}

    @staticmethod
    def _can_edit(expense: GroupExpense, me: GroupMember) -> bool:
        return me.role in ("owner", "admin") or expense.created_by == me.id

    async def _paid_back(self, expense_ids: list[int]) -> dict[int, set[int]]:
        """Who marked their share of each expense as paid back (phase 3e)."""
        if not expense_ids:
            return {}
        rows = await self.session.execute(
            select(GroupSettlement.group_expense_id, GroupSettlement.from_member).where(
                GroupSettlement.group_expense_id.in_(expense_ids),
                GroupSettlement.deleted_at.is_(None),
            )
        )
        result: dict[int, set[int]] = {}
        for expense_id, member_id in rows:
            result.setdefault(expense_id, set()).add(member_id)
        return result

    def _read(
        self,
        expense: GroupExpense,
        me: GroupMember,
        members: dict[int, GroupMember],
        paid_back: set[int],
    ) -> GroupExpenseRead:
        def ref(member_id: int) -> MemberRef:
            member = members[member_id]
            return MemberRef(uuid=member.uuid, display_name=member.display_name)

        mine: Decimal | None = next(
            (s.amount for s in expense.shares if s.member_id == me.id), None
        )
        return GroupExpenseRead(
            uuid=expense.uuid,
            description=expense.description,
            category=expense.category_slug,
            amount=expense.amount,
            original_amount=expense.original_amount,
            original_currency=expense.original_currency,
            split_method=expense.split_method,
            spent_at=expense.spent_at,
            paid_by=ref(expense.paid_by),
            added_by=ref(expense.created_by) if expense.created_by else None,
            shares=[
                ShareRead(member=ref(s.member_id), amount=s.amount, weight=s.weight)
                for s in expense.shares
            ],
            my_share=mine,
            paid_back=[members[m].uuid for m in sorted(paid_back)],
            can_edit=self._can_edit(expense, me),
            created_at=expense.created_at,
        )
