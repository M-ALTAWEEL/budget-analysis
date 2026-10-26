"""The phone app tells us where to send notifications (/me/push-devices)."""

from typing import Literal

from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.dependencies import CurrentUser, DbSession
from app.domain.notify.service import PushDevices

router = APIRouter(prefix="/me/push-devices", tags=["notifications"])

# What Expo hands the app: ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]
TOKEN_PATTERN = r"^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]{10,100}\]$"


class PushDeviceIn(BaseModel):
    token: str = Field(pattern=TOKEN_PATTERN, max_length=200)
    platform: Literal["ios", "android"]


class PushDeviceOut(BaseModel):
    token: str = Field(pattern=TOKEN_PATTERN, max_length=200)


@router.post("", status_code=status.HTTP_204_NO_CONTENT)
async def register_device(data: PushDeviceIn, user: CurrentUser, db: DbSession) -> None:
    """Called when the app starts with notifications allowed. Safe to call again."""
    await PushDevices(db).register(user, data.token, data.platform)


@router.post("/remove", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(data: PushDeviceOut, user: CurrentUser, db: DbSession) -> None:
    """Called on sign-out: this phone stops getting this account's notifications."""
    await PushDevices(db).unregister(user, data.token)
