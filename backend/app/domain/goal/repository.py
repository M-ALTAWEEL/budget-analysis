"""Database queries for savings goals. Every method takes user_id: no cross-user access."""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.goal.model import GoalContribution, SavingsGoal


class GoalRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_active(self, user_id: int) -> list[SavingsGoal]:
        return list(
            await self.session.scalars(
                select(SavingsGoal)
                .where(SavingsGoal.user_id == user_id, SavingsGoal.is_archived.is_(False))
                .order_by(SavingsGoal.created_at, SavingsGoal.id)
            )
        )

    async def get_active(self, user_id: int, goal_uuid: str) -> SavingsGoal | None:
        return await self.session.scalar(
            select(SavingsGoal).where(
                SavingsGoal.uuid == goal_uuid,
                SavingsGoal.user_id == user_id,
                SavingsGoal.is_archived.is_(False),
            )
        )

    def add(self, goal: SavingsGoal) -> None:
        self.session.add(goal)

    async def delete_contribution(self, contribution: GoalContribution) -> None:
        await self.session.delete(contribution)
