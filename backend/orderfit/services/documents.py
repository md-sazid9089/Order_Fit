"""Pure upload validation, parsing and extraction checks (no database, no network).

Document bytes are untrusted data. Nothing here executes content or fetches embedded URLs.
"""

import csv
import io
import json
import re
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation

from orderfit.agent.guards.injection import scan

PARSER_VERSION = "p4.1"
MAX_PAGES = 50
MAX_PAGE_CHARS = 100_000
MAX_CSV_ROWS = 2000
ALLOWED_MIME = {"application/pdf", "text/plain", "text/csv", "application/json"}
GENERATED_KINDS = {
    "order_deposit", "order_receipt", "order_final_receipt", "order_stage_receipt",
    "loan_draw", "loan_fee", "loan_interest", "loan_repayment",
}
CSV_KINDS = {
    "payroll", "rent", "tax", "ap_payment", "ar_collection", "loan_installment",
    "supplier_payment", "labour", "freight", "subcontract", "existing_inventory", "other",
}


class UploadRejected(Exception):
    def __init__(self, code: str):
        self.code = code


@dataclass
class ParseResult:
    parser: str
    status: str  # parsed | failed | ocr_required
    pages: list[str] = field(default_factory=list)
    error_code: str | None = None


def sniff_mime(data: bytes, declared: str) -> str:
    """Trust bytes over the declared type; reject mismatches and unsupported types."""
    declared = (declared or "").split(";")[0].strip().lower()
    if declared not in ALLOWED_MIME:
        raise UploadRejected("UNSUPPORTED_MEDIA_TYPE")
    if data.startswith(b"%PDF-"):
        actual = "application/pdf"
    elif data.startswith(b"PK\x03\x04") or b"\x00" in data[:4096]:
        raise UploadRejected("UNSUPPORTED_MEDIA_TYPE")
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise UploadRejected("UNSUPPORTED_MEDIA_TYPE") from None
        stripped = text.lstrip()
        if declared == "application/json" or (stripped[:1] in "{[" and declared != "text/csv"):
            try:
                json.loads(text)
                actual = "application/json"
            except ValueError:
                actual = "text/plain" if declared == "text/plain" else "invalid"
        else:
            actual = declared if declared in {"text/csv", "text/plain"} else "invalid"
    if actual != declared:
        raise UploadRejected("MIME_MISMATCH")
    return actual


def parse(data: bytes, mime: str) -> ParseResult:
    try:
        if mime == "application/pdf":
            return _parse_pdf(data)
        text = data.decode("utf-8-sig")
        parser = {"text/plain": "plain_text", "text/csv": "csv", "application/json": "json"}[mime]
        if mime == "application/json":
            text = json.dumps(json.loads(text), indent=1, sort_keys=True)
        pages = _paginate(text)
        if not any(p.strip() for p in pages):
            return ParseResult(parser, "failed", [], "EMPTY_TEXT")
        return ParseResult(parser, "parsed", pages)
    except (ValueError, UnicodeDecodeError):
        return ParseResult("plain_text", "failed", [], "MALFORMED")


def _paginate(text: str) -> list[str]:
    pages = [text[i : i + MAX_PAGE_CHARS] for i in range(0, len(text), MAX_PAGE_CHARS)] or [""]
    if len(pages) > MAX_PAGES:
        raise ValueError("too many pages")
    return pages


def _parse_pdf(data: bytes) -> ParseResult:
    try:
        from pypdf import PdfReader  # lazy: optional until a PDF is parsed

        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            return ParseResult("pdf_text", "failed", [], "ENCRYPTED")
        if len(reader.pages) > MAX_PAGES:
            return ParseResult("pdf_text", "failed", [], "TOO_MANY_PAGES")
        pages = [(p.extract_text() or "")[:MAX_PAGE_CHARS] for p in reader.pages]
    except Exception:  # malformed input must never escape as a server error
        return ParseResult("pdf_text", "failed", [], "MALFORMED")
    if not any(p.strip() for p in pages):
        return ParseResult("pdf_text", "ocr_required", [], "NO_TEXT_LAYER")
    return ParseResult("pdf_text", "parsed", pages)


# ---------------------------------------------------------------- candidate validation
def _norm(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


NUMERIC_FIELDS = {"order_value_minor", "opening_cash_minor", "payment_days"}
DATE_FIELDS = {"order_date", "invoice_date", "delivery_date"}


def quote_supports(field_name: str, value: str | None, quote: str, page_text: str) -> str:
    """Return 'ok', 'quote_mismatch' or 'ambiguous'. The quote must appear in the page text."""
    if _norm(quote) not in _norm(page_text) or not quote.strip():
        return "quote_mismatch"
    if value is None:
        return "ok"
    if field_name in NUMERIC_FIELDS:
        digits = re.sub(r"[^0-9]", "", value)
        quoted = re.sub(r"[^0-9]", "", quote)
        if field_name == "payment_days":
            return "ok" if digits and digits in quoted else "quote_mismatch"
        # minor units: quote must contain the major amount (value / 100)
        if not digits or not value.isdigit():
            return "quote_mismatch"
        major = Decimal(int(value)) / 100
        forms = {f"{major:.2f}", f"{major:.0f}"} if major == major.to_integral() else {f"{major:.2f}"}
        compact = re.sub(r"[,\s]", "", quote)
        return "ok" if any(f in compact or f.rstrip("0").rstrip(".") in compact for f in forms) else "quote_mismatch"
    if field_name in DATE_FIELDS:
        try:
            wanted = date.fromisoformat(value)
        except ValueError:
            return "quote_mismatch"
        found, ambiguous = _dates_in(quote)
        if wanted not in found:
            return "quote_mismatch"
        return "ambiguous" if ambiguous else "ok"
    return "ok"


MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}


def _dates_in(quote: str) -> tuple[set[date], bool]:
    """Every calendar date the quote could mean, and whether numeric day/month order is unclear."""
    found: set[date] = set()
    ambiguous = False

    def add(y, m, d):
        try:
            found.add(date(y if y > 99 else 2000 + y, m, d))
        except ValueError:
            pass

    for m in re.finditer(r"\b(\d{4})-(\d{2})-(\d{2})\b", quote):
        add(int(m[1]), int(m[2]), int(m[3]))
    for m in re.finditer(r"\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})\b", quote):
        a, b, y = int(m[1]), int(m[2]), int(m[3])
        add(y, b, a)  # day-first
        add(y, a, b)  # month-first
        if a <= 12 and b <= 12 and a != b:
            ambiguous = True
    names = "|".join(MONTHS)
    for m in re.finditer(rf"(\d{{1,2}})(?:st|nd|rd|th)?\s+({names})[a-z]*\.?,?\s+(\d{{4}})", quote, re.I):
        add(int(m[3]), MONTHS[m[2].lower()], int(m[1]))
    for m in re.finditer(rf"({names})[a-z]*\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})", quote, re.I):
        add(int(m[3]), MONTHS[m[1].lower()], int(m[2]))
    return found, ambiguous


def injection_flags(texts: list[str]) -> list[str]:
    flags: list[str] = []
    for t in texts:
        flags.extend(scan(t))
    return flags


# ---------------------------------------------------------------- CSV preview
CSV_HEADER = ["event_date", "amount", "direction", "kind", "certainty", "description", "invoice_ref", "is_deferrable"]


@dataclass
class CsvOutcome:
    events: list[dict]
    errors: list[dict]
    duplicate_keys: list[str]


def _err(code, row, message):
    return {"code": code, "field": f"row:{row}", "message": message, "blocking": True, "resolution": "correct_input"}


def parse_cash_csv(text: str, as_of: date) -> CsvOutcome:
    reader = csv.DictReader(io.StringIO(text))
    header = [h.strip() for h in (reader.fieldnames or [])]
    missing = [h for h in CSV_HEADER[:4] if h not in header]
    events: list[dict] = []
    errors: list[dict] = []
    dupes: list[str] = []
    if missing:
        return CsvOutcome([], [_err("CSV-HEADER", 0, "Required columns: " + ", ".join(CSV_HEADER[:4]))], [])
    seen: set[str] = set()
    for n, raw in enumerate(reader, start=2):
        if n - 1 > MAX_CSV_ROWS:
            errors.append(_err("CSV-TOO-MANY-ROWS", n, "At most 2000 rows can be previewed."))
            break
        row = {k.strip(): (v or "").strip() for k, v in raw.items() if k}
        try:
            event_date = date.fromisoformat(row["event_date"])
            if not date(2000, 1, 1) <= event_date <= date(2100, 12, 31):
                raise ValueError
            amount = Decimal(row["amount"].replace(",", ""))
            if amount <= 0 or amount != amount.quantize(Decimal("0.01")):
                raise ValueError
            minor = int(amount * 100)
            if row["direction"] not in {"in", "out"}:
                raise ValueError
            kind = row["kind"]
            if kind in GENERATED_KINDS or kind not in CSV_KINDS:
                errors.append(_err("CSV-KIND", n, "Unsupported event kind."))
                continue
            certainty = row.get("certainty") or "expected"
            if certainty not in {"confirmed", "expected", "assumed"}:
                raise ValueError
            deferrable = (row.get("is_deferrable") or "false").lower()
            if deferrable not in {"true", "false"}:
                raise ValueError
        except (ValueError, InvalidOperation, KeyError):
            errors.append(_err("CSV-ROW", n, "Row has an invalid date, amount, direction or certainty."))
            continue
        key = f"{event_date}|{minor}|{row['direction']}|{kind}|{row.get('invoice_ref', '')}"
        if key in seen:
            dupes.append(key)
            continue
        seen.add(key)
        events.append(
            {
                "event_date": str(event_date), "amount_minor": str(minor), "direction": row["direction"],
                "kind": kind, "certainty": certainty,
                "description": row.get("description") or None,
                "invoice_ref": row.get("invoice_ref") or None,
                "is_deferrable": deferrable == "true", "row": n,
            }
        )
    return CsvOutcome(events, errors, dupes)
