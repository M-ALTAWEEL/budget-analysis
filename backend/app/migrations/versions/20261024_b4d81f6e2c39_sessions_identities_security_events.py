"""phase 2a: sessions, sign-in identities, security events, email_verified_at

Revision ID: b4d81f6e2c39
Revises: a7c3e9d15b02
Create Date: 2026-10-24 12:00:00

Additive only: users.google_sub and the refresh_tokens table stay, so the previous version
of the code still works if we roll back. A later migration drops them.
Design: docs/design/accounts.md, section 3.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b4d81f6e2c39"
down_revision: str | None = "a7c3e9d15b02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _base_columns() -> list[sa.Column]:
    """The four columns every table inherits from BaseModel."""
    return [
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def _user_fk(table: str) -> sa.ForeignKeyConstraint:
    return sa.ForeignKeyConstraint(
        ["user_id"], ["users.id"], name=op.f(f"fk_{table}_user_id_users"), ondelete="CASCADE"
    )


def upgrade() -> None:
    op.add_column(
        "users", sa.Column("email_verified_at", sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        "user_identities",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("provider", sa.String(length=20), nullable=False),
        sa.Column("subject", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        *_base_columns(),
        _user_fk("user_identities"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_user_identities")),
        sa.UniqueConstraint(
            "provider", "subject", name=op.f("uq_user_identities_provider_subject")
        ),
    )
    op.create_index(op.f("ix_user_identities_user_id"), "user_identities", ["user_id"])
    op.create_index(op.f("ix_user_identities_uuid"), "user_identities", ["uuid"], unique=True)

    op.create_table(
        "sessions",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("refresh_hash", sa.String(length=64), nullable=False),
        sa.Column("previous_hash", sa.String(length=64), nullable=True),
        sa.Column("rotated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("device", sa.String(length=100), nullable=False),
        sa.Column("country", sa.String(length=2), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_reason", sa.String(length=30), nullable=True),
        *_base_columns(),
        _user_fk("sessions"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("refresh_hash", name=op.f("uq_sessions_refresh_hash")),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"])
    op.create_index(op.f("ix_sessions_previous_hash"), "sessions", ["previous_hash"])
    op.create_index(op.f("ix_sessions_uuid"), "sessions", ["uuid"], unique=True)

    op.create_table(
        "security_events",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(length=30), nullable=False),
        sa.Column("device", sa.String(length=100), nullable=True),
        sa.Column("country", sa.String(length=2), nullable=True),
        *_base_columns(),
        _user_fk("security_events"),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_security_events")),
    )
    op.create_index(
        "ix_security_events_user_id_created_at", "security_events", ["user_id", "created_at"]
    )
    op.create_index(op.f("ix_security_events_uuid"), "security_events", ["uuid"], unique=True)

    # ── Existing data ────────────────────────────────────────────────────────
    # Google accounts: Google verified the email, and the link becomes an identity row.
    op.execute(
        """
        INSERT INTO user_identities
            (uuid, user_id, provider, subject, email, verified_at, last_used_at)
        SELECT gen_random_uuid()::text, id, 'google', google_sub, email, now(), now()
        FROM users WHERE google_sub IS NOT NULL
        """
    )
    op.execute("UPDATE users SET email_verified_at = now() WHERE google_sub IS NOT NULL")
    # Everyone stays signed in: each live refresh token becomes a session. The cookie the
    # browser holds is the same token, so its hash matches.
    op.execute(
        """
        INSERT INTO sessions
            (uuid, user_id, refresh_hash, device, last_used_at,
             idle_expires_at, absolute_expires_at, created_at)
        SELECT gen_random_uuid()::text, user_id, token_hash, 'Unknown device', created_at,
               expires_at, created_at + interval '90 days', created_at
        FROM refresh_tokens
        WHERE revoked_at IS NULL AND expires_at > now()
        """
    )


def downgrade() -> None:
    # Google accounts made after the upgrade only exist in user_identities: put them back
    # where the previous code looks, so they can still sign in.
    op.execute(
        """
        UPDATE users SET google_sub = i.subject
        FROM user_identities i
        WHERE i.user_id = users.id AND i.provider = 'google' AND users.google_sub IS NULL
        """
    )
    # Sessions are not copied back: everyone signs in once more after a rollback.
    op.drop_index(op.f("ix_security_events_uuid"), table_name="security_events")
    op.drop_index("ix_security_events_user_id_created_at", table_name="security_events")
    op.drop_table("security_events")
    op.drop_index(op.f("ix_sessions_uuid"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_previous_hash"), table_name="sessions")
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_index(op.f("ix_user_identities_uuid"), table_name="user_identities")
    op.drop_index(op.f("ix_user_identities_user_id"), table_name="user_identities")
    op.drop_table("user_identities")
    op.drop_column("users", "email_verified_at")
