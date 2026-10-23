"""Application entry point: builds the FastAPI app and registers routers."""

from typing import Annotated

from fastapi import Depends, FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.limiter import limiter
from app.database import get_db
from app.domain.assistant.router import router as assistant_router
from app.domain.budget.router import budgets_router, categories_router
from app.domain.currency.router import router as currency_router
from app.domain.expense.router import router as expenses_router
from app.domain.goal.router import router as goals_router
from app.domain.user.router import auth_router, users_router


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="AI expense tracker and savings coach for students.",
        # Hide the interactive docs in production.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
    )

    # Rate limiting: too many requests -> 429 Too Many Requests.
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        """Headers on every API answer (OWASP Secure Headers). The answers are JSON with
        personal data: never cached by a browser or a proxy, never shown inside a page."""
        response = await call_next(request)
        headers = response.headers
        headers.setdefault("X-Content-Type-Options", "nosniff")
        headers.setdefault("X-Frame-Options", "DENY")
        headers.setdefault("Referrer-Policy", "no-referrer")
        headers.setdefault("Cache-Control", "no-store")
        if settings.is_production:
            # JSON needs nothing from anywhere. (Not in development: /docs loads its UI.)
            headers.setdefault(
                "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'"
            )
            headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,  # needed later for the refresh-token cookie
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get(f"{settings.api_prefix}/ping", tags=["system"])
    async def ping() -> dict:
        """Is the server up? No database query: the host's health checks and the
        keep-awake job call this often, and must not keep the (free) database awake."""
        return {"status": "ok"}

    @app.get(f"{settings.api_prefix}/health", tags=["system"])
    async def health(response: Response, db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
        """Liveness + database check. Used by Docker, Railway and us."""
        try:
            await db.execute(text("SELECT 1"))
            database = "ok"
        except Exception:
            database = "unavailable"
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {"status": "ok" if database == "ok" else "degraded", "database": database}

    # One router per domain, all under /api/v1.
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(users_router, prefix=settings.api_prefix)
    app.include_router(categories_router, prefix=settings.api_prefix)
    app.include_router(budgets_router, prefix=settings.api_prefix)
    app.include_router(expenses_router, prefix=settings.api_prefix)
    app.include_router(currency_router, prefix=settings.api_prefix)
    app.include_router(goals_router, prefix=settings.api_prefix)
    app.include_router(assistant_router, prefix=settings.api_prefix)

    return app


app = create_app()
