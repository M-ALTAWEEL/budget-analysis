"""HTTP endpoints for authentication (/auth) and the current user's profile (/users)."""

from typing import Annotated

from fastapi import APIRouter, Cookie, Request, Response, status

from app.config import settings
from app.core.limiter import limiter
from app.dependencies import CurrentUser, DbSession
from app.domain.user.schema import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserRead,
    UserUpdate,
)
from app.domain.user.service import AuthService, IssuedTokens, UserService

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = f"{settings.api_prefix}/auth"

auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])


def _send_tokens(response: Response, tokens: IssuedTokens) -> TokenResponse:
    """Access token in the JSON body; refresh token in an httpOnly cookie that
    JavaScript cannot read and the browser only sends to /auth endpoints."""
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=tokens.refresh_token,
        max_age=settings.refresh_token_days * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=settings.is_production,
        # Frontend and API live on different domains in production, which needs "none".
        samesite="none" if settings.is_production else "lax",
    )
    return TokenResponse(access_token=tokens.access_token, expires_in=tokens.expires_in)


# ── /auth ────────────────────────────────────────────────────────────────────


@auth_router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(data: RegisterRequest, response: Response, db: DbSession) -> TokenResponse:
    tokens = await AuthService(db).register(data)
    return _send_tokens(response, tokens)


@auth_router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by the rate limiter
    data: LoginRequest,
    response: Response,
    db: DbSession,
) -> TokenResponse:
    tokens = await AuthService(db).login(data)
    return _send_tokens(response, tokens)


@auth_router.post("/refresh")
async def refresh(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> TokenResponse:
    tokens = await AuthService(db).refresh(refresh_token)
    return _send_tokens(response, tokens)


@auth_router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: DbSession,
    refresh_token: Annotated[str | None, Cookie()] = None,
) -> None:
    await AuthService(db).logout(refresh_token)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


# ── /users ───────────────────────────────────────────────────────────────────


@users_router.get("/me")
async def read_me(user: CurrentUser) -> UserRead:
    return UserRead.model_validate(user)


@users_router.patch("/me")
async def update_me(data: UserUpdate, user: CurrentUser, db: DbSession) -> UserRead:
    updated = await UserService(db).update_profile(user, data)
    return UserRead.model_validate(updated)
