"""Pure proposal transforms and closed-grammar language. No persistence or effects."""

import re
from uuid import uuid4

from pydantic import TypeAdapter

from orderfit.agent.guards import numbers, terms
from orderfit.agent.guards.injection import scan
from orderfit.api.errors import ApplicationError
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.preparation import ReplyTerm
from orderfit.contracts.primitives import DTO
from orderfit.contracts.protocol import canonical_hash
from orderfit.contracts.workflow import OptionResult, WhatIfChange

COURTESY = [
    "Hello,",
    "Thank you for considering these proposed terms.",
    "Please review the proposal and reply with any requested changes.",
    "Please confirm agreement to the exact proposed terms.",
    "Kind regards,",
]
SUBJECTS = ["Proposed order terms for review", "Revised order terms for review"]


def merge_changes(previous, changes):
    merged = {c.kind: c for c in TypeAdapter(list[WhatIfChange]).validate_python(previous)}
    merged.update({c.kind: c for c in changes})
    return [merged[k] for k in sorted(merged)]


def fork_snapshot(snapshot: ConfirmedInputV1, changes) -> ConfirmedInputV1:
    """Restrict validated grids or adjust explicit stress; never infer new offers/fees."""
    data = snapshot.model_dump(mode="json")
    for change in changes:
        kind = change.kind
        if kind == "deposit_pct":
            data["strategy_space"]["deposit_pcts"] = [change.value]
        elif kind == "supplier_extension":
            eligible = {c.cost_key for c in snapshot.order.costs if c.is_deferrable}
            if set(change.eligible_cost_keys) != eligible or not eligible:
                raise ApplicationError(422, "UNSUPPORTED_EXTENSION_SUBSET")
            extension = next(
                (e for e in snapshot.strategy_space.extensions if e.days == change.days), None
            )
            if extension is None:
                raise ApplicationError(422, "UNSUPPORTED_EXTENSION_TERMS")
            data["strategy_space"]["extensions"] = [extension.model_dump(mode="json")]
        elif kind == "financing":
            offer = next((o for o in snapshot.offers if o.offer_id == change.offer_id), None)
            amount = int(change.amount_minor)
            if (
                offer is None
                or change.offer_id not in snapshot.strategy_space.offer_ids
                or not int(offer.min_minor) <= amount <= int(offer.max_minor)
                or (amount - int(offer.min_minor)) % int(offer.step_minor)
            ):
                raise ApplicationError(422, "INVALID_FINANCING_GRID")
            data["strategy_space"]["financing_selection"] = dict(
                offer_id=str(change.offer_id), amount_minor=change.amount_minor
            )
            data["strategy_space"]["offer_ids"] = [str(change.offer_id)]
        else:
            field = {
                "customer_delay_days": "order_receipt_delay_days",
                "ar_delay_days": "ar_delay_days",
                "cost_overrun_bps": "cost_overrun_bps",
            }[kind]
            data["scenarios"]["downside"][field] = change.value
            data["scenarios"]["severe"][field] = max(
                change.value, data["scenarios"]["severe"][field]
            )
    return ConfirmedInputV1.model_validate(data)


def deterministic_intent(instruction):
    """Small explicit fallback grammar. Unrecognized prose remains unavailable."""
    patterns = [
        (r"(?:what if )?(?:the )?deposit(?: is| of| at)? (\d{1,3})\s*%[?.]?", "deposit_pct"),
        (
            r"(?:what if )?(?:the )?(?:customer|payment) delay(?: is| of)? (\d{1,3}) days[?.]?",
            "customer_delay_days",
        ),
        (r"(?:what if )?ar delay(?: is| of)? (\d{1,3}) days[?.]?", "ar_delay_days"),
        (r"(?:what if )?cost overrun(?: is| of)? (\d{1,5}) bps[?.]?", "cost_overrun_bps"),
    ]
    for pattern, kind in patterns:
        if match := re.fullmatch(pattern, instruction.strip(), re.I):
            return TypeAdapter(list[WhatIfChange]).validate_python(
                [dict(kind=kind, value=int(match[1]))]
            )
    return []


class TermsIdentity(DTO):
    snapshot_hash: str
    option: OptionResult


def terms_hash(snapshot, option):
    return canonical_hash(TermsIdentity(snapshot_hash=canonical_hash(snapshot), option=option))


def term_lines(snapshot, option):
    p = option.parameters
    lines = [
        "Proposal only; no payment, funding or legal commitment has been executed.",
        f"Order revenue: {snapshot.order.order_value_minor} {snapshot.currency} minor units.",
        f"Final payment: {snapshot.order.payment_days} calendar days after {snapshot.order.payment_basis}.",
        f"Proposed deposit: {p.deposit_pct}% of net revenue under the evaluated concession schedule.",
        f"Supplier extension: {p.extension.days} calendar days; surcharge: {p.extension.surcharge_bps} bps.",
        f"Financing draw: {p.draw_minor} {snapshot.currency} minor units; offer: {p.offer_id or 'none'}.",
        "Eligible supplier obligations: " + (", ".join(p.eligible_cost_keys) or "none") + ".",
        f"Order date: {snapshot.order.order_date}; delivery: {snapshot.order.delivery_date}; invoice: {snapshot.order.invoice_date}.",
        f"Deposit concession: flat {snapshot.order.deposit_discount_bps} bps plus {snapshot.order.deposit_discount_bps_per_10pct} bps per ten percentage points.",
    ]
    offer = next((o for o in snapshot.offers if o.offer_id == p.offer_id), None)
    if offer:
        lines.extend(
            [
                f"Loan interest: {offer.interest_bps} bps flat over {offer.term_days} calendar days.",
                f"Loan fee: {offer.fee_bps} bps plus {offer.fee_flat_minor} {snapshot.currency} minor units, charged at {offer.fee_at}.",
                f"Funding lead: {offer.lead_days} calendar days; available from {offer.available_from}; offer valid through {offer.valid_until}.",
            ]
        )
    return lines


def draft_text(snapshot, option):
    return SUBJECTS[0], "\n".join(
        [COURTESY[0], *term_lines(snapshot, option), COURTESY[2], COURTESY[4]]
    )


def validate_message(subject, body, snapshot, option):
    required = term_lines(snapshot, option)
    # Numbers alone cannot establish their role. Exact typed term lines prevent
    # reassigning a real amount to a different promise, including written numbers.
    if (
        subject not in SUBJECTS
        or terms.check(body, required + COURTESY, required)
        or numbers.check(body, numbers.allowed_values(required, COURTESY))
    ):
        raise ApplicationError(422, "UNSUPPORTED_MESSAGE_CONTENT")


def explanation(evaluation, option):
    return [
        f"Base incremental profit: {option.base_incremental_profit_minor} minor units.",
        f"Assessment decision: {evaluation.decision}; this option passes hard constraints: {option.hard_feasible}.",
        *[
            f"{s.scenario}: lowest headroom {s.lowest_headroom_minor} minor units; hard feasible: {s.hard_feasible}."
            for s in option.scenarios
        ],
        f"Delay test: {option.tolerance.status}; observed safe days {option.tolerance.observed_safe_days}; scan cap {option.tolerance.scan_cap_days} days.",
        "A finite delay scan does not establish survival without payment. Figures depend on confirmed source coverage and assumptions.",
        "Inherited baseline breaches and hard feasibility are separate from the ranking target.",
    ]


def bank_change(body):
    # Conservative signal, not verification or an automatic account update.
    return bool(re.search(r"\b(bank|account|beneficiary|routing|iban|swift)\b", body, re.I))


def reply_candidates(body):
    result = []
    patterns = [
        (r"(?:deposit(?: of| is| at)?\s+)(\d{1,3})\s*%", "deposit_pct"),
        (r"(?:payment(?: within| in| is)?\s+)(\d{1,3})\s+(?:calendar\s+)?days", "payment_days"),
        (
            r"(?:order (?:value|revenue)(?: is| of)?\s+)([1-9]\d*)\s+minor units",
            "order_value_minor",
        ),
        (
            r"(?:supplier extension(?: of| is)?\s+)(\d{1,3})\s+(?:calendar\s+)?days",
            "supplier_extension_days",
        ),
        (r"(?:financing draw(?: of| is)?\s+)([1-9]\d*)\s+minor units", "financing_draw_minor"),
        (r"\b(accept the exact proposed terms)\b", "acceptance"),
    ]
    for pattern, field in patterns:
        for match in re.finditer(pattern, body, re.I):
            value = "accepted" if field == "acceptance" else match[1]
            if field == "deposit_pct" and int(value) > 100:
                continue
            if field in {"payment_days", "supplier_extension_days"} and int(value) > 365:
                continue
            result.append(ReplyTerm(id=uuid4(), field=field, value=value, quote=match[0]))
    return result[:20], bool(scan(body))
