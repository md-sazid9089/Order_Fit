"""Synthetic identities and manual evidence; never seeded into a running database."""

from uuid import NAMESPACE_URL, uuid5


def uid(label):
    return str(uuid5(NAMESPACE_URL, "https://orderfit.invalid/contracts/" + label))


def evidence():
    return {
        "document_id": None,
        "content_hash": None,
        "candidate_id": None,
        "confirmed_field_id": None,
        "source_role": "other",
        "page": None,
        "quote": None,
        "manual_attestation": "Synthetic owner attestation for contract testing",
        "override_reason": None,
    }


def loan():
    return {
        "offer_id": uid("offer"),
        "version": 1,
        "name": "Synthetic flat term loan",
        "kind": "term_loan",
        "interest_method": "flat_term",
        "interest_bps": 300,
        "fee_bps": 100,
        "fee_flat_minor": "123",
        "fee_at": "repayment",
        "lead_days": 5,
        "min_minor": "50000000",
        "max_minor": "250000000",
        "step_minor": "10000000",
        "term_days": 90,
        "available_from": "2026-11-02",
        "valid_until": "2027-02-01",
        "status": "active",
        "payee_id": uid("lender"),
        "payee_version": 1,
        "account_id": None,
        "account_version": None,
        "evidence": [evidence()],
    }


def snapshot():
    return {
        "schema_version": "confirmed-input.v1",
        "business_id": uid("business"),
        "deal_id": uid("deal"),
        "input_version": 3,
        "financial_revision": 4,
        "source_revisions": [
            {
                "resource_kind": "document",
                "resource_id": uid("document"),
                "revision": 1,
                "content_hash": "a" * 64,
            }
        ],
        "start_date": "2026-11-02",
        "currency": "BDT",
        "exponent": 2,
        "opening_cash_minor": "215000000",
        "reserve_minor": "60000000",
        "baseline_revision": 4,
        "coverage_through": "2027-12-31",
        "balance_evidence": [evidence()],
        "baseline_events": [
            {
                "event_id": "9007199254740993",
                "event_date": "2026-11-10",
                "amount_minor": "12000000",
                "direction": "out",
                "kind": "rent",
                "certainty": "confirmed",
                "invoice_ref": None,
                "original_obligation_id": "rent-nov",
                "projection_action_id": None,
                "evidence": [evidence()],
            }
        ],
        "order": {
            "customer_id": uid("customer"),
            "customer_version": 1,
            "po_number": "PO-SYNTHETIC",
            "order_value_minor": "360000000",
            "order_date": "2026-11-02",
            "invoice_date": "2026-12-14",
            "delivery_date": "2026-12-14",
            "payment_basis": "delivery",
            "payment_days": 45,
            "convention": "calendar",
            "deposit_discount_bps": 0,
            "deposit_discount_bps_per_10pct": 50,
            "cancellation_clause": None,
            "late_penalty_bps_per_day": None,
            "costs": [
                {
                    "event_id": "2",
                    "cost_key": "materials",
                    "event_date": "2026-11-04",
                    "amount_minor": "220000000",
                    "kind": "supplier_payment",
                    "is_deferrable": True,
                    "incremental": True,
                    "nonincremental_reason": None,
                    "invoice_ref": "MAT-1",
                    "payee_id": uid("supplier"),
                    "original_obligation_id": "materials",
                    "evidence": [evidence()],
                }
            ],
        },
        "offers": [loan()],
        "owner": {
            "constraints_id": uid("constraints"),
            "version": 1,
            "priorities": ["profit", "independence_any", "simplicity"],
            "min_order_profit_minor": "0",
            "max_financing_cost_minor": None,
            "target_scenario": "downside",
            "close_call_bps": 200,
            "max_deposit_concession_bps": None,
            "max_supplier_extension_days": 30,
            "max_negotiation_rounds": 3,
        },
        "strategy_space": {
            "deposit_pcts": [0, 30, 40],
            "deposit_lead_days": 7,
            "extensions": [{"days": 0, "surcharge_bps": 0}, {"days": 30, "surcharge_bps": 0}],
            "offer_ids": [uid("offer")],
            "stages": 1,
        },
        "scenarios": {
            "downside": {
                "order_receipt_delay_days": 15,
                "ar_delay_days": 5,
                "cost_overrun_bps": 0,
                "deposit_follows_delay": True,
                "order_receipt_haircut_bps": 0,
            },
            "severe": {
                "order_receipt_delay_days": 45,
                "ar_delay_days": 15,
                "cost_overrun_bps": 300,
                "deposit_follows_delay": True,
                "order_receipt_haircut_bps": 0,
            },
        },
        "analysis": {
            "scan_days": 90,
            "max_horizon_days": 1095,
            "max_work_units": 100000000,
            "sensitivity": [],
            "uncertainty_questions": [],
        },
        "assumptions": ["Synthetic contract example, not the OF-02 reference case"],
        "conflict_resolutions": [],
        "coverage_acknowledgement": None,
    }


def bundle():
    return {
        "schema_version": "action-bundle.v1",
        "id": uid("bundle"),
        "business_id": uid("business"),
        "deal_id": uid("deal"),
        "evaluation_id": uid("evaluation"),
        "option_key": "opaque-option-1",
        "snapshot_id": uid("snapshot"),
        "snapshot_hash": "a" * 64,
        "input_version": 3,
        "financial_revision": 4,
        "source_revisions": [],
        "calculator_version": "contract-example.v1",
        "kind": "send_message",
        "strategy": {
            "kind": "accept",
            "deposit_pct": 40,
            "extension": {"days": 0, "surcharge_bps": 0},
            "eligible_cost_keys": [],
            "offer_id": None,
            "draw_minor": "0",
        },
        "required_acceptances": [],
        "items": [
            {
                "kind": "message",
                "key": "buyer-ask",
                "message_id": uid("message"),
                "party_id": uid("customer"),
                "party_version": 1,
                "recipient": "buyer@example.invalid",
                "channel": "email",
                "subject": "Synthetic terms",
                "body": "Please review the proposed deposit terms.",
                "terms_hash": "b" * 64,
            }
        ],
        "created_by": uid("user"),
        "created_at": "2026-10-15T00:00:00Z",
        "expires_at": "2026-10-16T00:00:00Z",
        "sandbox": True,
    }
