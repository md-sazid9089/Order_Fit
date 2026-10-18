"""Single application calculation boundary; provenance is mapped, never calculated here."""

import hashlib
import json
from dataclasses import dataclass

from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.workflow import DatedEvent
from orderfit.engine import analyse
from orderfit.engine.models import EngineInput, Result

SENSITIVITY_PATHS = {
    "deposit_discount_bps_per_10pct": "order.deposit_discount_bps_per_10pct",
    "downside_order_delay_days": "scenarios.downside.order_receipt_delay_days",
    "downside_ar_delay_days": "scenarios.downside.ar_delay_days",
    "severe_cost_overrun_bps": "scenarios.severe.cost_overrun_bps",
    "deposit_lead_days": "strategy_space.deposit_lead_days",
}


def portfolio_trough(opening, events, start, end, delay_days):
    """Reuse the canonical daily outflows-before-inflows sweep for posted cash events.

    This is an absolute liquidity projection, not a new order feasibility verdict.
    The caller supplies bounded, validated dates/amounts and the complete horizon.
    """
    from orderfit.engine.models import CashEvent
    from orderfit.engine.timeline import sweep

    shifted = [
        CashEvent(str(index), event["date"], event["amount"], event["direction"], "other")
        .moved(delay_days if event["delayed"] else 0)
        for index, event in enumerate(events)
    ]
    return min(trough for trough, _ in sweep(opening, shifted, start, end).values())


@dataclass(frozen=True)
class Computation:
    snapshot_hash: str
    reference_input_hash: str
    result: Result


def to_engine_input(snapshot: ConfirmedInputV1) -> EngineInput:
    """No storage query, clock, inferred trust/default policy, generated receipt or loan rows."""
    snapshot = ConfirmedInputV1.model_validate(snapshot.model_dump(mode="python"))
    order = snapshot.order
    selection = snapshot.strategy_space.financing_selection

    def stress(value):
        return {
            "order_receipt_delay_days": value.order_receipt_delay_days,
            "ar_delay_days": value.ar_delay_days,
            "cost_overrun_bps": value.cost_overrun_bps,
            "deposit_follows_customer_delay": value.deposit_follows_delay,
            "order_receipt_haircut_bps": value.order_receipt_haircut_bps,
        }

    return EngineInput.model_validate(
        {
            "as_of": snapshot.start_date,
            "currency": snapshot.currency,
            "exponent": snapshot.exponent,
            "opening_balance": int(snapshot.opening_cash_minor),
            "reserve": int(snapshot.reserve_minor),
            "baseline_events": [
                {
                    "id": e.event_id,
                    "date": e.event_date,
                    "amount": int(e.amount_minor),
                    "direction": e.direction,
                    "kind": e.kind,
                    "certainty": e.certainty,
                    "invoice_ref": e.invoice_ref,
                }
                for e in snapshot.baseline_events
            ],
            "order": {
                "revenue": int(order.order_value_minor),
                "anchor_dates": {
                    "order": order.order_date,
                    "invoice": order.invoice_date,
                    "delivery": order.delivery_date,
                },
                "terms": {
                    "anchor": order.payment_basis,
                    "days": order.payment_days,
                    "convention": order.convention,
                },
                "deposit_discount_bps": order.deposit_discount_bps,
                "deposit_discount_bps_per_10pct": order.deposit_discount_bps_per_10pct,
                "costs": [
                    {
                        "id": c.cost_key,
                        "date": c.event_date,
                        "amount": int(c.amount_minor),
                        "kind": c.kind,
                        "incremental": c.incremental,
                        "deferrable": c.is_deferrable,
                        "invoice_ref": c.invoice_ref,
                    }
                    for c in order.costs
                ],
            },
            "financing_offers": [
                {
                    "offer_id": str(o.offer_id),
                    "name": o.name,
                    "shape": o.kind,
                    "interest_bps": o.interest_bps,
                    "fee_bps": o.fee_bps,
                    "fee_flat": int(o.fee_flat_minor),
                    "fee_at": o.fee_at,
                    "lead_days": o.lead_days,
                    "min": int(selection.amount_minor) if selection and selection.offer_id == o.offer_id else int(o.min_minor),
                    "max": int(selection.amount_minor) if selection and selection.offer_id == o.offer_id else int(o.max_minor),
                    "step": int(o.step_minor),
                    "term_days": o.term_days,
                    "available_from": o.available_from,
                    "valid_until": o.valid_until,
                }
                for o in snapshot.offers
            ],
            "owner": {
                "priorities": snapshot.owner.priorities,
                "min_order_profit": int(snapshot.owner.min_order_profit_minor),
                "max_financing_cost": int(snapshot.owner.max_financing_cost_minor)
                if snapshot.owner.max_financing_cost_minor is not None
                else None,
                "target_scenario": snapshot.owner.target_scenario,
                "close_call_bps": snapshot.owner.close_call_bps,
                "max_deposit_concession_bps": snapshot.owner.max_deposit_concession_bps,
                "max_supplier_extension_days": snapshot.owner.max_supplier_extension_days,
            },
            "strategy_space": {
                "deposit_pcts": snapshot.strategy_space.deposit_pcts,
                "deposit_lead_days": snapshot.strategy_space.deposit_lead_days,
                "extensions": [e.model_dump() for e in snapshot.strategy_space.extensions],
                "offer_ids": [str(i) for i in snapshot.strategy_space.offer_ids],
                "stages": [1],
            },
            "scenarios": {
                "downside": stress(snapshot.scenarios.downside),
                "severe": stress(snapshot.scenarios.severe),
            },
            "scan_days": snapshot.analysis.scan_days,
            "max_work_units": snapshot.analysis.max_work_units,
            "sensitivity": [
                {"path": SENSITIVITY_PATHS[s.field], "values": s.values}
                for s in snapshot.analysis.sensitivity
            ],
        }
    )


def compute(snapshot: ConfirmedInputV1) -> Computation:
    engine_input = to_engine_input(snapshot)
    reference_body = engine_input.model_dump(mode="json", exclude_none=True)
    for key in ("sensitivity", "review_issues", "max_work_units"):
        reference_body.pop(key, None)
    reference_body["case_id"] = str(snapshot.deal_id)
    reference_digest = hashlib.sha256(
        json.dumps(
            reference_body, sort_keys=True, separators=(",", ":"), ensure_ascii=False
        ).encode()
    ).hexdigest()
    return Computation(
        snapshot_hash=canonical_hash(snapshot),
        reference_input_hash=reference_digest,
        result=compute_review(engine_input),
    )


def compute_review(engine_input: EngineInput) -> Result:
    """Same production engine for incomplete review probes; grants no confirmation."""
    return analyse(engine_input)


def dated_commitment_events(result: Result, option_key: str) -> list[DatedEvent]:
    """Exact engine-dated order/financing events of one option under the base scenario.

    A pure mapping of engine output (no arithmetic): customer receipts with their engine
    certainty, incremental costs including any extension surcharge, and fixed-term loan
    draw/fee/interest/repayment. Exact zero residuals (full/rounded deposits or concessions)
    are no cash movement and are omitted. Negative values still fail the positive-money
    contract. Baseline-scope events are excluded; decline has none.
    """
    candidate = next((c for c in result.catalogue if c.strategy.id == option_key), None)
    if candidate is None:
        raise KeyError("option not found")
    if candidate.strategy.kind == "decline":
        return []
    events = [
        DatedEvent(
            event_key=f"{e.scope}:{e.id}",
            scope=e.scope,
            source_id=e.id,
            kind=e.kind,
            event_date=e.date,
            amount_minor=str(e.amount),
            direction=e.direction,
            certainty=e.certainty,
        )
        for e in candidate.events["base"]
        if e.scope in {"order", "financing"} and e.amount != 0
    ]
    keys = [e.event_key for e in events]
    if len(set(keys)) != len(keys):
        raise ValueError("engine produced duplicate dated event identities")
    return sorted(events, key=lambda e: e.event_key)


NOT_EVALUABLE = {"needs_input", "unsupported_escalate", "blocked_data_conflict", "analysis_limit"}


@dataclass(frozen=True)
class ForkOutcome:
    """Plain summary of one isolated engine run; a hypothesis, never a confirmed input."""

    evaluable: bool
    decision: str
    recommended_key: str | None
    profit_minor: int | None


def outcome_of(result: Result) -> ForkOutcome:
    """Pure mapping of an engine Result (no arithmetic)."""
    if result.decision in NOT_EVALUABLE:
        return ForkOutcome(False, result.decision, None, None)
    chosen = next((c for c in result.catalogue if c.strategy.id == result.recommended), None)
    return ForkOutcome(True, result.decision, result.recommended, None if chosen is None else chosen.net_profit)


def evaluate_forks(forks: list[ConfirmedInputV1], run=None) -> list[ForkOutcome]:
    """Evaluate each isolated fork with this module's engine call (or a bounded ``run``).

    ``run`` lets the durable worker substitute its resource-limited wrapper; either way the
    engine is reached only through ``compute``. A fork that fails validation or the
    engine's own checks is reported as not evaluable instead of raising.
    """
    outcomes = []
    for fork in forks:
        try:
            outcomes.append(outcome_of((run or compute)(fork).result))
        except (ValueError, KeyError):
            outcomes.append(ForkOutcome(False, "invalid_fork", None, None))
    return outcomes


async def run(state: dict) -> dict:
    snapshot = state.get("confirmed_input")
    if not isinstance(snapshot, ConfirmedInputV1):
        raise ValueError("A complete confirmed input snapshot is required")
    return {"computation": compute(snapshot)}
