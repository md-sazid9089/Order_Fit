"""Pure regression tests for audit repairs (errors, documents, llm, extraction windows)."""

import asyncio
import json
from datetime import date
from types import SimpleNamespace

import pytest
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import DBAPIError
from starlette.exceptions import HTTPException

from orderfit.agent import llm
from orderfit.api.errors import ApplicationError, is_security_relevant
from orderfit.services.documents import (
    UploadRejected,
    parse,
    parse_cash_csv,
    quote_supports,
    sniff_mime,
)
from orderfit.workflow.extraction import MAX_SOURCES, dropped_pages


# ---- A: only security-relevant outcomes are recorded --------------------------------
def test_anonymous_and_noise_errors_are_never_recorded():
    not_found = HTTPException(404)
    assert not is_security_relevant(not_found, 404, "NOT_FOUND", has_session=False)
    assert not is_security_relevant(not_found, 404, "NOT_FOUND", has_session=True)
    validation = RequestValidationError([])
    assert not is_security_relevant(validation, 422, "INVALID_INPUT", has_session=True)
    anonymous = ApplicationError(403, "CSRF_REJECTED")
    assert not is_security_relevant(anonymous, 403, "CSRF_REJECTED", has_session=False)
    expired = ApplicationError(401, "INVALID_SESSION")
    assert not is_security_relevant(expired, 401, "INVALID_SESSION", has_session=True)
    assert not is_security_relevant(RuntimeError(), 503, "DEPENDENCY_UNAVAILABLE", has_session=True)


@pytest.mark.parametrize(
    "status,code",
    [(403, "CSRF_REJECTED"), (403, "FORBIDDEN"), (404, "NOT_FOUND"), (409, "STALE_VERSION"),
     (401, "INVALID_CREDENTIALS"), (429, "AUTH_RATE_LIMIT")],
)
def test_authenticated_security_outcomes_are_recorded(status, code):
    assert is_security_relevant(ApplicationError(status, code), status, code, has_session=True)


def test_database_permission_denial_is_recorded_but_other_db_errors_are_not():
    exc = DBAPIError("stmt", {}, Exception())
    assert is_security_relevant(exc, 403, "FORBIDDEN", has_session=True)
    assert not is_security_relevant(exc, 409, "UNIQUE_CONFLICT", has_session=True)


# ---- D: documents -------------------------------------------------------------------
PAGE = "Total 5,100 BDT. Net 130 days. Pay in 30 days. Amount 350,000.00"


@pytest.mark.parametrize(
    "field,value,quote,expected",
    [
        ("order_value_minor", "100000", "Total 5,100 BDT", "quote_mismatch"),  # 1,000.00 != 5,100
        ("order_value_minor", "510000", "Total 5,100 BDT", "ok"),
        ("order_value_minor", "35000000", "Amount 350,000.00", "ok"),
        ("order_value_minor", "3500000", "Amount 350,000.00", "quote_mismatch"),
        ("order_value_minor", "35000000", "Amount 350,000.005", "quote_mismatch"),
        ("order_value_minor", "5000", "Total 5,100 BDT", "quote_mismatch"),
        ("order_value_minor", "-100", "Total 5,100 BDT", "quote_mismatch"),
        ("payment_days", "30", "Net 130 days", "quote_mismatch"),
        ("payment_days", "30", "Pay in 30 days", "ok"),
        ("payment_days", "30", "Pay in 30.5 days", "quote_mismatch"),
        ("payment_days", "3", "Pay in 30 days", "quote_mismatch"),
    ],
)
def test_numeric_quote_requires_a_whole_token_match(field, value, quote, expected):
    assert quote_supports(field, value, quote, PAGE) == expected


def test_non_numeric_fields_are_conservative():
    page = "Payment on delivery. Pay supplier A 100."
    assert quote_supports("payment_basis", "delivery", "Payment on delivery", page) == "ok"
    assert quote_supports("payment_basis", "invoice", "Payment on delivery", page) == "quote_mismatch"
    for field in ("costs", "financing_offer", "acceptance", "bank_account_change"):
        assert quote_supports(field, "anything", "Pay supplier A 100", page) == "ambiguous"


def test_deeply_nested_json_is_a_typed_rejection_not_a_crash():
    deep = b"[" * 100_000 + b"]" * 100_000
    with pytest.raises(UploadRejected):
        sniff_mime(deep, "application/json")
    result = parse(deep, "application/json")
    assert result.status == "failed" and result.error_code == "MALFORMED"


def test_oversized_csv_field_is_a_typed_preview_error():
    header = "event_date,amount,direction,kind\n"
    huge = header + "2026-11-02," + "9" * 200_000 + ",in,rent\n"
    outcome = parse_cash_csv(huge, date(2026, 11, 1))
    assert [e["code"] for e in outcome.errors] == ["CSV-MALFORMED"] and outcome.events == []
    good = header + "2026-11-02,10.00,in,rent\n2026-11-03," + "9" * 200_000 + ",in,rent\n"
    outcome = parse_cash_csv(good, date(2026, 11, 1))
    assert len(outcome.events) == 1 and outcome.errors[0]["code"] == "CSV-MALFORMED"
    assert all(e["blocking"] for e in outcome.errors)


def test_pages_beyond_the_extraction_window_are_reported():
    assert dropped_pages(["x"] * MAX_SOURCES) == 0
    assert dropped_pages(["x"] * (MAX_SOURCES + 3)) == 3
    assert dropped_pages(["x"] * MAX_SOURCES + ["  ", "y"]) == 1  # blank pages are not content


# ---- G: provider adapter ------------------------------------------------------------
@pytest.mark.parametrize("status,retryable", [(400, False), (401, False), (403, False),
                                              (404, False), (422, False), (500, True),
                                              (503, True), (408, True), (409, True)])
def test_status_errors_are_retryable_only_when_transient(status, retryable):
    result = llm._status_unavailable(SimpleNamespace(status_code=status)).result
    assert result.code == "PROVIDER_UNAVAILABLE" and result.retryable is retryable


@pytest.mark.parametrize("payload", [[], [1, 2], "text", 7, None])
def test_recording_that_is_not_an_object_is_invalid_output(tmp_path, payload):
    request = SimpleNamespace(prompt_version="p.v1", input_hash="ab" * 32)
    settings = llm.LLMSettings(mode="recorded", recordings_dir=tmp_path)
    (tmp_path / f"{request.prompt_version}__{request.input_hash}.json").write_text(json.dumps(payload))
    assert llm._recorded(request, settings).result.code == "INVALID_OUTPUT"


def test_semaphores_are_scoped_to_the_running_loop():
    async def grab():
        sem = llm._semaphore(2)
        assert llm._semaphore(2) is sem
        async with sem:
            await asyncio.sleep(0)
        return sem

    first, second = asyncio.run(grab()), asyncio.run(grab())
    assert first is not second
