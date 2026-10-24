"""Who owes whom in a group, computed from its expenses and settlements (phase 3e).
Design: docs/design/groups.md, section 5.

Balances are never stored: they are worked out from the history every time, so they can
never drift from it (one source of truth).

For every expense, each person in it owes the payer their share. Every settlement takes
that much off what one person owes another. What's left between two people, in either
direction, cancels out: if A owes B 30 and B owes A 10, A owes B 20.

Only models here (no services), so the group service can use it without a cycle."""

from collections import defaultdict
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.group.model import GroupExpense, GroupExpenseShare, GroupSettlement

ZERO = Decimal("0.00")


async def pair_debts(session: AsyncSession, group_id: int) -> dict[tuple[int, int], Decimal]:
    """{(debtor, creditor): amount > 0}, one entry per pair of members at most."""
    owed: dict[tuple[int, int], Decimal] = defaultdict(lambda: ZERO)

    shares = await session.execute(
        select(
            GroupExpenseShare.member_id, GroupExpense.paid_by, func.sum(GroupExpenseShare.amount)
        )
        .join(GroupExpense, GroupExpense.id == GroupExpenseShare.group_expense_id)
        .where(
            GroupExpense.group_id == group_id,
            GroupExpense.deleted_at.is_(None),
            GroupExpenseShare.member_id != GroupExpense.paid_by,  # your own share: no debt
        )
        .group_by(GroupExpenseShare.member_id, GroupExpense.paid_by)
    )
    for debtor, creditor, total in shares:
        owed[(debtor, creditor)] += total

    paid_back = await session.execute(
        select(
            GroupSettlement.from_member,
            GroupSettlement.to_member,
            func.sum(GroupSettlement.amount),
        )
        .where(GroupSettlement.group_id == group_id, GroupSettlement.deleted_at.is_(None))
        .group_by(GroupSettlement.from_member, GroupSettlement.to_member)
    )
    for payer, receiver, total in paid_back:
        owed[(payer, receiver)] -= total

    debts: dict[tuple[int, int], Decimal] = {}
    for a, b in {tuple(sorted(pair)) for pair in owed}:
        net = owed[(a, b)] - owed[(b, a)]
        if net > 0:
            debts[(a, b)] = net
        elif net < 0:
            debts[(b, a)] = -net
    return debts


def nets(debts: dict[tuple[int, int], Decimal]) -> dict[int, Decimal]:
    """Each member's balance: > 0 the group owes them, < 0 they owe. Always sums to 0."""
    result: dict[int, Decimal] = defaultdict(lambda: ZERO)
    for (debtor, creditor), amount in debts.items():
        result[debtor] -= amount
        result[creditor] += amount
    return dict(result)


async def member_net(session: AsyncSession, group_id: int, member_id: int) -> Decimal:
    return nets(await pair_debts(session, group_id)).get(member_id, ZERO)
