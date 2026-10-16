#!/usr/bin/env python3
"""Safe server-side administrator provisioning utility.

Operates directly against the authoritative database using administrative credentials.
Never exposed via any public network endpoint.

Usage:
    uv run python scripts/provision_admin.py list
    uv run python scripts/provision_admin.py promote <email>
    uv run python scripts/provision_admin.py demote <email>
"""

import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env", override=True)
load_dotenv(".env")

DATABASE_URL = os.environ.get("DATABASE_URL_DIRECT") or os.environ.get("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL_DIRECT or DATABASE_URL must be set in .env", file=sys.stderr)
    sys.exit(1)


def get_engine():
    return create_engine(DATABASE_URL)


def list_users():
    engine = get_engine()
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, email, full_name, is_platform_admin FROM app_user ORDER BY email ASC")
        ).mappings().all()

        print(f"\n{'ID':<38} {'EMAIL':<35} {'ADMIN':<8} {'FULL NAME'}")
        print("-" * 100)
        for r in rows:
            admin_badge = "YES" if r["is_platform_admin"] else "NO"
            print(f"{str(r['id']):<38} {r['email']:<35} {admin_badge:<8} {r['full_name']}")
        print()


def set_admin_role(email: str, is_admin: bool):
    clean_email = email.strip().lower()
    engine = get_engine()
    with engine.begin() as conn:
        user = conn.execute(
            text("SELECT id, email, full_name, is_platform_admin FROM app_user WHERE LOWER(email) = :e"),
            {"e": clean_email},
        ).mappings().one_or_none()

        if not user:
            print(f"ERROR: User with email '{clean_email}' not found.", file=sys.stderr)
            sys.exit(1)

        conn.execute(
            text("UPDATE app_user SET is_platform_admin = :a WHERE id = :id"),
            {"a": is_admin, "id": user["id"]},
        )
        # Log to security_event if table exists
        try:
            code = "ADMIN_PROMOTED" if is_admin else "ADMIN_DEMOTED"
            conn.execute(
                text("INSERT INTO security_event(user_id, code, created_at) VALUES (:u, :c, clock_timestamp())"),
                {"u": user["id"], "c": code},
            )
        except Exception:
            pass

        action = "promoted to platform admin" if is_admin else "demoted from platform admin"
        print(f"SUCCESS: User '{clean_email}' ({user['id']}) has been {action}.")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    cmd = sys.argv[1].lower()
    if cmd == "list":
        list_users()
    elif cmd == "promote":
        if len(sys.argv) < 3:
            print("Usage: python scripts/provision_admin.py promote <email>", file=sys.stderr)
            sys.exit(1)
        set_admin_role(sys.argv[2], True)
    elif cmd == "demote":
        if len(sys.argv) < 3:
            print("Usage: python scripts/provision_admin.py demote <email>", file=sys.stderr)
            sys.exit(1)
        set_admin_role(sys.argv[2], False)
    else:
        print(f"Unknown command: {cmd}\n", file=sys.stderr)
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
