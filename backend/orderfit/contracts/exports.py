"""Downloadable P3 decision evidence; later execution records are outside this scope."""

from typing import Literal
from uuid import UUID

from pydantic import model_validator

from .financial import ConfirmedInputV1
from .primitives import DTO, BigId, HashHex, Text, UTCInstant
from .protocol import canonical_hash
from .workflow import EvaluationResultV1


class DecisionRecordV1(DTO):
    schema_version: Literal["decision-export.v1"]
    scope: Literal["manual_evaluation"]
    exported_at: UTCInstant
    business_id: UUID
    deal_id: UUID
    snapshot_id: UUID
    snapshot_hash: HashHex
    snapshot: ConfirmedInputV1
    evaluation: EvaluationResultV1
    audit_head_sequence: BigId | None
    audit_head_hash: HashHex | None
    limitations: list[Text]

    @model_validator(mode="after")
    def coherent(self):
        result, snapshot = self.evaluation, self.snapshot
        if not (
            self.business_id == snapshot.business_id == result.business_id
            and self.deal_id == snapshot.deal_id == result.deal_id
            and self.snapshot_id == result.snapshot_id
            and self.snapshot_hash == result.snapshot_hash == canonical_hash(snapshot)
            and result.input_version == snapshot.input_version
            and result.financial_revision == snapshot.financial_revision
        ):
            raise ValueError("decision evidence does not match its confirmed snapshot")
        return self
