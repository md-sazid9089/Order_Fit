"""OrderFit core schema: tables, integrity triggers, audit hash chain, row-level security, reference data.

The SQL lives in backend/migrations/sql/ (0001-0004 up, down_0001 down); tests in
backend/migrations/tests/. See docs/database/database.md.

Why raw SQL instead of autogenerate: triggers, row-level security, generated columns, partial and
expression indexes and the hash-chain function cannot be produced by Alembic autogenerate, so
env.py runs with target_metadata = None (autogenerate disabled).

Revision ID: 0001_core_schema
Revises:
"""
from pathlib import Path

from alembic import op

revision = "0001_core_schema"
down_revision = None
branch_labels = None
depends_on = None

SQL_DIR = Path(__file__).resolve().parents[1] / "sql"
UP = (
    "0001_core_schema.sql",
    "0002_integrity_and_audit.sql",
    "0003_security.sql",
    "0004_reference_data.sql",
)


def _run(filename: str) -> None:
    # Send the file through the raw DBAPI cursor, inside Alembic's transaction, with NO parameters.
    #  - op.execute() wraps the text in sqlalchemy.text(), which reads ":MI" in to_char formats as a bind.
    #  - exec_driver_sql() passes an empty parameter tuple, and psycopg then tries to parse every "%"
    #    (RAISE EXCEPTION '% on %', format('%I'), LIKE '%x%') as a placeholder.
    # A parameter-less execute() uses the simple protocol, which also allows many statements per call.
    sql = (SQL_DIR / filename).read_text(encoding="utf-8")
    with op.get_bind().connection.cursor() as cur:
        cur.execute(sql)


def upgrade() -> None:
    for name in UP:
        _run(name)


def downgrade() -> None:
    _run("down_0001.sql")
