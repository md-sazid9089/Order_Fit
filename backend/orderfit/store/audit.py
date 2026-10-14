"""Append-only audit log. Only append() and read functions exist here.
Enforced in the database, not by convention: the migration that creates the
table adds a trigger that raises on UPDATE, DELETE and TRUNCATE.
Names and bank numbers are masked before writing."""

from orderfit.domain import AuditEntry


def append(entry: AuditEntry) -> None:
    raise NotImplementedError


def export_json(business_id: str, deal_id: str | None = None) -> list[dict]:
    raise NotImplementedError
