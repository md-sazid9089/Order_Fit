"""P6 exact-bundle preparation and approval use cases (sandbox only, no effects).

The server builds every manifest from a live evaluated option, the confirmed snapshot and
frozen P5 preparation/acceptance evidence. Clients cannot supply items, amounts, dates,
recipients or hashes with authority: a client hash is only compared with the server hash.
"""

import hashlib
import hmac
from datetime import UTC, datetime, time, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from orderfit.api.errors import ApplicationError
from orderfit.contracts.preparation import AcceptanceEvidence
from orderfit.contracts.protocol import PERMISSIONS, canonical_bytes, canonical_hash
from orderfit.contracts.workflow import (
    AcceptanceRequirement,
    ActionBundleV1,
    ApprovalView,
    BundleView,
    CommitmentItem,
    DatedEvent,
    LedgerItem,
    LenderItem,
    MessageItem,
    ProjectedEvent,
)
from orderfit.services.preparation import terms_hash
from orderfit.store import execution_repository as repo
from orderfit.store.preparation_repository import (
    acceptance_current,
    current_evaluation,
    get_prepared,
    option_for,
)
from orderfit.store.repositories import append_audit

BUNDLE_LIFETIME = timedelta(hours=24)
ACTIONABLE_STATES = {"awaiting_approval", "awaiting_reply"}
COMMITMENT_KEY = "commitment:plan"
RECEIPT_KINDS = {"order_deposit", "order_receipt", "order_final_receipt", "order_stage_receipt"}
LOAN_KINDS = {"loan_draw", "loan_fee", "loan_interest", "loan_repayment"}


def encode(manifest: ActionBundleV1) -> tuple[bytes, str]:
    """Frozen bundle encoding: application canonical JSON v1 (sorted keys, compact, UTF-8)."""
    raw = canonical_bytes(manifest)
    return raw, hashlib.sha256(raw).hexdigest()


def date_end_utc(day, timezone):
    """A date-only expiry includes its whole final day in the business timezone."""
    return datetime.combine(day + timedelta(days=1), time.min, tzinfo=ZoneInfo(timezone)).astimezone(
        UTC
    ) - timedelta(microseconds=1)


def funding_date(snapshot, offer):
    """Frozen contract rule (docs/contracts/README): max(as-of + lead, available_from)."""
    return max(snapshot.start_date + timedelta(days=offer.lead_days), offer.available_from)


def _versions(command, deal, business):
    if (command.expected_version, command.expected_input_version, command.expected_financial_revision) != (
        deal["version"],
        deal["input_version"],
        business["financial_revision"],
    ):
        raise ApplicationError(409, "STALE_INPUT_VERSION")


def _message_items(c, scope, deal_id, evaluation, option_key, message_ids, expiries):
    items, parties = [], set()
    for mid in message_ids:
        prepared = get_prepared(c, scope.business_id, mid)
        identity = prepared.identity
        if identity.deal_id != deal_id:
            raise ApplicationError(404, "NOT_FOUND")
        if identity.evaluation_id != evaluation.id or identity.option.option_key != option_key:
            raise ApplicationError(409, "MESSAGE_OPTION_MISMATCH")
        if prepared.is_stale or prepared.blockers:
            raise ApplicationError(409, "STALE_PREPARATION")
        if not prepared.reviewed:
            raise ApplicationError(409, "PREPARATION_REVIEW_REQUIRED")
        row = repo.message_status(c, scope.business_id, deal_id, mid)
        if row["direction"] != "outbound" or row["status"] != "draft":
            raise ApplicationError(409, "MESSAGE_NOT_DISPATCHABLE")
        party = (identity.party_role, identity.party_id)
        if party in parties:
            raise ApplicationError(422, "DUPLICATE_PARTY_MESSAGE")
        parties.add(party)
        expiries.append(identity.expires_at)
        items.append(
            MessageItem(
                kind="message",
                key=f"message:{mid}",
                message_id=mid,
                party_id=identity.party_id,
                party_version=identity.party_version,
                recipient=identity.recipient,
                channel=identity.channel,
                subject=identity.subject,
                body=identity.body,
                terms_hash=identity.terms_hash,
            )
        )
    return items


def classify_commitment(deal_id, snapshot, option, offer, events: list[DatedEvent]):
    """Pure: bind each stored engine-dated event to its obligation (no recalculation).

    Returns (incremental cost events by cost key, loan events by kind, projected-event
    fields without attribution). Raises 409 when the stored engine output does not describe
    this exact snapshot/option, rather than repairing or re-deriving any amount or date.
    """
    mismatch = ApplicationError(409, "COMMIT_PROJECTION_MISMATCH")
    params = option.parameters
    costs = {c_.cost_key: c_ for c_ in snapshot.order.costs if c_.incremental}
    seen_costs, loans, projected = {}, {}, []
    for event in events:
        if event.scope == "order" and event.kind in RECEIPT_KINDS:
            if event.direction != "in":
                raise mismatch
            extra = dict(
                original_obligation_id=f"commit:{deal_id}:{event.event_key}",
                supersedes_event_id=None,
                payee_id=None,
                customer_id=snapshot.order.customer_id,
            )
        elif event.scope == "order":
            cost = costs.get(event.source_id)
            if (
                cost is None
                or cost.kind != event.kind
                or event.direction != "out"
                or event.source_id in seen_costs
            ):
                raise mismatch
            extended = (
                bool(params.extension.days)
                and cost.is_deferrable
                and cost.cost_key in params.eligible_cost_keys
            )
            due = cost.event_date + timedelta(days=params.extension.days if extended else 0)
            # The engine event must describe this exact cost; a surcharge can only add to it.
            if (
                event.event_date != due
                or int(event.amount_minor) < int(cost.amount_minor)
                or (not extended and int(event.amount_minor) != int(cost.amount_minor))
            ):
                raise mismatch
            seen_costs[event.source_id] = (cost, event)
            extra = dict(
                original_obligation_id=cost.original_obligation_id,
                supersedes_event_id=cost.event_id,
                payee_id=cost.payee_id,
                customer_id=None,
            )
        else:
            if offer is None or event.kind not in LOAN_KINDS or event.kind in loans:
                raise mismatch
            loans[event.kind] = event
            extra = dict(
                original_obligation_id=f"commit:{deal_id}:{event.event_key}",
                supersedes_event_id=None,
                payee_id=offer.payee_id,
                customer_id=None,
            )
        projected.append(event.model_dump() | extra)
    if set(seen_costs) != set(costs):
        raise mismatch
    if offer is not None:
        draw = loans.get("loan_draw")
        if (
            draw is None
            or "loan_repayment" not in loans
            or int(draw.amount_minor) != int(params.draw_minor)
            or draw.event_date != funding_date(snapshot, offer)
        ):
            raise mismatch
    elif loans:
        raise mismatch
    if not any(p["kind"] in RECEIPT_KINDS for p in projected):
        raise mismatch
    return seen_costs, loans, projected


def _commit_items(c, scope, deal_id, evaluation, snapshot, option, offer, expiries):
    """Required exact-term acceptances, payee ledger/lender items and the commitment item."""
    params = option.parameters
    exact_terms = terms_hash(snapshot, option)
    parties = [("customer", snapshot.order.customer_id)]
    costs = {c_.cost_key: c_ for c_ in snapshot.order.costs}
    if params.extension.days:
        suppliers = set()
        for key in params.eligible_cost_keys:
            cost = costs.get(key)
            if cost is None or cost.payee_id is None:
                raise ApplicationError(409, "SUPPLIER_PARTY_UNRESOLVED")
            suppliers.add(cost.payee_id)
        parties += [("supplier", p) for p in suppliers]
    if offer is not None:
        parties.append(("lender", offer.payee_id))
    requirements = []
    for role, party_id in sorted(set(parties), key=lambda p: (p[0], str(p[1]))):
        payload = repo.current_acceptance(
            c, scope.business_id, deal_id, evaluation.id, option.option_key, party_id, role, exact_terms
        )
        if payload is None:
            raise ApplicationError(409, "REQUIRED_ACCEPTANCE_MISSING")
        evidence = acceptance_current(c, scope.business_id, AcceptanceEvidence.model_validate(payload))
        if evidence.is_stale:
            raise ApplicationError(409, "REQUIRED_ACCEPTANCE_STALE")
        expiries.append(evidence.valid_until)
        requirements.append(
            AcceptanceRequirement(
                party_id=party_id, party_role=role, terms_hash=exact_terms, acceptance_id=evidence.id
            )
        )
    stored = repo.option_projection(c, scope.business_id, evaluation.id, option.option_key)
    if stored is None:
        # Evaluations published before engine-dated events were stored cannot be committed:
        # re-evaluate instead of re-deriving receipts, surcharges or loan timing here.
        raise ApplicationError(409, "COMMIT_PROJECTION_UNAVAILABLE")
    events = [DatedEvent.model_validate(e) for e in stored]
    seen_costs, loans, projected = classify_commitment(deal_id, snapshot, option, offer, events)
    items, attributed = [], {}
    for cost_key, (cost, event) in sorted(seen_costs.items()):
        if cost.payee_id is None:
            continue
        payee = repo.payee(c, scope.business_id, cost.payee_id)
        if payee["archived_at"] is not None or payee["kind"] != "supplier":
            raise ApplicationError(409, "PAYEE_UNAVAILABLE")
        accounts = repo.payee_accounts(c, scope.business_id, cost.payee_id)
        if any(a["status"] == "pending" for a in accounts):
            raise ApplicationError(409, "PAYEE_ACCOUNT_CHANGE_PENDING")
        verified = [a for a in accounts if a["status"] == "verified"]
        if len(verified) != 1:
            raise ApplicationError(409, "PAYEE_ACCOUNT_UNVERIFIED")
        key = f"ledger:{cost_key}"
        attributed[event.event_key] = key
        items.append(
            LedgerItem(
                kind="ledger_entry",
                key=key,
                payee_id=cost.payee_id,
                payee_version=payee["version"],
                account_id=verified[0]["id"],
                account_version=verified[0]["version"],
                # Engine output, including any supplier-extension surcharge.
                amount_minor=event.amount_minor,
                scheduled_date=event.event_date,
                direction="out",
                original_obligation_id=cost.original_obligation_id,
            )
        )
    if offer is not None:
        if funding_date(snapshot, offer) > offer.valid_until:
            raise ApplicationError(409, "OFFER_EXPIRED")
        key = f"lender:{offer.offer_id}"
        for event in loans.values():
            attributed[event.event_key] = key
        items.append(
            LenderItem(
                kind="lender_acceptance",
                key=key,
                offer_id=offer.offer_id,
                offer_version=offer.version,
                payee_id=offer.payee_id,
                amount_minor=loans["loan_draw"].amount_minor,
                scheduled_date=loans["loan_draw"].event_date,
                terms_hash=canonical_hash(offer),
            )
        )
    items.append(
        CommitmentItem(
            kind="commitment",
            key=COMMITMENT_KEY,
            evaluation_id=evaluation.id,
            option_key=option.option_key,
            projections=sorted(
                (
                    ProjectedEvent(
                        **p, attributed_item_key=attributed.get(p["event_key"], COMMITMENT_KEY)
                    )
                    for p in projected
                ),
                key=lambda p: p.event_key,
            ),
        )
    )
    return requirements, items


def prepare(c, scope, deal_id, command) -> BundleView:
    deal, business = repo.lock_scope(c, scope.business_id, deal_id)
    _versions(command, deal, business)
    if deal["status"] not in ACTIONABLE_STATES:
        raise ApplicationError(409, "BUNDLE_STATE_CONFLICT")
    evaluation, snapshot = current_evaluation(c, scope.business_id, deal_id, command.evaluation_id)
    option = option_for(evaluation, command.option_key)
    if option.parameters != command.strategy:
        raise ApplicationError(409, "STRATEGY_MISMATCH")
    if repo.blocking_flags(c, scope.business_id, deal_id):
        raise ApplicationError(409, "UNRESOLVED_BLOCKERS")
    if command.kind == "send_message" and deal["negotiation_round"] >= snapshot.owner.max_negotiation_rounds:
        raise ApplicationError(409, "NEGOTIATION_ROUND_LIMIT")
    now = repo.clock(c)
    expiries = [now + BUNDLE_LIFETIME]
    offer = next((o for o in snapshot.offers if o.offer_id == option.parameters.offer_id), None)
    if offer is not None:
        expiries.append(date_end_utc(offer.valid_until, business["timezone"]))
    items = _message_items(
        c, scope, deal_id, evaluation, command.option_key, command.message_ids, expiries
    )
    requirements = []
    if command.kind == "commit_plan":
        requirements, more = _commit_items(c, scope, deal_id, evaluation, snapshot, option, offer, expiries)
        items += more
    expires_at = min(expiries)
    if expires_at <= now:
        raise ApplicationError(409, "BUNDLE_EXPIRED")
    manifest = ActionBundleV1(
        schema_version="action-bundle.v1",
        id=uuid4(),
        business_id=scope.business_id,
        deal_id=deal_id,
        evaluation_id=evaluation.id,
        option_key=option.option_key,
        snapshot_id=evaluation.snapshot_id,
        snapshot_hash=evaluation.snapshot_hash,
        input_version=evaluation.input_version,
        financial_revision=evaluation.financial_revision,
        source_revisions=snapshot.source_revisions,
        calculator_version=evaluation.calculator_version,
        kind=command.kind,
        strategy=option.parameters,
        required_acceptances=requirements,
        items=sorted(items, key=lambda i: i.key),
        created_by=scope.user_id,
        created_at=now,
        expires_at=expires_at,
        sandbox=True,
    )
    raw, digest = encode(manifest)
    repo.insert_bundle(c, manifest, raw, bytes.fromhex(digest))
    append_audit(
        c,
        scope,
        "prepare_action_bundle",
        deal_id=deal_id,
        payload={"bundle_id": str(manifest.id), "kind": manifest.kind, "bundle_hash": digest},
    )
    return bundle_view(c, scope, manifest.id)


def bundle_view(c, scope, bundle_id) -> BundleView:
    manifest, digest = repo.load_bundle(c, scope.business_id, bundle_id)
    reason = repo.bundle_reason(c, bundle_id)
    decided = repo.bundle_decision(c, scope.business_id, bundle_id)
    if reason is None and decided is None and scope.role in PERMISSIONS["execute"]:
        actions = ["step_up", "approve", "reject"]
    else:
        actions = ["view_details"]
    run_id = repo.bundle_run(c, scope.business_id, bundle_id)
    if (
        decided is not None
        and run_id is None
        and scope.role in PERMISSIONS["execute"]
        and repo.approval_reason(c, decided) is None
    ):
        actions = ["execute", "revoke_approval"]
    return BundleView(
        manifest=manifest,
        bundle_hash=digest,
        allowed_actions=actions,
        is_stale=reason is not None,
        stale_reasons=[reason] if reason else [],
        approval_id=decided,
        run_id=run_id,
    )


def _unusable(reason):
    if reason in {"BUNDLE_EXPIRED", "UNRESOLVED_BLOCKERS"}:
        return ApplicationError(409, reason)
    return ApplicationError(409, "STALE_BUNDLE")


def decide(c, scope, bundle_id, command, idempotency_key) -> ApprovalView:
    if command.bundle_id != bundle_id:
        raise ApplicationError(422, "BUNDLE_ID_MISMATCH")
    manifest, digest = repo.load_bundle(c, scope.business_id, bundle_id)
    deal, business = repo.lock_scope(c, scope.business_id, manifest.deal_id)
    _versions(command, deal, business)
    if not hmac.compare_digest(digest, command.bundle_hash):
        raise ApplicationError(409, "BUNDLE_HASH_MISMATCH")
    grant = None
    if command.decision == "approved":
        grant = repo.step_up_grant(c, scope.business_id, command.step_up_grant_id)
        if (
            grant is None
            or grant["user_id"] != scope.user_id
            or grant["session_id"] != scope.session_id
            or grant["bundle_id"] != bundle_id
            or grant["purpose"] != manifest.kind
            or bytes(grant["bundle_hash"]).hex() != digest
            or grant["consumed_at"] is not None
            or not grant["live"]
        ):
            raise ApplicationError(403, "STEP_UP_INVALID")
    if repo.bundle_decision(c, scope.business_id, bundle_id) is not None:
        raise ApplicationError(409, "BUNDLE_ALREADY_DECIDED")
    reason = repo.bundle_reason(c, bundle_id)
    if reason is not None and (command.decision == "approved" or reason == "BUNDLE_EXPIRED"):
        raise _unusable(reason)
    approval_id = uuid4()
    repo.insert_approval(
        c,
        approval_id=approval_id,
        manifest=manifest,
        bundle_hash=digest,
        approver_id=scope.user_id,
        decision=command.decision,
        grant=grant,
        key=idempotency_key,
    )
    append_audit(
        c,
        scope,
        "approve_action_bundle" if command.decision == "approved" else "reject_action_bundle",
        deal_id=manifest.deal_id,
        payload={"approval_id": str(approval_id), "bundle_id": str(bundle_id), "bundle_hash": digest},
    )
    return approval_view(c, scope, approval_id)


def approval_view(c, scope, approval_id) -> ApprovalView:
    row = repo.approval_row(c, scope.business_id, approval_id)
    return ApprovalView(
        id=row["id"],
        bundle_id=row["bundle_id"],
        bundle_hash=bytes(row["action_plan_hash"]).hex(),
        action=row["action"],
        decision=row["decision"],
        approver_id=row["approver_id"],
        created_at=row["created_at"],
        expires_at=row["expires_at"],
        revoked_at=row["revoked_at"],
        is_stale=row["reason"] is not None,
        stale_reasons=[row["reason"]] if row["reason"] else [],
    )


def revoke(c, scope, approval_id, command) -> ApprovalView:
    """Fail-safe brake: a current T3 may always revoke; unrelated revisions do not block it."""
    row = repo.approval_row(c, scope.business_id, approval_id)
    repo.lock_scope(c, scope.business_id, row["deal_id"])
    row = repo.approval_row(c, scope.business_id, approval_id)
    if row["decision"] != "approved":
        raise ApplicationError(409, "APPROVAL_NOT_REVOCABLE")
    if row["revoked_at"] is not None:
        raise ApplicationError(409, "APPROVAL_ALREADY_REVOKED")
    repo.insert_revocation(
        c,
        business_id=scope.business_id,
        deal_id=row["deal_id"],
        approval_id=approval_id,
        actor_id=scope.user_id,
        reason=command.reason,
    )
    append_audit(
        c,
        scope,
        "revoke_approval",
        deal_id=row["deal_id"],
        payload={"approval_id": str(approval_id), "bundle_id": str(row["bundle_id"])},
    )
    return approval_view(c, scope, approval_id)
