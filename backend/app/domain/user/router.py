"""HTTP endpoints for authentication (/auth) and the current user's profile (/users)."""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Cookie,
    Depends,
    HTTPException,
    Request,
    Response,
    status,
)

from app.config import settings
from app.core import secret_box
from app.core.breached import BreachChecker, get_breach_checker
from app.core.email import EmailSender, get_email_sender, send_safely
from app.core.google import GoogleVerifier, get_google_verifier
from app.core.limiter import limiter
from app.dependencies import Client, CurrentAuth, CurrentUser, DbSession, RecentAuth
from app.domain.user.account import AccountService
from app.domain.user.schema import (
    AuthConfig,
    BackupCodes,
    ChangeEmailRequest,
    ChangePasswordRequest,
    CodeRequest,
    ForgotPasswordRequest,
    GoogleSignInRequest,
    LoginRequest,
    Message,
    ReauthRequest,
    RegisterRequest,
    ResetPasswordRequest,
    RevokedCount,
    SecurityEventRead,
    SessionRead,
    TokenRequest,
    TokenResponse,
    TwoFactorChallenge,
    TwoFactorSetup,
    TwoFactorStatus,
    TwoFactorVerifyRequest,
    UserRead,
    UserUpdate,
)
from app.domain.user.service import (
    AccountEmailService,
    AuthService,
    IssuedTokens,
    SecondStepNeeded,
    SessionService,
    UserService,
)
from app.domain.user.two_factor import TwoFactorService

REFRESH_COOKIE = "refresh_token"
REFRESH_COOKIE_PATH = f"{settings.api_prefix}/auth"

auth_router = APIRouter(prefix="/auth", tags=["auth"])
users_router = APIRouter(prefix="/users", tags=["users"])

Email = Annotated[EmailSender | None, Depends(get_email_sender)]
Breach = Annotated[BreachChecker, Depends(get_breach_checker)]
BREACHED = (
    "This password has appeared in a data breach, so attackers try it first. "
    "Please choose another one."
)


async def _ensure_not_breached(breach: BreachChecker, password: str) -> None:
    # 422 like the other password rules, so the website shows it next to the form.
    if await breach.times_seen(password) > 0:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, BREACHED)


async def _signed_in(
    result: IssuedTokens | SecondStepNeeded, response: Response, db, client
) -> TokenResponse | TwoFactorChallenge:
    if isinstance(result, SecondStepNeeded):
        challenge = await TwoFactorService(db, client).start_challenge(result.user)
        return TwoFactorChallenge(challenge=challenge)
    return _send_tokens(response, result)


EMAIL_ON_ITS_WAY = "If an account exists for this email, we sent a link to it."
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
    data: RegisterRequest,
    response: Response,
    db: DbSession,
    client: Client,
    email: Email,
    breach: Breach,
    background: BackgroundTasks,
) -> TokenResponse:
    await _ensure_not_breached(breach, data.password)
    auth = AuthService(db, client)
    tokens = await auth.register(data)
    if email is not None:
        user = await auth.users.get_by_email(data.email)
        message = await AccountEmailService(db, client).start_verification(user)
        if message is not None:
            background.add_task(send_safely, email, message)
    return _send_tokens(response, tokens)


@auth_router.post("/login")
@limiter.limit("5/minute")
async def login(
    request: Request,  # required by the rate limiter
    data: LoginRequest,
    response: Response,
    db: DbSession,
    client: Client,
) -> TokenResponse | TwoFactorChallenge:
    result = await AuthService(db, client).login(data)
    return await _signed_in(result, response, db, client)


@auth_router.get("/config")
async def auth_config(email: Email) -> AuthConfig:
    """Which sign-in options are on. One place for the client ID: the backend's .env."""
    return AuthConfig(
        google_client_id=settings.google_client_id or None,
        email_enabled=email is not None,
        two_factor_available=secret_box.available(),
    )


@auth_router.post("/google")
@limiter.limit("10/minute")
async def google_sign_in(
    request: Request,  # required by the rate limiter
    data: GoogleSignInRequest,
    response: Response,
    db: DbSession,
    client: Client,
    google: Annotated[GoogleVerifier, Depends(get_google_verifier)],
) -> TokenResponse | TwoFactorChallenge:
    identity = await google.verify(data.credential)
    result = await AuthService(db, client).google(identity, data)
    return await _signed_in(result, response, db, client)


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


# ── email links and passwords (phase 2b) ────────────────────────────────────


def _require(email: EmailSender | None) -> EmailSender:
    if email is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Email is not available yet.")
    return email


@auth_router.post("/verify-email/send", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/hour")
async def send_verification_email(
    request: Request,  # required by the rate limiter
    auth: CurrentAuth,
    db: DbSession,
    client: Client,
    email: Email,
    background: BackgroundTasks,
) -> Message:
    sender = _require(email)
    message = await AccountEmailService(db, client).start_verification(auth.user)
    if message is not None:
        background.add_task(send_safely, sender, message)
    return Message(detail="If your email still needs confirming, we sent a link to it.")


@auth_router.post("/verify-email", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/hour")
async def verify_email(request: Request, data: TokenRequest, db: DbSession, client: Client) -> None:
    await AccountEmailService(db, client).verify_email(data.token)


@auth_router.post("/password/forgot", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    data: ForgotPasswordRequest,
    db: DbSession,
    client: Client,
    email: Email,
    background: BackgroundTasks,
) -> Message:
    sender = _require(email)
    message = await AccountEmailService(db, client).forgot_password(data.email)
    if message is not None:
        background.add_task(send_safely, sender, message)
    # The same words whether or not the account exists (no account enumeration).
    return Message(detail=EMAIL_ON_ITS_WAY)


@auth_router.post("/password/reset", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/hour")
async def reset_password(
    request: Request, data: ResetPasswordRequest, db: DbSession, client: Client, breach: Breach
) -> None:
    await _ensure_not_breached(breach, data.password)
    await AccountEmailService(db, client).reset_password(data.token, data.password)


@auth_router.post("/password/change", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/hour")
async def change_password(
    request: Request,
    data: ChangePasswordRequest,
    auth: CurrentAuth,
    db: DbSession,
    client: Client,
    breach: Breach,
) -> None:
    await _ensure_not_breached(breach, data.new_password)
    await AccountEmailService(db, client).change_password(
        auth.user, auth.session.uuid, data.current_password, data.new_password
    )


# ── sensitive actions (phase 2c) ─────────────────────────────────────────────


@auth_router.post("/reauth", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("10/minute")
async def reauthenticate(
    request: Request,
    data: ReauthRequest,
    auth: CurrentAuth,
    db: DbSession,
    client: Client,
    google: Annotated[GoogleVerifier, Depends(get_google_verifier)],
) -> None:
    """Prove it's you again on this device. Sensitive actions then work for 10 minutes."""
    service = AccountService(db, client)
    if data.password is not None:
        await service.reauth_with_password(auth.user, auth.session, data.password)
    else:
        identity = await google.verify(data.credential)
        await service.reauth_with_google(auth.user, auth.session, identity)


@auth_router.post("/email/change", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/hour")
async def change_email(
    request: Request,
    data: ChangeEmailRequest,
    auth: RecentAuth,
    db: DbSession,
    client: Client,
    email: Email,
    background: BackgroundTasks,
) -> Message:
    sender = _require(email)
    for message in await AccountService(db, client).start_email_change(auth.user, data.new_email):
        background.add_task(send_safely, sender, message)
    return Message(detail="If that address can be used, we sent a link to it.")


@auth_router.post("/email/confirm", status_code=status.HTTP_204_NO_CONTENT)
@limiter.limit("20/hour")
async def confirm_email_change(
    request: Request, data: TokenRequest, db: DbSession, client: Client
) -> None:
    await AccountService(db, client).confirm_email_change(data.token)


@me_router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    response: Response,
    auth: RecentAuth,
    db: DbSession,
    client: Client,
    email: Email,
    background: BackgroundTasks,
) -> None:
    """Deletes the account and everything in it, now (App Store 5.1.1(v), Google Play)."""
    goodbye = await AccountService(db, client).delete_account(auth.user)
    if email is not None:
        background.add_task(send_safely, email, goodbye)
    response.delete_cookie(REFRESH_COOKIE, path=REFRESH_COOKIE_PATH)


@me_router.get("/export")
@limiter.limit("10/hour")
async def export_data(
    request: Request, auth: RecentAuth, db: DbSession, client: Client
) -> Response:
    """Everything we hold about you, as a ZIP made now and not kept anywhere."""
    archive = await AccountService(db, client).export(auth.user)
    filename = f"budget-analysis-{datetime.now(UTC).date().isoformat()}.zip"
    return Response(
        content=archive,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── two-factor authentication (phase 2d) ─────────────────────────────────────


@auth_router.post("/2fa/verify")
@limiter.limit("10/minute")
async def verify_two_factor(
    request: Request,
    data: TwoFactorVerifyRequest,
    response: Response,
    db: DbSession,
    client: Client,
) -> TokenResponse:
    """The second step of signing in: the challenge from /login (or /google) and a code."""
    user = await TwoFactorService(db, client).finish_challenge(data.challenge, data.code)
    tokens = AuthService(db, client).start_session(user)
    await db.commit()
    return _send_tokens(response, tokens)


@me_router.get("/2fa")
async def two_factor_status(auth: CurrentAuth, db: DbSession, client: Client) -> TwoFactorStatus:
    left = await TwoFactorService(db, client).backup_codes_left(auth.user)
    return TwoFactorStatus(enabled=auth.user.two_factor_enabled, backup_codes_left=left)


@me_router.post("/2fa/setup")
async def setup_two_factor(auth: RecentAuth, db: DbSession, client: Client) -> TwoFactorSetup:
    return TwoFactorSetup(**await TwoFactorService(db, client).setup(auth.user))


@me_router.post("/2fa/enable")
@limiter.limit("10/minute")
async def enable_two_factor(
    request: Request, data: CodeRequest, auth: CurrentAuth, db: DbSession, client: Client
) -> BackupCodes:
    codes = await TwoFactorService(db, client).enable(auth.user, data.code)
    return BackupCodes(codes=codes)


@me_router.post("/2fa/disable", status_code=status.HTTP_204_NO_CONTENT)
async def disable_two_factor(auth: RecentAuth, db: DbSession, client: Client) -> None:
    await TwoFactorService(db, client).disable(auth.user)


@me_router.post("/2fa/backup-codes")
async def new_backup_codes(auth: RecentAuth, db: DbSession, client: Client) -> BackupCodes:
    return BackupCodes(codes=await TwoFactorService(db, client).new_backup_codes(auth.user))


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
