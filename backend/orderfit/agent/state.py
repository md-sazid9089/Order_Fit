"""Checkpointed workflow state, saved after every node."""

from typing import TypedDict

from orderfit.domain import Deal, Flag
from orderfit.engine.models import CashEvent, Result


class PendingAction(TypedDict):
    action_id: str  # idempotency key; send uses it so a retry never sends twice
    kind: str  # email, reply
    text: str  # rendered text after the number and terms guards passed


class WorkflowState(TypedDict, total=False):
    deal: Deal
    events: list[CashEvent]
    result: Result | None
    round: int
    pending_action: PendingAction | None
    flags: list[Flag]
