"""Durable sandbox execution handler (local simulation only, no external adapter).

Each manifest item is one short fenced transaction in which the SQL guards recheck the exact
approval, holds, revocation, membership and manifest membership, and the simulated effect
commits together with the action status and audit row. A retry after a crash finds the
completed action and its effect, so no effect is repeated. Settlement (round increment,
commitment projection with one revision bump, gate release, compensation reconciliation)
is a separate single transaction that also finishes the operation.
"""

import json
import logging
import time
from uuid import UUID

from pydantic import TypeAdapter
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import Evidence
from orderfit.contracts.workflow import (
    BlockedResult,
    CompletedResult,
    ErrorDetail,
    FailedResult,
    Finding,
    OperationResult,
    SafeError,
)
from orderfit.store import execution_repository as repo
from orderfit.store.repositories import append_audit

COMPLETED = {"sent", "posted", "accepted"}
OUTCOME = {
    "message": "sent",
    "ledger_entry": "posted",
    "lender_acceptance": "accepted",
    "commitment": "posted",
    "cancellation": "posted",
}
EFFECT = {
    "message": "outbox",
    "ledger_entry": "ledger",
    "lender_acceptance": "lender_simulation",
    "commitment": "ledger",
    "cancellation": "inverse",
}
REFUSED_SQLSTATES = {"OF002", "OF005", "OF006", "OF007"}
# Lock-not-available, statement timeout, deadlock and serialization failure: the item or
# settlement transaction rolled back as a whole, so it is safe to run it again under the same
# lease (its fence is rechecked inside every attempt).
TRANSIENT_SQLSTATES = {"55P03", "57014", "40P01", "40001"}
SETTLE_ATTEMPTS = 3
SETTLE_BACKOFF_SECONDS = (0.5, 1.5)  # before attempts 2 and 3; well inside the 60 s lease
ITEM_ATTEMPTS = 3
ITEM_BACKOFF_SECONDS = (0.5, 1.5)
LOG = logging.getLogger("orderfit.execution")


def fault(point):
    """Crash-injection seam for recovery tests; a no-op in every deployed process."""
    return None


def _set(c, name, value):
    c.execute(text("SELECT set_config(:n,:v,true)"), dict(n=name, v=str(value)))


def _lock(c, scope, run_id):
    c.execute(text("SELECT id FROM business WHERE id=:b FOR UPDATE"), dict(b=scope.business_id))
    run = repo.run_row(c, scope.business_id, run_id)
    c.execute(
        text("SELECT id FROM deal WHERE business_id=:b AND id=:d FOR UPDATE"),
        dict(b=scope.business_id, d=run["deal_id"]),
    )
    return repo.run_row(c, scope.business_id, run_id, lock=True)


def _fence(db, c, claim, *, settlement=False):
    """Recheck the lease under the operation row lock (after business/deal/run locks).

    ``db.job`` validates the lease only when the transaction opens; a worker whose lease then
    lapsed or was reclaimed by another worker must not commit an effect (plan section 9.2).
    Settlement ignores a cancellation request (nothing remains to stop) but not the lease or
    the actor's authorization.
    """
    if not db.fence(c, claim["id"], claim["lease_token"], settlement=settlement):
        raise ApplicationError(409, "LEASE_OR_AUTHORIZATION_LOST")


def _finish(c, claim, result):
    finished = c.execute(
        text("SELECT operation_finish(:id,:t,CAST(:r AS jsonb),false)"),
        dict(id=claim["id"], t=claim["lease_token"], r=TypeAdapter(OperationResult).dump_json(result).decode()),
    ).scalar_one()
    if not finished:
        raise ApplicationError(409, "LEASE_LOST")


def _completed(scope, run_id):
    return CompletedResult(
        kind="completed",
        resource_id=run_id,
        resource_url=f"/api/v1/businesses/{scope.business_id}/execution-runs/{run_id}",
    )


def run_execution(operations, claim, job, runtime=None):
    db = operations.database
    with db.job(claim["id"], claim["lease_token"]) as (c, scope):
        run_id = UUID(
            c.execute(text("SELECT parameters->>'run_id' FROM operation WHERE id=:id"), dict(id=claim["id"])).scalar_one()
        )
        run = _lock(c, scope, run_id)
        if run["operation_id"] != claim["id"]:
            raise ApplicationError(409, "RUN_OPERATION_MISMATCH")
        if run["status"] == "succeeded":
            result = _completed(scope, run_id)
            _finish(c, claim, result)
            return result
        if run["status"] in {"queued", "partial"}:
            c.execute(
                text(
                    "UPDATE execution_run SET status='running',started_at=coalesce(started_at,clock_timestamp()) WHERE id=:id"
                ),
                dict(id=run_id),
            )
        elif run["status"] != "running":
            raise ApplicationError(409, "RUN_TERMINAL")
        pending = [
            (r["id"], r["item_key"])
            for r in repo.run_actions(c, scope.business_id, run_id=run_id)
            if r["status"] not in COMPLETED
        ]
    for action_id, item_key in sorted(pending, key=lambda p: p[1]):
        reason = _execute_item(db, claim, run_id, action_id, item_key)
        if reason is not None:
            return _stop(db, claim, run_id, reason)
    return _settle(db, claim, run_id)


def _execute_item(db, claim, run_id, action_id, item_key):
    """Run one item; retry only technical lock/timeout/serialization failures.

    Each attempt is one atomic transaction (effect, action status and audit commit together or
    not at all), and an attempt after a rollback rereads the action, so a retry can never
    repeat an effect. A guard refusal or exhausted retries stop the run (partial); any other
    error propagates as before.
    """
    for attempt in range(1, ITEM_ATTEMPTS + 1):
        try:
            return _execute_item_once(db, claim, run_id, action_id, item_key)
        except DBAPIError as exc:
            if not _transient(exc):
                raise
            if attempt == ITEM_ATTEMPTS:
                LOG.warning("execution_item_retries_exhausted operation_id=%s run_id=%s item_key=%s sqlstate=%s",
                            claim["id"], run_id, item_key, exc.orig.sqlstate)
                return "TRANSIENT_RETRIES_EXHAUSTED"
            LOG.warning("execution_item_retry operation_id=%s run_id=%s item_key=%s attempt=%s sqlstate=%s",
                        claim["id"], run_id, item_key, attempt, exc.orig.sqlstate)
            time.sleep(ITEM_BACKOFF_SECONDS[min(attempt, len(ITEM_BACKOFF_SECONDS)) - 1])
    raise AssertionError("unreachable")  # pragma: no cover


def _execute_item_once(db, claim, run_id, action_id, item_key):
    """One effect per transaction. Returns a stop reason, or None when the item is complete."""
    try:
        with db.job(claim["id"], claim["lease_token"]) as (c, scope):
            run = _lock(c, scope, run_id)
            row = c.execute(
                text("SELECT * FROM execution_action WHERE business_id=:b AND id=:id FOR UPDATE"),
                dict(b=scope.business_id, id=action_id),
            ).mappings().one()
            if row["status"] in COMPLETED:
                return None  # committed by an earlier attempt: read the same result
            if run["status"] != "running":
                return "RUN_NOT_RUNNING"
            # Holds, revocation, approver membership, expiry, freshness, superseded content.
            reason = repo.approval_reason(c, run["approval_id"])
            if reason is not None:
                return reason
            _fence(db, c, claim)  # last check before the effect; held until commit
            _set(c, "app.execution_run_id", run_id)
            _set(c, "app.execution_item_key", item_key)
            if row["status"] in {"drafted", "failed"}:
                c.execute(text("UPDATE execution_action SET status='scheduled' WHERE id=:id"), dict(id=action_id))
            c.execute(
                text("UPDATE execution_action SET status=:s WHERE id=:id"),
                dict(s=OUTCOME[row["kind"]], id=action_id),
            )
            if row["kind"] == "message":
                c.execute(
                    text(
                        "UPDATE negotiation_message SET status='sent',sent_at=clock_timestamp() "
                        "WHERE business_id=:b AND deal_id=:d AND id=:m"
                    ),
                    dict(b=scope.business_id, d=row["deal_id"], m=row["message_id"]),
                )
            payload = {
                "sandbox": True,
                "external_delivery": False,
                "effect": EFFECT[row["kind"]],
                "action_id": str(action_id),
                "run_id": str(run_id),
                "bundle_id": str(row["bundle_id"]),
                "item_key": item_key,
                "plan_hash": bytes(row["plan_hash"]).hex(),
            }
            if row["kind"] == "cancellation":
                payload["original_action_id"] = row["payload"]["original_action_id"]
                payload["original_effect_hash"] = row["payload"]["original_payload_hash"]
            effect_hash = c.execute(
                text(
                    "INSERT INTO sandbox_effect(business_id,action_id,effect_kind,payload,payload_hash) "
                    "VALUES(:b,:a,:k,CAST(:p AS jsonb),sha256(convert_to(CAST(:p AS jsonb)::text,'UTF8'))) "
                    "RETURNING encode(payload_hash,'hex')"
                ),
                dict(b=scope.business_id, a=action_id, k=EFFECT[row["kind"]], p=json.dumps(payload, sort_keys=True)),
            ).scalar_one()
            append_audit(
                c, scope, "sandbox_effect", deal_id=row["deal_id"],
                payload={"run_id": str(run_id), "action_id": str(action_id), "item_key": item_key,
                         "effect_kind": EFFECT[row["kind"]], "effect_hash": effect_hash},
            )
            fault("before_item_commit")
    except DBAPIError as exc:
        # A guard refused authority at the effect boundary (race with a hold/revocation).
        if getattr(exc.orig, "sqlstate", "") in REFUSED_SQLSTATES:
            return "EXECUTION_REFUSED"
        raise
    fault("after_item_commit")
    return None


def _stop(db, claim, run_id, reason):
    """Stop remaining effects; completed ones stay visible and keep the gate (partial)."""
    with db.job(claim["id"], claim["lease_token"]) as (c, scope):
        run = _lock(c, scope, run_id)
        status = c.execute(text("SELECT p6_interrupt_run(:r,false)"), dict(r=run_id)).scalar_one()
        append_audit(
            c, scope, "execution_stopped", deal_id=run["deal_id"],
            payload={"run_id": str(run_id), "reason": reason, "status": status},
        )
        result = BlockedResult(
            kind="blocked",
            outcome="stale",
            findings=[Finding(
                code=reason, field=None,
                message="Execution stopped before the remaining sandbox effects; completed effects are preserved.",
                blocking=True, resolution="refresh",
            )],
        )
        _finish(c, claim, result)
        return result


def _evidence(run_id, action_id, digest):
    return [Evidence(
        document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
        source_role="baseline", page=None, quote=None, override_reason=None,
        manual_attestation=(
            f"Projected from completed sandbox commitment run {run_id}, action {action_id}, "
            f"approved bundle {digest}. Receipt certainty is engine output, not cash evidence."
        ),
    ).model_dump(mode="json")]


def _project(c, scope, run):
    manifest, digest = repo.load_bundle(c, scope.business_id, run["bundle_id"])
    commitment = next(i for i in manifest.items if i.kind == "commitment")
    actions = {
        r["item_key"]: r["id"] for r in repo.run_actions(c, scope.business_id, run_id=run["id"])
    }
    _set(c, "app.commitment_run_id", run["id"])
    for event in commitment.projections:
        action_id = actions[event.attributed_item_key]
        cash_event_id = c.execute(
            text(
                """INSERT INTO cash_event(business_id,deal_id,event_date,amount_minor,direction,kind,certainty,
                 description,is_deferrable,incremental,customer_id,payee_id,evidence,original_obligation_id,
                 supersedes_id,version,created_at)
                VALUES(:b,:d,:date,:amount,:direction,:kind,:certainty,:description,false,false,:customer,
                 :payee,CAST(:evidence AS jsonb),:obligation,:supersedes,1,clock_timestamp()) RETURNING id"""
            ),
            dict(
                b=scope.business_id, d=run["deal_id"], date=event.event_date,
                amount=int(event.amount_minor), direction=event.direction, kind=event.kind,
                certainty=event.certainty, description=f"Committed order projection {event.event_key}"[:500],
                customer=event.customer_id, payee=event.payee_id,
                evidence=json.dumps(_evidence(run["id"], action_id, digest)),
                obligation=event.original_obligation_id,
                supersedes=int(event.supersedes_event_id) if event.supersedes_event_id else None,
            ),
        ).scalar_one()
        c.execute(
            text(
                "INSERT INTO commitment_projection(business_id,deal_id,action_id,cash_event_id,"
                "original_obligation_id,evaluation_id,bundle_id) VALUES(:b,:d,:a,:e,:o,:ev,:bundle)"
            ),
            dict(b=scope.business_id, d=run["deal_id"], a=action_id, e=cash_event_id,
                 o=event.original_obligation_id, ev=manifest.evaluation_id, bundle=manifest.id),
        )


def _reconcile(c, scope, run):
    _set(c, "app.commitment_run_id", run["id"])
    rows = c.execute(
        text(
            """SELECT x.id AS compensation_id,p.action_id AS original_id,p.cash_event_id
            FROM execution_action x JOIN commitment_projection p
             ON p.business_id=x.business_id AND p.action_id::text=x.payload->>'original_action_id'
            JOIN cash_event ce ON ce.business_id=p.business_id AND ce.id=p.cash_event_id
            WHERE x.business_id=:b AND x.run_id=:r AND x.kind='cancellation' AND ce.voided_at IS NULL
            ORDER BY p.cash_event_id"""
        ),
        dict(b=scope.business_id, r=run["id"]),
    ).mappings().all()
    for row in rows:
        c.execute(
            text("UPDATE cash_event SET voided_at=clock_timestamp() WHERE business_id=:b AND id=:id"),
            dict(b=scope.business_id, id=row["cash_event_id"]),
        )
        c.execute(
            text(
                "INSERT INTO commitment_reconciliation(business_id,deal_id,cash_event_id,original_action_id,"
                "compensation_action_id,run_id) VALUES(:b,:d,:e,:o,:x,:r)"
            ),
            dict(b=scope.business_id, d=run["deal_id"], e=row["cash_event_id"], o=row["original_id"],
                 x=row["compensation_id"], r=run["id"]),
        )
    return len(rows)


def _transient(exc) -> bool:
    return isinstance(exc, DBAPIError) and getattr(exc.orig, "sqlstate", "") in TRANSIENT_SQLSTATES


def _settle(db, claim, run_id):
    """Settle in one transaction; retry only technical lock/timeout/serialization failures.

    A lock timeout or deadlock is not a settlement outcome: the whole transaction rolled
    back, so it is re-run (bounded, with backoff) under the same lease, whose fence is
    rechecked inside every attempt. Only a guard refusal, another settlement error or
    exhausted retries hold the gate and require reconciliation.
    """
    for attempt in range(1, SETTLE_ATTEMPTS + 1):
        try:
            result = _settle_once(db, claim, run_id)
        except (DBAPIError, ApplicationError) as exc:
            if isinstance(exc, ApplicationError) and exc.code in {"LEASE_OR_AUTHORIZATION_LOST", "LEASE_LOST"}:
                raise
            if _transient(exc) and attempt < SETTLE_ATTEMPTS:
                LOG.warning("execution_settlement_retry operation_id=%s run_id=%s attempt=%s sqlstate=%s",
                            claim["id"], run_id, attempt, exc.orig.sqlstate)
                time.sleep(SETTLE_BACKOFF_SECONDS[min(attempt, len(SETTLE_BACKOFF_SECONDS)) - 1])
                continue
            reason = "transient_retries_exhausted" if _transient(exc) else "refused"
            LOG.warning("execution_settlement_refused operation_id=%s run_id=%s error=%s reason=%s",
                        claim["id"], run_id, type(exc).__name__, reason)
            return _settlement_failed(db, claim, run_id, reason)
        except Exception as exc:  # noqa: BLE001 - any defect after effects takes the safe path
            # Effects already committed: an unexpected defect (KeyError, StopIteration, ...) must
            # not escape as a generic job failure. Record it and require reconciliation; the gate
            # stays held. Only the exception type is logged, never its message or payloads.
            LOG.error("execution_settlement_unexpected_error operation_id=%s run_id=%s error=%s",
                      claim["id"], run_id, type(exc).__name__)
            return _settlement_failed(db, claim, run_id, "unexpected_error")
        fault("after_finalize_commit")
        return result
    raise AssertionError("unreachable")  # pragma: no cover


def _settle_once(db, claim, run_id):
    # Every item already committed (checked below under the locks): a cancellation requested
    # now has no remaining effect to stop, so settlement completes (plan 9.2/9.5).
    with db.job(claim["id"], claim["lease_token"], settlement=True) as (c, scope):
        run = _lock(c, scope, run_id)
        pending = [
            r for r in repo.run_actions(c, scope.business_id, run_id=run_id) if r["status"] not in COMPLETED
        ]
        if pending or run["status"] != "running":
            raise ApplicationError(409, "RUN_INCOMPLETE")
        _fence(db, c, claim, settlement=True)
        kind = run["run_kind"]
        reversed_count = None
        if kind == "send_message":
            # Exactly one completed outbound round per fully sent approved batch. A workflow
            # increment is not a financial input change (deal.input_version is untouched).
            c.execute(
                text(
                    "UPDATE deal SET negotiation_round=negotiation_round+1,status='awaiting_reply' "
                    "WHERE business_id=:b AND id=:d"
                ),
                dict(b=scope.business_id, d=run["deal_id"]),
            )
        elif kind == "commit_plan":
            _project(c, scope, run)
            _settlement_row(c, scope, run, "commit")
            c.execute(
                text("UPDATE deal SET status='committed' WHERE business_id=:b AND id=:d"),
                dict(b=scope.business_id, d=run["deal_id"]),
            )
        else:
            reversed_count = _reconcile(c, scope, run)
            _settlement_row(c, scope, run, "compensate")
        c.execute(
            text("UPDATE execution_run SET status='succeeded',finished_at=clock_timestamp() WHERE id=:id"),
            dict(id=run_id),
        )
        if kind == "commit_plan":
            c.execute(
                text("DELETE FROM commitment_gate WHERE business_id=:b AND run_id=:r"),
                dict(b=scope.business_id, r=run_id),
            )
        elif kind == "compensate":
            _release_reversed_gate(c, scope, run)
        append_audit(
            c, scope, "execution_settled", deal_id=run["deal_id"],
            payload={"run_id": str(run_id), "kind": kind, "reversed_projections": reversed_count},
        )
        result = _completed(scope, run_id)
        _finish(c, claim, result)
        fault("before_finalize_commit")
    return result


def _settlement_row(c, scope, run, kind):
    """SQL validates completeness and bumps the business revision exactly once."""
    c.execute(
        text(
            "INSERT INTO commitment_settlement(business_id,deal_id,run_id,settlement_kind) VALUES(:b,:d,:r,:k)"
        ),
        dict(b=scope.business_id, d=run["deal_id"], r=run["id"], k=kind),
    )


def _release_reversed_gate(c, scope, run):
    """An interrupted commit whose every completed effect is now reversed releases its gate."""
    holder = repo.gate_holder(c, scope.business_id)
    if holder is not None and c.execute(
        text(
            """SELECT r.status IN ('partial','failed','cancelled') AND NOT EXISTS(
             SELECT FROM execution_action x WHERE x.run_id=r.id AND x.status IN ('sent','posted','accepted')
              AND NOT EXISTS(SELECT FROM execution_action c JOIN execution_run cr ON cr.id=c.run_id
               WHERE c.business_id=x.business_id AND c.kind='cancellation' AND c.status IN ('sent','posted','accepted')
                AND cr.status='succeeded' AND c.payload->>'original_action_id'=x.id::text))
            FROM execution_run r WHERE r.id=:h AND r.deal_id=:d"""
        ),
        dict(h=holder, d=run["deal_id"]),
    ).scalar_one_or_none():
        c.execute(
            text("DELETE FROM commitment_gate WHERE business_id=:b AND run_id=:r"),
            dict(b=scope.business_id, r=holder),
        )


def _settlement_failed(db, claim, run_id, reason="refused"):
    """Completed effects that cannot be settled correctly keep the gate and need reconciliation."""
    with db.job(claim["id"], claim["lease_token"]) as (c, scope):
        run = _lock(c, scope, run_id)
        status = c.execute(text("SELECT p6_interrupt_run(:r,false)"), dict(r=run_id)).scalar_one()
        append_audit(
            c, scope, "execution_settlement_failed", deal_id=run["deal_id"],
            payload={"run_id": str(run_id), "status": status, "reason": reason},
        )
        result = FailedResult(
            kind="failed",
            error=SafeError(
                code="SETTLEMENT_RECONCILIATION_REQUIRED",
                message="Sandbox effects completed but could not be settled; reconciliation is required.",
                request_id=claim["id"], details=ErrorDetail(), retryable=False,
            ),
        )
        _finish(c, claim, result)
        return result
