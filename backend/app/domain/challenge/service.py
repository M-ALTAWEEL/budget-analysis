"""Savings challenges (feature F6): progress from the person's own expenses, wins and
badges, and challenges shared with a group. Rules: docs/BUSINESS_LOGIC.md, section 9.1."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar
from app.core.money import to_money
from app.domain.budget.repository import BudgetRepository, CategoryRepository
from app.domain.budget.schema import CategoryRead
from app.domain.challenge.model import Challenge
from app.domain.challenge.schema import (
    ChallengeCreate,
    ChallengeList,
    ChallengeRead,
    OpenChallenge,
    Participant,
)
from app.domain.expense.model import Expense
from app.domain.group.model import Group, GroupMember
from app.domain.user.model import User

MAX_ACTIVE = 10
MAX_KEPT = 200
BADGES = ((1, "first_win"), (3, "three_wins"), (5, "five_wins"), (10, "ten_wins"))
STREAK_LOOKBACK = 120  # days


@dataclass
class Progress:
    status: str
    days_done: int
    value: Decimal
    target: Decimal


class ChallengeService:
    def __init__(self, session: AsyncSession, today: date | None = None) -> None:
        self.session = session
        self.today = today or date.today()

    # ── reading ──────────────────────────────────────────────────────────────

    async def list(self, user: User) -> ChallengeList:
        mine = list(
            await self.session.scalars(select(Challenge).where(Challenge.user_id == user.id))
        )
        reads = [await self._read(user, c) for c in mine]
        finished = {"won", "lost"}
        reads.sort(key=lambda r: (r.status in finished, -r.ends_on.toordinal()))
        wins = sum(1 for r in reads if r.status == "won")
        return ChallengeList(
            items=reads,
            open=await self._open(user, mine),
            wins=wins,
            badges=[name for needed, name in BADGES if wins >= needed],
            streak=await self._streak(user.id),
        )

    async def progress(self, challenge: Challenge) -> Progress:
        start, end = challenge.starts_on, challenge.ends_on
        days = (end - start).days + 1
        if self.today < start:
            target = self._target(challenge, days)
            return Progress("upcoming", 0, Decimal("0"), target)
        last_done = min(end, self.today - timedelta(days=1))  # finished days
        days_done = max((last_done - start).days + 1, 0)
        # Everything spent so far, today included: a purchase today already counts.
        until = min(end, self.today)
        query = select(func.coalesce(func.sum(Expense.amount_base), 0)).where(
            Expense.user_id == challenge.user_id,
            Expense.spent_at >= start,
            Expense.spent_at <= until,
        )
        over = self.today > end

        if challenge.kind == "no_spend_category":
            spent = await self.session.scalar(
                query.where(Expense.category_id == challenge.category_id)
            )
            if spent > 0:
                return Progress("lost", days_done, Decimal(days_done), Decimal(days))
            return Progress(
                "won" if over else "active", days_done, Decimal(days_done), Decimal(days)
            )

        if challenge.kind == "spend_under":
            if challenge.category_id is not None:
                query = query.where(Expense.category_id == challenge.category_id)
            spent = to_money(Decimal(await self.session.scalar(query)))
            limit = challenge.amount or Decimal("0")
            state = "lost" if spent > limit else "won" if over else "active"
            return Progress(state, days_done, spent, limit)

        # no_spend_days: finished days without a single expense
        spending_days = await self.session.scalar(
            select(func.count(func.distinct(Expense.spent_at))).where(
                Expense.user_id == challenge.user_id,
                Expense.spent_at >= start,
                Expense.spent_at <= last_done,
            )
        )
        clean = days_done - spending_days
        target = challenge.target_days or 0
        days_left = (end - max(self.today, start)).days + 1 if not over else 0
        if clean >= target:
            state = "won"
        elif clean + days_left < target:
            state = "lost"
        else:
            state = "active"
        return Progress(state, days_done, Decimal(clean), Decimal(target))

    # ── changing ─────────────────────────────────────────────────────────────

    async def create(self, user: User, data: ChallengeCreate) -> ChallengeRead:
        count = await self.session.scalar(
            select(func.count()).select_from(Challenge).where(Challenge.user_id == user.id)
        )
        if count >= MAX_KEPT:
            raise HTTPException(status.HTTP_409_CONFLICT, "Too many challenges.")
        active = await self.session.scalar(
            select(func.count())
            .select_from(Challenge)
            .where(Challenge.user_id == user.id, Challenge.ends_on >= self.today)
        )
        if active >= MAX_ACTIVE:
            raise HTTPException(status.HTTP_409_CONFLICT, "Too many running challenges.")
        category_id = None
        if data.category_uuid:
            category = await CategoryRepository(self.session).get_visible(
                user.id, data.category_uuid
            )
            if category is None:
                raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Unknown category.")
            if category.user_id is not None and data.group_uuid:
                # Others can't count against a category only I have.
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    "Shared challenges use the built-in categories.",
                )
            category_id = category.id
        group_id = None
        if data.group_uuid:
            group_id = (await self._my_group(user, data.group_uuid)).id
        challenge = Challenge(
            user_id=user.id,
            kind=data.kind,
            category_id=category_id,
            amount=to_money(data.amount) if data.kind == "spend_under" else None,
            target_days=data.target_days if data.kind == "no_spend_days" else None,
            currency=await self._currency(user, data.starts_on),
            starts_on=data.starts_on,
            ends_on=data.ends_on,
            group_id=group_id,
        )
        self.session.add(challenge)
        await self.session.commit()
        await self.session.refresh(challenge, ["category"])
        return await self._read(user, challenge)

    async def join(self, user: User, challenge_uuid: str) -> ChallengeRead:
        """My own copy of a challenge someone started in one of my groups."""
        origin = await self.session.scalar(
            select(Challenge).where(
                Challenge.uuid == challenge_uuid,
                Challenge.origin_id.is_(None),
                Challenge.group_id.is_not(None),
            )
        )
        if (
            origin is None
            or origin.user_id == user.id
            or not await self._member(user.id, origin.group_id)
        ):
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found.")
        if origin.ends_on < self.today:
            raise HTTPException(status.HTTP_409_CONFLICT, "This challenge is over.")
        already = await self.session.scalar(
            select(Challenge.id).where(
                Challenge.user_id == user.id, Challenge.origin_id == origin.id
            )
        )
        if already is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, "You already joined it.")
        copy = Challenge(
            user_id=user.id,
            kind=origin.kind,
            category_id=origin.category_id,
            amount=origin.amount,
            target_days=origin.target_days,
            currency=await self._currency(user, origin.starts_on),
            starts_on=origin.starts_on,
            ends_on=origin.ends_on,
            group_id=origin.group_id,
            origin_id=origin.id,
        )
        self.session.add(copy)
        await self.session.commit()
        await self.session.refresh(copy, ["category"])
        return await self._read(user, copy)

    async def delete(self, user: User, challenge_uuid: str) -> None:
        challenge = await self.session.scalar(
            select(Challenge).where(Challenge.uuid == challenge_uuid, Challenge.user_id == user.id)
        )
        if challenge is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found.")
        await self.session.delete(challenge)
        await self.session.commit()

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _target(challenge: Challenge, days: int) -> Decimal:
        if challenge.kind == "spend_under":
            return challenge.amount or Decimal("0")
        if challenge.kind == "no_spend_days":
            return Decimal(challenge.target_days or 0)
        return Decimal(days)

    async def _currency(self, user: User, day: date) -> str:
        month = BudgetCalendar.of(user).month_of(day)
        budget = await BudgetRepository(self.session).get_for_month(user.id, month)
        return budget.currency if budget else user.base_currency

    async def _member(self, user_id: int, group_id: int | None) -> GroupMember | None:
        if group_id is None:
            return None
        return await self.session.scalar(
            select(GroupMember).where(
                GroupMember.group_id == group_id,
                GroupMember.user_id == user_id,
                GroupMember.left_at.is_(None),
            )
        )

    async def _my_group(self, user: User, group_uuid: str) -> Group:
        group = await self.session.scalar(
            select(Group)
            .join(GroupMember, GroupMember.group_id == Group.id)
            .where(
                Group.uuid == group_uuid,
                Group.archived_at.is_(None),
                GroupMember.user_id == user.id,
                GroupMember.left_at.is_(None),
            )
        )
        if group is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Group not found.")
        return group

    async def _read(self, user: User, challenge: Challenge) -> ChallengeRead:
        p = await self.progress(challenge)
        group = None
        participants: list[Participant] = []
        if challenge.group_id is not None and await self._member(user.id, challenge.group_id):
            group = await self.session.get(Group, challenge.group_id)
            root_id = challenge.origin_id or challenge.id
            everyone = list(
                await self.session.scalars(
                    select(Challenge).where(
                        (Challenge.id == root_id) | (Challenge.origin_id == root_id)
                    )
                )
            )
            names = {
                m.user_id: m.display_name
                for m in await self.session.scalars(
                    select(GroupMember).where(
                        GroupMember.group_id == challenge.group_id,
                        GroupMember.left_at.is_(None),
                    )
                )
            }
            for other in everyone:
                if other.user_id not in names:
                    continue  # left the group: no longer shown
                q = p if other.id == challenge.id else await self.progress(other)
                participants.append(
                    Participant(
                        name=names[other.user_id],
                        me=other.user_id == user.id,
                        status=q.status,
                        value=q.value,
                        target=q.target,
                    )
                )
        return ChallengeRead(
            uuid=challenge.uuid,
            kind=challenge.kind,
            category=CategoryRead.model_validate(challenge.category)
            if challenge.category
            else None,
            amount=challenge.amount,
            target_days=challenge.target_days,
            starts_on=challenge.starts_on,
            ends_on=challenge.ends_on,
            currency=challenge.currency,
            status=p.status,
            days=(challenge.ends_on - challenge.starts_on).days + 1,
            days_done=p.days_done,
            value=p.value,
            target=p.target,
            group=group.name if group else None,
            group_uuid=group.uuid if group else None,
            participants=participants,
        )

    async def _open(self, user: User, mine: list[Challenge]) -> list[OpenChallenge]:
        joined = {c.origin_id for c in mine if c.origin_id is not None}
        my_groups = select(GroupMember.group_id).where(
            GroupMember.user_id == user.id, GroupMember.left_at.is_(None)
        )
        rows = await self.session.execute(
            select(Challenge, Group.name, GroupMember.display_name)
            .join(Group, Group.id == Challenge.group_id)
            .join(
                GroupMember,
                (GroupMember.group_id == Challenge.group_id)
                & (GroupMember.user_id == Challenge.user_id),
            )
            .where(
                Challenge.group_id.in_(my_groups),
                Challenge.origin_id.is_(None),
                Challenge.user_id != user.id,
                Challenge.ends_on >= self.today,
                GroupMember.left_at.is_(None),
            )
            .order_by(Challenge.starts_on)
        )
        return [
            OpenChallenge(
                uuid=c.uuid,
                kind=c.kind,
                category=CategoryRead.model_validate(c.category) if c.category else None,
                amount=c.amount,
                target_days=c.target_days,
                starts_on=c.starts_on,
                ends_on=c.ends_on,
                group=group_name,
                by=by,
            )
            for c, group_name, by in rows.unique()
            if c.id not in joined
        ]

    async def _streak(self, user_id: int) -> int:
        """Days in a row without any expense, ending yesterday."""
        since = self.today - timedelta(days=STREAK_LOOKBACK)
        days = set(
            await self.session.scalars(
                select(Expense.spent_at)
                .where(
                    Expense.user_id == user_id,
                    Expense.spent_at >= since,
                    Expense.spent_at < self.today,
                )
                .distinct()
            )
        )
        streak, day = 0, self.today - timedelta(days=1)
        while day >= since and day not in days:
            streak += 1
            day -= timedelta(days=1)
        return streak
