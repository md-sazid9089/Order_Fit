"""Append-only audit log. Only append() and read functions exist here.
SQLite: triggers reject UPDATE/DELETE. Postgres: revoke UPDATE/DELETE from the app role.
Names and bank numbers are masked before writing."""

from orderfit.domain import AuditEntry


def append(entry: AuditEntry) -> None:
    raise NotImplementedError


def export_json(business_id: str, deal_id: str | None = None) -> list[dict]:
    raise NotImplementedError
