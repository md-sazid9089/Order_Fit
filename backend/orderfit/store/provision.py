"""Migrator-only CLI for restricted runtime logins, never imported by API/worker."""

import os

import psycopg
from psycopg import sql


def provision_login(connection, name, password, *, worker=False):
    if not name or len(name) > 63 or len(password) < 32:
        raise ValueError("Runtime name and a strong generated password are required")
    exists = connection.execute("SELECT rolname FROM pg_roles WHERE rolname=%s", (name,)).fetchone()
    if exists:
        raise ValueError(
            "Runtime role already exists; use a reviewed credential rotation procedure"
        )
    connection.execute(
        sql.SQL(
            "CREATE ROLE {} LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD {}"
        ).format(sql.Identifier(name), sql.Literal(password))
    )
    connection.execute(
        sql.SQL("GRANT {} TO {}").format(
            sql.Identifier("orderfit_worker" if worker else "orderfit_app"), sql.Identifier(name)
        )
    )


def main():
    url = os.environ["DATABASE_URL_DIRECT"].replace("postgresql+psycopg://", "postgresql://", 1)
    with psycopg.connect(url) as c:
        provision_login(c, os.environ["RUNTIME_LOGIN"], os.environ["RUNTIME_PASSWORD"])
        provision_login(c, os.environ["WORKER_LOGIN"], os.environ["WORKER_PASSWORD"], worker=True)
    print("Restricted runtime logins provisioned")


if __name__ == "__main__":
    main()
