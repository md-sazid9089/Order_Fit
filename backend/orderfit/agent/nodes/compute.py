"""Single application calculation boundary; provenance is mapped, never calculated here."""

import hashlib
import json
from dataclasses import dataclass

from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.protocol import canonical_hash
from orderfit.engine import analyse
from orderfit.engine.models import EngineInput, Result

SENSITIVITY_PATHS = {
    "deposit_discount_bps_per_10pct": "order.deposit_discount_bps_per_10pct",
    "downside_order_delay_days": "scenarios.downside.order_receipt_delay_days",
    "downside_ar_delay_days": "scenarios.downside.ar_delay_days",
    "severe_cost_overrun_bps": "scenarios.severe.cost_overrun_bps",
    "deposit_lead_days": "strategy_space.deposit_lead_days",
}


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


async def run(state: dict) -> dict:
    snapshot = state.get("confirmed_input")
    if not isinstance(snapshot, ConfirmedInputV1):
        raise ValueError("A complete confirmed input snapshot is required")
    return {"computation": compute(snapshot)}
