"""P6 sandbox execution admission, read models and compensation preparation.

Admission is one short transaction: business/deal locks, the shared SQL usability predicate,
exact run/action rows copied from the immutable manifest, the durable operation and (for a
commit) the business commitment gate. Effects happen later in the worker, never here.
"""

import hmac
from uuid import UUID, uuid4

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.primitives import Page
from orderfit.contracts.workflow import (
    ActionBundleV1,
    ActionView,
    BundleView,
    CancellationItem,
    EffectView,
    ExecutionRun,
    OperationAccepted,
    SettlementView,
)
from orderfit.services.bundles import BUNDLE_LIFETIME, _versions, bundle_view, encode
from orderfit.store import execution_repository as repo
from orderfit.store.repositories import append_audit

COMPLETED = {"sent", "posted", "accepted"}
# Stable API codes for p6_approval_unusable_reason(); other reasons pass through unchanged.
REASON_CODES = {
    "REVOKED": "APPROVAL_REVOKED",
    "REJECTED": "APPROVAL_REJECTED",
}


def refused(reason):
    if reason == "APPROVAL_NOT_FOUND":
        return ApplicationError(404, "NOT_FOUND")
    return ApplicationError(409, REASON_CODES.get(reason, reason))


def accepted(scope, deal, revision, operation_id, status="queued"):
    base = f"/api/v1/businesses/{scope.business_id}"
    return OperationAccepted(
        operation_id=operation_id,
        deal_id=deal["id"],
        status=status,
        input_version=deal["input_version"],
        financial_revision=revision,
        poll_url=f"{base}/operations/{operation_id}",
        result_url=None,
    )


def _round_limit(c, scope, manifest, deal):
    payload = c.execute(
        text("SELECT payload FROM input_snapshot WHERE business_id=:b AND deal_id=:d AND id=:s"),
        dict(b=scope.business_id, d=manifest.deal_id, s=manifest.snapshot_id),
    ).scalar_one()
    snapshot = ConfirmedInputV1.model_validate(payload)
    if deal["negotiation_round"] >= snapshot.owner.max_negotiation_rounds:
        raise ApplicationError(409, "NEGOTIATION_ROUND_LIMIT")


def _reversal_pending(c, business_id, action_id):
    return c.execute(
        text(
            "SELECT EXISTS(SELECT FROM execution_action x JOIN execution_run r ON r.id=x.run_id "
            "WHERE x.business_id=:b AND x.kind='cancellation' AND x.payload->>'original_action_id'=:a "
            "AND (x.status IN ('sent','posted','accepted') OR r.status IN ('queued','running','partial')))"
        ),
        dict(b=business_id, a=str(action_id)),
    ).scalar_one()


def _kind_conditions(c, scope, manifest, deal):
    if manifest.kind == "send_message":
        _round_limit(c, scope, manifest, deal)
    elif manifest.kind == "commit_plan":
        if not any(i.kind == "commitment" for i in manifest.items):
            raise ApplicationError(409, "COMMIT_PROJECTION_UNAVAILABLE")
        if repo.gate_holder(c, scope.business_id) is not None:
            raise ApplicationError(409, "COMMIT_GATE_HELD")
    else:
        for item in manifest.items:
            row = c.execute(
                text("SELECT status FROM execution_action WHERE business_id=:b AND deal_id=:d AND id=:id"),
                dict(b=scope.business_id, d=manifest.deal_id, id=item.original_action_id),
            ).scalar_one_or_none()
            if row not in COMPLETED:
                raise ApplicationError(409, "ACTION_NOT_COMPLETED")
            if _reversal_pending(c, scope.business_id, item.original_action_id):
                raise ApplicationError(409, "ACTION_ALREADY_REVERSED")


def admit(c, scope, bundle_id, command, key, fingerprint) -> OperationAccepted:
    manifest, digest = repo.load_bundle(c, scope.business_id, bundle_id)
    deal, business = repo.lock_scope(c, scope.business_id, manifest.deal_id)
    _versions(command, deal, business)
    if not hmac.compare_digest(digest, command.bundle_hash):
        raise ApplicationError(409, "BUNDLE_HASH_MISMATCH")
    approval = c.execute(
        text("SELECT id,bundle_id FROM approval WHERE business_id=:b AND id=:id"),
        dict(b=scope.business_id, id=command.approval_id),
    ).mappings().one_or_none()
    if approval is None or approval["bundle_id"] != bundle_id:
        raise ApplicationError(404, "NOT_FOUND")
    revision = business["financial_revision"]
    existing = repo.run_for_bundle(c, scope.business_id, bundle_id)
    if existing is not None:
        # One admitted run per bundle: a double-click or lost response reaches the same run.
        if existing["approval_id"] != command.approval_id:
            raise ApplicationError(409, "RUN_APPROVAL_MISMATCH")
        op_status = repo.operation_status(c, existing["operation_id"])
        if op_status in {"queued", "running"}:
            return accepted(scope, deal, revision, existing["operation_id"], op_status)
        if existing["status"] == "succeeded":
            return accepted(scope, deal, revision, existing["operation_id"], "succeeded")
        if existing["status"] in {"failed", "cancelled"}:
            raise ApplicationError(409, "RUN_TERMINAL")
        # Interrupted run (partial, or its job ended): resume the same run and manifest.
        reason = repo.approval_reason(c, command.approval_id)
        if reason is not None:
            raise refused(reason)
        operation_id = uuid4()
        repo.insert_operation(
            c, operation_id=operation_id, scope=scope, deal=deal, revision=revision,
            run_id=existing["id"], fingerprint=fingerprint,
        )
        repo.resume_run(c, existing["id"], operation_id)
        append_audit(
            c, scope, "execution_resume", deal_id=manifest.deal_id,
            payload={"run_id": str(existing["id"]), "operation_id": str(operation_id)},
        )
        return accepted(scope, deal, revision, operation_id)
    reason = repo.approval_reason(c, command.approval_id)
    if reason is not None:
        raise refused(reason)
    _kind_conditions(c, scope, manifest, deal)
    blocking = [
        r for r in repo.unresolved_runs(c, scope.business_id, manifest.deal_id)
        if r["status"] != "partial" or (r["run_kind"] != "compensate" and manifest.kind != "compensate")
    ]
    if blocking:
        raise ApplicationError(409, "RUN_UNRESOLVED")
    run_id, operation_id = uuid4(), uuid4()
    repo.insert_operation(
        c, operation_id=operation_id, scope=scope, deal=deal, revision=revision, run_id=run_id,
        fingerprint=fingerprint,
    )
    repo.insert_run(
        c, run_id=run_id, manifest=manifest, approval_id=command.approval_id,
        operation_id=operation_id, key=key,
    )
    if manifest.kind == "commit_plan":
        repo.claim_gate(c, scope.business_id, run_id)
    append_audit(
        c, scope, "execution_admit", deal_id=manifest.deal_id,
        payload={"run_id": str(run_id), "bundle_id": str(bundle_id), "operation_id": str(operation_id),
                 "bundle_hash": digest, "kind": manifest.kind},
    )
    return accepted(scope, deal, revision, operation_id)


def _action_view(row) -> ActionView:
    effect = None
    if row["effect_kind"] is not None:
        effect = EffectView(
            effect_kind=row["effect_kind"],
            payload_hash=row["effect_hash"],
            original_action_id=UUID(row["effect_original"]) if row["effect_original"] else None,
            created_at=row["effect_at"],
            sandbox=True,
        )
    return ActionView(
        id=row["id"], run_id=row["run_id"], item_key=row["item_key"], kind=row["kind"],
        status=row["status"], executed_at=row["executed_at"], failure=None, effect=effect,
    )


def run_view(c, scope, run_id) -> ExecutionRun:
    run = repo.run_row(c, scope.business_id, run_id)
    settled = repo.settlement(c, run_id)
    return ExecutionRun(
        id=run["id"], deal_id=run["deal_id"], bundle_id=run["bundle_id"],
        approval_id=run["approval_id"], operation_id=run["operation_id"], run_kind=run["run_kind"],
        status=run["status"],
        actions=[_action_view(r) for r in repo.run_actions(c, scope.business_id, run_id=run_id)],
        reconciliation_required=run["reconciliation_required"], created_at=run["created_at"],
        started_at=run["started_at"], finished_at=run["finished_at"],
        settlement=SettlementView(
            settlement_kind=settled["settlement_kind"], projected_events=settled["projected_events"],
            revision_before=settled["revision_before"], revision_after=settled["revision_after"],
            settled_at=settled["settled_at"],
        ) if settled else None,
        sandbox=True,
    )


def actions_page(c, scope, deal_id, offset, limit) -> Page[ActionView]:
    repo._one(c, "SELECT id FROM deal WHERE business_id=:b AND id=:d", b=scope.business_id, d=deal_id)
    rows = repo.run_actions(c, scope.business_id, deal_id=deal_id, limit=limit + 1, offset=offset)
    return Page[ActionView](
        items=[_action_view(r) for r in rows[:limit]],
        next_cursor=str(offset + limit) if len(rows) > limit else None,
    )


def prepare_compensation(c, scope, deal_id, command) -> BundleView:
    """A separate manifest listing only reversals of completed actions of one run.

    Authority binds the original completed actions/effects and current compensation
    conditions; it deliberately does not require the committed evaluation to be fresh.
    """
    deal, business = repo.lock_scope(c, scope.business_id, deal_id)
    _versions(command, deal, business)
    if len(set(command.original_action_ids)) != len(command.original_action_ids):
        raise ApplicationError(422, "DUPLICATE_ACTION")
    run = repo.run_row(c, scope.business_id, command.original_run_id)
    if run["deal_id"] != deal_id:
        raise ApplicationError(404, "NOT_FOUND")
    if run["run_kind"] == "compensate" or run["status"] not in {"succeeded", "partial"}:
        raise ApplicationError(409, "COMPENSATION_STATE_CONFLICT")
    original, _ = repo.load_bundle(c, scope.business_id, run["bundle_id"])
    rows = {r["id"]: r for r in repo.run_actions(c, scope.business_id, run_id=run["id"])}
    items = []
    for action_id in command.original_action_ids:
        row = rows.get(action_id)
        if row is None:
            raise ApplicationError(404, "NOT_FOUND")
        if row["status"] not in COMPLETED or row["effect_hash"] is None:
            raise ApplicationError(409, "ACTION_NOT_COMPLETED")
        if _reversal_pending(c, scope.business_id, action_id):
            raise ApplicationError(409, "ACTION_ALREADY_REVERSED")
        items.append(
            CancellationItem(
                kind="cancellation", key=f"cancel:{action_id}", original_action_id=action_id,
                original_payload_hash=row["effect_hash"], reason=command.reason,
            )
        )
    now = repo.clock(c)
    manifest = ActionBundleV1(
        schema_version="action-bundle.v1",
        id=uuid4(),
        business_id=scope.business_id,
        deal_id=deal_id,
        evaluation_id=original.evaluation_id,
        option_key=original.option_key,
        snapshot_id=original.snapshot_id,
        snapshot_hash=original.snapshot_hash,
        input_version=deal["input_version"],
        financial_revision=business["financial_revision"],
        source_revisions=original.source_revisions,
        calculator_version=original.calculator_version,
        kind="compensate",
        strategy=original.strategy,
        required_acceptances=[],
        items=sorted(items, key=lambda i: i.key),
        created_by=scope.user_id,
        created_at=now,
        expires_at=now + BUNDLE_LIFETIME,
        sandbox=True,
    )
    raw, digest = encode(manifest)
    repo.insert_bundle(c, manifest, raw, bytes.fromhex(digest))
    append_audit(
        c, scope, "prepare_compensation_bundle", deal_id=deal_id,
        payload={"bundle_id": str(manifest.id), "original_run_id": str(run["id"]),
                 "bundle_hash": digest, "actions": [str(a) for a in command.original_action_ids]},
    )
    return bundle_view(c, scope, manifest.id)
