"""Sending sign-in codes by SMS, behind one small interface (like app/core/email.py).

SMS_BACKEND decides: "console" writes the code to the log (staging and local only;
production refuses it), "none" turns phone sign-in off. A real provider (Twilio Verify,
or WhatsApp where it is cheaper) is added at activation, phase 8.
"""

import logging
from typing import Protocol

from app.config import settings

logger = logging.getLogger("app.sms")


class SmsSender(Protocol):
    async def send(self, phone: str, text: str) -> None: ...


def mask_phone(phone: str) -> str:
    """+90 5•• ••• •• 12: enough to find your own test code in the log."""
    return f"{phone[:4]}•••{phone[-2:]}"


class ConsoleSmsSender:
    async def send(self, phone: str, text: str) -> None:
        logger.info("sms to=%s text=%s", mask_phone(phone), text)


def get_sms_sender() -> SmsSender | None:
    """FastAPI dependency. None = phone sign-in is off here."""
    if settings.sms_backend == "console":
        return ConsoleSmsSender()
    return None


async def send_safely(sender: SmsSender, phone: str, text: str) -> None:
    try:
        await sender.send(phone, text)
    except Exception:
        logger.exception("sms could not be sent")
