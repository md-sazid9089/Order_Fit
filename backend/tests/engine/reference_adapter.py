"""Synthetic legacy fixture translation only; production uses the confirmed-input adapter."""

import json
from copy import deepcopy
from pathlib import Path

from orderfit.engine.models import EngineInput

ROOT = Path(__file__).resolve().parents[3] / "docs/architecture/orderfit/fixtures"


def load(label):
    return json.loads((ROOT / "cases" / f"{label}.json").read_text(encoding="utf-8"))


def fixture_input(original):
    raw = deepcopy(original)
    issues = []
    order = raw["order"]
    if "po_total" in order and "quote_total" in order and order["po_total"] != order["quote_total"]:
        issues.append(
            {
                "code": "E-DATA-CONFLICT",
                "message": f"PO total {order['po_total']} != quote total {order['quote_total']}",
            }
        )
    if "line_items" in order:
        total = sum(q * p for q, p in order["line_items"])
        if total != order["revenue"]:
            issues.append(
                {
                    "code": "E-DATA-CONFLICT",
                    "message": f"line items sum {total} != order revenue {order['revenue']}",
                }
            )
    for key in list(order):
        if key not in {
            "revenue",
            "anchor_dates",
            "terms",
            "costs",
            "deposit_discount_bps",
            "deposit_discount_bps_per_10pct",
        }:
            del order[key]
    for cost in order["costs"]:
        cost.setdefault("incremental", True)
        cost.setdefault("deferrable", False)
    raw["strategy_space"].pop("stage_gap_days", None)
    for extension in raw["strategy_space"]["extensions"]:
        extension.setdefault("surcharge_bps", 0)
    for offer in raw["financing_offers"]:
        offer.setdefault("name", offer["offer_id"])
        for key, value in {
            "fee_bps": 0,
            "fee_flat": 0,
            "fee_at": "repayment",
            "lead_days": 0,
            "interest_bps": 0,
        }.items():
            offer.setdefault(key, value)
        if offer["fee_at"] != "draw":
            offer["fee_at"] = "repayment"
    raw["review_issues"] = issues
    for uncertainty in raw.get("uncertain_inputs", []):
        uncertainty.pop("description", None)
    for key in ("case_id", "title", "documents", "named_strategies", "intent"):
        raw.pop(key, None)
    return EngineInput.model_validate(raw)


def comparable(summary):
    raw = deepcopy(summary)
    for key in ("case_id", "calc_version", "input_hash", "named"):
        raw.pop(key, None)
    raw["flags"] = [f for f in raw.get("flags", []) if f["code"] != "F-INJECTION"]
    if "delay_scan_top" in raw:
        raw["delay_scan_top"].pop("status", None)
    if raw["decision"] == "unsupported_escalate":
        raw["escalations"] = [{"code": e["code"]} for e in raw["escalations"]]
    return raw
