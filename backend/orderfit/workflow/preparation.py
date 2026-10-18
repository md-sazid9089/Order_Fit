"""Durable P5 jobs: computation/provider work outside short publication transactions."""

import asyncio

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import text

from orderfit.agent.llm import LLMSettings, propose_intent, read_reply
from orderfit.api.errors import ApplicationError
from orderfit.contracts.preparation import (
    DraftPreparationRequest,
    ForkRequest,
    ForkView,
    ReplyIntake,
    ReplyReading,
    ReplyView,
)
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.workflow import BlockedResult, CompletedResult, Finding, OperationResult
from orderfit.services.evaluations import build_evaluation_dto, extract_series
from orderfit.services.preparation import bank_change, fork_snapshot, merge_reply, reply_candidates
from orderfit.store.preparation_repository import (
    current_evaluation,
    get_prepared,
    locked,
    one,
    save_draft,
)
from orderfit.store.repositories import append_audit


def blocked(code, outcome="needs_input", message=None):
    return BlockedResult(
        kind="blocked",
        outcome=outcome,
        findings=[
            Finding(
                code=code.replace("_", "-"),
                field=None,
                message=message or "Review the proposed changes and current source terms before continuing.",
                blocking=True,
                resolution="correct_input",
            )
        ],
    )


def validate_admission(c, scope, command, operation_id):
    """Runs atomically with operation/idempotency admission. Never runs a provider."""
    params = command.parameters or {}
    if command.kind == "whatif":
        data = ForkRequest.model_validate(params)
        ev = one(
            c,
            "SELECT id FROM evaluation WHERE business_id=:b AND deal_id=:d AND snapshot_id=:s AND superseded_at IS NULL",
            b=scope.business_id,
            d=command.deal_id,
            s=data.source_snapshot_id,
        )
        _, snapshot = current_evaluation(c, scope.business_id, command.deal_id, ev["id"])
        if data.changes:
            try:
                fork_snapshot(snapshot, data.changes)
            except ValidationError:
                raise ApplicationError(422, "INVALID_FORK_INPUTS") from None
    elif command.kind == "draft":
        data = DraftPreparationRequest.model_validate(params)
        current_evaluation(c, scope.business_id, command.deal_id, data.evaluation_id)
    elif command.kind == "reply":
        data = ReplyIntake.model_validate(params)
        ask = get_prepared(c, scope.business_id, data.ask_message_id)
        if ask.identity.deal_id != command.deal_id or ask.identity.party_id != data.party_id:
            raise ApplicationError(404, "NOT_FOUND")
        # The raw inbound message and fraud hold survive even if worker/provider fails.
        c.execute(
            text(
                "INSERT INTO negotiation_message(id,business_id,deal_id,round,direction,counterparty_kind,body,body_sha256,status,created_by) SELECT :id,:b,id,negotiation_round,'inbound',:role,:body,sha256(convert_to(:body,'UTF8')),'received',:u FROM deal WHERE business_id=:b AND id=:d"
            ),
            dict(
                id=operation_id,
                b=scope.business_id,
                d=command.deal_id,
                role=ask.identity.party_role,
                body=data.body,
                u=scope.user_id,
            ),
        )
        if bank_change(data.body):
            c.execute(
                text(
                    "INSERT INTO deal_flag(business_id,deal_id,kind,code,message,blocking,raised_by,field) VALUES(:b,:d,'fraud','P5-BANK-CHANGE','Bank or beneficiary information in a reply requires separate verification before dispatch.',true,'system','recipient')"
                ),
                dict(b=scope.business_id, d=command.deal_id),
            )
            append_audit(
                c,
                scope,
                "reply_bank_change_blocked",
                deal_id=command.deal_id,
                payload={"reply_id": str(operation_id)},
            )


def run_preparation(operations, claim, job, runtime=None):
    # Imports here avoid coupling the generic runner to a second calculation boundary.
    from orderfit.workflow.worker import bounded_compute

    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        row = one(c, "SELECT parameters FROM operation WHERE id=:id", id=claim["id"])
        params = row["parameters"]
        if job.kind == "whatif":
            data = ForkRequest.model_validate(params)
            ev = one(
                c,
                "SELECT id FROM evaluation WHERE business_id=:b AND deal_id=:d AND snapshot_id=:s AND superseded_at IS NULL",
                b=scope.business_id,
                d=job.deal_id,
                s=data.source_snapshot_id,
            )
            source, snapshot = current_evaluation(c, scope.business_id, job.deal_id, ev["id"])
        elif job.kind == "draft":
            data = DraftPreparationRequest.model_validate(params)
        else:
            data = ReplyIntake.model_validate(params)
    fork = None
    lang_code = None
    provenance = "typed"
    clarification = None
    intent = None
    reply_reading = None
    if job.kind == "whatif":
        changes = data.changes
        if data.instruction:
            intent = asyncio.run(
                propose_intent(
                    data.instruction,
                    canonical_hash(data),
                    runtime.llm if runtime else LLMSettings(),
                )
            )
            changes, provenance, lang_code = intent.changes, intent.provenance, intent.code
            clarification = intent.clarification if not intent.changes else None
        try:
            if clarification:
                # The model asks instead of guessing; nothing is run or changed.
                raise ApplicationError(422, "WHATIF-CLARIFICATION")
            if not changes or len({x.kind for x in changes}) != len(changes):
                raise ApplicationError(422, "UNRESOLVED-WHATIF")
            fork = fork_snapshot(snapshot, changes)
            computation = bounded_compute(fork)
            if computation.result.decision in {
                "analysis_limit",
                "needs_input",
                "unsupported_escalate",
                "blocked_data_conflict",
            }:
                outcome = blocked("FORK-REQUIRES-REVIEW", computation.result.decision)
                series = []
            else:
                outcome = build_evaluation_dto(
                    fork, computation, data.source_snapshot_id, claim["id"]
                )
                series = [
                    extract_series(computation.result, fork, None, scenario, option.option_key)
                    for option in outcome.option_catalogue
                    for scenario in ("base", "downside", "severe")
                ]
        except (ValidationError, ApplicationError) as exc:
            code = getattr(exc, "code", "INVALID-FORK")
            outcome = blocked(code, message=clarification if code == "WHATIF-CLARIFICATION" else None)
            series = []
    elif job.kind == "reply":
        # Provider work happens before the publication transaction.  The model can
        # propose terms, never suppress deterministic bank/injection holds.
        reply_reading = asyncio.run(
            read_reply(data.body, canonical_hash(data), runtime.llm if runtime else LLMSettings())
        )
    # Publication and operation_finish commit together. Fencing/auth are rechecked
    # by Database.job and operation_finish; a lost lease rolls back all evidence.
    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        d, revision = locked(c, scope, job.deal_id)
        if (d["input_version"], revision) != (job.input_version, job.financial_revision):
            result = blocked("STALE-INPUT-VERSION", "stale")
        elif job.kind == "whatif":
            saved = ForkView(
                id=claim["id"],
                deal_id=job.deal_id,
                request=data,
                changes=changes,
                fork_snapshot=fork,
                outcome=outcome,
                source_evaluation_id=source.id,
                source_result=source,
                series=series,
                provenance=provenance,
                language_code=lang_code,
                is_stale=False,
                language_model=intent.model if intent else None,
                language_response_id=intent.response_id if intent else None,
                language_input_hash=canonical_hash(data) if intent else None,
                clarification=clarification,
            )
            c.execute(
                text(
                    "INSERT INTO whatif_run(id,business_id,deal_id,user_id,params,result,snapshot_id,input_version,financial_revision,operation_id) VALUES(:id,:b,:d,:u,CAST(:p AS jsonb),CAST(:r AS jsonb),:s,:iv,:fr,:id)"
                ),
                dict(
                    id=claim["id"],
                    b=scope.business_id,
                    d=job.deal_id,
                    u=scope.user_id,
                    p=data.model_dump_json(),
                    r=saved.model_dump_json(),
                    s=data.source_snapshot_id,
                    iv=job.input_version,
                    fr=job.financial_revision,
                ),
            )
            result = CompletedResult(
                kind="completed",
                resource_id=claim["id"],
                resource_url=f"/api/v1/businesses/{scope.business_id}/whatifs/{claim['id']}",
            )
        elif job.kind == "draft":
            # A changed row version (including a hold) requires explicit retry.
            saved = save_draft(c, scope, job.deal_id, data)
            result = CompletedResult(
                kind="completed",
                resource_id=saved.identity.message_id,
                resource_url=f"/api/v1/businesses/{scope.business_id}/messages/{saved.identity.message_id}",
            )
        else:
            candidates, injection = reply_candidates(data.body)
            from orderfit.services.language import detect
            language_code, _script, language_supported = detect(data.body)
            # An unsupported/unknown reply may contain a payment destination or a
            # qualifying term that the bounded parser cannot safely interpret.
            # Treat it as a review hold; model output can never clear it.
            language_hold = not language_supported
            reading = reply_reading or ReplyReading(provenance="template", code="AI_OFF")
            candidates, baseline, disagreement = merge_reply(data.body, candidates, reading)
            provenance = reading.provenance
            saved = ReplyView(
                id=claim["id"],
                deal_id=job.deal_id,
                ask_message_id=data.ask_message_id,
                party_id=data.party_id,
                body=data.body,
                candidates=candidates,
                bank_change=bank_change(data.body),
                injection_flagged=injection or language_hold,
                provenance=provenance,
                language_code=language_code,
                language_supported=language_supported,
                language_model=reading.model,
                language_response_id=reading.response_id,
                language_input_hash=canonical_hash(data) if provenance != "template" else None,
                language_script=_script,
                conditions=reading.conditions,
                unsupported_clauses=reading.unsupported_clauses,
                model_stance=reading.stance,
                baseline_stance=baseline,
                stance_disagreement=disagreement,
                reviewed=False,
            )
            c.execute(
                text(
                    "INSERT INTO reply_candidate_set(business_id,deal_id,id,ask_message_id,payload,operation_id) VALUES(:b,:d,:id,:ask,CAST(:p AS jsonb),:id)"
                ),
                dict(
                    b=scope.business_id,
                    d=job.deal_id,
                    id=claim["id"],
                    ask=data.ask_message_id,
                    p=saved.model_dump_json(),
                ),
            )
            result = CompletedResult(
                kind="completed",
                resource_id=saved.id,
                resource_url=f"/api/v1/businesses/{scope.business_id}/replies/{saved.id}",
            )
        op = one(c, "SELECT cancellation_requested FROM operation WHERE id=:id", id=claim["id"])
        if op["cancellation_requested"]:
            # Rollback any prepared evidence; outer runner records cancellation.
            raise ApplicationError(409, "OPERATION_CANCELLED")
        append_audit(
            c,
            scope,
            "publish_preparation",
            deal_id=job.deal_id,
            payload={"operation_id": str(claim["id"]), "kind": job.kind},
        )
        finished = c.execute(
            text("SELECT operation_finish(:id,:t,CAST(:r AS jsonb),false)"),
            dict(
                id=claim["id"],
                t=claim["lease_token"],
                r=TypeAdapter(OperationResult).dump_json(result).decode(),
            ),
        ).scalar_one()
        if not finished:
            raise ApplicationError(409, "LEASE_LOST")
    return result
