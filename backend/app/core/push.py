"""Sending push notifications to the phone app, behind one small interface (phase 6).

Which sender is used depends on PUSH_BACKEND:
- "expo":    Expo's push service (it forwards to Apple and Google). Free, no limit we reach.
- "console": written to the log. Staging and local runs.
- "none":    notifications are off. Phones still register; nothing is sent.

A notification never says more than a lock screen should: who, which group, how much.
"""

import logging
from dataclasses import dataclass, field
from typing import Protocol

import httpx

from app.config import settings

logger = logging.getLogger("app.push")

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
BATCH = 100  # Expo takes at most 100 messages per request


@dataclass(frozen=True)
class PushMessage:
    to: str  # an Expo push token: ExponentPushToken[...]
    title: str
    body: str
    data: dict[str, str] = field(default_factory=dict)  # e.g. {"url": "/groups/<uuid>"}


class PushSender(Protocol):
    async def send(self, messages: list[PushMessage]) -> list[str]:
        """Sends them. Returns the tokens the phone no longer accepts (app removed)."""
        ...


def mask_token(token: str) -> str:
    return token[:22] + "…" if len(token) > 22 else token


class ConsolePushSender:
    async def send(self, messages: list[PushMessage]) -> list[str]:
        for message in messages:
            logger.info(
                "push to=%s title=%s body=%s", mask_token(message.to), message.title, message.body
            )
        return []


class ExpoPushSender:
    def __init__(self, access_token: str = "", client: httpx.AsyncClient | None = None) -> None:
        self.access_token = access_token
        self.client = client

    async def send(self, messages: list[PushMessage]) -> list[str]:
        dead: list[str] = []
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if self.access_token:  # "Enhanced push security" in the Expo account
            headers["Authorization"] = f"Bearer {self.access_token}"
        client = self.client or httpx.AsyncClient(timeout=10)
        try:
            for start in range(0, len(messages), BATCH):
                batch = messages[start : start + BATCH]
                body = [
                    {
                        "to": m.to,
                        "title": m.title,
                        "body": m.body,
                        "data": m.data,
                        "sound": "default",
                    }
                    for m in batch
                ]
                response = await client.post(EXPO_PUSH_URL, json=body, headers=headers)
                response.raise_for_status()
                for message, ticket in zip(batch, response.json().get("data", []), strict=False):
                    if ticket.get("status") == "error":
                        error = (ticket.get("details") or {}).get("error")
                        if error == "DeviceNotRegistered":
                            dead.append(message.to)
                        else:
                            logger.warning("push failed: %s", error or ticket.get("message"))
        finally:
            if self.client is None:
                await client.aclose()
        return dead


def get_push_sender() -> PushSender | None:
    """FastAPI dependency. None = notifications are off here."""
    if settings.push_backend == "expo":
        return ExpoPushSender(settings.expo_access_token)
    if settings.push_backend == "console":
        return ConsolePushSender()
    return None
