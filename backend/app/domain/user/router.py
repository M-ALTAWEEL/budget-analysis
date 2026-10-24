"""HTTP endpoints for authentication (/auth) and the current user's profile (/users)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, Request, Response, status

from app.config import settings
from app.core.google import GoogleVerifier, get_google_verifier
from app.core.limiter import limiter
from app.dependencies import Client, CurrentAuth, CurrentUser, DbSession
from app.domain.user.schema import (
    AuthConfig,
    GoogleSignInRequest,
    LoginRequest,
    RegisterRequest,
    RevokedCount,
    SecurityEventRead,
    SessionRead,
    TokenResponse,
    UserRead,
    UserUpdate,
)
from app.domain.user.service import AuthService, IssuedTokens, SessionService, UserService

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = f"{settings.api_prefix}/auth"

auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])
me_router = APIRouter(prefix="/me", tags=["me"])


def _send_tokens(response: Response, tokens: IssuedTokens) -> TokenResponse:
    """Access token in the JSON body; refresh token in an httpOnly cookie that
    JavaScript cannot read and the browser only sends to /auth endpoints."""
    if tokens.refresh_token is not None:  # None: the browser already has the right cookie
        response.set_cookie(
            key=REFRESH_COOKIE,
            value=tokens.refresh_token,
            max_age=tokens.refresh_max_age,
            path=REFRESH_COOKIE_PATH,
            httponly=True,
            secure=settings.is_production,
            # The frontend proxies /api/v1 to this server, so the browser sees one site
            # and "lax" is enough (and safer than "none").
            samesite="lax",
        )
    return TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)


# ── /auth ────────────────────────────────────────────────────────────────────


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(
    data: RegisterRequest, response: Response, db: DbSession, client: Client
) -> TokenResponse:
    tokens = await AuthService(db, client).register(data)
    return _send_tokens(response, tokens)


@auth_router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by the rate limiter
    data: LoginRequest,
    response: Response,
    db: DbSession,
    client: Client,
) -> TokenResponse:
    tokens = await AuthService(db, client).login(data)
    return _send_tokens(response, tokens)


@auth_router.get("/config")
async def auth_config() -> AuthConfig:
    """Which sign-in options are on. One place for the client ID: the backend's .env."""
    return AuthConfig(google_client_id=settings.google_client_id or None)


@auth_router.post("/google")
@limiter.limit("10/minute")
async def google_sign_in(
    request: Request,  # required by the rate limiter
    data: GoogleSignInRequest,
    response: Response,
    db: DbSession,
    client: Client,
    google: Annotated[GoogleVerifier, Depends(get_google_verifier)],
) -> TokenResponse:
    identity = await google.verify(data.credential)
    tokens = await AuthService(db, client).google(identity, data)
    return _send_tokens(response, tokens)


@auth_router.post("/refresh")
async def refresh(
    response: Response,
    db: DbSession,
    client: Client,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    tokens = await AuthService(db, client).refresh(refresh_token)
    return _send_tokens(response, tokens)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: DbSession,
    client: Client,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    await AuthService(db, client).logout(refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


# ── /users ───────────────────────────────────────────────────────────────────


@users_router.get("/me")
async def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@users_router.patch("/me")
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    updated = await UserService(db).update_profile(user, data)
    return UserRead.model_validate(updated)


# ── /me: Settings → Security ─────────────────────────────────────────────────


@me_router.get("/sessions")
async def list_sessions(auth: CurrentAuth, db: DbSession, client: Client) -> list[SessionRead]:
    sessions = await SessionService(db, client).list_sessions(auth.user)
    return [
        SessionRead(
            uuid=s.uuid,
            device=s.device,
            country=s.country,
            created_at=s.created_at,
            last_used_at=s.last_used_at,
            current=s.uuid == auth.session.uuid,
        )
        for s in sessions
    ]


@me_router.delete("/sessions/{session_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_session(
    session_uuid: str, auth: CurrentAuth, db: DbSession, client: Client
) -> None:
    await SessionService(db, client).revoke(auth.user, session_uuid)


@me_router.post("/sessions/revoke-others")
async def revoke_other_sessions(auth: CurrentAuth, db: DbSession, client: Client) -> RevokedCount:
    count = await SessionService(db, client).revoke_others(auth.user, auth.session.uuid)
    return RevokedCount(revoked=count)


@me_router.get("/security-events")
async def list_security_events(
    auth: CurrentAuth, db: DbSession, client: Client
) -> list[SecurityEventRead]:
    events = await SessionService(db, client).list_events(auth.user)
    return [SecurityEventRead.model_validate(e) for e in events]
