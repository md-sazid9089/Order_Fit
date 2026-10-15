"""Evaluation result and series read routes."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.deps import identity_service, session_token
from orderfit.contracts.workflow import EvaluationResultV1, Series
from orderfit.store.repositories import EvaluationRepository

router = APIRouter(prefix="/api/v1/businesses/{business_id}/evaluations")


@router.get("/{evaluation_id}", response_model=EvaluationResultV1, operation_id="evaluation_get")
def get_evaluation(business_id: UUID, evaluation_id: UUID, request: Request):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return EvaluationRepository.get_evaluation(c, business_id, evaluation_id)


@router.get("/{evaluation_id}/series", response_model=Series, operation_id="evaluation_series")
def get_evaluation_series(
    business_id: UUID,
    evaluation_id: UUID,
    request: Request,
    scenario: str = Query("base"),
    option_key: str | None = Query(None),
):
    service = identity_service(request)
    with service.database.tenant(session_token(request), business_id, "read") as (c, _):
        return EvaluationRepository.get_evaluation_series(
            c, business_id, evaluation_id, scenario=scenario, option_key=option_key
        )
