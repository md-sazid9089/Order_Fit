"""Durable operation admission/recovery. No engine/provider handler is enabled in P1."""

import json
from typing import Literal
from uuid import UUID, uuid4

from pydantic import model_validator
from sqlalchemy import select, text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import DTO, Version
from orderfit.contracts.protocol import IdempotencyMaterial, canonical_hash
from orderfit.contracts.workflow import Operation, OperationAccepted, OperationResult
from orderfit.store.repositories import IdempotencyRepository, append_audit
from orderfit.store.tables import operation


class Admission(DTO):
    kind: Literal[
        "extract", "evaluate", "explain", "draft", "whatif", "reply", "execute", "csv_preview"
    ]
    deal_id: UUID | None
    expected_version: Version | None
    expected_input_version: Version | None
    expected_financial_revision: Version
    snapshot_id: UUID | None
    source_document_id: UUID | None
    parameters: dict | None = None
    config_version: Literal["operation.v1"] = "operation.v1"

    @model_validator(mode="after")
    def scope(self):
        if (self.deal_id is None) != (self.expected_input_version is None) or (
            self.deal_id is None
        ) != (self.expected_version is None):
            raise ValueError("deal versions required exactly for deal scope")
        if self.kind == "evaluate" and (self.snapshot_id is None or self.deal_id is None):
            raise ValueError("evaluation requires confirmed snapshot")
        return self


def operation_dto(row):
    base = f"/api/v1/businesses/{row['business_id']}"
    result = row["result"]
    return Operation(
        operation_id=row["id"],
        deal_id=row["deal_id"],
        status=row["status"],
        input_version=row["input_version"],
        financial_revision=row["financial_revision"],
        poll_url=f"{base}/operations/{row['id']}",
        result_url=result.get("resource_url") if result else None,
        version=row["version"],
        kind=row["kind"],
        subphase=row["subphase"],
        queued_at=row["queued_at"],
        started_at=row["started_at"],
        finished_at=row["finished_at"],
        attempt=row["attempt"],
        cancellation_requested=row["cancellation_requested"],
        result=result,
    )


class Operations:
    def __init__(self, database):
        self.database = database

    def admit(self, token, business_id, key, command: Admission):
        path = f"/api/v1/businesses/{business_id}/internal/{command.kind}"
        with self.database.tenant(token, business_id, "prepare") as (c, scope):
            fingerprint = bytes.fromhex(
                canonical_hash(
                    IdempotencyMaterial(
                        schema_version="idempotency.v1",
                        business_id=business_id,
                        actor_id=scope.user_id,
                        method="POST",
                        path=path,
                        body_hash=canonical_hash(command),
                    )
                )
            )
            cached = IdempotencyRepository.reserve(c, business_id, key, path, fingerprint)
            if cached:
                return OperationAccepted.model_validate(cached)
            business = c.execute(
                text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
                {"b": business_id},
            ).scalar_one()
            if business != command.expected_financial_revision:
                raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
            if command.deal_id:
                deal = (
                    c.execute(
                        text("SELECT * FROM deal WHERE business_id=:b AND id=:d FOR UPDATE"),
                        {"b": business_id, "d": command.deal_id},
                    )
                    .mappings()
                    .one_or_none()
                )
                if not deal:
                    raise ApplicationError(404, "NOT_FOUND")
                if (deal["version"], deal["input_version"]) != (
                    command.expected_version,
                    command.expected_input_version,
                ):
                    raise ApplicationError(409, "STALE_INPUT_VERSION")
                if command.snapshot_id:
                    snapshot = (
                        c.execute(
                            text(
                                "SELECT * FROM input_snapshot WHERE business_id=:b AND deal_id=:d AND id=:s"
                            ),
                            {"b": business_id, "d": command.deal_id, "s": command.snapshot_id},
                        )
                        .mappings()
                        .one_or_none()
                    )
                    if not snapshot or (
                        snapshot["input_version"],
                        snapshot["financial_revision"],
                    ) != (deal["input_version"], business):
                        raise ApplicationError(409, "STALE_SNAPSHOT")
                if (
                    command.source_document_id
                    and not c.execute(
                        text(
                            "SELECT 1 FROM document WHERE business_id=:b AND deal_id=:d AND id=:s"
                        ),
                        {"b": business_id, "d": command.deal_id, "s": command.source_document_id},
                    ).scalar_one_or_none()
                ):
                    raise ApplicationError(404, "NOT_FOUND")
                if command.kind == "evaluate":
                    c.execute(
                        text("UPDATE deal SET status='computing' WHERE id=:d"),
                        {"d": command.deal_id},
                    )
            operation_id = uuid4()
            if command.kind in {"whatif", "draft", "reply"}:
                from orderfit.workflow.preparation import validate_admission
                validate_admission(c, scope, command, operation_id)
            c.execute(
                text(
                    "INSERT INTO operation(id,business_id,deal_id,actor_user_id,session_id,kind,request_hash,input_version,financial_revision,snapshot_id,source_document_id,config_version,parameters) VALUES(:id,:b,:d,:u,:s,:kind,:hash,:iv,:fr,:snapshot,:document,:config,CAST(:params AS jsonb))"
                ),
                {
                    "id": operation_id,
                    "b": business_id,
                    "d": command.deal_id,
                    "u": scope.user_id,
                    "s": scope.session_id,
                    "kind": command.kind,
                    "hash": fingerprint,
                    "iv": command.expected_input_version,
                    "fr": business,
                    "snapshot": command.snapshot_id,
                    "document": command.source_document_id,
                    "config": command.config_version,
                    "params": None if command.parameters is None else json.dumps(command.parameters),
                },
            )
            accepted = OperationAccepted(
                operation_id=operation_id,
                deal_id=command.deal_id,
                status="queued",
                input_version=command.expected_input_version,
                financial_revision=business,
                poll_url=f"/api/v1/businesses/{business_id}/operations/{operation_id}",
                result_url=None,
            )
            IdempotencyRepository.complete(c, business_id, key, accepted.model_dump(mode="json"))
            append_audit(
                c,
                scope,
                "operation_admit",
                deal_id=command.deal_id,
                payload={"operation_id": str(operation_id)},
            )
            return accepted

    def get(self, token, business_id, operation_id):
        with self.database.tenant(token, business_id) as (c, _):
            row = (
                c.execute(
                    select(operation).where(
                        operation.c.business_id == business_id, operation.c.id == operation_id
                    ),
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise ApplicationError(404, "NOT_FOUND")
            return operation_dto(row)

    def cancel(self, token, business_id, operation_id, key, command):
        path = f"/api/v1/businesses/{business_id}/operations/{operation_id}/cancel"
        with self.database.tenant(token, business_id, "prepare") as (c, scope):
            fingerprint = bytes.fromhex(
                canonical_hash(
                    IdempotencyMaterial(
                        schema_version="idempotency.v1",
                        business_id=business_id,
                        actor_id=scope.user_id,
                        method="POST",
                        path=path,
                        body_hash=canonical_hash(command),
                    )
                )
            )
            cached = IdempotencyRepository.reserve(c, business_id, key, path, fingerprint)
            if cached:
                return Operation.model_validate(cached)
            row = (
                c.execute(
                    text(
                        "UPDATE operation SET cancellation_requested=true,version=version+1 WHERE business_id=:b AND id=:id AND version=:v AND status IN ('queued','running') RETURNING *"
                    ),
                    {"b": business_id, "id": operation_id, "v": command.expected_operation_version},
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise ApplicationError(409, "OPERATION_STATE_CONFLICT")
            result = operation_dto(row)
            append_audit(
                c,
                scope,
                "operation_cancel_requested",
                deal_id=row["deal_id"],
                payload={"operation_id": str(operation_id)},
            )
            IdempotencyRepository.complete(c, business_id, key, result.model_dump(mode="json"))
            return result

    def claim(self, worker):
        with self.database.engine.begin() as c:
            row = (
                c.execute(text("SELECT * FROM operation_claim(:worker)"), {"worker": worker})
                .mappings()
                .one_or_none()
            )
            return dict(row) if row else None

    def heartbeat(self, claim):
        with self.database.engine.begin() as c:
            return c.execute(
                text("SELECT operation_heartbeat(:id,:token)"),
                {"id": claim["id"], "token": claim["lease_token"]},
            ).scalar_one()

    def finish(self, claim, result: OperationResult, *, retry=False):
        from pydantic import TypeAdapter

        payload = (
            TypeAdapter(OperationResult)
            .dump_json(TypeAdapter(OperationResult).validate_python(result))
            .decode()
        )
        with self.database.engine.begin() as c:
            return c.execute(
                text("SELECT operation_finish(:id,:token,CAST(:result AS jsonb),:retry)"),
                {
                    "id": claim["id"],
                    "token": claim["lease_token"],
                    "result": payload,
                    "retry": retry,
                },
            ).scalar_one()
