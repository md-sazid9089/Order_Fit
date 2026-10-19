"""Deterministic hardening of model extraction candidates.

Model output can only lower confidence here: a candidate is downgraded to
``ambiguous`` or ``conflicting``, never promoted.  Grounding of quotes, numbers and
dates stays in ``services.documents.quote_supports``.
"""

import re
import unicodedata
from decimal import Decimal, InvalidOperation

from orderfit.agent.guards.injection import scan
from orderfit.contracts.language import Candidate
from orderfit.contracts.workflow import Finding

PAYMENT_BASES = {"order", "invoice", "delivery"}
# Fields with exactly one true value per order; costs/offers may legitimately repeat.
SINGLE_VALUED = {
    "order_value_minor", "opening_cash_minor", "payment_days", "payment_basis",
    "order_date", "invoice_date", "delivery_date",
}


def _finding(code, field, message):
    return Finding(code=code, field=field, message=message, blocking=False, resolution="provide_evidence")


def harden(candidates: list[Candidate]) -> tuple[list[Candidate], list[Finding]]:
    """Return candidates with unsafe 'extracted' claims downgraded, plus explanations."""
    findings: list[Finding] = []
    result: list[Candidate] = []
    for item in candidates:
        if item.field == "payment_days" and item.status == "extracted" and item.normalized_value:
            # Correct a frequent formatting slip without inventing or promoting a
            # candidate: the model sometimes places its explicit day unit in the
            # normalized value. Quote grounding still verifies the number in source.
            day_value = re.fullmatch(
                r"\s*(\d{1,3})\s*(?:calendar\s+)?days?\s*", item.normalized_value, re.I
            )
            if day_value:
                item = item.model_copy(update={"normalized_value": day_value.group(1)})
        if (
            item.field == "payment_basis"
            and item.status == "extracted"
            and item.normalized_value not in PAYMENT_BASES
        ):
            # e.g. "invoice_date" or "net 30": a person must choose the trigger.
            item = item.model_copy(update={"status": "ambiguous"})
            findings.append(_finding("AI-BASIS-UNRECOGNISED", item.field,
                                     "Payment basis is not exactly order, invoice or delivery."))
        result.append(item)
    values: dict[str, set[str]] = {}
    for item in result:
        if item.field in SINGLE_VALUED and item.status == "extracted" and item.normalized_value is not None:
            values.setdefault(item.field, set()).add(item.normalized_value)
    disagreeing = {field for field, found in values.items() if len(found) > 1}
    if disagreeing:
        result = [
            item.model_copy(update={"status": "conflicting"})
            if item.field in disagreeing and item.status == "extracted" else item
            for item in result
        ]
        findings.extend(
            _finding("AI-VALUE-CONFLICT", field, "Different values were proposed for one field.")
            for field in sorted(disagreeing)
        )
    return result, findings


_TOKEN = re.compile(r"\d[\d.,]*\d|\d")


def _values(value: str) -> set[Decimal]:
    """Numeric values in the text with native digits mapped and grouping removed.

    1,000.00 and 3,50,000.00 compare by value, so a gloss may regroup a number but
    cannot introduce one the quote does not contain.
    """
    ascii_text = "".join(
        str(unicodedata.decimal(ch)) if ch.isdecimal() else {"٫": ".", "٬": ","}.get(ch, ch)
        for ch in unicodedata.normalize("NFKC", value)
    )
    found: set[Decimal] = set()
    for token in _TOKEN.findall(ascii_text):
        try:
            found.add(Decimal(token.replace(",", "")).normalize())
        except InvalidOperation:
            found.add(Decimal(re.sub(r"\D", "", token)).normalize())
    return found


def safe_gloss(gloss: str | None, quote: str, quote_language: str) -> str | None:
    """Keep a reviewer-only English gloss only when it cannot carry unsupported content.

    The gloss is never evidence. It is dropped when the quote is already English, when
    it is long, injection-like, or contains a number absent from the quote.
    """
    if not gloss or not gloss.strip() or quote_language == "en" or len(gloss) > 300:
        return None
    if scan(gloss) or not _values(gloss) <= _values(quote):
        return None
    return gloss.strip()
