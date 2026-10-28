"""The admin dashboard: who is an admin (the command line only), what admins see (account
information and counts, never anyone's money), and what they can do (docs/design/admin.md).
"""

from dataclasses import dataclass
from datetime import UTC, date, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import exists, func, literal_column, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core import secret_box
from app.core.email import EmailMessage
from app.core.money import DEFAULT_CURRENCY
from app.domain.admin.model import AdminAuditLog, PlatformAdmin
from app.domain.admin.repository import AdminRepository, AuditRepository
from app.domain.admin.schema import (
    AdminCurrency,
    AdminSecurityEvent,
    AdminSession,
    AuditEntry,
    AuditPage,
    CurrencyAdd,
    DayCount,
    Stats,
    SystemStatus,
    UserDetail,
    UserListItem,
    UserPage,
)
from app.domain.currency.catalog import CurrencyCatalog, forget_currencies
from app.domain.currency.client import ExchangeRateClient, FxUnavailableError
from app.domain.currency.model import ExchangeRate, SupportedCurrency
from app.domain.expense.model import Expense
from app.domain.group.model import Group
from app.domain.notify.model import PushDevice
from app.domain.user.model import SecurityEvent, User, UserIdentity, UserSession
from app.domain.user.repository import (
    SecurityEventRepository,
    SessionRepository,
    UserRepository,
)
from app.domain.user.service import AccountEmailService, ClientInfo

PAGE_SIZE = 25
AUDIT_PAGE_SIZE = 50
CHART_DAYS = 30
USER_NOT_FOUND = "User not found."
# Shown in the person's own "Security activity", so they know support did something.
ADMIN_EVENT = "admin_action"


class GrantError(Exception):
    """The command line refused (unknown email, disabled account, ...)."""


# ── who is an admin: the command line only (app/cli.py) ──────────────────────


class AdminGrants:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        self.users = UserRepository(session)
        self.admins = AdminRepository(session)
        self.audit = AuditRepository(session)

    async def grant(self, email: str, by: str) -> User:
        user = await self._user(email, by)
        if not user.is_active:
            raise GrantError(f"{email} is disabled; enable it first.")
        now = datetime.now(UTC)
        row = await self.admins.get(user.id)
        if row is not None and row.revoked_at is None:
            raise GrantError(f"{email} is already an admin.")
        if row is None:
            self.session.add(PlatformAdmin(user_id=user.id, granted_at=now, granted_by=by))
        else:  # granted again after a revoke: same row, the history is in the audit log
            row.granted_at, row.granted_by, row.revoked_at, row.revoked_by = now, by, None, None
        self._log(by, "grant_admin", user)
        await self.session.commit()
        return user

    async def revoke(self, email: str, by: str) -> User:
        user = await self._user(email, by)
        row = await self.admins.get(user.id)
        if row is None or row.revoked_at is not None:
            raise GrantError(f"{email} is not an admin.")
        row.revoked_at, row.revoked_by = datetime.now(UTC), by
        self._log(by, "revoke_admin", user)
        await self.session.commit()
        return user

    async def list(self) -> list[tuple[User, PlatformAdmin]]:
        result = await self.session.execute(
            select(User, PlatformAdmin)
            .join(PlatformAdmin, PlatformAdmin.user_id == User.id)
            .where(PlatformAdmin.revoked_at.is_(None))
            .order_by(PlatformAdmin.granted_at)
        )
        return [(user, admin) for user, admin in result]

    async def _user(self, email: str, by: str) -> User:
        if not 1 <= len(by.strip()) <= 50:
            raise GrantError("--by must be 1 to 50 characters.")
        user = await self.users.get_by_email(email.strip().lower())
        if user is None:
            raise GrantError(f"No account with the email {email}.")
        return user

    def _log(self, by: str, action: str, user: User) -> None:
        self.audit.add(
            AdminAuditLog(
                actor_label=f"cli:{by}",
                action=action,
                target_user_id=user.id,
                target_label=user.email,
            )
        )


# ── the dashboard ────────────────────────────────────────────────────────────


@dataclass(frozen=True)
class Actor:
    """The admin making the request."""

    user: User
    client: ClientInfo


def _day(column):
    # 'UTC' written into the SQL, not sent as a parameter: GROUP BY must see the very
    # same expression as SELECT, and two parameters ($1, $2) are not the same to Postgres.
    return func.date(func.timezone(literal_column("'UTC'"), column))


def _days(rows, today: date) -> list[DayCount]:
    """One entry per day of the chart, 0 for days with nothing."""
    counts = {day: count for day, count in rows}
    first = today - timedelta(days=CHART_DAYS - 1)
    return [
        DayCount(day=first + timedelta(days=n), count=counts.get(first + timedelta(days=n), 0))
        for n in range(CHART_DAYS)
    ]


def _prefix(value: str) -> str:
    """A LIKE pattern that matches the start, with the person's % and _ taken literally."""
    escaped = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"{escaped}%"


class AdminService:
    def __init__(self, session: AsyncSession, actor: Actor) -> None:
        self.session = session
        self.actor = actor
        self.users = UserRepository(session)
        self.admins = AdminRepository(session)
        self.audit = AuditRepository(session)
        self.sessions = SessionRepository(session)
        self.events = SecurityEventRepository(session)

    # ── reading ──────────────────────────────────────────────────────────────

    async def stats(self) -> Stats:
        now = datetime.now(UTC)
        today = now.date()
        since = datetime.combine(today - timedelta(days=CHART_DAYS - 1), datetime.min.time(), UTC)

        def count(model, *where):
            return self.session.scalar(select(func.count()).select_from(model).where(*where))

        def active_since(days: int):
            return self.session.scalar(
                select(func.count(func.distinct(UserSession.user_id))).where(
                    UserSession.last_used_at >= now - timedelta(days=days)
                )
            )

        def users_with(provider: str):
            return self.session.scalar(
                select(func.count(func.distinct(UserIdentity.user_id))).where(
                    UserIdentity.provider == provider
                )
            )

        signups = await self.session.execute(
            select(_day(User.created_at), func.count())
            .where(User.created_at >= since)
            .group_by(_day(User.created_at))
        )
        expenses = await self.session.execute(
            select(_day(Expense.created_at), func.count())
            .where(Expense.created_at >= since)
            .group_by(_day(Expense.created_at))
        )
        return Stats(
            users_total=await count(User),
            users_disabled=await count(User, User.is_active.is_(False)),
            active_7_days=await active_since(7),
            active_30_days=await active_since(30),
            signups_per_day=_days(signups.all(), today),
            with_password=await count(User, User.password_hash.is_not(None)),
            with_google=await users_with("google"),
            with_phone=await users_with("phone"),
            two_factor_on=await count(User, User.totp_enabled_at.is_not(None)),
            email_verified=await count(User, User.email_verified_at.is_not(None)),
            expenses_per_day=_days(expenses.all(), today),
            groups_total=await count(Group),
            groups_active=await count(Group, Group.archived_at.is_(None)),
            push_devices=await count(PushDevice),
        )

    async def search_users(self, query: str, page: int) -> UserPage:
        last_active = (
            select(func.max(UserSession.last_used_at))
            .where(UserSession.user_id == User.id)
            .correlate(User)
            .scalar_subquery()
        )
        is_admin = exists().where(
            PlatformAdmin.user_id == User.id, PlatformAdmin.revoked_at.is_(None)
        )
        where = []
        query = query.strip()
        if query:
            pattern = _prefix(query.lower())
            phone = exists().where(
                UserIdentity.user_id == User.id,
                UserIdentity.provider == "phone",
                UserIdentity.subject.like(_prefix(query), escape="\\"),
            )
            where.append(
                User.email.ilike(pattern, escape="\\")
                | User.username.ilike(pattern, escape="\\")
                | User.full_name.ilike(pattern, escape="\\")
                | phone
            )
        total = await self.session.scalar(select(func.count()).select_from(User).where(*where))
        rows = await self.session.execute(
            select(User, last_active, is_admin)
            .where(*where)
            .order_by(User.created_at.desc(), User.id.desc())
            .offset((page - 1) * PAGE_SIZE)
            .limit(PAGE_SIZE)
        )
        items = [
            UserListItem(
                uuid=user.uuid,
                email=user.email,
                full_name=user.full_name,
                username=user.username,
                created_at=user.created_at,
                last_active_at=active_at,
                is_active=user.is_active,
                is_admin=admin,
                two_factor_enabled=user.two_factor_enabled,
                email_verified=user.email_verified,
            )
            for user, active_at, admin in rows
        ]
        return UserPage(items=items, total=total or 0, page=page, page_size=PAGE_SIZE)

    async def user_detail(self, user_uuid: str) -> UserDetail:
        user = await self._target(user_uuid)
        providers = set(
            await self.session.scalars(
                select(UserIdentity.provider).where(UserIdentity.user_id == user.id)
            )
        )
        phone = await self.session.scalar(
            select(UserIdentity.subject).where(
                UserIdentity.user_id == user.id, UserIdentity.provider == "phone"
            )
        )
        methods = (["password"] if user.has_password else []) + sorted(providers)
        live = await self.sessions.list_live(user.id, datetime.now(UTC))
        events = await self.events.list_recent(user.id)
        return UserDetail(
            uuid=user.uuid,
            email=user.email,
            phone=phone,
            full_name=user.full_name,
            username=user.username,
            created_at=user.created_at,
            email_verified=user.email_verified,
            has_password=user.has_password,
            sign_in_methods=methods,
            two_factor_enabled=user.two_factor_enabled,
            locale=user.locale,
            base_currency=user.base_currency,
            is_active=user.is_active,
            is_admin=await self.admins.is_admin(user.id),
            sessions=[
                AdminSession(
                    device=s.device,
                    country=s.country,
                    created_at=s.created_at,
                    last_used_at=s.last_used_at,
                )
                for s in live
            ],
            security_events=[
                AdminSecurityEvent(
                    type=e.type, device=e.device, country=e.country, created_at=e.created_at
                )
                for e in events
            ],
        )

    async def system(self) -> SystemStatus:
        try:
            await self.session.execute(text("SELECT 1"))
            database = "ok"
        except Exception:
            database = "unavailable"
        rates_at = None
        if database == "ok":
            rates_at = await self.session.scalar(select(func.max(ExchangeRate.fetched_at)))
        return SystemStatus(
            database=database,
            commit=settings.git_commit[:7],
            deploy_env=settings.deploy_env,
            app_env=settings.app_env,
            email_backend=settings.email_backend,
            sms_backend=settings.sms_backend,
            push_backend=settings.push_backend,
            google_sign_in=bool(settings.google_client_id),
            redis=bool(settings.redis_url),
            sentry=bool(settings.sentry_dsn),
            two_factor_key=secret_box.available(),
            rates_fetched_at=rates_at,
        )

    async def audit_log(self, page: int) -> AuditPage:
        entries, total = await self.audit.page((page - 1) * AUDIT_PAGE_SIZE, AUDIT_PAGE_SIZE)
        targets = {e.target_user_id for e in entries if e.target_user_id is not None}
        uuids = {}
        if targets:
            rows = await self.session.execute(
                select(User.id, User.uuid).where(User.id.in_(targets))
            )
            uuids = dict(rows.all())
        items = [
            AuditEntry(
                actor=e.actor_label,
                action=e.action,
                target=e.target_label,
                target_uuid=uuids.get(e.target_user_id),
                detail=e.detail,
                country=e.country,
                created_at=e.created_at,
            )
            for e in entries
        ]
        return AuditPage(items=items, total=total, page=page, page_size=AUDIT_PAGE_SIZE)

    # ── actions (each one audited, and shown to the person) ─────────────────

    async def disable(self, user_uuid: str) -> None:
        user = await self._acting_on(user_uuid)
        now = datetime.now(UTC)
        user.is_active = False
        count = await self.sessions.revoke_all(user.id, "admin_disabled", now)
        await self._done("disable_user", user, f"{count} sessions ended")

    async def enable(self, user_uuid: str) -> None:
        user = await self._acting_on(user_uuid)
        user.is_active = True
        await self._done("enable_user", user)

    async def sign_out_everywhere(self, user_uuid: str) -> int:
        user = await self._acting_on(user_uuid)
        count = await self.sessions.revoke_all(user.id, "admin_signed_out", datetime.now(UTC))
        await self._done("sign_out_user", user, f"{count} sessions ended")
        return count

    async def resend_verification(self, user_uuid: str) -> EmailMessage:
        user = await self._acting_on(user_uuid)
        if user.email is None or user.email_verified:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "This email is already confirmed.")
        message = await AccountEmailService(self.session, self.actor.client).start_verification(
            user
        )
        if message is None:  # the per-account hourly limit of verification emails
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "Too many emails to this account; try later."
            )
        await self._done("resend_verification", user)
        return message

    # ── currencies (add and hide, never delete: budgets keep theirs for good) ──

    async def currencies(self) -> list[AdminCurrency]:
        rows = await self.session.execute(
            select(User.base_currency, func.count()).group_by(User.base_currency)
        )
        users = {code: count for code, count in rows}
        return [
            AdminCurrency(
                code=c.code,
                name_en=c.name_en,
                name_ar=c.name_ar,
                name_tr=c.name_tr,
                hidden=c.hidden,
                added_by=c.added_by,
                created_at=c.created_at,
                users=users.get(c.code, 0),
            )
            for c in await CurrencyCatalog(self.session).list()
        ]

    async def add_currency(self, data: CurrencyAdd, fx: ExchangeRateClient) -> None:
        if await CurrencyCatalog(self.session).get(data.code) is not None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{data.code} is already in the list.")
        # Only what the rate provider knows: a currency that can't be converted would break
        # every expense and group that uses it.
        try:
            known = await fx.fetch_all("USD")
        except FxUnavailableError:
            raise HTTPException(
                status.HTTP_503_SERVICE_UNAVAILABLE,
                "The exchange-rate service can't be reached. Try again later.",
            ) from None
        if data.code not in known:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"The exchange-rate service doesn't know {data.code}, so it can't be converted.",
            )
        self.session.add(
            SupportedCurrency(
                code=data.code,
                name_en=data.name_en,
                name_ar=data.name_ar,
                name_tr=data.name_tr,
                added_by=self._actor_label(),
            )
        )
        await self._changed_currency("currency_added", data.code, data.name_en)

    async def set_currency_hidden(self, code: str, hidden: bool) -> None:
        currency = await CurrencyCatalog(self.session).get(code.upper())
        if currency is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Currency not found.")
        if currency.hidden == hidden:
            state = "hidden" if hidden else "visible"
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"{currency.code} is already {state}.")
        if hidden:
            if currency.code == DEFAULT_CURRENCY:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"{DEFAULT_CURRENCY} is the sign-up default and can't be hidden.",
                )
            visible = await self.session.scalar(
                select(func.count())
                .select_from(SupportedCurrency)
                .where(SupportedCurrency.hidden.is_(False))
            )
            if visible <= 1:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, "At least one currency must stay visible."
                )
        currency.hidden = hidden
        await self._changed_currency(
            "currency_hidden" if hidden else "currency_shown", currency.code
        )

    async def _changed_currency(self, action: str, code: str, detail: str | None = None) -> None:
        self._log(action, target_label=code, detail=detail)
        await self.session.commit()
        forget_currencies()  # this process sees it now; the others within a minute

    # ── helpers ──────────────────────────────────────────────────────────────

    def _actor_label(self) -> str:
        return self.actor.user.email or self.actor.user.uuid

    def _log(
        self,
        action: str,
        target: User | None = None,
        target_label: str | None = None,
        detail: str | None = None,
    ) -> None:
        self.audit.add(
            AdminAuditLog(
                actor_user_id=self.actor.user.id,
                actor_label=self._actor_label(),
                action=action,
                target_user_id=target.id if target else None,
                target_label=target_label,
                detail=detail,
                country=self.actor.client.country,
            )
        )

    async def _target(self, user_uuid: str) -> User:
        user = await self.users.get_by_uuid(user_uuid)
        if user is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, USER_NOT_FOUND)
        return user

    async def _acting_on(self, user_uuid: str) -> User:
        """Never on yourself or another admin: one stolen admin account can't lock the
        others out, and an admin can't hide their own tracks."""
        user = await self._target(user_uuid)
        if user.id == self.actor.user.id:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not on your own account.")
        if await self.admins.is_admin(user.id):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Not on another admin.")
        return user

    async def _done(self, action: str, user: User, detail: str | None = None) -> None:
        self._log(action, target=user, target_label=user.email or user.uuid, detail=detail)
        # The admin's device isn't the person's business; the event says "support" did it.
        self.events.add(SecurityEvent(user_id=user.id, type=ADMIN_EVENT))
        await self.session.commit()
