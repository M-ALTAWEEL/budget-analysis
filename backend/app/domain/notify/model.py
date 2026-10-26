"""The phones that receive push notifications (phase 6)."""

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.base import BaseModel


class PushDevice(BaseModel):
    """One installed app that may receive notifications. A token belongs to one phone and
    one app install; signing in with another account on that phone moves it there."""

    __tablename__ = "push_devices"

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    token: Mapped[str] = mapped_column(String(200), unique=True)
    platform: Mapped[str] = mapped_column(String(10))  # "ios" or "android"
    last_seen_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
