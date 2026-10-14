"""Postgres access via SQLAlchemy 2 (async engine, psycopg 3 driver).

Tables are defined in store/tables.py and changed only through Alembic
migrations (backend/migrations). Every query is scoped by business_id.
Money columns are BIGINT minor units, never NUMERIC or float.
"""
