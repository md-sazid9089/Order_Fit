"""Migrator-only sanitized account-mail status and explicit retention maintenance."""

import argparse
import os

import psycopg

from orderfit.store.db import SCHEMA_REVISION


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("status", "cleanup"))
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if args.action == "cleanup" and not args.apply:
        parser.error("cleanup requires --apply and a reviewed target")
    url = os.environ["DATABASE_URL_DIRECT"].replace("postgresql+psycopg://", "postgresql://", 1)
    with psycopg.connect(url) as c:
        revision = c.execute("SELECT version_num FROM alembic_version").fetchone()[0]
        if revision != SCHEMA_REVISION:
            raise RuntimeError("Account-mail maintenance requires the current schema")
        if args.action == "cleanup":
            c.execute("SELECT account_mail_maintenance()")
        for state, count, oldest_seconds in c.execute(
            "SELECT status,count(*),max(extract(epoch FROM clock_timestamp()-created_at))::bigint "
            "FROM account_mail_outbox GROUP BY status ORDER BY status"
        ):
            print(f"status={state} count={count} oldest_seconds={oldest_seconds}")


if __name__ == "__main__":
    main()
