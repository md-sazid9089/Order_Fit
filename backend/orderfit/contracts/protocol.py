"""Application canonicalization v1. This is NOT the PostgreSQL audit-chain format."""

import hashlib
import hmac
import json
from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, SecretStr, TypeAdapter

from .primitives import DTO, HashHex, Version


def canonical_bytes(value: BaseModel) -> bytes:
    """Typed JSON, sorted object keys, compact separators, UTF-8, explicit nulls.

    Arrays retain order (including manifest execution order). No whitespace/newline
    or Unicode normalization. UTC values use Pydantic's Z form. Floats prohibited.
    """

    def reject_secrets(obj):
        if isinstance(obj, SecretStr):
            raise ValueError("use keyed request_body_digest for secret-bearing requests")
        if isinstance(obj, dict):
            for item in obj.values():
                reject_secrets(item)
        elif isinstance(obj, (list, tuple)):
            for item in obj:
                reject_secrets(item)

    reject_secrets(value.model_dump(mode="python"))
    payload = value.model_dump(mode="json", exclude_none=False)

    def no_floats(obj):
        if isinstance(obj, float):
            raise ValueError("canonical payload cannot contain floats")
        if isinstance(obj, dict):
            for item in obj.values():
                no_floats(item)
        elif isinstance(obj, list):
            for item in obj:
                no_floats(item)

    no_floats(payload)
    return json.dumps(
        payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False
    ).encode("utf-8")


def canonical_hash(value: BaseModel) -> str:
    return hashlib.sha256(canonical_bytes(value)).hexdigest()


def request_body_digest(value: BaseModel, key: bytes) -> str:
    """Keyed request fingerprint, including secrets without storing/logging them.

    Pydantic's redacted JSON must never equate two different passwords/accounts.
    Auth caches retain only this keyed digest, not raw bodies or session tokens.
    """
    if len(key) < 32:
        raise ValueError("idempotency HMAC key must have at least 32 bytes")

    def encode(obj):
        if isinstance(obj, SecretStr):
            return obj.get_secret_value()
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, (datetime, date)):
            return TypeAdapter(type(obj)).dump_python(obj, mode="json")
        raise TypeError("unsupported request fingerprint type")

    raw = json.dumps(
        value.model_dump(mode="python", exclude_none=False),
        default=encode,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
        allow_nan=False,
    ).encode("utf-8")
    return hmac.new(key, b"request-body.v1\x00" + raw, hashlib.sha256).hexdigest()


class IdempotencyMaterial(DTO):
    schema_version: Literal["idempotency.v1"]
    business_id: UUID
    actor_id: UUID
    method: Literal["POST", "PATCH"]
    path: str
    body_hash: HashHex


class FreshnessConflict(ValueError):
    code = "STALE_INPUT_VERSION"


def require_fresh(
    *,
    expected_version: int,
    expected_input_version: int,
    expected_financial_revision: int,
    version: int,
    input_version: int,
    financial_revision: int,
) -> None:
    """Contract predicate; callers still lock/rebuild/check in their transaction."""
    if (expected_version, expected_input_version, expected_financial_revision) != (
        version,
        input_version,
        financial_revision,
    ):
        raise FreshnessConflict("Refresh current versions before continuing")


def require_unexpired(expires_at: datetime, now: datetime) -> None:
    if expires_at.tzinfo is None or now.tzinfo is None or expires_at <= now:
        raise ValueError("expired or timezone missing")


PERMISSIONS = {
    "read": {"viewer", "auditor", "commercial_lead", "risk_officer", "owner"},
    "audit": {"auditor", "risk_officer", "owner"},
    "prepare": {"commercial_lead", "risk_officer", "owner"},
    "execute": {"risk_officer", "owner"},
    "manage_finance": {"risk_officer", "owner"},
    "manage_members": {"owner"},
}

# Existing SQL edges; only the last edge is a proposed P1 addition.
STATE_EDGES = {
    "ingesting": {"awaiting_confirm", "failed", "closed"},
    "awaiting_confirm": {"computing", "ingesting", "failed", "closed"},
    "computing": {"awaiting_approval", "failed", "closed", "awaiting_confirm"},
    "awaiting_approval": {
        "awaiting_reply",
        "computing",
        "awaiting_confirm",
        "committed",
        "closed",
        "failed",
    },
    "awaiting_reply": {"awaiting_confirm", "computing", "committed", "closed", "failed"},
    "committed": set(),
    "closed": set(),
    "failed": {"ingesting", "closed"},
}

# SQLSTATE -> curated HTTP/code. Never return driver exception text.
SQL_ERRORS = {
    "OF001": (409, "ILLEGAL_TRANSITION"),
    "OF002": (409, "UNRESOLVED_BLOCKERS"),
    "OF003": (409, "FROZEN_OR_STALE_INPUT"),
    "OF004": (409, "ROUND_MISMATCH"),
    "OF005": (409, "APPROVAL_CONFLICT"),
    "OF006": (409, "MESSAGE_APPROVAL_CONFLICT"),
    "OF007": (409, "EXECUTION_APPROVAL_CONFLICT"),
    "OF008": (409, "WORKFLOW_ENTRY_CONFLICT"),
    "OF009": (403, "ROLE_ASSIGNMENT_FORBIDDEN"),
    "OF010": (409, "IMMUTABLE_HISTORY"),
    "23000": (409, "IMMUTABLE_HISTORY"),
    "23505": (409, "UNIQUE_CONFLICT"),
    "23503": (422, "INVALID_REFERENCE"),
    "23514": (422, "INVALID_INPUT"),
    "42501": (403, "FORBIDDEN"),
}


def sql_error_contract(sqlstate: str) -> tuple[int, str]:
    if sqlstate == "AC403":
        return 403, "REAUTHENTICATION_REQUIRED"
    if sqlstate.startswith("22"):
        return 422, "INVALID_INPUT"
    return SQL_ERRORS.get(sqlstate, (503, "DEPENDENCY_UNAVAILABLE"))


class VersionSet(DTO):
    version: Version
    input_version: Version
    financial_revision: Version
