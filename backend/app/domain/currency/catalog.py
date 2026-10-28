"""Which currencies exist (all of them, for conversion) and which are offered (the visible
ones, for new choices). The list is in the `currencies` table; admins add and hide."""

import time

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.money import DEFAULT_CURRENCY
from app.domain.currency.model import SupportedCurrency

# Each server process keeps the list for a minute: it's read on every rate lookup and
# changes a few times a year. The process that changes it forgets its copy at once.
CACHE_SECONDS = 60
_cache: tuple[float, dict[str, bool]] | None = None  # (when, {code: hidden})

NOT_OFFERED = "This currency isn't available."


def forget_currencies() -> None:
    """Empty the in-memory copy (after a change, and between tests)."""
    global _cache
    _cache = None


class CurrencyCatalog:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _codes(self, looking_for: str | None = None) -> dict[str, bool]:
        """{code: hidden}. A code missing from the copy is looked up again once: another
        server process may have just added it."""
        global _cache
        now = time.monotonic()
        if _cache is not None and now - _cache[0] < CACHE_SECONDS:
            if looking_for is None or looking_for in _cache[1]:
                return _cache[1]
        rows = await self.session.execute(select(SupportedCurrency.code, SupportedCurrency.hidden))
        codes = {code: hidden for code, hidden in rows}
        _cache = (now, codes)
        return codes

    async def all(self, including: str | None = None) -> set[str]:
        """Every currency, hidden ones too: whoever uses one still needs it converted."""
        return set(await self._codes(including))

    async def require_known(self, code: str) -> None:
        if code not in await self._codes(code):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_OFFERED)

    async def require_offered(self, code: str, current: str | None = None) -> None:
        """For a newly chosen currency. Keeping the one you already have (`current`) is
        always fine, even after it was hidden."""
        if code == current:
            return
        codes = await self._codes(code)
        if code not in codes or codes[code]:
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, NOT_OFFERED)

    async def offered_or_default(self, code: str) -> str:
        """For sign-ins that make an account on the way (Google, phone): the code was
        already spent, so a currency that isn't offered falls back to the default instead
        of failing. They can change it in Settings."""
        codes = await self._codes(code)
        return code if code in codes and not codes[code] else DEFAULT_CURRENCY

    async def list(self) -> list[SupportedCurrency]:
        """Every row, in the order they were added (the six first). Not cached."""
        rows = await self.session.scalars(select(SupportedCurrency).order_by(SupportedCurrency.id))
        return list(rows)

    async def get(self, code: str) -> SupportedCurrency | None:
        return await self.session.scalar(
            select(SupportedCurrency).where(SupportedCurrency.code == code)
        )
