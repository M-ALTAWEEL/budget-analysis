"""Shared FastAPI dependencies. The single authentication boundary of the API."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.database import get_db
from app.domain.user.model import User
from app.domain.user.repository import UserRepository

DbSession = Annotated[AsyncSession, Depends(get_db)]

# auto_error=False: we raise our own 401 with a consistent message.
bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> User:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    user_uuid = decode_access_token(credentials.credentials)
    if user_uuid is None:
        raise unauthorized

    # Load the live user: a deleted or disabled account loses access immediately.
    user = await UserRepository(db).get_by_uuid(user_uuid)
    if user is None or not user.is_active:
        raise unauthorized
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
