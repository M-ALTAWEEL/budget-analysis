"""Balances, paying back, and the group's chat (phase 3e).
Design: docs/design/groups.md, sections 5 and 7.

- "I paid my share of this": a settlement linked to that expense, for my share of it.
  The bill shows me as paid, and my balance with the payer drops by that much.
- "Sara paid me 100": any amount between two members, written down by either of them
  (or by an admin). Either of them, whoever wrote it, or an admin can take it back.
- The chat is every expense and payment in the order they were written down, each with
  the server's time, so nobody can back-date a message."""

from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.currency.client import ExchangeRateClient
from app.domain.group.expenses import GroupExpenseService
from app.domain.group.ledger import ZERO, nets, pair_debts
from app.domain.group.model import GroupExpense, GroupMember, GroupSettlement
from app.domain.group.schema import (
    ActivityItem,
    BalancesRead,
    DebtRead,
    MemberBalance,
    MemberRef,
    SettlementInput,
    SettlementRead,
)
from app.domain.group.service import GroupService
from app.domain.user.model import User

NOT_FOUND = "Payment not found."


class SettlementService:
    def __init__(self, session: AsyncSession, fx_client: ExchangeRateClient) -> None:
        self.session = session
        self.groups = GroupService(session)
        self.expenses = GroupExpenseService(session, fx_client)

    # ── balances ─────────────────────────────────────────────────────────────

    async def balances(self, user: User, group_uuid: str) -> BalancesRead:
        group, me = await self.groups.membership(user, group_uuid)
        members = await self._members(group.id)
        debts = await pair_debts(self.session, group.id)
        net = nets(debts)
        ref = _refs(members)
        return BalancesRead(
            currency=group.currency,
            debts=[
                DebtRead(from_member=ref(a), to_member=ref(b), amount=amount)
                for (a, b), amount in sorted(debts.items(), key=lambda d: -d[1])
            ],
            members=[
                MemberBalance(member=ref(m.id), net=net.get(m.id, ZERO))
                for m in members.values()
                if m.left_at is None or net.get(m.id, ZERO) != 0
            ],
            my_net=net.get(me.id, ZERO),
        )

    # ── paying back ──────────────────────────────────────────────────────────

    async def record(self, user: User, group_uuid: str, data: SettlementInput) -> SettlementRead:
        group, me = await self.groups.membership(user, group_uuid)
        members = await self._members(group.id)
        by_uuid = {m.uuid: m for m in members.values()}
        expense = None

        if data.expense is not None:
            expense = await self.session.scalar(
                select(GroupExpense).where(
                    GroupExpense.group_id == group.id,
                    GroupExpense.uuid == data.expense,
                    GroupExpense.deleted_at.is_(None),
                )
            )
            if expense is None:
                raise HTTPException(status.HTTP_404_NOT_FOUND, "Expense not found.")
            mine = next((s.amount for s in expense.shares if s.member_id == me.id), None)
            if expense.paid_by == me.id or not mine:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "You don't owe anything for this.")
            already = await self.session.scalar(
                select(GroupSettlement.id).where(
                    GroupSettlement.group_expense_id == expense.id,
                    GroupSettlement.from_member == me.id,
                    GroupSettlement.deleted_at.is_(None),
                )
            )
            if already:
                raise HTTPException(status.HTTP_409_CONFLICT, "You already paid this one.")
            payer, receiver, amount = me, members[expense.paid_by], mine
        else:
            payer = by_uuid.get(data.from_member) if data.from_member else me
            receiver = by_uuid.get(data.to)
            if payer is None or receiver is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown member.")
            if payer.id == receiver.id:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Someone can't pay themselves.")
            if me.id not in (payer.id, receiver.id):
                self.groups.require(me, "owner", "admin")
            amount = data.amount

        settlement = GroupSettlement(
            group_id=group.id,
            from_member=payer.id,
            to_member=receiver.id,
            amount=amount,
            created_by=me.id,
            group_expense_id=expense.id if expense else None,
        )
        self.session.add(settlement)
        await self.session.commit()
        return self._read(settlement, me, members, {expense.id: expense} if expense else {})

    async def delete(self, user: User, group_uuid: str, settlement_uuid: str) -> None:
        group, me = await self.groups.membership(user, group_uuid)
        settlement = await self.session.scalar(
            select(GroupSettlement).where(
                GroupSettlement.group_id == group.id,
                GroupSettlement.uuid == settlement_uuid,
                GroupSettlement.deleted_at.is_(None),
            )
        )
        if settlement is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
        if not _can_delete(settlement, me):
            raise HTTPException(
                status.HTTP_403_FORBIDDEN, "Only the two people in it, or an admin, can undo it."
            )
        settlement.deleted_at = datetime.now(UTC)  # soft: the history can always be explained
        await self.session.commit()

    # ── the chat ─────────────────────────────────────────────────────────────

    async def activity(
        self, user: User, group_uuid: str, before: datetime | None, limit: int
    ) -> list[ActivityItem]:
        """Newest first. For the next page, pass the `at` of the last item as `before`."""
        group, me = await self.groups.membership(user, group_uuid)
        members = await self._members(group.id)
        ref = _refs(members)

        expense_query = select(GroupExpense).where(
            GroupExpense.group_id == group.id, GroupExpense.deleted_at.is_(None)
        )
        settlement_query = select(GroupSettlement).where(
            GroupSettlement.group_id == group.id, GroupSettlement.deleted_at.is_(None)
        )
        if before is not None:
            expense_query = expense_query.where(GroupExpense.created_at < before)
            settlement_query = settlement_query.where(GroupSettlement.created_at < before)
        expenses = (
            await self.session.scalars(
                expense_query.order_by(
                    GroupExpense.created_at.desc(), GroupExpense.id.desc()
                ).limit(limit)
            )
        ).all()
        settlements = (
            await self.session.scalars(
                settlement_query.order_by(
                    GroupSettlement.created_at.desc(), GroupSettlement.id.desc()
                ).limit(limit)
            )
        ).all()

        expense_reads = await self.expenses.read_many(group, me, list(expenses))
        linked = await self._linked_expenses([s.group_expense_id for s in settlements])
        items = [
            ActivityItem(kind="expense", at=read.created_at, by=read.added_by, expense=read)
            for read in expense_reads
        ] + [
            ActivityItem(
                kind="settlement",
                at=s.created_at,
                by=ref(s.created_by) if s.created_by else None,
                settlement=self._read(s, me, members, linked),
            )
            for s in settlements
        ]
        items.sort(key=lambda item: item.at, reverse=True)
        return items[:limit]

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _members(self, group_id: int) -> dict[int, GroupMember]:
        rows = await self.session.scalars(
            select(GroupMember).where(GroupMember.group_id == group_id)
        )
        return {m.id: m for m in rows}

    async def _linked_expenses(self, ids: list[int | None]) -> dict[int, GroupExpense]:
        wanted = [i for i in ids if i is not None]
        if not wanted:
            return {}
        rows = await self.session.scalars(select(GroupExpense).where(GroupExpense.id.in_(wanted)))
        return {e.id: e for e in rows}

    @staticmethod
    def _read(
        settlement: GroupSettlement,
        me: GroupMember,
        members: dict[int, GroupMember],
        expenses: dict[int, GroupExpense],
    ) -> SettlementRead:
        ref = _refs(members)
        expense = expenses.get(settlement.group_expense_id) if settlement.group_expense_id else None
        return SettlementRead(
            uuid=settlement.uuid,
            from_member=ref(settlement.from_member),
            to_member=ref(settlement.to_member),
            amount=settlement.amount,
            expense_uuid=expense.uuid if expense else None,
            expense_description=expense.description if expense else None,
            by=ref(settlement.created_by) if settlement.created_by else None,
            can_delete=_can_delete(settlement, me),
            created_at=settlement.created_at,
        )


def _refs(members: dict[int, GroupMember]):
    def ref(member_id: int) -> MemberRef:
        member = members[member_id]
        return MemberRef(uuid=member.uuid, display_name=member.display_name)

    return ref


def _can_delete(settlement: GroupSettlement, me: GroupMember) -> bool:
    return me.role in ("owner", "admin") or me.id in (
        settlement.from_member,
        settlement.to_member,
        settlement.created_by,
    )
