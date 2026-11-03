"""HTTP endpoints for importing a bank statement (/imports)."""

from typing import Annotated

from fastapi import APIRouter, Depends, Request

from app.core.limiter import limiter
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.imports.schema import ImportRequest, ImportResult, Preview, StatementFile
from app.domain.imports.service import ImportService

router = APIRouter(prefix="/imports", tags=["imports"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]


@router.post("/statement")
@limiter.limit("20/hour")
async def read_statement(
    request: Request, data: StatementFile, user: CurrentUser, db: DbSession, fx: FxClient
) -> Preview:
    """Feature F11: what is in the statement, with a suggestion for each line. Saves
    nothing, and the file isn't kept."""
    return await ImportService(db, fx).preview(user, data)


@router.post("/statement/add")
@limiter.limit("20/hour")
async def add_from_statement(
    request: Request, data: ImportRequest, user: CurrentUser, db: DbSession, fx: FxClient
) -> ImportResult:
    """The lines the person picked, as expenses or income. Importing twice adds once."""
    return await ImportService(db, fx).add(user, data)
