"""HTTP endpoint for the assistant (/assistant)."""

from fastapi import APIRouter

from app.dependencies import CurrentUser, DbSession
from app.domain.assistant.schema import Answer, Question
from app.domain.assistant.service import Assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/ask")
async def ask(data: Question, user: CurrentUser, db: DbSession) -> Answer:
    """A question about the student's own money, in English, Arabic or Turkish."""
    return await Assistant(db).ask(user, data.question)
