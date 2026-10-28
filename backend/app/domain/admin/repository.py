"""Database access for the admin dashboard."""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.admin.model import AdminAuditLog, PlatformAdmin


class AdminRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def get(self, user_id: int) -> PlatformAdmin | None:
        return await self.session.scalar(
            select(PlatformAdmin).where(PlatformAdmin.user_id == user_id)
        )

    async def is_admin(self, user_id: int) -> bool:
        found = await self.session.scalar(
            select(PlatformAdmin.id).where(
                PlatformAdmin.user_id == user_id, PlatformAdmin.revoked_at.is_(None)
            )
        )
        return found is not None

    async def list_live(self) -> list[PlatformAdmin]:
        result = await self.session.scalars(
            select(PlatformAdmin)
            .where(PlatformAdmin.revoked_at.is_(None))
            .order_by(PlatformAdmin.granted_at)
        )
        return list(result)


class AuditRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    def add(self, entry: AdminAuditLog) -> None:
        self.session.add(entry)

    async def page(self, offset: int, limit: int) -> tuple[list[AdminAuditLog], int]:
        total = await self.session.scalar(select(func.count()).select_from(AdminAuditLog))
        result = await self.session.scalars(
            select(AdminAuditLog)
            .order_by(AdminAuditLog.created_at.desc(), AdminAuditLog.id.desc())
            .offset(offset)
            .limit(limit)
        )
        return list(result), total or 0
