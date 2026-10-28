"""Shared FastAPI dependencies. The single authentication boundary of the API."""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from limits import parse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.client_ip import client_country
from app.core.device import describe_device
from app.core.limiter import limiter
from app.core.security import decode_access_token
from app.database import get_db
from app.domain.admin.repository import AdminRepository
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


RECENT_AUTH = timedelta(minutes=10)
REAUTH_REQUIRED = "reauth_required"  # the website reads this word and asks "is it you?"


async def get_recent_auth(auth: Annotated[Auth, Depends(get_current_auth)]) -> Auth:
    """For sensitive actions (docs/design/accounts.md, section 9): the person signed in, or
    proved it's them again, on this device within the last 10 minutes. A session copied
    from someone's browser, or a laptop left open, is not enough to delete the account."""
    proved_at = max(
        auth.session.created_at, auth.session.reauthenticated_at or datetime.min.replace(tzinfo=UTC)
    )
    if datetime.now(UTC) - proved_at > RECENT_AUTH:
        raise HTTPException(status.HTTP_403_FORBIDDEN, REAUTH_REQUIRED)
    return auth


# ── the admin dashboard (docs/design/admin.md) ───────────────────────────────

logger = logging.getLogger("app.admin")
# Not an admin: the same answer as a page that doesn't exist, so a signed-in visitor can't
# even tell the admin API is there.
NOT_FOUND = "Not Found"
ADMIN_2FA_REQUIRED = "admin_2fa_required"  # the website says "turn on 2FA first"
# Repeated tries by one account are worth a look: reported to Sentry (an error log).
DENIED_ALERT = parse("5/hour")


async def get_admin(auth: Annotated[Auth, Depends(get_current_auth)], db: DbSession) -> Auth:
    """Admins only, and only with two-factor authentication on. Not signed in: 401 like
    any other endpoint (the browser renews its token on a 401)."""
    if not await AdminRepository(db).is_admin(auth.user.id):
        fields = {"user": auth.user.uuid}
        logger.warning("admin access denied", extra={"fields": fields})
        try:
            if not limiter.limiter.hit(DENIED_ALERT, "admin-denied", auth.user.uuid):
                logger.error("repeated admin access denied", extra={"fields": fields})
        except Exception:  # the counter store is down: the warning above is enough
            pass
        raise HTTPException(status.HTTP_404_NOT_FOUND, NOT_FOUND)
    if not auth.user.two_factor_enabled:
        raise HTTPException(status.HTTP_403_FORBIDDEN, ADMIN_2FA_REQUIRED)
    return auth


async def get_admin_recent(auth: Annotated[Auth, Depends(get_admin)]) -> Auth:
    """Admin actions (disable, sign out, ...): also proved it's them in the last 10 minutes."""
    return await get_recent_auth(auth)


def get_client_info(request: Request) -> ClientInfo:
    app = request.headers.get("x-client")
    return ClientInfo(
        device=describe_device(request.headers.get("user-agent"), app),
        country=client_country(request),
        # The apps say which they are, and send no Origin. A browser always sends Origin
        # with a POST and a page's script can't remove it, so a script injected into the
        # website can't pretend to be the app to get a refresh token it could read.
        native=app in ("ios", "android") and "origin" not in request.headers,
    )


CurrentAuth = Annotated[Auth, Depends(get_current_auth)]
RecentAuth = Annotated[Auth, Depends(get_recent_auth)]
CurrentUser = Annotated[User, Depends(get_current_user)]
Client = Annotated[ClientInfo, Depends(get_client_info)]
Admin = Annotated[Auth, Depends(get_admin)]
AdminRecent = Annotated[Auth, Depends(get_admin_recent)]
