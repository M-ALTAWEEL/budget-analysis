"""Your share of a group expense, copied into your own budget (phase 3d).
Design: docs/design/groups.md, section 6.

Principle 1: your share is your expense, not what you paid. If Sara pays 300 for three,
each of them spends 100: that 100 is what lands in each person's own budget.

- A copy is made only for members who have auto-add on (the default) and a budget for
  that month. Otherwise the share waits as "pending" until they add it themselves.
- When the group expense changes, the copies follow. When it's deleted, they go too.
- If someone edits or deletes their copy, it's theirs from then on ("dismissed"): the
  group never touches it again. Moving it to another category doesn't count as that.
- A share of 0 makes no copy."""

from datetime import date

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar, format_month
from app.core.money import Currency
from app.domain.budget.model import Budget, Category
from app.domain.currency.service import CurrencyService
from app.domain.expense.model import Expense
from app.domain.group.model import Group, GroupExpense, GroupExpenseShare, GroupMember
from app.domain.group.schema import AddAllResult, PendingShareRead
from app.domain.user.model import User

DESCRIPTION_MAX = 200


class ShareCopies:
    def __init__(self, session: AsyncSession, currency: CurrencyService) -> None:
        self.session = session
        self.currency = currency

    async def sync(
        self,
        group: Group,
        expense: GroupExpense,
        members: dict[int, GroupMember],
    ) -> None:
        """Bring every member's copy in line with the group expense, as it is now.
        Called after the expense was added, changed or deleted, before the commit."""
        for share in expense.shares:
            member = members[share.member_id]
            if share.status == "dismissed" or member.user_id is None:
                continue  # theirs now, or a deleted account: nothing to do
            if expense.deleted_at is not None or share.amount == 0:
                await self._drop_copy(share)
                continue
            if share.personal_expense_id is not None:
                await self._update_copy(group, expense, share, member)
            elif member.auto_add_shares:
                await self.add(group, expense, share, member, required=False)

    async def add(
        self,
        group: Group,
        expense: GroupExpense,
        share: GroupExpenseShare,
        member: GroupMember,
        required: bool = True,
    ) -> bool:
        """Copy one share into the member's budget. Without a budget for that month:
        409 when they asked for it (`required`), otherwise it simply stays pending."""
        budget = await self._budget(member.user_id, expense)
        if budget is None:
            if required:
                raise _need_budget(expense)
            return False
        category = await self._default_category(expense.category_slug)
        amount_base, rate = await self.currency.convert(
            share.amount, Currency(group.currency), Currency(budget.currency)
        )
        copy = Expense(
            user_id=member.user_id,
            category=category,
            amount=share.amount,
            currency=group.currency,
            amount_base=amount_base,
            fx_rate=rate,
            description=_description(expense, group),
            spent_at=expense.spent_at,
            categorized_by="user",
            source="group",
        )
        self.session.add(copy)
        await self.session.flush()
        share.personal_expense_id = copy.id
        share.status = "added"
        return True

    async def _update_copy(
        self, group: Group, expense: GroupExpense, share: GroupExpenseShare, member: GroupMember
    ) -> None:
        copy = await self.session.get(Expense, share.personal_expense_id)
        if copy is None:  # deleted some other way
            share.personal_expense_id = None
            share.status = "pending"
            return
        budget = await self._budget(member.user_id, expense)
        if budget is None:
            # Moved to a month they have no budget for: back to waiting.
            await self._drop_copy(share)
            return
        amount_base, rate = await self.currency.convert(
            share.amount, Currency(group.currency), Currency(budget.currency)
        )
        copy.amount = share.amount
        copy.currency = group.currency
        copy.amount_base = amount_base
        copy.fx_rate = rate
        copy.description = _description(expense, group)
        copy.spent_at = expense.spent_at
        if copy.category.user_id is None:
            # Still in a default category: follow the group's. In one of their own
            # categories: they chose it, so it stays.
            copy.category = await self._default_category(expense.category_slug)

    async def drop(self, shares: list[GroupExpenseShare]) -> None:
        """People taken out of an expense: their copies go (unless they made it theirs)."""
        for share in shares:
            if share.status != "dismissed":
                await self._drop_copy(share)

    async def _drop_copy(self, share: GroupExpenseShare) -> None:
        if share.personal_expense_id is not None:
            copy = await self.session.get(Expense, share.personal_expense_id)
            if copy is not None:
                await self.session.delete(copy)
            share.personal_expense_id = None
        if share.status == "added":
            share.status = "pending"

    async def _budget(self, user_id: int, expense: GroupExpense) -> Budget | None:
        return await self.session.scalar(
            select(Budget).where(
                Budget.user_id == user_id,
                Budget.month == await _budget_month(self.session, user_id, expense.spent_at),
            )
        )

    async def _default_category(self, slug: str) -> Category:
        category = await self.session.scalar(
            select(Category).where(Category.user_id.is_(None), Category.slug == slug)
        )
        if category is None:  # the defaults are seeded by a migration: should never happen
            category = await self.session.scalar(
                select(Category).where(Category.user_id.is_(None), Category.slug == "other")
            )
        return category


async def on_copy_changed(session: AsyncSession, copy: Expense, deleted: bool) -> None:
    """The member edited or deleted their copy themselves: from now on it's theirs."""
    share = await session.scalar(
        select(GroupExpenseShare).where(GroupExpenseShare.personal_expense_id == copy.id)
    )
    if share is None:
        return
    share.status = "dismissed"
    if deleted:
        share.personal_expense_id = None


def _description(expense: GroupExpense, group: Group) -> str:
    text = f"{expense.description} · {group.name}"
    return text if len(text) <= DESCRIPTION_MAX else text[: DESCRIPTION_MAX - 1] + "…"


async def _budget_month(session: AsyncSession, user_id: int, day: date) -> date:
    """The member's budget month for that day: their month may start on another day."""
    user = await session.get(User, user_id)
    return BudgetCalendar.of(user).month_of(day)


def _need_budget(expense: GroupExpense) -> HTTPException:
    month = expense.spent_at.replace(day=1)
    return HTTPException(
        status.HTTP_409_CONFLICT,
        f"Set a budget for {format_month(month)} before adding expenses to it.",
    )


# ── my shares that are waiting (Overview banner, Groups page) ────────────────


class MyShares:
    def __init__(self, session: AsyncSession, currency: CurrencyService) -> None:
        self.session = session
        self.copies = ShareCopies(session, currency)

    def _waiting(self, user_id: int):
        return (
            select(GroupExpenseShare, GroupExpense, Group, GroupMember)
            .join(GroupExpense, GroupExpense.id == GroupExpenseShare.group_expense_id)
            .join(Group, Group.id == GroupExpense.group_id)
            .join(GroupMember, GroupMember.id == GroupExpenseShare.member_id)
            .where(
                GroupMember.user_id == user_id,
                GroupExpenseShare.status == "pending",
                GroupExpenseShare.amount > 0,
                GroupExpense.deleted_at.is_(None),
            )
            .order_by(GroupExpense.spent_at.desc(), GroupExpense.id.desc())
        )

    async def list(self, user_id: int) -> list[PendingShareRead]:
        rows = (await self.session.execute(self._waiting(user_id).limit(200))).all()
        return [
            PendingShareRead(
                uuid=share.uuid,
                group_uuid=group.uuid,
                group_name=group.name,
                description=expense.description,
                amount=share.amount,
                currency=group.currency,
                spent_at=expense.spent_at,
            )
            for share, expense, group, _ in rows
        ]

    async def add(self, user_id: int, share_uuid: str) -> None:
        row = await self._one(user_id, share_uuid)
        share, expense, group, member = row
        await self.copies.add(group, expense, share, member, required=True)
        await self.session.commit()

    async def add_all(self, user_id: int) -> AddAllResult:
        """Every waiting share that has a budget for its month. The others keep waiting."""
        added = waiting = 0
        for share, expense, group, member in (
            await self.session.execute(self._waiting(user_id))
        ).all():
            if await self.copies.add(group, expense, share, member, required=False):
                added += 1
            else:
                waiting += 1
        await self.session.commit()
        return AddAllResult(added=added, waiting=waiting)

    async def dismiss(self, user_id: int, share_uuid: str) -> None:
        share, *_ = await self._one(user_id, share_uuid)
        share.status = "dismissed"
        await self.session.commit()

    async def _one(self, user_id: int, share_uuid: str):
        row = (
            await self.session.execute(
                self._waiting(user_id).where(GroupExpenseShare.uuid == share_uuid)
            )
        ).first()
        if row is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Share not found.")
        return row
