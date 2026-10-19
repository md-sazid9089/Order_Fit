"""Regressions for the manual-test findings: password policy, closed offers, worker failures."""

import logging
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

import pytest
from sqlalchemy.exc import OperationalError

from orderfit.api.errors import ApplicationError
from orderfit.services.password_policy import check_new_password
from orderfit.store.repositories import _row_to_offer
from orderfit.workflow.worker import RetryableJobError, classify_unexpected_failure

EMAIL = "owner@example.com"


# --- password policy -------------------------------------------------------------------

@pytest.mark.parametrize("candidate", [
    "owner@example.com",       # the account email
    "xx-owner-xx-2026",        # contains the email local part
    "OWNER@EXAMPLE.COM",       # case-insensitive
    "password1234",            # common
    "Password1234!",           # common with decoration
    "P@ssw0rd2026",            # common with leetspeak
    "qwertyuiop12",            # keyboard walk
    "aaaaaaaaaaaa",            # repeated character
    "abababababab",            # repeated pattern
    "123456789012",            # sequence
    "abcdefghijkl",            # sequence
    "orderfit-2026",           # the product name
])
def test_weak_passwords_are_rejected(candidate):
    with pytest.raises(ApplicationError) as caught:
        check_new_password(candidate, email=EMAIL)
    assert (caught.value.status, caught.value.code) == (422, "WEAK_PASSWORD")


def test_reusing_the_current_password_is_rejected():
    with pytest.raises(ApplicationError) as caught:
        check_new_password("Kestrel-Basalt-Quill-77", email=EMAIL, current="Kestrel-Basalt-Quill-77")
    assert (caught.value.status, caught.value.code) == (422, "PASSWORD_REUSED")


@pytest.mark.parametrize("candidate", [
    "Kestrel-Basalt-Quill-77",
    "correct horse battery staple",
    "t7#Vn2!qLw9z@Rb",
    "Sazidcse@420-Plus",       # decorated but not a common base word
])
def test_reasonable_passwords_are_accepted(candidate):
    check_new_password(candidate, email=EMAIL, current="a-different-old-password")


def test_short_local_part_does_not_reject_unrelated_passwords():
    check_new_password("Kestrel-Basalt-Quill-77", email="ab@example.com")


# --- closed offers ---------------------------------------------------------------------

def _offer_row(status):
    offer_id = uuid4()
    return {
        "id": offer_id, "version": 3, "name": "Working capital 90d", "kind": "term_loan",
        "status": status, "interest_method": "flat_term", "interest_bps": 1200, "fee_bps": 0,
        "fee_flat_minor": 0, "fee_at": "draw", "lead_days": 2, "min_minor": 100000,
        "max_minor": 5000000, "step_minor": 100000, "term_days": 90,
        "available_from": date(2026, 1, 1), "valid_until": date(2027, 1, 1),
        "lender_payee_id": uuid4(), "lender_payee_version": 1, "lender_account_id": None,
        "lender_account_version": None, "evidence": [{
            "document_id": None, "content_hash": None, "candidate_id": None,
            "confirmed_field_id": None, "source_role": "other", "page": None, "quote": None,
            "manual_attestation": "Signed term sheet", "override_reason": None}],
    }


def test_closed_offer_renders_as_unsupported_instead_of_raising():
    view = _row_to_offer(_offer_row("closed"), 7)
    assert view.supported is False
    assert view.unavailable_reason
    assert view.archived_at is not None


def test_active_complete_offer_remains_supported():
    view = _row_to_offer(_offer_row("active"), 7)
    assert view.supported is True
    assert view.archived_at is None


# --- worker failure classification -----------------------------------------------------

JOB = SimpleNamespace(kind="evaluation")
CLAIM = {"id": uuid4()}


def test_unexpected_exception_is_logged_without_its_message(caplog):
    with caplog.at_level(logging.ERROR, logger="orderfit.worker"):
        result, retry = classify_unexpected_failure(CLAIM, JOB, ValueError("secret-account-9988"))
    assert (result.error.code, retry) == ("JOB_FAILED", False)
    text = " ".join(r.getMessage() for r in caplog.records)
    assert "job_failed" in text and str(CLAIM["id"]) in text and "ValueError" in text
    assert "secret-account-9988" not in text


def test_transient_database_connectivity_error_is_retried():
    exc = OperationalError("SELECT 1", {}, Exception("server closed the connection"))
    result, retry = classify_unexpected_failure(CLAIM, JOB, exc)
    assert (result.error.code, retry) == ("TRANSIENT_JOB_FAILURE", True)


def test_explicit_retryable_error_is_retried():
    result, retry = classify_unexpected_failure(CLAIM, JOB, RetryableJobError())
    assert (result.error.code, retry) == ("TRANSIENT_JOB_FAILURE", True)
