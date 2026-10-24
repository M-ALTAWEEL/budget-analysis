"""Sending email, behind one small interface (docs/design/accounts.md, section 5).

Which sender is used depends on EMAIL_BACKEND:
- "smtp":    to Mailpit locally (docker compose up mailpit; read at http://localhost:8025).
- "console": written to the log, links included. Staging only: production refuses it.
- "none":    email is off. The features that need it are hidden (/auth/config says so).
A real provider (Resend) is added at activation, phase 8. Nothing else in the code changes.
"""

import asyncio
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as MimeMessage
from typing import Protocol

from app.config import settings

logger = logging.getLogger("app.email")


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str
    html: str


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


def mask_address(address: str) -> str:
    """m***@gmail.com: enough to find your own test email in the log, not to collect them."""
    name, _, domain = address.partition("@")
    return f"{name[:1]}***@{domain}"


class ConsoleEmailSender:
    async def send(self, message: EmailMessage) -> None:
        logger.info(
            "email to=%s subject=%s\n%s", mask_address(message.to), message.subject, message.text
        )


class SmtpEmailSender:
    def __init__(self, host: str, port: int, sender: str) -> None:
        self.host = host
        self.port = port
        self.sender = sender

    async def send(self, message: EmailMessage) -> None:
        mime = MimeMessage()
        mime["From"] = self.sender
        mime["To"] = message.to
        mime["Subject"] = message.subject
        mime.set_content(message.text)
        mime.add_alternative(message.html, subtype="html")
        # smtplib blocks, so it runs in a worker thread and the server keeps answering.
        await asyncio.to_thread(self._send_blocking, mime)

    def _send_blocking(self, mime: MimeMessage) -> None:
        with smtplib.SMTP(self.host, self.port, timeout=10) as smtp:
            smtp.send_message(mime)


def get_email_sender() -> EmailSender | None:
    """FastAPI dependency. None = email is off here."""
    if settings.email_backend == "smtp":
        return SmtpEmailSender(settings.smtp_host, settings.smtp_port, settings.email_from)
    if settings.email_backend == "console":
        return ConsoleEmailSender()
    return None


async def send_safely(sender: EmailSender, message: EmailMessage) -> None:
    """Runs after the response is sent. A mail server problem is logged (and reported to
    Sentry), never shown to the user: the answer must not depend on whether we sent."""
    try:
        await sender.send(message)
    except Exception:
        logger.exception("email could not be sent")
