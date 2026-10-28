"""Business rules for savings goals: progress, the monthly amount needed, deposits."""

from datetime import date
from decimal import ROUND_UP, Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import to_money
from app.domain.currency.catalog import CurrencyCatalog
from app.domain.goal.model import GoalContribution, SavingsGoal
from app.domain.goal.repository import GoalRepository
from app.domain.goal.schema import (
    ContributionCreate,
    ContributionRead,
    GoalCreate,
    GoalDetail,
    GoalRead,
    GoalUpdate,
)
from app.domain.user.model import User


def months_left(target: date, today: date) -> int:
    """Calendar months still available to save, counting the current one.

    October 18 -> March 15 = 6 (Oct, Nov, Dec, Jan, Feb, Mar). 0 when the date has passed.
    """
    if target < today:
        return 0
    return (target.year - today.year) * 12 + (target.month - today.month) + 1


def describe(goal: SavingsGoal, today: date) -> GoalRead:
    saved = to_money(goal.saved)
    # to_money: max() can return the bare Decimal("0") we wrote, which the API would send
    # as "0" instead of "0.00" like every other amount.
    remaining = to_money(max(goal.target_amount - saved, Decimal("0")))
    progress = min(saved / goal.target_amount, Decimal("1")) if goal.target_amount else Decimal("0")

    months = months_left(goal.target_date, today) if goal.target_date else None
    if months is None:
        monthly = None
    elif months == 0:
        monthly = remaining  # deadline passed: everything still missing is due now
    else:
        # Round UP to the cent: rounding down would end the last month a few cents short.
        monthly = (remaining / months).quantize(Decimal("0.01"), rounding=ROUND_UP)

    return GoalRead(
        uuid=goal.uuid,
        name=goal.name,
        icon=goal.icon,
        color=goal.color,
        currency=goal.currency,
        target_amount=goal.target_amount,
        target_date=goal.target_date,
        saved=saved,
        remaining=remaining,
        progress=progress.quantize(Decimal("0.0001")),
        achieved=saved >= goal.target_amount,
        months_left=months,
        monthly_needed=monthly,
        created_at=goal.created_at,
    )


def _not_found(what: str = "Goal") -> HTTPException:
    # 404 for other users' goals too: we do not even confirm they exist.
    return HTTPException(status.HTTP_404_NOT_FOUND, f"{what} not found.")


class GoalService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.goals = GoalRepository(session)

    async def list_active(self, user: User) -> list[GoalRead]:
        today = date.today()
        return [describe(goal, today) for goal in await self.goals.list_active(user.id)]

    async def detail(self, user: User, goal_uuid: str) -> GoalDetail:
        goal = await self._goal_or_404(user, goal_uuid)
        return self._detail(goal)

    async def create(self, user: User, data: GoalCreate) -> GoalDetail:
        currency = data.currency or user.base_currency
        await CurrencyCatalog(self.session).require_offered(currency, current=user.base_currency)
        goal = SavingsGoal(
            user_id=user.id,
            name=data.name,
            target_amount=to_money(data.target_amount),
            currency=currency,
            target_date=data.target_date,
            icon=data.icon,
            color=data.color,
            contributions=[],  # start with an empty (already loaded) list
        )
        self.goals.add(goal)
        await self.session.commit()
        return self._detail(goal)

    async def update(self, user: User, goal_uuid: str, data: GoalUpdate) -> GoalDetail:
        goal = await self._goal_or_404(user, goal_uuid)
        for field, value in data.model_dump(exclude_unset=True).items():
            setattr(goal, field, value)
        await self.session.commit()
        return self._detail(goal)

    async def archive(self, user: User, goal_uuid: str) -> None:
        goal = await self._goal_or_404(user, goal_uuid)
        goal.is_archived = True
        await self.session.commit()

    async def contribute(self, user: User, goal_uuid: str, data: ContributionCreate) -> GoalDetail:
        goal = await self._goal_or_404(user, goal_uuid)
        amount = to_money(data.amount)
        if data.kind == "withdrawal":
            if amount > goal.saved:
                raise HTTPException(
                    status.HTTP_422_UNPROCESSABLE_CONTENT,
                    f"Only {to_money(goal.saved)} is saved in this goal.",
                )
            amount = -amount

        made_on = data.made_on or date.today()
        if made_on > date.today():
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, "The date cannot be in the future."
            )

        goal.contributions.append(GoalContribution(amount=amount, note=data.note, made_on=made_on))
        await self.session.commit()
        return self._detail(goal)

    async def remove_contribution(
        self, user: User, goal_uuid: str, contribution_uuid: str
    ) -> GoalDetail:
        goal = await self._goal_or_404(user, goal_uuid)
        contribution = next((c for c in goal.contributions if c.uuid == contribution_uuid), None)
        if contribution is None:
            raise _not_found("Contribution")
        if goal.saved - contribution.amount < 0:
            # Removing an old deposit would leave later withdrawals taking out money
            # that was never put in.
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Remove the withdrawals made after it first."
            )
        goal.contributions.remove(contribution)  # delete-orphan: the row is deleted
        await self.session.commit()
        return self._detail(goal)

    # ── helpers ──────────────────────────────────────────────────────────────

    async def _goal_or_404(self, user: User, goal_uuid: str) -> SavingsGoal:
        goal = await self.goals.get_active(user.id, goal_uuid)
        if goal is None:
            raise _not_found()
        return goal

    @staticmethod
    def _detail(goal: SavingsGoal) -> GoalDetail:
        return GoalDetail(
            **describe(goal, date.today()).model_dump(),
            # Sorted here, not only by the relationship's ORDER BY: a contribution added in
            # this request sits at the end of the in-memory list until the goal is reloaded.
            contributions=[
                ContributionRead.model_validate(c)
                for c in sorted(goal.contributions, key=lambda c: (c.made_on, c.id), reverse=True)
            ],
        )
