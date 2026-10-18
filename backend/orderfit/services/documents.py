"""Pure upload validation, parsing and extraction checks (no database, no network).

Document bytes are untrusted data. Nothing here executes content or fetches embedded URLs.
"""

import csv
import io
import json
import os
import re
import subprocess
import sys
import unicodedata
from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal, InvalidOperation
from importlib.resources import files
from threading import BoundedSemaphore

from orderfit.agent.guards.injection import scan
from orderfit.services.language import detect

PARSER_VERSION = "p4.2"
MAX_PAGES = 50
MAX_PAGE_CHARS = 100_000
MAX_CSV_ROWS = 2000
PDF_WORK = BoundedSemaphore(2)
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
            except (ValueError, RecursionError):  # deeply nested JSON is rejected, not a 500
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
    except (ValueError, UnicodeDecodeError, RecursionError):
        return ParseResult("plain_text", "failed", [], "MALFORMED")


def _paginate(text: str) -> list[str]:
    pages = [text[i : i + MAX_PAGE_CHARS] for i in range(0, len(text), MAX_PAGE_CHARS)] or [""]
    if len(pages) > MAX_PAGES:
        raise ValueError("too many pages")
    return pages


def _parse_pdf(data: bytes) -> ParseResult:
    """Untrusted decompression and parsing never run in the API process."""
    if not PDF_WORK.acquire(blocking=False):
        raise UploadRejected("PARSER_CAPACITY")
    try:
        return _bounded_pdf(data)
    finally:
        PDF_WORK.release()


def _bounded_pdf(data: bytes) -> ParseResult:
    try:
        child = subprocess.Popen(
            [sys.executable, "-m", "orderfit.services.pdf_parser"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            # A document parser needs neither application nor provider credentials.
            # This is resource isolation, not a full filesystem/network sandbox.
            env={name: os.environ[name] for name in
                 ("SYSTEMROOT", "WINDIR", "PATH", "TMP", "TEMP", "LANG") if name in os.environ}
                | {"PYTHONNOUSERSITE": "1", "PYTHONUTF8": "1"},
        )
    except OSError:
        return ParseResult("pdf_text", "failed", [], "PARSER_UNAVAILABLE")
    try:
        output, _ = child.communicate(data, timeout=10)
    except subprocess.TimeoutExpired:
        child.kill()
        child.communicate()
        return ParseResult("pdf_text", "failed", [], "PARSER_LIMIT")
    if child.returncode != 0:
        return ParseResult("pdf_text", "failed", [], "PARSER_LIMIT")
    try:
        return ParseResult(**json.loads(output))
    except (ValueError, TypeError):
        return ParseResult("pdf_text", "failed", [], "MALFORMED")


def parse_pdf_child(data: bytes) -> ParseResult:
    """Child-only implementation; caller must establish memory and wall-clock limits."""
    try:
        from pypdf import PdfReader  # lazy: optional until a PDF is parsed

        reader = PdfReader(io.BytesIO(data), strict=False)
        if reader.is_encrypted:
            return ParseResult("pdf_text", "failed", [], "ENCRYPTED")
        if len(reader.pages) > MAX_PAGES:
            return ParseResult("pdf_text", "failed", [], "TOO_MANY_PAGES")
        pages = []
        for page in reader.pages:
            body = page.extract_text() or ""
            if len(body) > MAX_PAGE_CHARS:
                return ParseResult("pdf_text", "failed", [], "PAGE_TOO_LARGE")
            pages.append(body)
    except Exception:  # malformed input must never escape as a server error
        return ParseResult("pdf_text", "failed", [], "MALFORMED")
    if not any(p.strip() for p in pages):
        return ParseResult("pdf_text", "ocr_required", [], "NO_TEXT_LAYER")
    return ParseResult("pdf_text", "parsed", pages)


# ---------------------------------------------------------------- candidate validation
def _norm(value: str) -> str:
    value = unicodedata.normalize("NFKC", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Cf")
    return re.sub(r"\s+", " ", value).strip().lower()


NUMERIC_FIELDS = {"order_value_minor", "opening_cash_minor", "payment_days"}
DATE_FIELDS = {"order_date", "invoice_date", "delivery_date"}
BASIS_FIELDS = {"payment_basis"}
# Required runtime data ships in the wheel, independently of checkout/demo mounts.
PAYMENT_BASIS_LEXICON = json.loads(
    files("orderfit.services").joinpath("payment_basis.json").read_text(encoding="utf-8")
)
# Group-separated (1,234 / 1,00,000) or plain numbers, never a fragment of a longer number.
_NUMBER = re.compile(r"(?<![\d.,])(?:\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?![\d])")


def _ascii_numerals(value: str) -> str:
    """Normalize decimal digits and full-width/Arabic separators without guessing locale."""
    output = []
    for char in unicodedata.normalize("NFKC", value):
        try:
            output.append(str(unicodedata.decimal(char)))
        except ValueError:
            output.append({"٫": ".", "٬": ","}.get(char, char))
    return "".join(output)
_EUROPEAN = re.compile(r"(?<![\d.,])\d{1,3}(?:\.\d{3})+,\d{1,2}(?!\d)")


def _european_grouping(value: str) -> str:
    """Rewrite 1.234,56 as 1,234.56 (same length). Only a token with both separators in
    that order is converted; a lone 1.234 stays as written and is never guessed."""
    return _EUROPEAN.sub(lambda m: m.group().translate({46: 44, 44: 46}), value)


_MINUS = r"\-\u2212\u2012\u2013\u2014\ufe63\uff0d"
_CURRENCY_MARKER = r"(?:\b(?:bdt|usd|eur|gbp)\b|[$€£৳])"
_NEGATIVE_PREFIX = re.compile(
    rf"(?:[{_MINUS}]\s*(?:{_CURRENCY_MARKER}\s*)?|\(\s*(?:{_CURRENCY_MARKER}\s*)?)$",
    re.I,
)
_NEGATIVE_SUFFIX = re.compile(
    rf"^\s*(?:{_CURRENCY_MARKER}\s*)?[{_MINUS}](?!\s*\d)", re.I,
)


def _numbers_in(quote: str, page_text: str) -> set[Decimal]:
    """Whole source tokens inside the quote, retaining signs/accounting brackets.

    Read tokens from the original page, so a shortened quote cannot hide the
    source sign or select only a numeric substring (100 from 1000, for example).
    Whitespace/case normalization matches the existing quote-presence contract.
    """
    source = _european_grouping(_ascii_numerals(_norm(page_text)))
    quoted = _european_grouping(_ascii_numerals(_norm(quote)))
    values: set[Decimal] = set()
    tokens = iter(_NUMBER.finditer(source))
    token = next(tokens, None)
    for occurrence in re.finditer(re.escape(quoted), source):
        # Both streams are ordered and quote occurrences do not overlap. Advance
        # once through source numbers rather than rescanning a repeated page for
        # every occurrence of a short quote.
        while token is not None and token.start() < occurrence.start():
            token = next(tokens, None)
        while token is not None and token.start() < occurrence.end():
            if token.end() <= occurrence.end():
                value = Decimal(token.group().replace(",", ""))
                prefix = source[max(0, token.start() - 64) : token.start()]
                suffix = source[token.end() : token.end() + 32]
                if _NEGATIVE_PREFIX.search(prefix) or _NEGATIVE_SUFFIX.search(suffix):
                    value = -value
                values.add(value)
            token = next(tokens, None)
        if token is None:
            break
    return values


def quote_supports(field_name: str, value: str | None, quote: str, page_text: str) -> str:
    """Return 'ok', 'quote_mismatch' or 'ambiguous'. The quote must appear in the page text.

    Numbers must match a whole signed source token covered by the quote. Fields whose value this
    function cannot compare structurally (costs, offers, acceptance, bank changes) are never
    'ok': they stay 'ambiguous' so a person must review them against the cited quote.
    """
    if not quote.strip() or _norm(quote) not in _norm(page_text):
        return "quote_mismatch"
    if value is None:
        return "ok"
    if field_name in NUMERIC_FIELDS:
        if not value.isascii() or not value.isdigit():
            return "quote_mismatch"
        if field_name == "payment_days":
            return "ok" if Decimal(value) in _numbers_in(quote, page_text) else "quote_mismatch"
        # minor units: a quoted token must equal the major amount (value / 100) exactly
        if Decimal(value) / 100 not in _numbers_in(quote, page_text):
            return "quote_mismatch"
        # Two different stated totals (for example quoted vs revised) need a person.
        return "ambiguous" if field_name == "order_value_minor" and len(_stated_totals(page_text)) > 1 else "ok"
    if field_name in BASIS_FIELDS:
        language, _script, supported = detect(quote)
        # The source is authoritative.  A model's English enum is accepted only
        # when a reviewed source-language term establishes that enum.
        words = PAYMENT_BASIS_LEXICON.get(language, {}).get(value, []) if supported else []
        normalized_quote = _norm(quote)
        if any(_norm(word) in normalized_quote for word in words):
            return "ok"
        # A reviewed term for a different trigger contradicts the claimed one.
        others = (
            word for basis, group in PAYMENT_BASIS_LEXICON.get(language, {}).items()
            if basis != value for word in group
        ) if supported else ()
        return "quote_mismatch" if any(_norm(word) in normalized_quote for word in others) else "ambiguous"
    if field_name in DATE_FIELDS:
        try:
            wanted = date.fromisoformat(value)
        except ValueError:
            return "quote_mismatch"
        found, ambiguous = _dates_in(quote)
        if wanted not in found:
            return "quote_mismatch"
        # A quote carrying several dates cannot say which one the field means.
        return "ambiguous" if ambiguous or _date_token_count(quote) > 1 else "ok"
    return "ambiguous"


MONTHS = {m: i for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"], start=1)}
# Reviewed month names for the supported scripts (NFKC-normalised, matched after the
# same normalisation).  Month order stays explicit; numeric day/month order never is.
_LOCAL_MONTH_NAMES = {
    1: ["জানুয়ারি", "জানুয়ারী", "जनवरी"],
    2: ["ফেব্রুয়ারি", "ফেব্রুয়ারী", "फरवरी", "फ़रवरी"],
    3: ["মার্চ", "मार्च"],
    4: ["এপ্রিল", "अप्रैल", "अप्रेल"],
    5: ["মে", "मई"],
    6: ["জুন", "जून"],
    7: ["জুলাই", "जुलाई"],
    8: ["আগস্ট", "अगस्त"],
    9: ["সেপ্টেম্বর", "सितंबर", "सितम्बर"],
    10: ["অক্টোবর", "अक्टूबर", "अक्तूबर"],
    11: ["নভেম্বর", "नवंबर", "नवम्बर"],
    12: ["ডিসেম্বর", "दिसंबर", "दिसम्बर"],
}
_LOCAL_MONTHS = {
    unicodedata.normalize("NFKC", name).casefold(): month
    for month, names in _LOCAL_MONTH_NAMES.items() for name in names
}
_LOCAL_ALT = "|".join(sorted(map(re.escape, _LOCAL_MONTHS), key=len, reverse=True))
_ENGLISH_ALT = "|".join(MONTHS)


def _date_matches(quote: str):
    """Yield (span, (y, m, d), numeric_order_unclear) for each date token in the quote."""
    quote = unicodedata.normalize("NFKC", _ascii_numerals(quote)).casefold()
    for m in re.finditer(r"(?<!\d)(\d{4})-(\d{2})-(\d{2})(?!\d)", quote):
        yield m.span(), [(int(m[1]), int(m[2]), int(m[3]))], False
    for m in re.finditer(r"(?<![\d./-])(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?![\d./-])", quote):
        a, b, y = int(m[1]), int(m[2]), int(m[3])
        yield m.span(), [(y, b, a), (y, a, b)], a <= 12 and b <= 12 and a != b
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})(?:st|nd|rd|th)?\s+({_ENGLISH_ALT})[a-z]*\.?,?\s+(\d{{4}})(?!\d)", quote):
        yield m.span(), [(int(m[3]), MONTHS[m[2]], int(m[1]))], False
    for m in re.finditer(rf"(?<![a-z])({_ENGLISH_ALT})[a-z]*\.?\s+(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})(?!\d)", quote):
        yield m.span(), [(int(m[3]), MONTHS[m[1]], int(m[2]))], False
    for m in re.finditer(rf"(?<!\d)(\d{{1,2}})\s*({_LOCAL_ALT})\s*,?\s*(\d{{4}})(?!\d)", quote):
        yield m.span(), [(int(m[3]), _LOCAL_MONTHS[m[2]], int(m[1]))], False
    for m in re.finditer(rf"({_LOCAL_ALT})\s*(\d{{1,2}})\s*,?\s*(\d{{4}})(?!\d)", quote):
        yield m.span(), [(int(m[3]), _LOCAL_MONTHS[m[1]], int(m[2]))], False
    for m in re.finditer(r"(?<!\d)(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*[日号]?", quote):
        yield m.span(), [(int(m[1]), int(m[2]), int(m[3]))], False


def _dates_in(quote: str) -> tuple[set[date], bool]:
    """Every calendar date the quote could mean, and whether numeric day/month order is unclear."""
    found: set[date] = set()
    ambiguous = False
    for _span, options, unclear in _date_matches(quote):
        ambiguous |= unclear
        for y, m, d in options:
            try:
                found.add(date(y if y > 99 else 2000 + y, m, d))
            except ValueError:
                pass
    return found, ambiguous


def _date_token_count(quote: str) -> int:
    """Distinct (non-overlapping) date expressions in the quote."""
    spans = sorted(span for span, _options, _unclear in _date_matches(quote))
    count, end = 0, -1
    for start, stop in spans:
        if start >= end:
            count += 1
            end = stop
    return count


_TOTAL = re.compile(
    r"(?<![a-z])total(?:\s+(?:amount|due|value|price))?\s*[:=\-]?\s*"
    r"(?:bdt|usd|eur|gbp|[$€£৳₹¥])?\s*(\d[\d.,]*\d|\d)"
)


def _stated_totals(page_text: str) -> set[Decimal]:
    """Distinct figures labelled 'total' in the page; only used to force human review."""
    text = _european_grouping(_ascii_numerals(_norm(page_text)))
    values: set[Decimal] = set()
    for match in _TOTAL.finditer(text):
        try:
            values.add(Decimal(match[1].replace(",", "")))
        except InvalidOperation:
            continue
    return values


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
    try:
        header = [h.strip() for h in (reader.fieldnames or [])]
    except csv.Error:
        return CsvOutcome([], [_err("CSV-MALFORMED", 1, "The file is not a valid CSV (a field is too large).")], [])
    missing = [h for h in CSV_HEADER[:4] if h not in header]
    events: list[dict] = []
    errors: list[dict] = []
    dupes: list[str] = []
    if missing:
        return CsvOutcome([], [_err("CSV-HEADER", 0, "Required columns: " + ", ".join(CSV_HEADER[:4]))], [])
    seen: set[str] = set()
    rows = iter(reader)
    n = 1
    while True:
        n += 1
        try:
            raw = next(rows)
        except StopIteration:
            break
        except csv.Error:
            errors.append(_err("CSV-MALFORMED", n, "The file is not a valid CSV (a field is too large)."))
            break
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
