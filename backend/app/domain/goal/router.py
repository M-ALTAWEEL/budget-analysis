"""HTTP endpoints for savings goals (/goals)."""

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.domain.goal.schema import ContributionCreate, GoalCreate, GoalDetail, GoalRead, GoalUpdate
from app.domain.goal.service import GoalService

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("")
async def list_goals(user: CurrentUser, db: DbSession) -> list[GoalRead]:
    """Active goals with saved amount, progress and the monthly amount still needed."""
    return await GoalService(db).list_active(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_goal(data: GoalCreate, user: CurrentUser, db: DbSession) -> GoalDetail:
    return await GoalService(db).create(user, data)


@router.get("/{goal_uuid}")
async def get_goal(goal_uuid: str, user: CurrentUser, db: DbSession) -> GoalDetail:
    """One goal with its full history of deposits and withdrawals."""
    return await GoalService(db).detail(user, goal_uuid)


@router.patch("/{goal_uuid}")
async def update_goal(
    goal_uuid: str, data: GoalUpdate, user: CurrentUser, db: DbSession
) -> GoalDetail:
    return await GoalService(db).update(user, goal_uuid, data)


@router.delete("/{goal_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def archive_goal(goal_uuid: str, user: CurrentUser, db: DbSession) -> None:
    await GoalService(db).archive(user, goal_uuid)


@router.post("/{goal_uuid}/contributions", status_code=status.HTTP_201_CREATED)
async def add_contribution(
    goal_uuid: str, data: ContributionCreate, user: CurrentUser, db: DbSession
) -> GoalDetail:
    """Put money in (deposit) or take it out (withdrawal)."""
    return await GoalService(db).contribute(user, goal_uuid, data)


@router.delete("/{goal_uuid}/contributions/{contribution_uuid}")
async def remove_contribution(
    goal_uuid: str, contribution_uuid: str, user: CurrentUser, db: DbSession
) -> GoalDetail:
    return await GoalService(db).remove_contribution(user, goal_uuid, contribution_uuid)
