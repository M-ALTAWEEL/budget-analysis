"""Shared FastAPI dependencies. The single authentication boundary of the API."""

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import client_country
from app.core.device import describe_device
from app.core.security import decode_access_token
from app.database import get_db
from app.domain.user.model import User, UserSession
from app.domain.user.repository import UserRepository
from app.domain.user.service import ClientInfo

DbSession = Annotated[AsyncSession, Depends(get_db)]

# auto_error=False: we raise our own 401 with a consistent message.
bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Auth:
    user: User
    session: UserSession  # the session this request belongs to ("this device")


async def get_current_auth(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: DbSession,
) -> Auth:
    unauthorized = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Not authenticated.",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if credentials is None:
        raise unauthorized

    claims = decode_access_token(credentials.credentials)
    if claims is None:
        raise unauthorized

    # The live user AND the live session, in one query: a disabled account or a session
    # signed out from another device loses access on the very next request.
    found = await UserRepository(db).get_with_live_session(
        claims.user_uuid, claims.session_uuid, datetime.now(UTC)
    )
    if found is None or not found[0].is_active:
        raise unauthorized
    return Auth(user=found[0], session=found[1])


async def get_current_user(auth: Annotated[Auth, Depends(get_current_auth)]) -> User:
    return auth.user


def get_client_info(request: Request) -> ClientInfo:
    return ClientInfo(
        device=describe_device(request.headers.get("user-agent"), request.headers.get("x-client")),
        country=client_country(request),
    )


CurrentAuth = Annotated[Auth, Depends(get_current_auth)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Client = Annotated[ClientInfo, Depends(get_client_info)]
