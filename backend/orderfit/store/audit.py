"""Append with PostgreSQL sequencing/canonicalization, never a competing Python chain."""

from orderfit.store.repositories import append_audit

__all__ = ["append_audit"]
