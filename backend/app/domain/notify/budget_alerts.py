"""Budget alerts as push notifications (phase 6i).

The same alerts the overview shows (frontend/src/lib/insights.ts: findAlerts), sent to the
phone when spending crosses them, so the student hears about it without opening the app:

- a category at 85% of its limit, and a category over its limit;
- 90% of the month's money gone with more than 3 days left, and the month overspent.

Each alert is sent **once per budget month** (remembered in `budgets.alerts_sent`), only for
the current budget month, and only to people who left `notify_budget` on. Checked after any
change that adds to someone's spending: their own expense, or a group share copied into
their budget. Sending happens after the response, like the group notifications.
"""

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import BudgetCalendar
from app.core.push import PushMessage
from app.domain.budget.repository import BudgetRepository
from app.domain.budget.service import BudgetService
from app.domain.group.model import GroupMember
from app.domain.group.schema import GroupExpenseRead
from app.domain.notify.model import PushDevice
from app.domain.notify.texts import category_name, money, text
from app.domain.user.model import User

NEAR_LIMIT = Decimal("0.85")  # a category at 85% of its limit (same as the overview)
BUDGET_NEAR = Decimal("0.9")  # 90% of the month's money gone ...
MIN_DAYS_LEFT = 3  # ... with more than 3 days still to go


@dataclass(frozen=True)
class _Alert:
    key: str  # "cat_over:<category uuid>", "budget_near", ...
    replaces: str | None  # the milder alert it makes pointless ("cat_near:<uuid>")
    body: str


class BudgetAlerts:
    def __init__(self, session: AsyncSession, today: date | None = None) -> None:
        self.session = session
        self.today = today or date.today()

    async def check_group_expense(self, expense: GroupExpenseRead) -> list[PushMessage]:
        """Everyone with a share: it may just have been copied into their budget."""
        member_uuids = [s.member.uuid for s in expense.shares if s.amount > 0]
        if not member_uuids:
            return []
        users = await self.session.scalars(
            select(User)
            .join(GroupMember, GroupMember.user_id == User.id)
            .where(GroupMember.uuid.in_(member_uuids))
        )
        messages: list[PushMessage] = []
        for user in list(users):
            messages += await self.check(user, expense.spent_at)
        return messages

    async def check(self, user: User, day: date | None = None) -> list[PushMessage]:
        """`day`: the date of the expense that changed (default today). Returns the
        notifications to send (usually none) and remembers them as sent."""
        if not user.is_active or not user.notify_budget:
            return []
        calendar = BudgetCalendar.of(user)
        month = calendar.month_of(day or self.today)
        if month != calendar.month_of(self.today):
            return []  # an old month changing is not news
        budget = await BudgetRepository(self.session).get_for_month(user.id, month)
        if budget is None:
            return []
        try:
            summary = await BudgetService(self.session).summary(user, month)
        except HTTPException:  # hidden by a fresh start
            return []

        sent = set((budget.alerts_sent or "").split())
        alerts = self._alerts(user, summary, calendar.bounds(month)[1])
        new = [a for a in alerts if a.key not in sent]
        if not new:
            return []
        for alert in new:
            sent.add(alert.key)
            if alert.replaces:
                sent.add(alert.replaces)  # over its limit: "near" would only be late news
        budget.alerts_sent = " ".join(sorted(sent))
        await self.session.commit()

        devices = list(
            await self.session.scalars(select(PushDevice).where(PushDevice.user_id == user.id))
        )
        title = text(user.locale, "budget_title")
        return [
            PushMessage(to=device.token, title=title, body=alert.body, data={"url": "/"})
            for alert in new
            for device in devices
        ]

    def _alerts(self, user: User, summary, month_end: date) -> list[_Alert]:
        locale, currency = user.locale, summary.currency
        found: list[_Alert] = []
        for row in summary.categories:
            limit = row.limit_amount
            if limit is None or limit <= 0:
                continue
            name = category_name(locale, row.category.slug, row.category.name)
            uuid = row.category.uuid
            if row.spent > limit:
                over = money(row.spent - limit, currency)
                body = text(locale, "cat_over", category=name, over=over)
                found.append(_Alert(f"cat_over:{uuid}", f"cat_near:{uuid}", body))
            elif row.spent / limit >= NEAR_LIMIT:
                body = text(
                    locale,
                    "cat_near",
                    category=name,
                    percent=str(int(row.spent / limit * 100)),
                    left=money(limit - row.spent, currency),
                )
                found.append(_Alert(f"cat_near:{uuid}", None, body))

        total, spent = summary.total_amount, summary.spent
        days_left = (month_end - self.today).days  # today still counts
        if total > 0 and spent > total:
            body = text(locale, "budget_over", over=money(spent - total, currency))
            found.append(_Alert("budget_over", "budget_near", body))
        elif total > 0 and spent / total >= BUDGET_NEAR and days_left > MIN_DAYS_LEFT:
            body = text(
                locale, "budget_near", percent=str(int(spent / total * 100)), days=str(days_left)
            )
            found.append(_Alert("budget_near", None, body))
        return found
