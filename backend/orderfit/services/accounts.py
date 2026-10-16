"""P7 payee bank accounts: keyed fingerprints, human-recorded verification evidence.

Raw account numbers are never stored, logged or cached: only HMAC-SHA256 fingerprints under a
versioned server key plus the last four characters. "Verified" means a current finance
manager recorded owner-attestation or document evidence; it is a sandbox label, not a bank
confirmation. Each account change bumps the business financial revision (SQL trigger), so
evaluations/bundles that referenced the old state become stale.
"""

import hashlib
import hmac
import re

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import Page, RevisionReason
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.resources import AccountCreate, AccountVerification, AccountView
from orderfit.services.pagination import page_limit, split_page, timestamp_position
from orderfit.store import account_repository as repo
from orderfit.store.repositories import append_audit

LISTING = "payee_accounts"
ACCOUNT_PATTERN = re.compile(r"^[0-9A-Z]{4,64}$")


class Fingerprinter:
    """HMAC-SHA256(key, domain || normalized account). The key version is stored per row."""

    def __init__(self, key: bytes, version: int):
        if len(key) < 32:
            raise ValueError("fingerprint key too short")
        self.key, self.version = key, version

    @staticmethod
    def normalize(raw: str) -> str:
        value = re.sub(r"[\s-]", "", raw).upper()
        if not ACCOUNT_PATTERN.fullmatch(value):
            raise ApplicationError(422, "INVALID_ACCOUNT_NUMBER", "Use 4-64 letters or digits.")
        return value

    def fingerprint(self, normalized: str) -> bytes:
        return hmac.new(self.key, b"orderfit:payee-account:v1\x00" + normalized.encode("ascii"), hashlib.sha256).digest()


def view(row) -> AccountView:
    return AccountView(
        id=row["id"], payee_id=row["payee_id"], version=row["version"], last4=row["last4"],
        bank_name=row["bank_name"] or "Unspecified bank", status=row["status"],
        verified_by=row["verified_by"], verified_at=row["verified_at"],
        verification_source="owner_attestation" if row["status"] == "verified" and row["has_evidence"] else None,
    )


def _payee(c, scope, payee_id, *, writable):
    row = repo.payee(c, scope.business_id, payee_id)
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if writable and row["archived_at"] is not None:
        raise ApplicationError(409, "PAYEE_ARCHIVED")


def _revision(c, scope, expected):
    current = c.execute(
        text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"), {"b": scope.business_id}
    ).scalar_one()
    if current != expected:
        raise ApplicationError(409, "STALE_FINANCIAL_REVISION")


def list_accounts(c, scope, cursors, payee_id, cursor, limit) -> Page[AccountView]:
    limit = page_limit(limit)
    _payee(c, scope, payee_id, writable=False)
    filters = {"payee_id": payee_id}
    after = cursors.decode(cursor, business_id=scope.business_id, user_id=scope.user_id, listing=LISTING, filters=filters)
    rows, more = split_page(repo.accounts_page(c, scope.business_id, payee_id, after, limit), limit)
    next_cursor = None
    if more:
        next_cursor = cursors.encode(
            business_id=scope.business_id, user_id=scope.user_id, listing=LISTING, filters=filters,
            position=[timestamp_position(rows[-1]["created_at"]), rows[-1]["id"]],
        )
    return Page[AccountView](items=[view(r) for r in rows], next_cursor=next_cursor)


def add_account(c, scope, fingerprinter: Fingerprinter, payee_id, command: AccountCreate) -> AccountView:
    _revision(c, scope, command.expected_financial_revision)
    _payee(c, scope, payee_id, writable=True)
    normalized = fingerprinter.normalize(command.account_number.get_secret_value())
    fingerprint = fingerprinter.fingerprint(normalized)
    if repo.fingerprint_exists(c, scope.business_id, payee_id, fingerprint):
        raise ApplicationError(409, "ACCOUNT_EXISTS")
    account_id = repo.insert_account(
        c, scope.business_id, payee_id, command.bank_name, fingerprint, normalized[-4:], fingerprinter.version
    )
    append_audit(c, scope, "payee_account_added", payload={
        "payee_id": str(payee_id), "account_id": str(account_id), "last4": normalized[-4:],
        "fingerprint_key_version": fingerprinter.version})
    return view(repo.account(c, scope.business_id, payee_id, account_id))


def _locked(c, scope, payee_id, account_id, command):
    _revision(c, scope, command.expected_financial_revision)
    _payee(c, scope, payee_id, writable=False)
    row = repo.account(c, scope.business_id, payee_id, account_id, lock=True)
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    return row


def verify_account(c, scope, payee_id, account_id, command: AccountVerification) -> AccountView:
    row = _locked(c, scope, payee_id, account_id, command)
    if row["status"] != "pending":
        raise ApplicationError(409, "ACCOUNT_NOT_PENDING")
    evidence = command.evidence
    if evidence.document_id is not None and not repo.document_in_tenant(
        c, scope.business_id, evidence.document_id, evidence.content_hash
    ):
        raise ApplicationError(404, "NOT_FOUND")
    repo.insert_evidence(
        c, scope.business_id, payee_id, account_id, "verification", evidence.model_dump(mode="json"),
        bytes.fromhex(canonical_hash(evidence)), bytes(row["account_fingerprint"]), scope.user_id,
    )
    repo.set_verified(c, scope.business_id, account_id, scope.user_id)
    append_audit(c, scope, "payee_account_verified", payload={
        "payee_id": str(payee_id), "account_id": str(account_id), "evidence_hash": canonical_hash(evidence)})
    return view(repo.account(c, scope.business_id, payee_id, account_id))


def revoke_account(c, scope, payee_id, account_id, command: RevisionReason) -> AccountView:
    row = _locked(c, scope, payee_id, account_id, command)
    if row["status"] == "revoked":
        raise ApplicationError(409, "ACCOUNT_REVOKED")
    record = {"reason": command.reason}
    repo.insert_evidence(
        c, scope.business_id, payee_id, account_id, "revocation", record,
        hashlib.sha256(command.reason.encode("utf-8")).digest(), bytes(row["account_fingerprint"]), scope.user_id,
    )
    repo.set_revoked(c, scope.business_id, account_id)
    append_audit(c, scope, "payee_account_revoked", payload={
        "payee_id": str(payee_id), "account_id": str(account_id), "reason": command.reason})
    return view(repo.account(c, scope.business_id, payee_id, account_id))
