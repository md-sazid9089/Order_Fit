"""Payee bank accounts and immutable verification evidence (SQL guards in 0012)."""

import json

from sqlalchemy import text

ACCOUNT_COLUMNS = (
    "a.id,a.payee_id,a.version,a.last4,a.bank_name,a.status,a.verified_by,a.verified_at,a.created_at,"
    "a.account_fingerprint,EXISTS(SELECT FROM payee_account_evidence e WHERE e.account_id=a.id "
    "AND e.business_id=a.business_id AND e.kind='verification') AS has_evidence"
)


def payee(c, business_id, payee_id):
    return c.execute(
        text("SELECT id,archived_at FROM payee WHERE business_id=:b AND id=:p"),
        {"b": business_id, "p": payee_id},
    ).mappings().one_or_none()


def accounts_page(c, business_id, payee_id, after, limit):
    return c.execute(
        text(
            "SELECT " + ACCOUNT_COLUMNS + " FROM payee_bank_account a WHERE a.business_id=:b AND a.payee_id=:p "
            "AND (CAST(:c AS timestamptz) IS NULL OR (a.created_at,a.id)>(CAST(:c AS timestamptz),CAST(:i AS uuid))) "
            "ORDER BY a.created_at,a.id LIMIT :n"
        ),
        {"b": business_id, "p": payee_id, "c": after[0] if after else None,
         "i": after[1] if after else None, "n": limit + 1},
    ).mappings().all()


def account(c, business_id, payee_id, account_id, *, lock=False):
    return c.execute(
        text(
            "SELECT " + ACCOUNT_COLUMNS + " FROM payee_bank_account a WHERE a.business_id=:b AND a.payee_id=:p "
            "AND a.id=:id" + (" FOR UPDATE OF a" if lock else "")
        ),
        {"b": business_id, "p": payee_id, "id": account_id},
    ).mappings().one_or_none()


def account_by_id(c, business_id, account_id):
    return c.execute(
        text("SELECT " + ACCOUNT_COLUMNS + " FROM payee_bank_account a WHERE a.business_id=:b AND a.id=:id"),
        {"b": business_id, "id": account_id},
    ).mappings().one_or_none()


def fingerprint_exists(c, business_id, payee_id, fingerprint):
    return c.execute(
        text("SELECT EXISTS(SELECT FROM payee_bank_account WHERE business_id=:b AND payee_id=:p AND account_fingerprint=:f)"),
        {"b": business_id, "p": payee_id, "f": fingerprint},
    ).scalar_one()


def insert_account(c, business_id, payee_id, bank_name, fingerprint, last4, key_version):
    return c.execute(
        text(
            "INSERT INTO payee_bank_account(business_id,payee_id,bank_name,account_fingerprint,last4,fingerprint_key_version) "
            "VALUES(:b,:p,:n,:f,:l,:k) RETURNING id"
        ),
        {"b": business_id, "p": payee_id, "n": bank_name, "f": fingerprint, "l": last4, "k": key_version},
    ).scalar_one()


def insert_evidence(c, business_id, payee_id, account_id, kind, evidence, evidence_hash, fingerprint, actor):
    c.execute(
        text(
            "INSERT INTO payee_account_evidence(business_id,payee_id,account_id,kind,evidence,evidence_hash,account_fingerprint,actor_user_id) "
            "VALUES(:b,:p,:a,:k,CAST(:e AS jsonb),:h,:f,:u)"
        ),
        {"b": business_id, "p": payee_id, "a": account_id, "k": kind, "e": json.dumps(evidence),
         "h": evidence_hash, "f": fingerprint, "u": actor},
    )


def set_verified(c, business_id, account_id, actor):
    c.execute(
        text("UPDATE payee_bank_account SET status='verified',verified_by=:u,verified_at=clock_timestamp() WHERE business_id=:b AND id=:id"),
        {"u": actor, "b": business_id, "id": account_id},
    )


def set_revoked(c, business_id, account_id):
    c.execute(
        text("UPDATE payee_bank_account SET status='revoked' WHERE business_id=:b AND id=:id"),
        {"b": business_id, "id": account_id},
    )


def document_in_tenant(c, business_id, document_id, content_hash):
    return c.execute(
        text("SELECT EXISTS(SELECT FROM document WHERE business_id=:b AND id=:d AND (CAST(:h AS bytea) IS NULL OR content_hash=:h))"),
        {"b": business_id, "d": document_id, "h": bytes.fromhex(content_hash) if content_hash else None},
    ).scalar_one()


def bank_change_reply(c, business_id, deal_id, reply_id):
    return c.execute(
        text(
            "SELECT payload->>'party_id' AS party_id,(payload->>'bank_change')::boolean AS bank_change "
            "FROM reply_candidate_set WHERE business_id=:b AND deal_id=:d AND id=:id"
        ),
        {"b": business_id, "d": deal_id, "id": reply_id},
    ).mappings().one_or_none()


def insert_bank_resolution(c, business_id, deal_id, flag_id, reply_id, account_id, actor, evidence, fingerprint):
    return c.execute(
        text(
            "INSERT INTO bank_verification_resolution(business_id,deal_id,flag_id,source_reply_id,account_id,actor_user_id,evidence,verified_fingerprint) "
            "VALUES(:b,:d,:f,:r,:a,:u,:e,:fp) RETURNING id"
        ),
        {"b": business_id, "d": deal_id, "f": flag_id, "r": reply_id, "a": account_id, "u": actor,
         "e": evidence, "fp": fingerprint},
    ).scalar_one()
