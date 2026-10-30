"""HTTP endpoints for recurring expenses (/recurring), and the daily job (/internal/daily)."""

import hmac
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, status

from app.config import settings
from app.core.push import PushSender, get_push_sender
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.debt.service import DebtService, users_with_debts_due
from app.domain.notify.budget_alerts import BudgetAlerts
from app.domain.notify.service import deliver
from app.domain.recurring.schema import (
    RecurringCreate,
    RecurringList,
    RecurringRead,
    RecurringUpdate,
)
from app.domain.recurring.service import RecurringService, users_with_rules
from app.domain.report.service import WrappedService, users_with_recent_budgets

router = APIRouter(prefix="/recurring", tags=["recurring"])
internal_router = APIRouter(prefix="/internal", tags=["internal"], include_in_schema=False)

FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]
Push = Annotated[PushSender | None, Depends(get_push_sender)]
logger = logging.getLogger("app.recurring")


@router.get("")
async def list_recurring(user: CurrentUser, db: DbSession, fx: FxClient) -> RecurringList:
    return await RecurringService(db, fx).list(user)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_recurring(
    data: RecurringCreate, user: CurrentUser, db: DbSession, fx: FxClient
) -> RecurringRead:
    return await RecurringService(db, fx).create(user, data)


@router.patch("/{rule_uuid}")
async def update_recurring(
    rule_uuid: str, data: RecurringUpdate, user: CurrentUser, db: DbSession, fx: FxClient
) -> RecurringRead:
    return await RecurringService(db, fx).update(user, rule_uuid, data)


@router.delete("/{rule_uuid}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_recurring(rule_uuid: str, user: CurrentUser, db: DbSession, fx: FxClient) -> None:
    await RecurringService(db, fx).delete(user, rule_uuid)


@internal_router.post("/daily")
async def daily(
    db: DbSession,
    fx: FxClient,
    push: Push,
    x_cron_secret: Annotated[str, Header()] = "",
) -> dict:
    """Once a day (.github/workflows/daily.yml): add the recurring expenses that fell due
    for everyone, send tomorrow's reminders, today's debt reminders (F2), the budget alerts they
    may cause, and the month-end report notification when a month has just ended (F4)."""
    if not settings.cron_secret:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Not Found")
    if not hmac.compare_digest(x_cron_secret.encode(), settings.cron_secret.encode()):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    added = reminded = 0
    messages = []
    for user in await users_with_rules(db):
        service = RecurringService(db, fx)
        count = await service.catch_up(user)
        added += count
        notes = await service.reminders(user)
        reminded += len(notes)
        messages += notes
        if count:
            messages += await BudgetAlerts(db).check(user)
    debts = DebtService(db, fx)
    for user in await users_with_debts_due(db, debts.today):
        notes = await debts.reminders(user)
        reminded += len(notes)
        messages += notes
    wrapped = WrappedService(db, fx)
    for user in await users_with_recent_budgets(db, wrapped.today):
        notes = await wrapped.notify(user)
        reminded += len(notes)
        messages += notes
    if push is not None:
        await deliver(push, messages)
    logger.info("daily job", extra={"fields": {"added": added, "reminders": reminded}})
    return {"added": added, "reminders": reminded}
