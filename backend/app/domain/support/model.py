"""Customer support: messages from people to the team, and the team's answers."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, false
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.base import BaseModel


class SupportTicket(BaseModel):
    """One conversation: a problem, an idea or a question. Someone signed in has their
    account attached; someone who can't sign in leaves an email address instead."""

    __tablename__ = "support_tickets"
    __table_args__ = (
        CheckConstraint(
            "topic IN ('problem', 'idea', 'question', 'account', 'other')", name="topic"
        ),
        CheckConstraint("status IN ('open', 'answered', 'closed')", name="status"),
    )

    user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    email: Mapped[str | None] = mapped_column(String(254))  # where answers go
    name: Mapped[str | None] = mapped_column(String(100))
    locale: Mapped[str] = mapped_column(String(5), default="en")
    topic: Mapped[str] = mapped_column(String(10))
    subject: Mapped[str] = mapped_column(String(120))
    # Where it was sent from, to reproduce a problem: "android 0.1.0", "web 7bc8d23".
    platform: Mapped[str | None] = mapped_column(String(60))
    status: Mapped[str] = mapped_column(String(10), default="open", index=True)
    last_message_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    unread_by_user: Mapped[bool] = mapped_column(server_default=false(), default=False)

    messages: Mapped[list["SupportMessage"]] = relationship(
        back_populates="ticket",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="SupportMessage.id",
    )


class SupportMessage(BaseModel):
    __tablename__ = "support_messages"

    ticket_id: Mapped[int] = mapped_column(
        ForeignKey("support_tickets.id", ondelete="CASCADE"), index=True
    )
    from_support: Mapped[bool] = mapped_column(server_default=false(), default=False)
    author: Mapped[str] = mapped_column(String(100))  # the person, or "Support"
    body: Mapped[str] = mapped_column(Text)

    ticket: Mapped[SupportTicket] = relationship(back_populates="messages")
