"""HTTP endpoints for reports (/reports)."""

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Path, Query
from fastapi.responses import Response

from app.core.dates import MonthPath, parse_month
from app.dependencies import CurrentUser, DbSession
from app.domain.currency.client import ExchangeRateClient, get_fx_client
from app.domain.report.files import ReportData, to_pdf, to_xlsx
from app.domain.report.schema import Wrapped
from app.domain.report.service import ReportFiles, WrappedService

router = APIRouter(prefix="/reports", tags=["reports"])
FxClient = Annotated[ExchangeRateClient, Depends(get_fx_client)]
FileFormat = Annotated[Literal["pdf", "xlsx"], Query(alias="format")]

_TYPES = {
    "pdf": "application/pdf",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}


def _file(data: ReportData, kind: str) -> Response:
    body = to_pdf(data) if kind == "pdf" else to_xlsx(data)
    return Response(
        body,
        media_type=_TYPES[kind],
        headers={
            "Content-Disposition": f'attachment; filename="budget-{data.period}.{kind}"',
            "Cache-Control": "no-store",  # personal money data: never kept by a proxy
        },
    )


@router.get("/{month}/wrapped")
async def wrapped(month: MonthPath, user: CurrentUser, db: DbSession, fx: FxClient) -> Wrapped:
    """The month in a few numbers (feature F4); "so far" while the month is still going."""
    return await WrappedService(db, fx).month(user, parse_month(month))


@router.get("/{month}/file", response_class=Response)
async def month_file(
    month: MonthPath, kind: FileFormat, user: CurrentUser, db: DbSession, fx: FxClient
) -> Response:
    """The month as a PDF or Excel file (feature F5)."""
    return _file(await ReportFiles(db, fx).month(user, parse_month(month)), kind)


@router.get("/year/{year}/file", response_class=Response)
async def year_file(
    year: Annotated[int, Path(ge=2000, le=2100)],
    kind: FileFormat,
    user: CurrentUser,
    db: DbSession,
    fx: FxClient,
) -> Response:
    """Every month of a year with a budget, as a PDF or Excel file (feature F5)."""
    return _file(await ReportFiles(db, fx).year(user, year), kind)
