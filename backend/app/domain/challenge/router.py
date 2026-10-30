"""HTTP endpoints for savings challenges (/challenges)."""

from fastapi import APIRouter, status

from app.dependencies import CurrentUser, DbSession
from app.domain.challenge.schema import ChallengeCreate, ChallengeList, ChallengeRead
from app.domain.challenge.service import ChallengeService

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.get("")
async def list_challenges(user: CurrentUser, db: DbSession) -> ChallengeList:
    return await ChallengeService(db).list(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_challenge(
    data: ChallengeCreate, user: CurrentUser, db: DbSession
) -> ChallengeRead:
    return await ChallengeService(db).create(user, data)


@router.post("/{challenge_uuid}/join", status_code=status.HTTP_201_CREATED)
async def join_challenge(challenge_uuid: str, user: CurrentUser, db: DbSession) -> ChallengeRead:
    """Take part in a challenge someone started in one of my groups."""
    return await ChallengeService(db).join(user, challenge_uuid)


@router.delete("/{challenge_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_challenge(challenge_uuid: str, user: CurrentUser, db: DbSession) -> None:
    await ChallengeService(db).delete(user, challenge_uuid)
