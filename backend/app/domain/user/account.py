"""Phase 2c: proving it's you again, changing the email, deleting the account, exporting
the data. Design: docs/design/accounts.md, sections 9 and 10."""

import csv
import io
import json
import zipfile
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.email import EmailMessage
from app.core.email_templates import build_email
from app.core.google import GoogleIdentity
from app.core.security import generate_refresh_token, hash_token, verify_password
from app.domain.budget.model import Budget, Category
from app.domain.challenge.model import Challenge
from app.domain.debt.model import Debt
from app.domain.expense.model import Expense
from app.domain.goal.model import SavingsGoal
from app.domain.group.service import GroupService
from app.domain.income.model import Income
from app.domain.recurring.model import RecurringExpense
from app.domain.support.model import SupportTicket
from app.domain.user.model import (
    OneTimeToken,
    SecurityEvent,
    User,
    UserIdentity,
    UserSession,
)
from app.domain.user.repository import (
    IdentityRepository,
    OneTimeTokenRepository,
    SecurityEventRepository,
    UserRepository,
)
from app.domain.user.service import ClientInfo

CHANGE_EMAIL_FOR = timedelta(hours=1)
EXPORTS_PER_DAY = 3
INVALID_LINK = "This link is invalid or has expired."


class AccountService:
    def __init__(self, session: AsyncSession, client: ClientInfo) -> None:
        self.session = session
        self.client = client
        self.users = UserRepository(session)
        self.identities = IdentityRepository(session)
        self.tokens = OneTimeTokenRepository(session)
        self.events = SecurityEventRepository(session)

    # ── "is it you?" ─────────────────────────────────────────────────────────

    async def reauth_with_password(self, user: User, user_session: UserSession, password: str):
        # 400, not 401: a wrong password here must not look like an expired session.
        if user.password_hash is None or not verify_password(password, user.password_hash):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That password is wrong.")
        await self._mark_reauthenticated(user, user_session)

    async def reauth_with_google(
        self, user: User, user_session: UserSession, identity: GoogleIdentity
    ):
        linked = await self.identities.get("google", identity.sub)
        if linked is None or linked.user_id != user.id:
            # A real Google account, but not the one linked to this account.
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Use the Google account you sign in with."
            )
        await self._mark_reauthenticated(user, user_session)

    async def _mark_reauthenticated(self, user: User, user_session: UserSession) -> None:
        user_session.reauthenticated_at = datetime.now(UTC)
        self._event(user.id, "reauthenticated")
        await self.session.commit()

    # ── changing the email ───────────────────────────────────────────────────

    async def start_email_change(self, user: User, new_email: str) -> list[EmailMessage]:
        """A link to the new address, and a notice to the old one. The answer to the client
        is the same whether or not the new address is already taken (no enumeration)."""
        if new_email == user.email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "That's already your email.")
        if await self.users.get_by_email(new_email) is not None:
            return []  # taken: say nothing, send nothing
        now = datetime.now(UTC)
        recent = await self.tokens.count_since(user.id, "change_email", now - timedelta(hours=1))
        if recent >= 3:
            return []
        raw = generate_refresh_token()
        self.tokens.add(
            OneTimeToken(
                user_id=user.id,
                purpose="change_email",
                token_hash=hash_token(raw),
                payload=new_email,
                expires_at=now + CHANGE_EMAIL_FOR,
            )
        )
        await self.session.commit()
        link = f"{settings.public_app_url}/confirm-email-change?token={raw}"
        common = {"name": user.full_name, "locale": user.locale}
        messages = [build_email("change_email", to=new_email, link=link, **common)]
        if user.email:  # a phone-only account adding its first email has no old address
            messages.append(build_email("email_changed", to=user.email, **common))
        return messages

    async def confirm_email_change(self, raw_token: str) -> None:
        now = datetime.now(UTC)
        token = await self.tokens.get_by_hash(hash_token(raw_token), "change_email")
        if token is None or token.used_at is not None or token.expires_at <= now:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_LINK)
        user = await self.users.get_by_id(token.user_id)
        new_email = token.payload
        if user is None or not new_email:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, INVALID_LINK)
        if await self.users.get_by_email(new_email) is not None:
            # Someone took the address after the link was sent.
            raise HTTPException(status.HTTP_409_CONFLICT, "This email is used by another account.")
        user.email = new_email
        user.email_verified_at = now  # opening the link proved the new inbox is theirs
        await self.tokens.use_all(user.id, "change_email", now)
        self._event(user.id, "email_changed")
        await self.session.commit()

    # ── deleting the account ─────────────────────────────────────────────────

    async def delete_account(self, user: User) -> EmailMessage | None:
        """Immediate and permanent (App Store 5.1.1(v), Google Play, GDPR art. 17, KVKK).
        One DELETE: the database removes every row that belongs to the account (ON DELETE
        CASCADE on every user_id): sessions, identities, budgets, expenses, goals, logs."""
        goodbye = (
            build_email("account_deleted", to=user.email, name=user.full_name, locale=user.locale)
            if user.email
            else None
        )
        # Groups keep their history and balances: the memberships become "Deleted user".
        await GroupService(self.session).on_account_deleted(user.id)
        await self.session.flush()
        await self.session.execute(delete(User).where(User.id == user.id))
        await self.session.commit()
        return goodbye

    # ── exporting the data ───────────────────────────────────────────────────

    async def export(self, user: User) -> bytes:
        """A ZIP with everything we hold about the user, made now and not kept (GDPR art. 20,
        KVKK). No internal ids, hashes or tokens: only what the person themselves put in or
        would recognise."""
        since = datetime.now(UTC) - timedelta(days=1)
        done_today = await self.session.scalar(
            select(func.count())
            .select_from(SecurityEvent)
            .where(
                SecurityEvent.user_id == user.id,
                SecurityEvent.type == "data_exported",
                SecurityEvent.created_at >= since,
            )
        )
        if done_today >= EXPORTS_PER_DAY:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, "You can export your data 3 times a day."
            )

        data = await self._collect(user)
        expenses_csv = io.StringIO()
        writer = csv.writer(expenses_csv)
        writer.writerow(["date", "description", "category", "amount", "currency", "amount_base"])
        for expense in data["expenses"]:
            writer.writerow(
                [
                    expense["date"],
                    expense["description"],
                    expense["category"],
                    expense["amount"],
                    expense["currency"],
                    expense["amount_in_budget_currency"],
                ]
            )

        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
            archive.writestr("budget-analysis.json", json.dumps(data, ensure_ascii=False, indent=2))
            # utf-8-sig: Excel opens Arabic and Turkish letters correctly.
            archive.writestr("expenses.csv", expenses_csv.getvalue().encode("utf-8-sig"))

        self._event(user.id, "data_exported")
        await self.session.commit()
        return buffer.getvalue()

    async def _collect(self, user: User) -> dict:
        def when(value) -> str | None:
            return value.isoformat() if value else None

        categories = (
            await self.session.scalars(select(Category).where(Category.user_id == user.id))
        ).all()
        budgets = (
            await self.session.scalars(
                select(Budget).where(Budget.user_id == user.id).order_by(Budget.month)
            )
        ).all()
        expenses = (
            await self.session.scalars(
                select(Expense)
                .where(Expense.user_id == user.id)
                .order_by(Expense.spent_at, Expense.id)
            )
        ).all()
        goals = (
            await self.session.scalars(select(SavingsGoal).where(SavingsGoal.user_id == user.id))
        ).all()
        recurring = (
            await self.session.scalars(
                select(RecurringExpense).where(RecurringExpense.user_id == user.id)
            )
        ).all()
        debts = (await self.session.scalars(select(Debt).where(Debt.user_id == user.id))).all()
        challenges = (
            await self.session.scalars(select(Challenge).where(Challenge.user_id == user.id))
        ).all()
        tickets = (
            await self.session.scalars(
                select(SupportTicket).where(SupportTicket.user_id == user.id)
            )
        ).all()
        incomes = (
            await self.session.scalars(
                select(Income).where(Income.user_id == user.id).order_by(Income.received_on)
            )
        ).all()
        identities = (
            await self.session.scalars(select(UserIdentity).where(UserIdentity.user_id == user.id))
        ).all()
        sessions = (
            await self.session.scalars(select(UserSession).where(UserSession.user_id == user.id))
        ).all()
        events = await self.events.list_recent(user.id, limit=1000)

        def category_name(category: Category) -> str:
            return category.slug or category.name

        return {
            "exported_at": datetime.now(UTC).isoformat(),
            "profile": {
                "email": user.email,
                "email_verified": user.email_verified,
                "full_name": user.full_name,
                "username": user.username,
                "base_currency": user.base_currency,
                "secondary_currency": user.secondary_currency,
                "language": user.locale,
                "created_at": when(user.created_at),
                "has_password": user.has_password,
            },
            "sign_in_methods": [
                {"provider": i.provider, "email": i.email, "linked_at": when(i.created_at)}
                for i in identities
            ],
            "categories": [
                {"name": c.name, "icon": c.icon, "color": c.color, "archived": c.is_archived}
                for c in categories
            ],
            "budgets": [
                {
                    "month": b.month.isoformat()[:7],
                    "total": str(b.total_amount),
                    "currency": b.currency,
                    "categories": [
                        {"category": category_name(a.category), "limit": str(a.limit_amount)}
                        for a in b.allocations
                    ],
                }
                for b in budgets
            ],
            "expenses": [
                {
                    "date": e.spent_at.isoformat(),
                    "description": e.description,
                    "category": category_name(e.category),
                    "amount": str(e.amount),
                    "currency": e.currency,
                    "amount_in_budget_currency": str(e.amount_base),
                }
                for e in expenses
            ],
            "savings_goals": [
                {
                    "name": g.name,
                    "target": str(g.target_amount),
                    "currency": g.currency,
                    "target_date": when(g.target_date),
                    "archived": g.is_archived,
                    "contributions": [
                        {"date": c.made_on.isoformat(), "amount": str(c.amount), "note": c.note}
                        for c in g.contributions
                    ],
                }
                for g in goals
            ],
            "recurring_expenses": [
                {
                    "description": r.description,
                    "amount": str(r.amount),
                    "currency": r.currency,
                    "category": category_name(r.category),
                    "day_of_month": r.day_of_month,
                    "starts_on": r.starts_on.isoformat(),
                    "ends_on": when(r.ends_on),
                    "paused": r.paused,
                }
                for r in recurring
            ],
            "debts": [
                {
                    "person": d.person,
                    "direction": d.direction,
                    "amount": str(d.amount),
                    "currency": d.currency,
                    "note": d.note,
                    "started_on": d.started_on.isoformat(),
                    "due_on": when(d.due_on),
                    "settled_on": when(d.settled_on),
                    "payments": [
                        {"date": p.paid_on.isoformat(), "amount": str(p.amount)} for p in d.payments
                    ],
                }
                for d in debts
            ],
            "income": [
                {
                    "date": i.received_on.isoformat(),
                    "source": i.source,
                    "kind": i.kind,
                    "amount": str(i.amount),
                    "currency": i.currency,
                    "note": i.note,
                }
                for i in incomes
            ],
            "support_messages": [
                {
                    "topic": t.topic,
                    "subject": t.subject,
                    "status": t.status,
                    "messages": [
                        {"from_support": m.from_support, "text": m.body, "at": when(m.created_at)}
                        for m in t.messages
                    ],
                }
                for t in tickets
            ],
            "challenges": [
                {
                    "kind": c.kind,
                    "category": category_name(c.category) if c.category else None,
                    "amount": str(c.amount) if c.amount is not None else None,
                    "currency": c.currency,
                    "target_days": c.target_days,
                    "starts_on": c.starts_on.isoformat(),
                    "ends_on": c.ends_on.isoformat(),
                    "shared": c.group_id is not None,
                }
                for c in challenges
            ],
            "devices": [
                {
                    "device": s.device,
                    "country": s.country,
                    "signed_in_at": when(s.created_at),
                    "last_used_at": when(s.last_used_at),
                    "signed_out_at": when(s.revoked_at),
                }
                for s in sessions
            ],
            "security_activity": [
                {"type": e.type, "device": e.device, "country": e.country, "at": when(e.created_at)}
                for e in events
            ],
        }

    def _event(self, user_id: int, event_type: str) -> None:
        self.events.add(
            SecurityEvent(
                user_id=user_id,
                type=event_type,
                device=self.client.device,
                country=self.client.country,
            )
        )
