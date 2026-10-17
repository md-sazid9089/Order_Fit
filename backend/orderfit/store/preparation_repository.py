"""Tenant-scoped immutable preparation and explicit reviewed canonical changes."""

from datetime import UTC, datetime, time, timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import bindparam, text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.preparation import (
    AcceptanceEvidence,
    ForkSummary,
    ForkView,
    PreparationIdentity,
    PreparedMessage,
    ReplyView,
)
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.resources import DealWrite
from orderfit.contracts.workflow import WhatIfChange
from orderfit.services.preparation import (
    COURTESY,
    draft_text,
    fork_snapshot,
    has_exact_acceptance,
    merge_changes,
    terms_hash,
    validate_message,
)
from orderfit.store.repositories import DealRepository, EvaluationRepository, append_audit


def one(c, sql, **params):
    row = c.execute(text(sql), params).mappings().one_or_none()
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    return row


def locked(c, scope, deal_id, command=None):
    b = one(
        c, "SELECT financial_revision FROM business WHERE id=:b FOR UPDATE", b=scope.business_id
    )
    d = one(
        c,
        "SELECT * FROM deal WHERE business_id=:b AND id=:d FOR UPDATE",
        b=scope.business_id,
        d=deal_id,
    )
    if command and (
        command.expected_version,
        command.expected_input_version,
        command.expected_financial_revision,
    ) != (d["version"], d["input_version"], b["financial_revision"]):
        raise ApplicationError(409, "STALE_INPUT_VERSION")
    if d["status"] in {"committed", "closed", "failed", "computing"}:
        raise ApplicationError(409, "PREPARATION_STATE_CONFLICT")
    return d, b["financial_revision"]


def current_evaluation(c, business_id, deal_id, evaluation_id):
    result = EvaluationRepository.get_evaluation(c, business_id, evaluation_id)
    if result.deal_id != deal_id:
        raise ApplicationError(404, "NOT_FOUND")
    if result.is_stale:
        raise ApplicationError(409, "STALE_EVALUATION")
    snapshot = ConfirmedInputV1.model_validate(
        one(
            c,
            "SELECT payload FROM input_snapshot WHERE business_id=:b AND deal_id=:d AND id=:s",
            b=business_id,
            d=deal_id,
            s=result.snapshot_id,
        )["payload"]
    )
    return result, snapshot


def option_for(result, key, require_feasible=True):
    option = next(
        (
            o
            for o in [*result.option_catalogue, result.as_is, *result.ranked_candidates]
            if o.option_key == key
        ),
        None,
    )
    if option is None:
        raise ApplicationError(404, "OPTION_NOT_FOUND")
    if require_feasible and (not option.hard_feasible or option.parameters.kind == "decline"):
        raise ApplicationError(409, "OPTION_NOT_FEASIBLE")
    return option


def _check_party_in_plan(snapshot, option, party_id, role):
    if role == "customer":
        if party_id != snapshot.order.customer_id:
            raise ApplicationError(404, "PARTY_NOT_IN_PLAN")
    elif role == "lender":
        offer = next((o for o in snapshot.offers if o.offer_id == option.parameters.offer_id), None)
        if offer is None or offer.payee_id != party_id:
            raise ApplicationError(404, "PARTY_NOT_IN_PLAN")
    elif not option.parameters.extension.days or not any(
        cost.payee_id == party_id and cost.cost_key in option.parameters.eligible_cost_keys
        for cost in snapshot.order.costs
    ):
        raise ApplicationError(404, "PARTY_NOT_IN_PLAN")


def party(c, business_id, snapshot, option, party_id, role, historical=False):
    _check_party_in_plan(snapshot, option, party_id, role)
    if role == "customer":
        row = one(
            c,
            "SELECT version,known_domains,archived_at,'customer' AS kind FROM customer WHERE business_id=:b AND id=:p",
            b=business_id,
            p=party_id,
        )
        if row["archived_at"] and not historical:
            raise ApplicationError(409, "PARTY_ARCHIVED")
        return row
    row = one(
        c,
        "SELECT version,known_domains,archived_at,kind FROM payee WHERE business_id=:b AND id=:p",
        b=business_id,
        p=party_id,
    )
    if not historical and (row["archived_at"] or row["kind"] != role):
        raise ApplicationError(409, "PARTY_ARCHIVED_OR_CHANGED")
    return row


def get_prepared(c, business_id, message_id):
    row = one(
        c,
        "SELECT * FROM prepared_message WHERE business_id=:b AND id=:id",
        b=business_id,
        id=message_id,
    )
    identity = PreparationIdentity.model_validate(row["payload"])
    ev = EvaluationRepository.get_evaluation(c, business_id, identity.evaluation_id)
    superseded = c.execute(
        text("SELECT 1 FROM prepared_message WHERE business_id=:b AND previous_id=:id"),
        {"b": business_id, "id": message_id},
    ).scalar_one_or_none()
    review = c.execute(
        text(
            "SELECT 1 FROM preparation_review WHERE business_id=:b AND message_id=:id AND preparation_hash=:h"
        ),
        {"b": business_id, "id": message_id, "h": row["content_hash"]},
    ).scalar_one_or_none()
    blockers = [
        r[0]
        for r in c.execute(
            text(
                "SELECT code FROM deal_flag WHERE business_id=:b AND deal_id=:d AND blocking AND resolved_at IS NULL ORDER BY id"
            ),
            {"b": business_id, "d": identity.deal_id},
        )
    ]
    snapshot = ConfirmedInputV1.model_validate(
        one(
            c,
            "SELECT payload FROM input_snapshot WHERE business_id=:b AND id=:s",
            b=business_id,
            s=identity.snapshot_id,
        )["payload"]
    )
    p = party(
        c,
        business_id,
        snapshot,
        identity.option,
        identity.party_id,
        identity.party_role,
        historical=True,
    )
    return _prepared_view(
        identity, row["content_hash"], review, superseded, ev.is_stale, p, blockers
    )


def _prepared_view(identity, content_hash, reviewed, superseded, evaluation_stale, p, blockers):
    # Shared by single-resource reads and batched history; never cached between requests.
    blockers = list(blockers)
    if identity.recipient.rsplit("@", 1)[-1].lower() not in [d.lower() for d in p["known_domains"]]:
        blockers.append("RECIPIENT_DOMAIN_UNVERIFIED")
    stale = (
        evaluation_stale
        or bool(superseded)
        or bool(p["archived_at"])
        or p["kind"] != identity.party_role
        or p["version"] != identity.party_version
        or identity.expires_at <= datetime.now(UTC)
    )
    if stale:
        blockers.append("STALE_PREPARATION")
    return PreparedMessage(
        identity=identity,
        preparation_hash=bytes(content_hash).hex(),
        provenance="manual" if identity.previous_message_id else "template",
        reviewed=bool(reviewed),
        is_stale=stale,
        blockers=blockers,
        edit_sentences=COURTESY,
    )


def list_prepared(c, business_id, deal_id, offset, limit):
    """Bounded history in three reads, without hydrating full evaluation catalogues."""
    rows = (
        c.execute(
            text("""
        SELECT m.payload,m.content_hash,
          (e.input_version<>d.input_version OR e.financial_revision<>b.financial_revision
           OR e.superseded_at IS NOT NULL) AS evaluation_stale,
          EXISTS(SELECT 1 FROM prepared_message newer
            WHERE newer.business_id=m.business_id AND newer.previous_id=m.id) AS superseded,
          EXISTS(SELECT 1 FROM preparation_review r WHERE r.business_id=m.business_id
            AND r.message_id=m.id AND r.preparation_hash=m.content_hash) AS reviewed,
          ARRAY(SELECT f.code FROM deal_flag f WHERE f.business_id=m.business_id
            AND f.deal_id=m.deal_id AND f.blocking AND f.resolved_at IS NULL ORDER BY f.id) AS blockers
        FROM prepared_message m
        JOIN evaluation e ON e.business_id=m.business_id AND e.id=m.evaluation_id
        JOIN deal d ON d.business_id=m.business_id AND d.id=m.deal_id
        JOIN business b ON b.id=m.business_id
        WHERE m.business_id=:b AND m.deal_id=:d ORDER BY m.id LIMIT :limit OFFSET :offset
        """),
            dict(b=business_id, d=deal_id, limit=limit + 1, offset=offset),
        )
        .mappings()
        .all()
    )
    more = len(rows) > limit
    rows = rows[:limit]
    if not rows:
        return [], more
    identities = [PreparationIdentity.model_validate(row["payload"]) for row in rows]
    snapshots = {
        row["id"]: ConfirmedInputV1.model_validate(row["payload"])
        for row in c.execute(
            text("""SELECT id,payload FROM input_snapshot
            WHERE business_id=:b AND deal_id=:d AND id IN :ids""").bindparams(
                bindparam("ids", expanding=True)
            ),
            dict(b=business_id, d=deal_id, ids=list({item.snapshot_id for item in identities})),
        ).mappings()
    }
    parties = {
        (row["source"], row["id"]): row
        for row in c.execute(
            text("""
            SELECT id,version,known_domains,archived_at,'customer' AS kind,'customer' AS source
            FROM customer WHERE business_id=:b AND id IN :ids
            UNION ALL
            SELECT id,version,known_domains,archived_at,kind,'payee' AS source
            FROM payee WHERE business_id=:b AND id IN :ids
            """).bindparams(bindparam("ids", expanding=True)),
            dict(b=business_id, ids=list({item.party_id for item in identities})),
        ).mappings()
    }
    items = []
    for row, identity in zip(rows, identities, strict=True):
        snapshot = snapshots.get(identity.snapshot_id)
        p = parties.get(
            ("customer" if identity.party_role == "customer" else "payee", identity.party_id)
        )
        if snapshot is None or p is None:
            raise ApplicationError(404, "NOT_FOUND")
        _check_party_in_plan(snapshot, identity.option, identity.party_id, identity.party_role)
        items.append(
            _prepared_view(
                identity,
                row["content_hash"],
                row["reviewed"],
                row["superseded"],
                row["evaluation_stale"],
                p,
                row["blockers"],
            )
        )
    return items, more


def save_draft(c, scope, deal_id, command, previous=None):
    d, _ = locked(c, scope, deal_id, command)
    evaluation, snapshot = current_evaluation(c, scope.business_id, deal_id, command.evaluation_id)
    option = option_for(evaluation, command.option_key)
    p = party(c, scope.business_id, snapshot, option, command.party_id, command.party_role)
    if d["negotiation_round"] >= snapshot.owner.max_negotiation_rounds:
        raise ApplicationError(409, "NEGOTIATION_ROUND_LIMIT")
    subject, body = draft_text(snapshot, option)
    old = None
    if previous:
        old = get_prepared(c, scope.business_id, previous)
        if old.identity.deal_id != deal_id:
            raise ApplicationError(404, "NOT_FOUND")
        if old.is_stale or command.expected_preparation_hash != old.preparation_hash:
            raise ApplicationError(409, "STALE_PREPARATION")
        subject, body = command.subject, command.body
        validate_message(subject, body, snapshot, option)
    mid = uuid4()
    now = datetime.now(UTC)
    expiry = now + timedelta(hours=24)
    selected_offer = next(
        (o for o in snapshot.offers if o.offer_id == option.parameters.offer_id), None
    )
    if selected_offer:
        timezone = one(c, "SELECT timezone FROM business WHERE id=:b", b=scope.business_id)[
            "timezone"
        ]
        # Date-only offer validity includes its full final day in business time.
        expiry = min(
            expiry,
            datetime.combine(
                selected_offer.valid_until + timedelta(days=1), time.min, tzinfo=ZoneInfo(timezone)
            ).astimezone(UTC)
            - timedelta(microseconds=1),
        )
        if expiry <= now:
            raise ApplicationError(409, "OFFER_EXPIRED")
    identity = PreparationIdentity(
        message_id=mid,
        business_id=scope.business_id,
        deal_id=deal_id,
        evaluation_id=evaluation.id,
        snapshot_id=evaluation.snapshot_id,
        snapshot_hash=evaluation.snapshot_hash,
        input_version=evaluation.input_version,
        financial_revision=evaluation.financial_revision,
        option=option,
        party_id=command.party_id,
        party_role=command.party_role,
        party_version=p["version"],
        recipient=command.recipient,
        channel=command.channel,
        subject=subject,
        body=body,
        terms_hash=terms_hash(snapshot, option),
        previous_message_id=previous,
        revision=old.identity.revision + 1 if old else 1,
        created_by=scope.user_id,
        created_at=now,
        expires_at=expiry,
    )
    c.execute(
        text(
            "INSERT INTO negotiation_message(id,business_id,deal_id,round,direction,counterparty_kind,channel,subject,body,body_sha256,status,created_by) VALUES(:id,:b,:d,:r,'outbound',:role,:ch,:subject,:body,sha256(convert_to(:body,'UTF8')),'draft',:u)"
        ),
        dict(
            id=mid,
            b=scope.business_id,
            d=deal_id,
            r=d["negotiation_round"],
            role=command.party_role,
            ch=command.channel,
            subject=subject,
            body=body,
            u=scope.user_id,
        ),
    )
    c.execute(
        text(
            "INSERT INTO prepared_message(business_id,deal_id,id,evaluation_id,option_key,previous_id,payload,content_hash) VALUES(:b,:d,:id,:e,:o,:prev,CAST(:payload AS jsonb),:hash)"
        ),
        dict(
            b=scope.business_id,
            d=deal_id,
            id=mid,
            e=evaluation.id,
            o=command.option_key,
            prev=previous,
            payload=identity.model_dump_json(),
            hash=bytes.fromhex(canonical_hash(identity)),
        ),
    )
    append_audit(
        c,
        scope,
        "prepare_message_revision",
        deal_id=deal_id,
        payload={"message_id": str(mid), "hash": canonical_hash(identity)},
    )
    return get_prepared(c, scope.business_id, mid)


def review_prepared(c, scope, message_id, command):
    item = get_prepared(c, scope.business_id, message_id)
    locked(c, scope, item.identity.deal_id, command)
    # Re-read after serializing all preparation writers on the deal.
    item = get_prepared(c, scope.business_id, message_id)
    if item.blockers or item.preparation_hash != command.preparation_hash:
        raise ApplicationError(409, "PREPARATION_REVIEW_BLOCKED")
    c.execute(
        text(
            "INSERT INTO preparation_review(business_id,deal_id,message_id,preparation_hash,recorded_by,attestation) VALUES(:b,:d,:id,:h,:u,:a) ON CONFLICT(message_id) DO NOTHING"
        ),
        dict(
            b=scope.business_id,
            d=item.identity.deal_id,
            id=message_id,
            h=bytes.fromhex(item.preparation_hash),
            u=scope.user_id,
            a=command.attestation,
        ),
    )
    append_audit(
        c,
        scope,
        "review_preparation",
        deal_id=item.identity.deal_id,
        payload={"preparation_hash": item.preparation_hash},
    )
    return get_prepared(c, scope.business_id, message_id)


def get_fork(c, business_id, fork_id):
    row = one(
        c, "SELECT * FROM whatif_run WHERE business_id=:b AND id=:id", b=business_id, id=fork_id
    )
    result = ForkView.model_validate(row["result"])
    d = one(
        c,
        "SELECT input_version FROM deal WHERE business_id=:b AND id=:d",
        b=business_id,
        d=result.deal_id,
    )
    b = one(c, "SELECT financial_revision FROM business WHERE id=:b", b=business_id)
    ev = EvaluationRepository.get_evaluation(c, business_id, result.source_evaluation_id)
    return result.model_copy(
        update={
            "is_stale": ev.is_stale
            or (d["input_version"], b["financial_revision"])
            != (result.request.expected_input_version, result.request.expected_financial_revision)
        }
    )


def get_fork_summary(c, business_id, fork_id):
    # PostgreSQL projects summaries before transferring JSON. History must not load
    # fifty complete candidate/day catalogues into either the API or the browser.
    row = one(
        c,
        """SELECT
      w.result - 'series' - 'fork_snapshot' - 'outcome' - 'source_result' AS metadata,
      w.result->'outcome'->>'kind' AS blocked,
      CASE WHEN w.result->'outcome' ? 'kind' THEN w.result->'outcome'
       ELSE jsonb_build_object('decision',w.result->'outcome'->'decision',
        'recommended_option_key',w.result->'outcome'->'recommended_option_key',
        'as_is',jsonb_build_object('base_incremental_profit_minor',w.result->'outcome'->'as_is'->'base_incremental_profit_minor')) END AS outcome,
      jsonb_build_object('decision',w.result->'source_result'->'decision',
       'recommended_option_key',w.result->'source_result'->'recommended_option_key',
       'as_is',jsonb_build_object('base_incremental_profit_minor',w.result->'source_result'->'as_is'->'base_incremental_profit_minor')) AS source,
      (w.input_version<>d.input_version OR w.financial_revision<>b.financial_revision OR e.superseded_at IS NOT NULL) AS stale
      FROM whatif_run w JOIN deal d ON d.business_id=w.business_id AND d.id=w.deal_id
      JOIN business b ON b.id=w.business_id
      JOIN evaluation e ON e.business_id=w.business_id AND e.id=(w.result->>'source_evaluation_id')::uuid
      WHERE w.business_id=:b AND w.id=:id""",
        b=business_id,
        id=fork_id,
    )
    data = row["metadata"]
    keys = {key: data[key] for key in ("id", "deal_id", "changes", "provenance", "language_code")}
    return ForkSummary(
        **keys, outcome=row["outcome"], source_result=row["source"], is_stale=row["stale"]
    )


def apply_settings(c, scope, deal_id, changes):
    d = one(
        c,
        "SELECT status,analysis_changes FROM deal WHERE business_id=:b AND id=:d",
        b=scope.business_id,
        d=deal_id,
    )
    if d["status"] in {"awaiting_approval", "awaiting_reply"}:
        c.execute(
            text("UPDATE deal SET status='awaiting_confirm' WHERE business_id=:b AND id=:d"),
            dict(b=scope.business_id, d=deal_id),
        )
    merged = merge_changes(d["analysis_changes"], changes)
    c.execute(
        text("UPDATE deal SET analysis_changes=CAST(:p AS jsonb) WHERE business_id=:b AND id=:d"),
        dict(
            b=scope.business_id,
            d=deal_id,
            p=TypeAdapter(list[WhatIfChange]).dump_json(merged).decode(),
        ),
    )


def apply_fork(c, scope, fork_id, command):
    item = get_fork(c, scope.business_id, fork_id)
    locked(c, scope, item.deal_id, command)
    item = get_fork(c, scope.business_id, fork_id)
    if (
        item.is_stale
        or item.fork_snapshot is None
        or not item.changes
        or hasattr(item.outcome, "kind")
    ):
        raise ApplicationError(409, "STALE_OR_BLOCKED_FORK")
    # Rebuild from current actual sources. A stored fork never becomes a confirmed snapshot.
    review = DealRepository.build_review(c, scope.business_id, item.deal_id)
    if review.candidate_snapshot is None:
        raise ApplicationError(409, "INPUT_REVIEW_REQUIRED")
    try:
        fork_snapshot(review.candidate_snapshot, item.changes)
    except ValidationError:
        raise ApplicationError(422, "INVALID_FORK_INPUTS") from None
    apply_settings(c, scope, item.deal_id, item.changes)
    append_audit(
        c, scope, "apply_whatif_for_review", deal_id=item.deal_id, payload={"fork_id": str(fork_id)}
    )
    return DealRepository.get_deal(c, scope.business_id, item.deal_id)


def reset_settings(c, scope, deal_id, command):
    d, _ = locked(c, scope, deal_id, command)
    if d["status"] in {"awaiting_approval", "awaiting_reply"}:
        c.execute(
            text("UPDATE deal SET status='awaiting_confirm' WHERE business_id=:b AND id=:d"),
            dict(b=scope.business_id, d=deal_id),
        )
    c.execute(
        text("UPDATE deal SET analysis_changes='[]'::jsonb WHERE business_id=:b AND id=:d"),
        dict(b=scope.business_id, d=deal_id),
    )
    append_audit(c, scope, "reset_exploration_for_review", deal_id=deal_id)
    return DealRepository.build_review(c, scope.business_id, deal_id)


def get_reply(c, business_id, reply_id):
    row = one(
        c,
        "SELECT payload FROM reply_candidate_set WHERE business_id=:b AND id=:id",
        b=business_id,
        id=reply_id,
    )
    item = ReplyView.model_validate(row["payload"])
    reviewed = c.execute(
        text("SELECT 1 FROM reply_review WHERE business_id=:b AND reply_id=:id"),
        dict(b=business_id, id=reply_id),
    ).scalar_one_or_none()
    return item.model_copy(update={"reviewed": bool(reviewed)})


def review_reply(c, scope, deal_id, reply_id, command):
    locked(c, scope, deal_id, command)
    reply = get_reply(c, scope.business_id, reply_id)
    if reply.deal_id != deal_id:
        raise ApplicationError(404, "NOT_FOUND")
    if reply.reviewed:
        raise ApplicationError(409, "REPLY_ALREADY_REVIEWED")
    candidates = [r for r in reply.candidates if r.id in command.candidate_ids]
    if len(candidates) != len(set(command.candidate_ids)) or len(command.candidate_ids) != len(
        set(command.candidate_ids)
    ):
        raise ApplicationError(422, "INVALID_CANDIDATE_SELECTION")
    if len({x.field for x in candidates}) != len(candidates):
        raise ApplicationError(422, "CONFLICTING_REPLY_TERMS")
    if command.decision == "apply":
        ask = get_prepared(c, scope.business_id, reply.ask_message_id)
        if reply.bank_change or reply.injection_flagged:
            raise ApplicationError(409, "REPLY_REQUIRES_SOURCE_REVIEW")
        if ask.is_stale:
            raise ApplicationError(409, "STALE_PREPARATION")
        role = ask.identity.party_role
        supported = {
            "customer": {"payment_days", "order_value_minor", "deposit_pct"},
            "supplier": {"supplier_extension_days"},
            "lender": {"financing_draw_minor"},
        }
        if not candidates:
            raise ApplicationError(422, "REPLY_REQUIRES_TYPED_REVIEW")
        if any(x.field == "acceptance" for x in candidates):
            raise ApplicationError(422, "RECORD_ACCEPTANCE_SEPARATELY")
        if any(x.field not in supported[role] for x in candidates):
            raise ApplicationError(422, "REPLY_PARTY_TERM_MISMATCH")
        deal = DealRepository.get_deal(c, scope.business_id, deal_id)
        inputs = deal.inputs.model_dump(mode="json")
        changes = []
        for candidate in candidates:
            if candidate.field == "deposit_pct":
                changes.append(
                    TypeAdapter(WhatIfChange).validate_python(
                        dict(kind="deposit_pct", value=int(candidate.value))
                    )
                )
            elif candidate.field == "supplier_extension_days":
                source = DealRepository.build_review(
                    c, scope.business_id, deal_id
                ).candidate_snapshot
                if source is None:
                    raise ApplicationError(409, "INPUT_REVIEW_REQUIRED")
                changes.append(
                    TypeAdapter(WhatIfChange).validate_python(
                        dict(
                            kind="supplier_extension",
                            days=int(candidate.value),
                            eligible_cost_keys=[
                                cost.cost_key
                                for cost in source.order.costs
                                if cost.incremental and cost.is_deferrable
                                and cost.payee_id == ask.identity.party_id
                            ],
                        )
                    )
                )
            elif candidate.field == "financing_draw_minor":
                changes.append(
                    TypeAdapter(WhatIfChange).validate_python(
                        dict(
                            kind="financing",
                            offer_id=ask.identity.option.parameters.offer_id,
                            amount_minor=candidate.value,
                        )
                    )
                )
            else:
                inputs[candidate.field] = (
                    int(candidate.value) if candidate.field == "payment_days" else candidate.value
                )
        if any(x.field in {"payment_days", "order_value_minor"} for x in candidates):
            DealRepository.update_deal(
                c,
                scope,
                deal_id,
                DealWrite(
                    expected_version=command.expected_version,
                    expected_input_version=command.expected_input_version,
                    expected_financial_revision=command.expected_financial_revision,
                    inputs=inputs,
                ),
            )
        if changes:
            source = DealRepository.build_review(c, scope.business_id, deal_id).candidate_snapshot
            if source is None:
                raise ApplicationError(409, "INPUT_REVIEW_REQUIRED")
            try:
                fork_snapshot(source, changes)
            except ValidationError:
                raise ApplicationError(422, "INVALID_REPLY_TERMS") from None
            apply_settings(c, scope, deal_id, changes)
    c.execute(
        text(
            "INSERT INTO reply_review(business_id,deal_id,reply_id,payload,recorded_by) VALUES(:b,:d,:id,CAST(:p AS jsonb),:u)"
        ),
        dict(
            b=scope.business_id,
            d=deal_id,
            id=reply_id,
            p=command.model_dump_json(),
            u=scope.user_id,
        ),
    )
    append_audit(
        c,
        scope,
        "review_reply_candidates",
        deal_id=deal_id,
        payload={
            "reply_id": str(reply_id),
            "decision": command.decision,
            "candidate_ids": [str(x) for x in command.candidate_ids],
        },
    )
    return DealRepository.build_review(c, scope.business_id, deal_id)


def acceptance_current(c, business_id, evidence):
    item = get_prepared(c, business_id, evidence.message_id)
    replaced = c.execute(
        text("SELECT 1 FROM party_acceptance WHERE business_id=:b AND supersedes_id=:id"),
        dict(b=business_id, id=evidence.id),
    ).scalar_one_or_none()
    return evidence.model_copy(
        update={
            "is_stale": item.is_stale
            or bool(item.blockers)
            or bool(replaced)
            or evidence.valid_until <= datetime.now(UTC)
        }
    )


def record_acceptance(c, scope, deal_id, command):
    locked(c, scope, deal_id, command)
    item = get_prepared(c, scope.business_id, command.message_id)
    if item.identity.deal_id != deal_id:
        raise ApplicationError(404, "NOT_FOUND")
    if item.blockers or not item.reviewed or item.preparation_hash != command.preparation_hash:
        raise ApplicationError(409, "ACCEPTANCE_REQUIRES_CURRENT_REVIEW")
    now = datetime.now(UTC)
    if not now < command.valid_until <= item.identity.expires_at:
        raise ApplicationError(422, "INVALID_ACCEPTANCE_EXPIRY")
    if command.reply_id:
        reply = get_reply(c, scope.business_id, command.reply_id)
        if (
            reply.deal_id != deal_id
            or reply.ask_message_id != command.message_id
            or reply.party_id != item.identity.party_id
        ):
            raise ApplicationError(404, "NOT_FOUND")
        if reply.bank_change or reply.injection_flagged:
            raise ApplicationError(409, "REPLY_REQUIRES_SOURCE_REVIEW")
        snapshot = ConfirmedInputV1.model_validate(
            one(
                c,
                "SELECT payload FROM input_snapshot WHERE business_id=:b AND id=:id",
                b=scope.business_id,
                id=item.identity.snapshot_id,
            )["payload"]
        )
        exact_values = {
            "payment_days": str(snapshot.order.payment_days),
            "deposit_pct": str(item.identity.option.parameters.deposit_pct),
            "order_value_minor": snapshot.order.order_value_minor,
            "supplier_extension_days": str(item.identity.option.parameters.extension.days),
            "financing_draw_minor": item.identity.option.parameters.draw_minor,
            "acceptance": "accepted",
        }
        # Recheck preserved source text, including historical candidate sets from
        # before qualification handling changed. Immutable proposals are evidence,
        # not authority to drop a condition when recording a fresh attestation.
        if not has_exact_acceptance(reply.body) or not any(
            x.field == "acceptance" for x in reply.candidates
        ) or any(
            x.value != exact_values[x.field] for x in reply.candidates
        ):
            raise ApplicationError(409, "REPLY_NOT_EXACT_ACCEPTANCE")
    if command.supersedes_id:
        old = AcceptanceEvidence.model_validate(
            one(
                c,
                "SELECT payload FROM party_acceptance WHERE business_id=:b AND deal_id=:d AND id=:id",
                b=scope.business_id,
                d=deal_id,
                id=command.supersedes_id,
            )["payload"]
        )
        if old.party_id != item.identity.party_id or old.party_role != item.identity.party_role:
            raise ApplicationError(409, "INVALID_ACCEPTANCE_SUPERSESSION")
    evidence = AcceptanceEvidence(
        id=uuid4(),
        deal_id=deal_id,
        message_id=command.message_id,
        party_id=item.identity.party_id,
        party_role=item.identity.party_role,
        terms_hash=item.identity.terms_hash,
        preparation_hash=item.preparation_hash,
        reply_id=command.reply_id,
        attestation=command.attestation,
        recorded_by=scope.user_id,
        recorded_at=now,
        valid_until=command.valid_until,
        supersedes_id=command.supersedes_id,
        is_stale=False,
    )
    c.execute(
        text(
            "INSERT INTO party_acceptance(id,business_id,deal_id,message_id,reply_id,supersedes_id,payload) VALUES(:id,:b,:d,:m,:r,:s,CAST(:p AS jsonb))"
        ),
        dict(
            id=evidence.id,
            b=scope.business_id,
            d=deal_id,
            m=command.message_id,
            r=command.reply_id,
            s=command.supersedes_id,
            p=evidence.model_dump_json(),
        ),
    )
    append_audit(
        c,
        scope,
        "record_party_attestation",
        deal_id=deal_id,
        payload={"acceptance_id": str(evidence.id), "terms_hash": evidence.terms_hash},
    )
    return evidence
