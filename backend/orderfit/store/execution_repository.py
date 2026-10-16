"""P6 bundle/approval persistence. SQL guards remain the second, authoritative lock.

Bundles and items are immutable (forbid_change, no UPDATE grant), so reads never row-lock
them. Writers lock business then deal, matching every other financial writer.
"""

import json
from uuid import UUID

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.workflow import ActionBundleV1


def _one(c, sql, **params):
    row = c.execute(text(sql), params).mappings().one_or_none()
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    return row


def clock(c):
    return c.execute(text("SELECT clock_timestamp()")).scalar_one()


def lock_scope(c, business_id: UUID, deal_id: UUID):
    business = _one(
        c, "SELECT financial_revision,timezone FROM business WHERE id=:b FOR UPDATE", b=business_id
    )
    deal = _one(
        c, "SELECT * FROM deal WHERE business_id=:b AND id=:d FOR UPDATE", b=business_id, d=deal_id
    )
    return deal, business


def blocking_flags(c, business_id, deal_id):
    return list(
        c.execute(
            text(
                "SELECT code FROM deal_flag WHERE business_id=:b AND deal_id=:d AND blocking "
                "AND resolved_at IS NULL ORDER BY id"
            ),
            dict(b=business_id, d=deal_id),
        ).scalars()
    )


def message_status(c, business_id, deal_id, message_id):
    return _one(
        c,
        "SELECT status,direction FROM negotiation_message WHERE business_id=:b AND deal_id=:d AND id=:id",
        b=business_id,
        d=deal_id,
        id=message_id,
    )


def payee(c, business_id, payee_id):
    return _one(
        c,
        "SELECT id,version,kind,archived_at FROM payee WHERE business_id=:b AND id=:p",
        b=business_id,
        p=payee_id,
    )


def payee_accounts(c, business_id, payee_id):
    return (
        c.execute(
            text(
                "SELECT id,version,status FROM payee_bank_account WHERE business_id=:b AND payee_id=:p ORDER BY id"
            ),
            dict(b=business_id, p=payee_id),
        )
        .mappings()
        .all()
    )


def current_acceptance(c, business_id, deal_id, evaluation_id, option_key, party_id, role, terms):
    """Latest unsuperseded, unexpired attestation for these exact terms and evaluated option."""
    return c.execute(
        text(
            """SELECT a.payload FROM party_acceptance a
            JOIN prepared_message p ON p.business_id=a.business_id AND p.deal_id=a.deal_id AND p.id=a.message_id
            WHERE a.business_id=:b AND a.deal_id=:d AND p.evaluation_id=:e AND p.option_key=:o
             AND a.payload->>'party_id'=:pid AND a.payload->>'party_role'=:role
             AND a.payload->>'terms_hash'=:th
             AND (a.payload->>'valid_until')::timestamptz>clock_timestamp()
             AND NOT EXISTS(SELECT FROM party_acceptance s WHERE s.business_id=a.business_id AND s.supersedes_id=a.id)
            ORDER BY a.payload->>'recorded_at' DESC, a.id LIMIT 1"""
        ),
        dict(b=business_id, d=deal_id, e=evaluation_id, o=option_key, pid=str(party_id), role=role, th=terms),
    ).scalar_one_or_none()


def insert_bundle(c, manifest: ActionBundleV1, canonical: bytes, digest: bytes):
    c.execute(
        text(
            """INSERT INTO action_bundle(business_id,deal_id,id,evaluation_id,option_key,snapshot_id,
             input_version,financial_revision,action,manifest,canonical_manifest,bundle_hash,
             created_by,created_at,expires_at,sandbox)
            VALUES(:b,:d,:id,:e,:o,:s,:iv,:fr,:action,CAST(:manifest AS jsonb),:canonical,:hash,
             :u,:created,:expires,true)"""
        ),
        dict(
            b=manifest.business_id,
            d=manifest.deal_id,
            id=manifest.id,
            e=manifest.evaluation_id,
            o=manifest.option_key,
            s=manifest.snapshot_id,
            iv=manifest.input_version,
            fr=manifest.financial_revision,
            action=manifest.kind,
            manifest=canonical.decode("utf-8"),
            canonical=canonical,
            hash=digest,
            u=manifest.created_by,
            created=manifest.created_at,
            expires=manifest.expires_at,
        ),
    )
    for item in manifest.items:
        data = item.model_dump(mode="json")
        party_id = party_version = terms = None
        if item.kind == "message":
            party_id, party_version, terms = item.party_id, item.party_version, item.terms_hash
        elif item.kind == "ledger_entry":
            party_id, party_version = item.payee_id, item.payee_version
        elif item.kind == "lender_acceptance":
            terms = item.terms_hash
        # PostgreSQL derives item_hash from its own jsonb text, exactly as its guards compare.
        c.execute(
            text(
                """INSERT INTO action_bundle_item(business_id,deal_id,bundle_id,item_key,kind,payload,
                 item_hash,message_id,party_id,party_version,terms_hash)
                VALUES(:b,:d,:bundle,:key,:kind,CAST(:p AS jsonb),
                 sha256(convert_to(CAST(:p AS jsonb)::text,'UTF8')),:m,:pid,:pv,:th)"""
            ),
            dict(
                b=manifest.business_id,
                d=manifest.deal_id,
                bundle=manifest.id,
                key=item.key,
                kind=item.kind,
                p=json.dumps(data, ensure_ascii=False, sort_keys=True),
                m=getattr(item, "message_id", None),
                pid=party_id,
                pv=party_version,
                th=bytes.fromhex(terms) if terms else None,
            ),
        )


def load_bundle(c, business_id, bundle_id) -> tuple[ActionBundleV1, str]:
    row = _one(
        c,
        "SELECT canonical_manifest,bundle_hash FROM action_bundle WHERE business_id=:b AND id=:id",
        b=business_id,
        id=bundle_id,
    )
    return (
        ActionBundleV1.model_validate_json(bytes(row["canonical_manifest"])),
        bytes(row["bundle_hash"]).hex(),
    )


def bundle_reason(c, bundle_id):
    return c.execute(
        text("SELECT p6_bundle_unusable_reason(:id)"), dict(id=bundle_id)
    ).scalar_one()


def bundle_decision(c, business_id, bundle_id):
    return c.execute(
        text(
            "SELECT id FROM approval WHERE business_id=:b AND bundle_id=:id ORDER BY created_at,id LIMIT 1"
        ),
        dict(b=business_id, id=bundle_id),
    ).scalar_one_or_none()


def step_up_grant(c, business_id, grant_id):
    return (
        c.execute(
            text(
                """SELECT id,user_id,session_id,bundle_id,purpose,bundle_hash,created_at,expires_at,
                 consumed_at,expires_at>clock_timestamp() AS live
                FROM step_up_grant WHERE business_id=:b AND id=:id"""
            ),
            dict(b=business_id, id=grant_id),
        )
        .mappings()
        .one_or_none()
    )


def insert_approval(c, *, approval_id, manifest, bundle_hash, approver_id, decision, grant, key):
    c.execute(
        text(
            """INSERT INTO approval(id,business_id,deal_id,action,evaluation_id,option_key,
             action_plan_hash,approver_id,decision,step_up_verified_at,idempotency_key,expires_at,
             bundle_id,step_up_grant_id)
            VALUES(:id,:b,:d,:action,:e,:o,:hash,:u,:decision,:verified,:key,:expires,:bundle,:grant)"""
        ),
        dict(
            id=approval_id,
            b=manifest.business_id,
            d=manifest.deal_id,
            action=manifest.kind,
            e=manifest.evaluation_id,
            o=manifest.option_key,
            hash=bytes.fromhex(bundle_hash),
            u=approver_id,
            decision=decision,
            verified=grant["created_at"] if grant else None,
            key=key,
            expires=manifest.expires_at,
            bundle=manifest.id,
            grant=grant["id"] if grant else None,
        ),
    )


def approval_row(c, business_id, approval_id):
    return _one(
        c,
        """SELECT a.*,r.revoked_at,p6_approval_unusable_reason(a.id) AS reason
        FROM approval a LEFT JOIN approval_revocation r ON r.approval_id=a.id
        WHERE a.business_id=:b AND a.id=:id AND a.bundle_id IS NOT NULL""",
        b=business_id,
        id=approval_id,
    )


def insert_revocation(c, *, business_id, deal_id, approval_id, actor_id, reason):
    c.execute(
        text(
            "INSERT INTO approval_revocation(business_id,deal_id,approval_id,actor_user_id,reason) "
            "VALUES(:b,:d,:a,:u,:r)"
        ),
        dict(b=business_id, d=deal_id, a=approval_id, u=actor_id, r=reason),
    )


def option_projection(c, business_id, evaluation_id, option_key):
    """Stored engine-dated events of one evaluated option (None for older evaluations)."""
    return c.execute(
        text(
            "SELECT events FROM evaluation_projection WHERE business_id=:b AND evaluation_id=:e AND option_key=:o"
        ),
        dict(b=business_id, e=evaluation_id, o=option_key),
    ).scalar_one_or_none()


def bundle_run(c, business_id, bundle_id):
    return c.execute(
        text("SELECT id FROM execution_run WHERE business_id=:b AND bundle_id=:id"),
        dict(b=business_id, id=bundle_id),
    ).scalar_one_or_none()


def approval_reason(c, approval_id):
    return c.execute(
        text("SELECT p6_approval_unusable_reason(:id)"), dict(id=approval_id)
    ).scalar_one()


def run_row(c, business_id, run_id, *, lock=False):
    return _one(
        c,
        "SELECT * FROM execution_run WHERE business_id=:b AND id=:id" + (" FOR UPDATE" if lock else ""),
        b=business_id,
        id=run_id,
    )


def run_for_bundle(c, business_id, bundle_id):
    return (
        c.execute(
            text("SELECT * FROM execution_run WHERE business_id=:b AND bundle_id=:id FOR UPDATE"),
            dict(b=business_id, id=bundle_id),
        )
        .mappings()
        .one_or_none()
    )


def operation_status(c, operation_id):
    return c.execute(
        text("SELECT status FROM operation WHERE id=:id"), dict(id=operation_id)
    ).scalar_one_or_none()


def unresolved_runs(c, business_id, deal_id):
    return list(
        c.execute(
            text(
                "SELECT id,run_kind,status FROM execution_run WHERE business_id=:b AND deal_id=:d "
                "AND status IN ('queued','running','partial') ORDER BY created_at,id"
            ),
            dict(b=business_id, d=deal_id),
        ).mappings()
    )


def gate_holder(c, business_id):
    return c.execute(
        text("SELECT run_id FROM commitment_gate WHERE business_id=:b"), dict(b=business_id)
    ).scalar_one_or_none()


def insert_operation(c, *, operation_id, scope, deal, revision, run_id, fingerprint):
    c.execute(
        text(
            "INSERT INTO operation(id,business_id,deal_id,actor_user_id,session_id,kind,request_hash,"
            "input_version,financial_revision,config_version,parameters) "
            "VALUES(:id,:b,:d,:u,:s,'execute',:hash,:iv,:fr,'operation.v1',CAST(:params AS jsonb))"
        ),
        dict(
            id=operation_id,
            b=scope.business_id,
            d=deal["id"],
            u=scope.user_id,
            s=scope.session_id,
            hash=fingerprint,
            iv=deal["input_version"],
            fr=revision,
            params=json.dumps({"run_id": str(run_id)}),
        ),
    )


def insert_run(c, *, run_id, manifest, approval_id, operation_id, key):
    # fencing_token is an immutable run identity marker, not the fence: effects and
    # publication are fenced by operation.lease_token (Database.fence, ADR 0007).
    c.execute(
        text(
            "INSERT INTO execution_run(id,business_id,deal_id,bundle_id,approval_id,run_kind,status,"
            "operation_id,idempotency_key,fencing_token) "
            "VALUES(:id,:b,:d,:bundle,:a,:kind,'queued',:op,:key,gen_random_uuid())"
        ),
        dict(
            id=run_id,
            b=manifest.business_id,
            d=manifest.deal_id,
            bundle=manifest.id,
            a=approval_id,
            kind=manifest.kind,
            op=operation_id,
            key=key,
        ),
    )
    # Exact item rows are copied from the immutable manifest items, never from caller JSON.
    c.execute(
        text(
            """INSERT INTO execution_action(business_id,deal_id,kind,payee_id,message_id,amount_minor,
             scheduled_date,payload,plan_hash,approval_id,status,idempotency_key,run_id,bundle_id,item_key)
            SELECT i.business_id,i.deal_id,i.kind,
             CASE WHEN i.kind IN ('ledger_entry','lender_acceptance') THEN (i.payload->>'payee_id')::uuid END,
             i.message_id,
             CASE WHEN i.kind IN ('ledger_entry','lender_acceptance') THEN (i.payload->>'amount_minor')::bigint END,
             CASE WHEN i.kind IN ('ledger_entry','lender_acceptance') THEN (i.payload->>'scheduled_date')::date END,
             i.payload,b.bundle_hash,:a,'drafted',CAST(:run AS text)||':'||i.item_key,:run,i.bundle_id,i.item_key
            FROM action_bundle_item i JOIN action_bundle b ON b.id=i.bundle_id AND b.business_id=i.business_id
            WHERE i.business_id=:b AND i.bundle_id=:bundle ORDER BY i.item_key"""
        ),
        dict(a=approval_id, run=run_id, b=manifest.business_id, bundle=manifest.id),
    )


def claim_gate(c, business_id, run_id):
    c.execute(
        text("INSERT INTO commitment_gate(business_id,run_id) VALUES(:b,:r)"),
        dict(b=business_id, r=run_id),
    )


def resume_run(c, run_id, operation_id):
    c.execute(
        text("UPDATE execution_run SET operation_id=:op WHERE id=:id"),
        dict(op=operation_id, id=run_id),
    )


def run_actions(c, business_id, *, run_id=None, deal_id=None, limit=None, offset=0):
    where = "x.run_id=:r" if run_id else "x.deal_id=:d AND x.run_id IS NOT NULL"
    sql = (
        "SELECT x.id,x.run_id,x.item_key,x.kind,x.status,x.executed_at,x.failure_reason,x.payload,"
        "e.effect_kind,encode(e.payload_hash,'hex') AS effect_hash,e.created_at AS effect_at,"
        "e.payload->>'original_action_id' AS effect_original "
        "FROM execution_action x LEFT JOIN sandbox_effect e ON e.action_id=x.id AND e.business_id=x.business_id "
        f"WHERE x.business_id=:b AND {where} ORDER BY x.created_at,x.item_key,x.id"
    )
    params = dict(b=business_id, r=run_id, d=deal_id)
    if limit is not None:
        sql += " LIMIT :limit OFFSET :offset"
        params.update(limit=limit, offset=offset)
    return c.execute(text(sql), params).mappings().all()


def settlement(c, run_id):
    return (
        c.execute(text("SELECT * FROM commitment_settlement WHERE run_id=:r"), dict(r=run_id))
        .mappings()
        .one_or_none()
    )
