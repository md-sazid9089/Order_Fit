"""Regression evidence for persisted manual costs, dated balances and policy terms."""

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.financial import CostInput, Evidence, TermLoanTerms
from orderfit.contracts.primitives import ReasonCommand, RevisionReason
from orderfit.contracts.resources import (
    BaselineBalance,
    BaselineWrite,
    ConstraintWrite,
    CustomerCreate,
    CustomerInput,
    DealWrite,
    DraftInputs,
    OfferCreate,
    OfferWrite,
    PayeeCreate,
    PayeeInput,
)
from orderfit.contracts.workflow import ConfirmInputs, CreateDeal
from orderfit.store.repositories import (
    BusinessRepository,
    ConstraintsRepository,
    CustomerRepository,
    DealRepository,
    OfferRepository,
    PayeeRepository,
)
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import run_once
from tests.db.p3_helpers import manual_evaluation


def evidence():
    return Evidence(document_id=None, content_hash=None, candidate_id=None,
        confirmed_field_id=None, source_role="baseline", page=None, quote=None,
        manual_attestation="Owner verified synthetic data", override_reason=None)


def setup_deal(postgres, account):
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        profile = BusinessRepository.get_profile(c, account.business_id)
        BusinessRepository.update_baseline(c, scope, BaselineWrite(
            expected_version=profile.version, expected_financial_revision=profile.financial_revision,
            balance=BaselineBalance(opening_date=date(2026, 11, 2), opening_cash_minor="500000",
                coverage_through=date(2027, 11, 2), evidence=evidence())))
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        customer = CustomerRepository.create_customer(c, scope, CustomerCreate(
            expected_financial_revision=revision,
            customer=CustomerInput(name="Synthetic customer", known_domains=[], red_flags=[])))
        constraints = ConstraintsRepository.list_constraints(c, account.business_id).items[0]
        deal = DealRepository.create_deal(c, scope, CreateDeal(public_ref=uuid4().hex,
            customer_id=customer.id, constraints_id=constraints.id, start_date=date(2026, 11, 2)))
        inputs = DraftInputs(opening_cash_minor="500000", reserve_minor="0",
            order_value_minor="300000", order_date=date(2026, 11, 2),
            invoice_date=date(2026, 11, 12), delivery_date=date(2026, 11, 12),
            payment_basis="delivery", payment_days=10, customer_id=customer.id,
            constraints_id=constraints.id, costs=[])
        deal = save(c, scope, deal, inputs)
        return deal, inputs


def save(c, scope, deal, inputs):
    revision = BusinessRepository.get_profile(c, scope.business_id).financial_revision
    return DealRepository.update_deal(c, scope, deal.id, DealWrite(
        expected_version=deal.version, expected_input_version=deal.input_version,
        expected_financial_revision=revision, inputs=inputs))


def test_cost_evidence_persists_and_unknown_identity_rolls_back(postgres, accounts):
    account = accounts[0]
    deal, inputs = setup_deal(postgres, account)
    cost = CostInput(event_id=None, cost_key="manual-material", event_date=date(2026, 11, 3),
        amount_minor="100000", kind="supplier_payment", is_deferrable=True, incremental=True,
        nonincremental_reason=None, invoice_ref="INV-1", payee_id=None,
        original_obligation_id="material-1", evidence=[evidence()])
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        deal = save(c, scope, deal, inputs.model_copy(update={"costs": [cost]}))
        assert deal.inputs.costs[0].evidence == cost.evidence
        assert deal.inputs.costs[0].cost_key == cost.cost_key
        assert deal.inputs.costs[0].original_obligation_id == cost.original_obligation_id
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is not None, review.findings
        assert review.candidate_snapshot.order.costs[0].amount_minor == "100000"
        assert review.candidate_snapshot.order.costs[0].original_obligation_id == cost.original_obligation_id
        assert {r.resource_kind for r in review.candidate_snapshot.source_revisions} >= {"cash_event", "customer", "constraints"}
        cost_id = deal.inputs.costs[0].event_id
    with pytest.raises(ApplicationError) as failure:
        with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
            save(c, scope, deal, inputs.model_copy(update={"costs": [cost.model_copy(update={"event_id": "9223372036854775807"})]}))
    assert failure.value.code == "COST_NOT_FOUND"
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        fresh = DealRepository.get_deal(c, account.business_id, deal.id)
        assert fresh.version == deal.version
        updated = cost.model_copy(update={"event_id": cost_id, "amount_minor": "110000"})
        fresh = save(c, scope, fresh, inputs.model_copy(update={"costs": [updated]}))
        assert fresh.inputs.costs[0].amount_minor == "110000"
        assert fresh.inputs.costs[0].evidence == cost.evidence
        fresh = save(c, scope, fresh, inputs)
        assert fresh.inputs.costs == []
        assert c.execute(text("SELECT voided_at IS NOT NULL FROM cash_event WHERE id=:id"), {"id": cost_id}).scalar_one()


def test_opening_balance_date_and_conflicting_override_require_review(postgres, accounts):
    account = accounts[0]
    deal, inputs = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        deal = save(c, scope, deal, inputs.model_copy(update={"opening_cash_minor": "900000"}))
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is None
        assert "OPENING-BALANCE-CONFLICT" in {f.code for f in review.findings}
        deal = save(c, scope, deal, inputs)
        profile = BusinessRepository.get_profile(c, account.business_id)
        baseline = BusinessRepository.get_baseline(c, account.business_id)
        BusinessRepository.update_baseline(c, scope, BaselineWrite(expected_version=profile.version,
            expected_financial_revision=profile.financial_revision,
            balance=baseline.balance.model_copy(update={"opening_date": deal.start_date - timedelta(days=1)})))
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is None
        assert "BASELINE-DATE-MISMATCH" in {f.code for f in review.findings}


def test_constraints_preserve_haircuts_and_zero_day_deposit(postgres, accounts):
    account = accounts[0]
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        original = ConstraintsRepository.list_constraints(c, account.business_id).items[0]
        request = ConstraintWrite(expected_financial_revision=original.financial_revision,
            reserve_minor=original.reserve_minor, owner=original.owner,
            strategy_space=original.strategy_space.model_copy(update={"deposit_lead_days": 0}),
            scenarios=original.scenarios.model_copy(update={
                "downside": original.scenarios.downside.model_copy(update={"order_receipt_haircut_bps": 1200}),
                "severe": original.scenarios.severe.model_copy(update={"order_receipt_haircut_bps": 3500})}),
            make_default=True)
        created = ConstraintsRepository.create_version(c, scope, request)
        assert created.strategy_space.deposit_lead_days == 0
        assert created.scenarios.downside.order_receipt_haircut_bps == 1200
        assert created.scenarios.severe.order_receipt_haircut_bps == 3500
        row = c.execute(text("SELECT downside_order_receipt_haircut_bps,severe_order_receipt_haircut_bps FROM owner_constraints WHERE id=:id"), {"id": created.id}).one()
        assert tuple(row) == (1200, 3500)


@pytest.mark.parametrize("method", ["close_deal", "hold_deal", "reopen_for_review"])
def test_deal_commands_reject_stale_versions(postgres, accounts, method):
    account = accounts[0]
    deal, _ = setup_deal(postgres, account)
    with pytest.raises(ApplicationError) as failure:
        with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
            getattr(DealRepository, method)(c, scope, deal.id, ReasonCommand(
                expected_version=deal.version + 1, expected_input_version=deal.input_version,
                expected_financial_revision=deal.financial_revision, reason="Synthetic review"))
    assert failure.value.code == "STALE_VERSION"
    with postgres["database"].tenant(account.token, account.business_id) as (c, _):
        assert DealRepository.get_deal(c, account.business_id, deal.id).version == deal.version


def test_hold_advances_version_and_blocks_confirmation(postgres, accounts):
    account = accounts[0]
    deal, _ = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        held = DealRepository.hold_deal(c, scope, deal.id, ReasonCommand(
            expected_version=deal.version, expected_input_version=deal.input_version,
            expected_financial_revision=deal.financial_revision, reason="Stop pending review"))
        assert held.version > deal.version
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is None
        assert "MANUAL-HOLD" in {f.code for f in review.findings}


def test_offer_update_keeps_exact_lender_evidence_and_snapshot_sources(postgres, accounts):
    account = accounts[0]
    deal, _ = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        lenders = []
        for index in range(2):
            revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
            lenders.append(PayeeRepository.create_payee(c, scope, PayeeCreate(
                expected_financial_revision=revision,
                payee=PayeeInput(name=f"Synthetic lender {index}", kind="lender", category="finance",
                    terms_days=30, terms_note=None, delay_tolerance_note=None,
                    risk_rating="low", known_domains=[]))))
        terms = TermLoanTerms(name="Synthetic confirmed loan", kind="term_loan", interest_method="flat_term",
            interest_bps=100, fee_bps=0, fee_flat_minor="0", fee_at="draw", lead_days=0,
            min_minor="1000", max_minor="1000", step_minor="1000", term_days=30,
            available_from=deal.start_date, valid_until=date(2027, 11, 2), status="active",
            payee_id=lenders[0].id, payee_version=lenders[0].version, account_id=None,
            account_version=None, evidence=[evidence()])
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        original = OfferRepository.create_offer(c, scope, OfferCreate(expected_financial_revision=revision, terms=terms))
        revised_evidence = evidence().model_copy(update={"manual_attestation": "Reconfirmed second lender terms"})
        terms = terms.model_copy(update={"payee_id": lenders[1].id, "payee_version": lenders[1].version,
            "evidence": [revised_evidence]})
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        updated = OfferRepository.update_offer(c, scope, original.id, OfferWrite(
            expected_version=original.version, expected_financial_revision=revision, terms=terms))
        assert updated.terms.payee_id == lenders[1].id
        assert updated.terms.evidence == [revised_evidence]
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is not None, review.findings
        assert review.candidate_snapshot.offers[0].payee_id == lenders[1].id
        refs = {(ref.resource_kind, ref.resource_id) for ref in review.candidate_snapshot.source_revisions}
        assert ("offer", str(updated.id)) in refs
        assert ("payee", str(lenders[1].id)) in refs


def test_archiving_an_offer_returns_a_closed_view_and_removes_it_from_the_review(postgres, accounts):
    """Regression: archive used to raise a validation error (HTTP 503) for every closed offer."""
    account = accounts[0]
    deal, _ = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        lender = PayeeRepository.create_payee(c, scope, PayeeCreate(
            expected_financial_revision=revision,
            payee=PayeeInput(name="Synthetic archive lender", kind="lender", category="finance",
                terms_days=30, terms_note=None, delay_tolerance_note=None,
                risk_rating="low", known_domains=[])))
        terms = TermLoanTerms(name="Synthetic archived loan", kind="term_loan", interest_method="flat_term",
            interest_bps=100, fee_bps=0, fee_flat_minor="0", fee_at="draw", lead_days=0,
            min_minor="1000", max_minor="1000", step_minor="1000", term_days=30,
            available_from=deal.start_date, valid_until=date(2027, 11, 2), status="active",
            payee_id=lender.id, payee_version=lender.version, account_id=None,
            account_version=None, evidence=[evidence()])
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        offer = OfferRepository.create_offer(c, scope, OfferCreate(expected_financial_revision=revision, terms=terms))
        assert offer.supported is True
        revision = BusinessRepository.get_profile(c, account.business_id).financial_revision
        closed = OfferRepository.archive_offer(c, scope, offer.id, RevisionReason(
            expected_version=offer.version, expected_financial_revision=revision,
            reason="Replaced by a fresh offer"))
        assert closed.supported is False
        assert closed.unavailable_reason == "Offer is closed."
        assert closed.archived_at is not None
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is not None, review.findings
        assert review.candidate_snapshot.offers == []


@pytest.mark.parametrize("error", [TimeoutError, MemoryError])
def test_process_budget_exhaustion_returns_reviewable_technical_outcome(postgres, accounts, config, monkeypatch, error):
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": account.csrf}
        deal, _, accepted = manual_evaluation(client, headers, account.business_id)

        def exhaust(*args, **kwargs):
            raise error("synthetic resource exhaustion")

        monkeypatch.setattr("orderfit.workflow.worker.bounded_compute", exhaust)
        assert run_once(Operations(postgres["worker"]), "resource-regression", {})
        operation = client.get(accepted["poll_url"]).json()
        assert operation["result"]["kind"] == "blocked"
        assert operation["result"]["outcome"] == "analysis_limit"
        current = client.get(f"/api/v1/businesses/{account.business_id}/deals/{deal['id']}").json()
        assert current["status"] == "awaiting_confirm"
        assert current["live_evaluation_id"] is None


def test_evaluation_reads_project_current_freshness(postgres, accounts, config):
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": account.csrf}
        deal, _, accepted = manual_evaluation(client, headers, account.business_id)
        assert run_once(Operations(postgres["worker"]), "freshness-regression", {})
        operation = client.get(accepted["poll_url"]).json()
        result_url = operation["result"]["resource_url"]
        original = client.get(result_url).json()
        assert original["is_stale"] is False
        base = f"/api/v1/businesses/{account.business_id}"
        current = client.get(f"{base}/deals/{deal['id']}").json()
        profile = client.get(base + "/profile").json()
        inputs = current["inputs"] | {"order_value_minor": "36000000"}
        response = client.patch(f"{base}/deals/{deal['id']}", headers=headers | {"Idempotency-Key": str(uuid4())}, json=dict(
            expected_version=current["version"], expected_input_version=current["input_version"],
            expected_financial_revision=profile["financial_revision"], inputs=inputs))
        assert response.status_code == 200, response.text
        stale = client.get(result_url).json()
        assert stale["is_stale"] is True
        assert "STALE_INPUT_VERSION" in stale["stale_reasons"]
        assert stale["allowed_actions"] == ["view_details"]
        page = client.get(f"{base}/deals/{deal['id']}/evaluations").json()
        assert page["items"][0]["is_stale"] is True


def test_csrf_challenge_does_not_invalidate_another_tab(postgres, accounts, config):
    account = accounts[0]
    app = create_app(config, postgres["database"])
    with TestClient(app) as first, TestClient(app) as second:
        for client in (first, second):
            client.cookies.set("orderfit_session", account.token)
            client.cookies.set("orderfit_csrf", account.csrf)
        one = first.get("/api/v1/auth/csrf")
        two = second.get("/api/v1/auth/csrf")
        assert one.status_code == two.status_code == 200
        assert one.json()["csrf_token"] == two.json()["csrf_token"] == account.csrf
        for _ in range(3):
            assert second.get("/api/v1/auth/csrf").json()["csrf_token"] == account.csrf
        profile = first.get(f"/api/v1/businesses/{account.business_id}/profile").json()
        response = first.post(f"/api/v1/businesses/{account.business_id}/customers", headers={
            "Origin": "http://localhost:3000", "X-CSRF-Token": one.json()["csrf_token"],
            "Idempotency-Key": str(uuid4())}, json=dict(
                expected_financial_revision=profile["financial_revision"],
                customer=dict(name="Independent first tab", known_domains=[], red_flags=[])))
        assert response.status_code == 200, response.text


def test_business_baseline_populates_persisted_manual_order_before_compute(postgres, accounts):
    account = accounts[0]
    deal, inputs = setup_deal(postgres, account)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, scope):
        # The manual form sources opening cash from the business baseline rather than
        # asking the user to duplicate it on every order.
        deal = save(c, scope, deal, inputs.model_copy(update={"opening_cash_minor": None}))
        assert deal.inputs.opening_cash_minor == "500000"
        review = DealRepository.build_review(c, account.business_id, deal.id)
        assert review.candidate_snapshot is not None, review.findings
        confirmed = DealRepository.confirm(c, scope, deal.id, ConfirmInputs(
            expected_version=review.version,
            expected_input_version=review.input_version,
            expected_financial_revision=review.financial_revision,
            snapshot_hash=review.snapshot_hash,
            confirmed_field_ids=review.required_field_ids,
            acknowledged_warning_codes=[],
        ), str(uuid4()))
        c.execute(text("UPDATE deal SET status='computing' WHERE id=:d"), {"d": deal.id})
        assert confirmed.snapshot_id
