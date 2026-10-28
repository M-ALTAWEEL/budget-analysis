"""Commands for the people who run the server. The only way to make someone an admin.

    python -m app.cli grant-admin  riza@test.com --by riza
    python -m app.cli revoke-admin riza@test.com --by riza
    python -m app.cli list-admins

It uses DATABASE_URL like the API: locally `docker compose exec api python -m app.cli ...`;
for staging or production, run it on your computer with that environment's DATABASE_URL.
Whoever can do that already holds the database, so no new door is opened
(docs/design/admin.md)."""

import argparse
import asyncio
import sys

from app.database import SessionLocal, engine
from app.domain.admin.service import AdminGrants, GrantError


async def _run(args: argparse.Namespace) -> int:
    try:
        async with SessionLocal() as session:
            grants = AdminGrants(session)
            if args.command == "grant-admin":
                user = await grants.grant(args.email, args.by)
                print(f"{user.email} is now an admin.")
                if not user.two_factor_enabled:
                    print(
                        "Note: they must turn on two-factor authentication in Settings "
                        "before the dashboard opens for them."
                    )
            elif args.command == "revoke-admin":
                user = await grants.revoke(args.email, args.by)
                print(f"{user.email} is no longer an admin.")
            else:
                admins = await grants.list()
                if not admins:
                    print("No admins.")
                for user, admin in admins:
                    two_fa = "2FA on" if user.two_factor_enabled else "2FA OFF"
                    granted = admin.granted_at.date().isoformat()
                    print(f"{user.email}  ({two_fa}, granted {granted} by {admin.granted_by})")
        return 0
    except GrantError as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    finally:
        await engine.dispose()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description=__doc__.split("\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    for name, help_text in (
        ("grant-admin", "make an account an admin"),
        ("revoke-admin", "take admin away from an account"),
    ):
        command = commands.add_parser(name, help=help_text)
        command.add_argument("email")
        command.add_argument(
            "--by", required=True, help="who is running this (kept in the audit log)"
        )
    commands.add_parser("list-admins", help="list the current admins")
    return asyncio.run(_run(parser.parse_args(argv)))


if __name__ == "__main__":
    sys.exit(main())
