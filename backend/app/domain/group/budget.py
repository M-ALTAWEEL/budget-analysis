"""The shared household budget of a group (feature F7): one monthly total for the flat,
with optional category limits, and what is left. Rules: docs/BUSINESS_LOGIC.md, 11.9."""

from datetime import date
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import format_month, next_month
from app.core.money import to_money
from app.domain.group.model import GroupBudget, GroupExpense, GroupMember
from app.domain.group.schema import (
    GroupBudgetRead,
    GroupBudgetSet,
    GroupCategorySpending,
    MemberPaid,
)
from app.domain.group.service import GroupService
from app.domain.user.model import User

EDITORS = ("owner", "admin")


class GroupBudgetService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.groups = GroupService(session)

    async def get(self, user: User, group_uuid: str, month: date) -> GroupBudgetRead:
        group, me = await self.groups.membership(user, group_uuid)
        budget = await self._budget(group.id, month)
        end = next_month(month)
        live = (
            GroupExpense.group_id == group.id,
            GroupExpense.deleted_at.is_(None),
            GroupExpense.spent_at >= month,
            GroupExpense.spent_at < end,
        )
        by_category = dict(
            (
                await self.session.execute(
                    select(GroupExpense.category_slug, func.sum(GroupExpense.amount))
                    .where(*live)
                    .group_by(GroupExpense.category_slug)
                )
            ).all()
        )
        paid = (
            await self.session.execute(
                select(GroupMember.display_name, GroupMember.id, func.sum(GroupExpense.amount))
                .join(GroupMember, GroupMember.id == GroupExpense.paid_by)
                .where(*live)
                .group_by(GroupMember.display_name, GroupMember.id)
            )
        ).all()
        limits = {k: Decimal(v) for k, v in (budget.limits if budget else {}).items()}
        slugs = set(by_category) | set(limits)
        spent = to_money(sum(by_category.values(), Decimal("0")))
        rows = [
            GroupCategorySpending(
                category=slug,
                limit=limits.get(slug),
                spent=to_money(by_category.get(slug, Decimal("0"))),
            )
            for slug in slugs
        ]
        rows.sort(key=lambda r: (r.spent, r.limit or 0), reverse=True)
        return GroupBudgetRead(
            month=format_month(month),
            currency=group.currency,
            total_amount=budget.total_amount if budget else None,
            spent=spent,
            remaining=to_money(budget.total_amount - spent) if budget else None,
            categories=rows,
            paid_by=sorted(
                (
                    MemberPaid(name=name, me=member_id == me.id, paid=to_money(total))
                    for name, member_id, total in paid
                ),
                key=lambda m: m.paid,
                reverse=True,
            ),
            can_edit=me.role in EDITORS,
        )

    async def set(
        self, user: User, group_uuid: str, month: date, data: GroupBudgetSet
    ) -> GroupBudgetRead:
        group, me = await self.groups.membership(user, group_uuid)
        self.groups.require(me, *EDITORS)
        planned = sum(data.limits.values(), Decimal("0"))
        if planned > data.total_amount:
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT,
                "The category limits add up to more than the total.",
            )
        budget = await self._budget(group.id, month)
        if budget is None:
            budget = GroupBudget(group_id=group.id, month=month)
            self.session.add(budget)
        budget.total_amount = to_money(data.total_amount)
        budget.limits = {k: str(to_money(v)) for k, v in data.limits.items() if v > 0}
        await self.session.commit()
        return await self.get(user, group_uuid, month)

    async def delete(self, user: User, group_uuid: str, month: date) -> None:
        group, me = await self.groups.membership(user, group_uuid)
        self.groups.require(me, *EDITORS)
        budget = await self._budget(group.id, month)
        if budget is not None:
            await self.session.delete(budget)
            await self.session.commit()

    async def _budget(self, group_id: int, month: date) -> GroupBudget | None:
        return await self.session.scalar(
            select(GroupBudget).where(GroupBudget.group_id == group_id, GroupBudget.month == month)
        )
