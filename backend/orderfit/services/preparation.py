"""Pure proposal transforms and closed-grammar language. No persistence or effects."""

import re
import unicodedata
from uuid import uuid4

from pydantic import TypeAdapter, ValidationError

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
            eligible = {
                c.cost_key for c in snapshot.order.costs if c.incremental and c.is_deferrable
            }
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
    """Small explicit fallback grammar. Unrecognized prose remains unavailable.

    Multiple independently explicit changes may be combined with ``and``.  This
    never guesses an offer, recipient, financing amount, or omitted selector.
    """
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
    combined = [
        (r"(?:the )?deposit(?: is| of| at)?\s+(\d{1,3})\s*(?:%|percent)", "deposit_pct"),
        (r"(?:the )?(?:customer|buyer|payment) (?:delay(?: is| of)?\s+|pays?\s+)(\d{1,3})\s+days?(?:\s+late)?", "customer_delay_days"),
        (r"(?:the )?ar delay(?: is| of)?\s+(\d{1,3})\s+days?", "ar_delay_days"),
        (r"(?:the )?cost overrun(?: is| of)?\s+(\d{1,5})\s+(?:bps|basis points?)", "cost_overrun_bps"),
    ]
    remainder = instruction.strip().lower()
    extracted = []
    for pattern, kind in combined:
        for match in list(re.finditer(pattern, remainder, re.I)):
            extracted.append((kind, int(match[1])))
        remainder = re.sub(pattern, " ", remainder, flags=re.I)
    remainder = re.sub(r"\b(?:what|if|explore|try|assume|model|set|use|and|with|a|an|the)\b|[?.,;:]", " ", remainder)
    if remainder.strip() or not extracted or len({kind for kind, _ in extracted}) != len(extracted):
        return []
    try:
        return TypeAdapter(list[WhatIfChange]).validate_python(
            [dict(kind=kind, value=value) for kind, value in extracted]
        )
    except ValidationError:
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


# Characters that survive NFKC but look like Latin letters (common homoglyph spoofing).
_CONFUSABLES = str.maketrans(
    {
        "а": "a", "е": "e", "о": "o", "р": "p", "с": "c",
        "х": "x", "у": "y", "і": "i", "ј": "j", "һ": "h",
        "ѕ": "s", "ԁ": "d", "ɡ": "g", "ο": "o", "α": "a",
        "ι": "i", "ν": "v", "ı": "i", "Α": "a", "Β": "b",
        "Ε": "e", "Ι": "i", "Κ": "k", "Μ": "m", "Ν": "n",
        "Ο": "o", "Ρ": "p", "Τ": "t", "Χ": "x", "А": "a",
        "В": "b", "Е": "e", "К": "k", "М": "m", "Н": "h",
        "О": "o", "Р": "p", "С": "c", "Т": "t", "Х": "x",
    }
)
_BANK_TERMS = re.compile(
    r"(?<![a-z0-9])(?:"
    r"bank|banking|account|accounts|acct|a\s*/\s*c|beneficiary|routing|iban|swift|bic|bsb|"
    r"sort\s*code|ifsc|ach|aba|wire|wiring|remit|remits|remitted|remittance|wallet|"
    r"bkash|nagad|rocket|payee|payment\s+(?:details|instructions?|info|information)|"
    r"pay\s+(?:to|into)|transfer\s+(?:to|into)|new\s+(?:details|payee|bank|account)"
    r"|ব্যাংক|হিসাব|অ্যাকাউন্ট|প্রাপক|রেমিট|বিকাশ|নগদ|রকেট"
    r"|बैंक|खाता|खाते|लाभार्थी|भुगतान\s+(?:विवरण|जानकारी|निर्देश)|प्रेषण"
    r"|银行|账户|账号|收款人|收款账|汇款|转账|付款(?:信息|详情|账户|方式)"
    r")(?![a-z0-9])"
)
_SPACED_LETTERS = re.compile(r"(?<![a-z0-9])(?:[a-z][\s.\-_*]+){2,}[a-z](?![a-z0-9])")


def _normalize_for_signals(body: str) -> str:
    text = unicodedata.normalize("NFKC", body)
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Cc"} or ch in "\n\t")
    return re.sub(r"\s+", " ", text.translate(_CONFUSABLES).casefold())


def bank_change(body):
    """Fail-closed signal, not verification or an automatic account update.

    Matches payment-destination vocabulary after Unicode normalization (NFKC, zero-width
    removal, common Cyrillic/Greek homoglyph folding, case/whitespace folding) and also
    after rejoining letters spread out as "b a n k" or "b.a.n.k". False positives only
    create a human-review blocker.
    """
    text = _normalize_for_signals(body)
    rejoined = _SPACED_LETTERS.sub(lambda m: re.sub(r"[\s.\-_*]+", "", m.group()), text)
    return bool(_BANK_TERMS.search(text) or _BANK_TERMS.search(rejoined))


_NEGATION = re.compile(
    r"\b(?:not|never|cannot|can't|cant|won't|wont|don't|dont|doesn't|doesnt|didn't|unable|"
    r"decline|declines|declined|reject|rejects|rejected|refuse|refuses|refused|no longer|"
    r"without|neither|nor|if|unless|provided|subject to|would|might|may|could)\b|n't\b",
    re.I,
)
_QUALIFICATION = re.compile(
    r"\b(?:but|except|pending|contingent|conditional|conditionally|provisional|provisionally|"
    r"assuming|once|only\s+(?:after|when)|in\s+principle)\b",
    re.I,
)
_EXACT_ACCEPTANCE = r"\b(accept the exact proposed terms)\b"


def _qualified(body, match):
    """Reject conditions before or after an apparent exact acceptance.

    Later sentences can qualify the acceptance too. This conservative parser may
    require manual attestation for harmless prose; it must not discard a condition
    and turn only the quoted acceptance phrase into evidence of unconditional assent.
    Earlier unrelated sentences do not negate a later, explicit acceptance.
    """
    start = max(body.rfind(c, 0, match.start()) for c in ".\n!?")
    context = body[start + 1 : match.start()] + " " + body[match.end() :]
    return bool(_NEGATION.search(context) or _QUALIFICATION.search(context))


def has_exact_acceptance(body):
    """Whether source text contains an unqualified exact-terms acceptance candidate."""
    return any(
        not _qualified(body, match)
        for match in re.finditer(_EXACT_ACCEPTANCE, body, re.I)
    )


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
        (_EXACT_ACCEPTANCE, "acceptance"),
    ]
    for pattern, field in patterns:
        for match in re.finditer(pattern, body, re.I):
            if field == "acceptance" and _qualified(body, match):
                continue  # negated/conditional wording is never an acceptance candidate
            value = "accepted" if field == "acceptance" else match[1]
            if field == "deposit_pct" and int(value) > 100:
                continue
            if field in {"payment_days", "supplier_extension_days"} and int(value) > 365:
                continue
            result.append(ReplyTerm(id=uuid4(), field=field, value=value, quote=match[0]))
    return result[:20], bool(scan(body))


_REJECTION = re.compile(
    r"\b(?:decline[sd]?|reject(?:s|ed)?|refuse[sd]?)\b|"
    r"\b(?:do(?:es)? not|don't|doesn't|cannot|can't|unable to)\s+(?:accept|agree|approve)\b",
    re.I,
)


def baseline_stance(body, candidates):
    """Deterministic English stance used only to display reviewer disagreement."""
    if has_exact_acceptance(body):
        return "accept"
    if _REJECTION.search(body):
        return "reject"
    if any(term.field != "acceptance" for term in candidates):
        return "partial"
    return "unclear"


def merge_reply(body, baseline, reading):
    """Combine regex baseline candidates with a validated model reading.

    The model contributes extra supported terms and review attention only. Conditions,
    unsupported clauses or a reject/partial stance remove any acceptance candidate
    (a hold); nothing the model says can add acceptance or clear a deterministic flag.
    Returns (candidates, baseline_stance, stance_disagreement).
    """
    from orderfit.services.language import detect

    # A reply in an unsupported or mixed language is a human-review hold. The model
    # can still help label the language, but its interpretation must not become a
    # candidate fact until a reviewer can read and confirm the source.
    if not detect(body)[2]:
        return list(baseline), baseline_stance(body, baseline), False

    seen = {(t.field, t.value, t.quote) for t in baseline}
    merged = list(baseline) + [t for t in reading.terms if (t.field, t.value, t.quote) not in seen]
    if reading.conditions or reading.unsupported_clauses or reading.stance in {"reject", "partial"}:
        merged = [t for t in merged if t.field != "acceptance"]
    stance = baseline_stance(body, baseline)
    disagreement = reading.stance is not None and reading.stance != stance
    return merged[:20], stance, disagreement
