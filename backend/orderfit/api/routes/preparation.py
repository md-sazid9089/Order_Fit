"""Persisted P5 preparation. No route approves, sends or commits anything."""

from uuid import UUID

from fastapi import APIRouter, Query, Request, Response

from orderfit.api.deps import identity_service, mutation, session_token
from orderfit.contracts.preparation import (
    AcceptanceEvidence,
    DraftPreparationRequest,
    DraftRevisionRequest,
    Explanation,
    ForkRequest,
    ForkView,
    OptionCatalogue,
    PreparationReview,
    PreparationState,
    PreparedMessage,
    RecordAcceptance,
    ReplyDecision,
    ReplyIntake,
    ReplyView,
)
from orderfit.contracts.primitives import ExpectedVersions, Page
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.resources import DealView
from orderfit.contracts.workflow import OperationAccepted, Review
from orderfit.services.preparation import explanation
from orderfit.store import preparation_repository as repo
from orderfit.store.repositories import DealRepository, EvaluationRepository, IdempotencyRepository
from orderfit.workflow.operations import Admission

router = APIRouter(prefix="/api/v1/businesses/{business_id}", tags=["preparation"])


def admit(request, business_id, deal_id, data, kind, snapshot_id=None):
    _, key, _ = mutation(request)
    return request.app.state.operations.admit(
        session_token(request),
        business_id,
        key,
        Admission(
            kind=kind,
            deal_id=deal_id,
            expected_version=data.expected_version,
            expected_input_version=data.expected_input_version,
            expected_financial_revision=data.expected_financial_revision,
            snapshot_id=snapshot_id,
            source_document_id=None,
            parameters=data.model_dump(mode="json"),
        ),
    )


def write(request, business_id, data, handler):
    service, key, _ = mutation(request)
    path = str(request.url.path)
    with service.database.tenant(session_token(request), business_id, "prepare") as (c, scope):
        fp = bytes.fromhex(
            canonical_hash(
                IdempotencyMaterial(
                    schema_version="idempotency.v1",
                    business_id=business_id,
                    actor_id=scope.user_id,
                    method=request.method,
                    path=path,
                    body_hash=canonical_hash(data),
                )
            )
        )
        cached = IdempotencyRepository.reserve(c, business_id, key, path, fp)
        if cached:
            return cached
        result = handler(c, scope)
        IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
        return result


@router.post(
    "/deals/{deal_id}/preparation-settings/reset",
    response_model=Review,
    operation_id="preparation_settings_reset",
)
def reset_preparation_settings(
    business_id: UUID, deal_id: UUID, data: ExpectedVersions, request: Request
):
    return write(request, business_id, data, lambda c, s: repo.reset_settings(c, s, deal_id, data))


@router.post(
    "/deals/{deal_id}/whatifs",
    response_model=OperationAccepted,
    status_code=202,
    operation_id="whatif_create",
)
def whatif_create(
    business_id: UUID, deal_id: UUID, data: ForkRequest, request: Request, response: Response
):
    accepted = admit(request, business_id, deal_id, data, "whatif", data.source_snapshot_id)
    response.headers["Location"] = accepted.poll_url
    return accepted


@router.get("/whatifs/{whatif_id}", response_model=ForkView, operation_id="whatif_get")
def whatif_get(business_id: UUID, whatif_id: UUID, request: Request):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        return repo.get_fork(c, business_id, whatif_id)


@router.post("/whatifs/{whatif_id}/apply", response_model=DealView, operation_id="whatif_apply")
def whatif_apply(business_id: UUID, whatif_id: UUID, data: ExpectedVersions, request: Request):
    return write(request, business_id, data, lambda c, s: repo.apply_fork(c, s, whatif_id, data))


@router.get(
    "/evaluations/{evaluation_id}/catalogue",
    response_model=OptionCatalogue,
    operation_id="evaluation_catalogue",
)
def catalogue(business_id: UUID, evaluation_id: UUID, request: Request):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        result = EvaluationRepository.get_evaluation(c, business_id, evaluation_id)
        return OptionCatalogue(
            evaluation_id=result.id,
            options=result.option_catalogue or [result.as_is, *result.ranked_candidates],
            is_stale=result.is_stale,
        )


@router.get(
    "/evaluations/{evaluation_id}/explanation",
    response_model=Explanation,
    operation_id="evaluation_explanation",
)
def explain(
    business_id: UUID,
    evaluation_id: UUID,
    request: Request,
    option_key: str = Query(min_length=1, max_length=80),
):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        result = EvaluationRepository.get_evaluation(c, business_id, evaluation_id)
        option = repo.option_for(result, option_key, require_feasible=False)
        return Explanation(
            evaluation_id=result.id,
            option_key=option_key,
            sentences=explanation(result, option),
            fact_ids=[
                f"{option_key}:profit",
                *[f"{option_key}:{s.scenario}:headroom" for s in option.scenarios],
                f"{option_key}:tolerance",
            ],
            is_stale=result.is_stale,
        )


@router.post(
    "/deals/{deal_id}/drafts",
    response_model=OperationAccepted,
    status_code=202,
    operation_id="draft_create",
)
def draft_create(
    business_id: UUID,
    deal_id: UUID,
    data: DraftPreparationRequest,
    request: Request,
    response: Response,
):
    accepted = admit(request, business_id, deal_id, data, "draft")
    response.headers["Location"] = accepted.poll_url
    return accepted


@router.get("/messages/{message_id}", response_model=PreparedMessage, operation_id="message_get")
def message_get(business_id: UUID, message_id: UUID, request: Request):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        return repo.get_prepared(c, business_id, message_id)


@router.get(
    "/deals/{deal_id}/messages", response_model=Page[PreparedMessage], operation_id="messages"
)
def messages(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        DealRepository.get_deal(c, business_id, deal_id)
        items, more = repo.list_prepared(c, business_id, deal_id, offset, limit)
        return Page[PreparedMessage](
            items=items,
            next_cursor=str(offset + limit) if more else None,
        )


@router.patch("/messages/{message_id}", response_model=PreparedMessage, operation_id="draft_edit")
def draft_edit(business_id: UUID, message_id: UUID, data: DraftRevisionRequest, request: Request):
    def handler(c, scope):
        item = repo.get_prepared(c, business_id, message_id)
        return repo.save_draft(c, scope, item.identity.deal_id, data, message_id)

    return write(request, business_id, data, handler)


@router.post(
    "/messages/{message_id}/review",
    response_model=PreparedMessage,
    operation_id="preparation_review",
)
def preparation_review(
    business_id: UUID, message_id: UUID, data: PreparationReview, request: Request
):
    return write(
        request, business_id, data, lambda c, s: repo.review_prepared(c, s, message_id, data)
    )


@router.post(
    "/deals/{deal_id}/replies",
    response_model=OperationAccepted,
    status_code=202,
    operation_id="reply_create",
)
def reply_create(
    business_id: UUID, deal_id: UUID, data: ReplyIntake, request: Request, response: Response
):
    accepted = admit(request, business_id, deal_id, data, "reply")
    response.headers["Location"] = accepted.poll_url
    return accepted


@router.get("/replies/{reply_id}", response_model=ReplyView, operation_id="reply_get")
def reply_get(business_id: UUID, reply_id: UUID, request: Request):
    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        return repo.get_reply(c, business_id, reply_id)


@router.post(
    "/deals/{deal_id}/replies/{message_id}/review",
    response_model=Review,
    operation_id="reply_review",
)
def reply_review(
    business_id: UUID, deal_id: UUID, message_id: UUID, data: ReplyDecision, request: Request
):
    return write(
        request, business_id, data, lambda c, s: repo.review_reply(c, s, deal_id, message_id, data)
    )


@router.post(
    "/deals/{deal_id}/acceptances",
    response_model=AcceptanceEvidence,
    status_code=201,
    operation_id="acceptance_create",
)
def acceptance_create(business_id: UUID, deal_id: UUID, data: RecordAcceptance, request: Request):
    # Decision: "owner-recorded" (docs/contracts/p5-preparation.md) means a business member
    # records an attestation; it is not independent counterparty authentication. The plan's
    # permission matrix reserves approve/send/commit for risk_officer/owner, and acceptance
    # evidence is preparation work, so prepare-permission roles may record it. It never
    # substitutes for the separate P6 commitment approval.
    return write(
        request, business_id, data, lambda c, s: repo.record_acceptance(c, s, deal_id, data)
    )


@router.get(
    "/deals/{deal_id}/acceptances",
    response_model=Page[AcceptanceEvidence],
    operation_id="acceptances",
)
def acceptances(
    business_id: UUID,
    deal_id: UUID,
    request: Request,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    from sqlalchemy import text

    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        DealRepository.get_deal(c, business_id, deal_id)
        rows = (
            c.execute(
                text(
                    "SELECT payload FROM party_acceptance WHERE business_id=:b AND deal_id=:d ORDER BY id LIMIT :limit OFFSET :offset"
                ),
                dict(b=business_id, d=deal_id, limit=limit + 1, offset=offset),
            )
            .scalars()
            .all()
        )
        return Page[AcceptanceEvidence](
            items=[
                repo.acceptance_current(c, business_id, AcceptanceEvidence.model_validate(r))
                for r in rows[:limit]
            ],
            next_cursor=str(offset + limit) if len(rows) > limit else None,
        )


@router.get(
    "/deals/{deal_id}/preparation",
    response_model=PreparationState,
    operation_id="preparation_state",
)
def preparation_state(
    business_id: UUID, deal_id: UUID, request: Request, offset: int = Query(0, ge=0)
):
    from sqlalchemy import text

    with identity_service(request).database.tenant(session_token(request), business_id, "read") as (
        c,
        _,
    ):
        DealRepository.get_deal(c, business_id, deal_id)
        results = {}
        more = False
        # Table names are constant application code, never request identifiers.
        for table, key, loader in [
            ("whatif_run", "forks", repo.get_fork_summary),
            ("prepared_message", "messages", repo.get_prepared),
            ("reply_candidate_set", "replies", repo.get_reply),
        ]:
            ids = (
                c.execute(
                    text(
                        f"SELECT id FROM {table} WHERE business_id=:b AND deal_id=:d ORDER BY id LIMIT 51 OFFSET :offset"
                    ),
                    dict(b=business_id, d=deal_id, offset=offset),
                )
                .scalars()
                .all()
            )
            more |= len(ids) > 50
            results[key] = [loader(c, business_id, mid) for mid in ids[:50]]
        rows = (
            c.execute(
                text(
                    "SELECT payload FROM party_acceptance WHERE business_id=:b AND deal_id=:d ORDER BY id LIMIT 51 OFFSET :offset"
                ),
                dict(b=business_id, d=deal_id, offset=offset),
            )
            .scalars()
            .all()
        )
        more |= len(rows) > 50
        results["acceptances"] = [
            repo.acceptance_current(c, business_id, AcceptanceEvidence.model_validate(r))
            for r in rows[:50]
        ]
        from orderfit.workflow.operations import operation_dto

        operations = (
            c.execute(
                text(
                    "SELECT * FROM operation WHERE business_id=:b AND deal_id=:d AND kind IN ('whatif','draft','reply') ORDER BY queued_at DESC,id DESC LIMIT 50"
                ),
                dict(b=business_id, d=deal_id),
            )
            .mappings()
            .all()
        )
        results["operations"] = [operation_dto(row) for row in operations]
        return PreparationState(deal_id=deal_id, **results, has_more=more)
