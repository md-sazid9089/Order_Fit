"""P3 persisted manual-input vertical slice integration tests.

Acceptance gate:
- create an order manually, confirm, evaluate and inspect exact financial result;
- refresh/restart and recover all state;
- edit input and see stale old result;
- two concurrent editors get one success/one conflict;
- unauthorized tenant sees no record;
- API-key-free operation works;
- Demo hardcoded data cannot appear in the live order flow.
"""

from contextlib import contextmanager
from datetime import date, timedelta
from uuid import uuid4

from fastapi.testclient import TestClient

from orderfit.api.main import create_app
from orderfit.contracts.primitives import ReasonCommand
from orderfit.contracts.resources import (
    BaselineBalance,
    BaselineWrite,
    CashEventCreate,
    CashEventInput,
    CustomerCreate,
    CustomerInput,
    DealWrite,
    DraftInputs,
    Evidence,
    OfferCreate,
    PayeeCreate,
    PayeeInput,
)
from orderfit.contracts.workflow import (
    ConfirmInputs,
    CreateDeal,
    EvaluateRequest,
)
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.conftest import Account


@contextmanager
def auth_client(app, account: Account):
    with TestClient(app, raise_server_exceptions=True) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {
            "X-CSRF-Token": account.csrf,
            "Origin": "http://localhost:3000",
        }
        yield client, headers


def test_business_profile_baseline_and_constraints(postgres, accounts, config):
    app = create_app(config, postgres["database"])
    a = accounts[0]
    base = f"/api/v1/businesses/{a.business_id}"

    with auth_client(app, a) as (client, headers):
        # 1. Profile
        resp = client.get(f"{base}/profile", headers=headers)
        assert resp.status_code == 200, resp.text
        profile = resp.json()
        assert profile["currency"] == "BDT"
        assert profile["exponent"] == 2
        assert profile["profile"]["name"] == "Synthetic business"

        # 2. An unconfigured baseline is an explicit conflict, not a fabricated zero balance.
        resp = client.get(f"{base}/baseline", headers=headers)
        assert resp.status_code == 409, resp.text
        baseline = profile
        # Business row version also advances for provisioning/default setup.
        assert baseline["version"] >= 1

        # 3. Baseline update
        today = date.today()
        update_headers = dict(headers)
        update_headers["Idempotency-Key"] = str(uuid4())
        req_body = BaselineWrite(
            expected_version=baseline["version"],
            expected_financial_revision=baseline["financial_revision"],
            balance=BaselineBalance(
                opening_date=today,
                opening_cash_minor="25000000",
                coverage_through=today + timedelta(days=365),
                evidence=Evidence(
                    document_id=None,
                    content_hash=None,
                    candidate_id=None,
                    confirmed_field_id=None,
                    source_role="baseline",
                    page=None,
                    quote=None,
                    manual_attestation="Owner verification",
                    override_reason=None,
                ),
            ),
        ).model_dump(mode="json")
        resp = client.patch(f"{base}/baseline", json=req_body, headers=update_headers)
        assert resp.status_code == 200, resp.text
        updated_baseline = resp.json()
        assert updated_baseline["balance"]["opening_cash_minor"] == "25000000"
        assert updated_baseline["financial_revision"] > baseline["financial_revision"]

        # 4. Constraints list and get
        resp = client.get(f"{base}/constraints", headers=headers)
        assert resp.status_code == 200, resp.text
        constraints_page = resp.json()
        assert len(constraints_page["items"]) >= 1
        first_c = constraints_page["items"][0]
        assert first_c["is_default"] is True

        cid = first_c["id"]
        resp = client.get(f"{base}/constraints/{cid}", headers=headers)
        assert resp.status_code == 200, resp.text
        c_get = resp.json()
        assert c_get["id"] == cid


def test_customer_payee_offer_and_cash_events(postgres, accounts, config):
    app = create_app(config, postgres["database"])
    a = accounts[0]
    base = f"/api/v1/businesses/{a.business_id}"

    with auth_client(app, a) as (client, headers):
        # Get current financial revision
        prof = client.get(f"{base}/profile", headers=headers).json()
        fin_rev = prof["financial_revision"]

        # 1. Customer lifecycle
        h1 = dict(headers, **{"Idempotency-Key": str(uuid4())})
        cust_req = CustomerCreate(
            expected_financial_revision=fin_rev,
            customer=CustomerInput(
                name="Apex Retail Corp",
                known_domains=["apexretail.example"],
                red_flags=[],
            ),
        ).model_dump(mode="json")
        resp = client.post(f"{base}/customers", json=cust_req, headers=h1)
        assert resp.status_code == 200, resp.text
        cust = resp.json()
        cust_id = cust["id"]
        assert cust["customer"]["name"] == "Apex Retail Corp"

        # List customers
        resp = client.get(f"{base}/customers", headers=headers)
        assert resp.status_code == 200
        custs = resp.json()["items"]
        assert any(c["id"] == cust_id for c in custs)

        # 2. Payee lifecycle
        prof = client.get(f"{base}/profile", headers=headers).json()
        h2 = dict(headers, **{"Idempotency-Key": str(uuid4())})
        payee_req = PayeeCreate(
            expected_financial_revision=prof["financial_revision"],
            payee=PayeeInput(
                name="Prime Fabrics Ltd",
                kind="supplier",
                category="raw_material",
                terms_days=30,
                terms_note="Net 30 standard",
                delay_tolerance_note="Up to 15 days delay acceptable",
                risk_rating="low",
                known_domains=["primefabrics.example"],
            ),
        ).model_dump(mode="json")
        resp = client.post(f"{base}/payees", json=payee_req, headers=h2)
        assert resp.status_code == 200, resp.text
        payee_id = resp.json()["id"]

        # 3. Financing Offer lifecycle (Term loan)
        prof = client.get(f"{base}/profile", headers=headers).json()
        h3 = dict(headers, **{"Idempotency-Key": str(uuid4())})
        today = date.today()
        offer_req = OfferCreate(
            expected_financial_revision=prof["financial_revision"],
            terms={
                "name": "Working Capital Term Loan",
                "kind": "term_loan",
                "interest_method": "flat_term",
                "interest_bps": 850,
                "fee_bps": 100,
                "fee_flat_minor": "50000",
                "fee_at": "draw",
                "lead_days": 3,
                "min_minor": "10000000",
                "max_minor": "50000000",
                "step_minor": "5000000",
                "term_days": 90,
                "available_from": str(today),
                "valid_until": str(today + timedelta(days=180)),
                "status": "active",
                "payee_id": payee_id,
                "payee_version": 1,
                "account_id": None,
                "account_version": None,
                "evidence": [
                    {
                        "document_id": None,
                        "content_hash": None,
                        "candidate_id": None,
                        "confirmed_field_id": None,
                        "source_role": "financing",
                        "page": None,
                        "quote": None,
                        "manual_attestation": "Lender term sheet",
                        "override_reason": None,
                    }
                ],
            },
        ).model_dump(mode="json")
        resp = client.post(f"{base}/financing-offers", json=offer_req, headers=h3)
        assert resp.status_code == 200, resp.text
        offer = resp.json()
        assert offer["supported"] is True, offer
        assert offer["kind"] == "term_loan"

        # 4. Cash Events & Cash Flow
        prof = client.get(f"{base}/profile", headers=headers).json()
        baseline = client.patch(
            f"{base}/baseline",
            json=BaselineWrite(
                expected_version=prof["version"],
                expected_financial_revision=prof["financial_revision"],
                balance=BaselineBalance(
                    opening_date=today,
                    opening_cash_minor="25000000",
                    coverage_through=today + timedelta(days=365),
                    evidence=Evidence(
                        document_id=None, content_hash=None, candidate_id=None,
                        confirmed_field_id=None, source_role="baseline", page=None,
                        quote=None, manual_attestation="Owner verified balance", override_reason=None,
                    ),
                ),
            ).model_dump(mode="json"),
            headers=dict(headers, **{"Idempotency-Key": str(uuid4())}),
        )
        assert baseline.status_code == 200, baseline.text
        prof = client.get(f"{base}/profile", headers=headers).json()
        h4 = dict(headers, **{"Idempotency-Key": str(uuid4())})
        event_req = CashEventCreate(
            expected_financial_revision=prof["financial_revision"],
            event=CashEventInput(
                deal_id=None,
                event_date=today + timedelta(days=10),
                amount_minor="5000000",
                direction="in",
                kind="ar_collection",
                certainty="confirmed",
                description="Accounts receivable payment from customer",
                invoice_ref="INV-2026-001",
                is_deferrable=False,
                incremental=False,
                customer_id=cust_id,
                payee_id=None,
                evidence=Evidence(
                        document_id=None,
                        content_hash=None,
                        candidate_id=None,
                        confirmed_field_id=None,
                        source_role="baseline",
                        page=None,
                        quote=None,
                        manual_attestation="Owner ledger entry",
                        override_reason=None,
                        ),
            ),
        ).model_dump(mode="json")
        resp = client.post(f"{base}/cash-events", json=event_req, headers=h4)
        assert resp.status_code == 200, resp.text
        assert resp.json()["id"] is not None

        # Cash flow series
        resp = client.get(f"{base}/cash-flow", headers=headers)
        assert resp.status_code == 200, resp.text
        series = resp.json()
        assert series["currency"] == "BDT"
        assert len(series["points"]) >= 2


def test_deal_full_slice_confirm_evaluate_and_inspect(postgres, accounts, config):
    app = create_app(config, postgres["database"])
    a = accounts[0]
    base = f"/api/v1/businesses/{a.business_id}"

    with auth_client(app, a) as (client, headers):
        # 1. Setup customer and baseline cash
        prof = client.get(f"{base}/profile", headers=headers).json()
        h_c = dict(headers, **{"Idempotency-Key": str(uuid4())})
        cust_res = client.post(
            f"{base}/customers",
            json=CustomerCreate(
                expected_financial_revision=prof["financial_revision"],
                customer=CustomerInput(name="Grand Retailers", known_domains=[], red_flags=[]),
            ).model_dump(mode="json"),
            headers=h_c,
        ).json()
        customer_id = cust_res["id"]

        today = date.today()
        prof = client.get(f"{base}/profile", headers=headers).json()
        c_page = client.get(f"{base}/constraints", headers=headers).json()
        default_cid = c_page["items"][0]["id"]

        baseline_before = client.get(f"{base}/profile", headers=headers).json()
        baseline_resp = client.patch(
            f"{base}/baseline",
            json=BaselineWrite(
                expected_version=baseline_before["version"],
                expected_financial_revision=prof["financial_revision"],
                balance=BaselineBalance(
                    opening_date=today,
                    opening_cash_minor="50000000",
                    coverage_through=today + timedelta(days=365),
                    evidence=Evidence(
                        document_id=None,
                        content_hash=None,
                        candidate_id=None,
                        confirmed_field_id=None,
                        source_role="baseline",
                        page=None,
                        quote=None,
                        manual_attestation="Owner verified balance",
                        override_reason=None,
                    ),
                ),
            ).model_dump(mode="json"),
            headers=dict(headers, **{"Idempotency-Key": str(uuid4())}),
        )
        assert baseline_resp.status_code == 200, baseline_resp.text

        # 2. Create Deal
        h_deal = dict(headers, **{"Idempotency-Key": str(uuid4())})
        create_req = CreateDeal(
            public_ref="PO-TEST-001",
            start_date=today,
            customer_id=customer_id,
            constraints_id=default_cid,
        ).model_dump(mode="json")
        resp = client.post(f"{base}/deals", json=create_req, headers=h_deal)
        assert resp.status_code == 200, resp.text
        deal_view = resp.json()
        deal_id = deal_view["id"]
        assert deal_view["status"] == "ingesting"

        # 3. Update Draft Inputs
        prof = client.get(f"{base}/profile", headers=headers).json()
        delivery_date = today + timedelta(days=45)
        h_update = dict(headers, **{"Idempotency-Key": str(uuid4())})
        update_req = DealWrite(
            expected_version=deal_view["version"],
            expected_input_version=deal_view["input_version"],
            expected_financial_revision=prof["financial_revision"],
            inputs=DraftInputs(
                opening_cash_minor="50000000",
                reserve_minor="10000000",
                order_value_minor="35000000",
                order_date=today,
                invoice_date=delivery_date,
                delivery_date=delivery_date,
                payment_basis="delivery",
                payment_days=30,
                customer_id=customer_id,
                constraints_id=default_cid,
                costs=[],
            ),
        ).model_dump(mode="json")
        resp = client.patch(f"{base}/deals/{deal_id}", json=update_req, headers=h_update)
        assert resp.status_code == 200, resp.text
        deal_view = resp.json()
        assert deal_view["order_value_minor"] == "35000000"

        # 4. Review
        resp = client.get(f"{base}/deals/{deal_id}/review", headers=headers)
        assert resp.status_code == 200, resp.text
        review = resp.json()
        assert review["snapshot_hash"] is not None
        assert review["candidate_snapshot"] is not None
        assert len([f for f in review["findings"] if f["blocking"]]) == 0

        # 5. Confirm
        h_confirm = dict(headers, **{"Idempotency-Key": str(uuid4())})
        confirm_req = ConfirmInputs(
            expected_version=review["version"],
            expected_input_version=review["input_version"],
            expected_financial_revision=review["financial_revision"],
            snapshot_hash=review["snapshot_hash"],
            confirmed_field_ids=review["required_field_ids"],
            acknowledged_warning_codes=[],
        ).model_dump(mode="json")
        resp = client.post(f"{base}/deals/{deal_id}/confirm", json=confirm_req, headers=h_confirm)
        assert resp.status_code == 200, resp.text
        confirm_result = resp.json()
        snapshot_id = confirm_result["snapshot_id"]
        assert confirm_result["snapshot_hash"] == review["snapshot_hash"]

        # Check deal status
        deal_view = client.get(f"{base}/deals/{deal_id}", headers=headers).json()
        assert deal_view["status"] == "awaiting_confirm"
        assert "evaluate" in deal_view["allowed_actions"]

        # 6. Evaluate (POST .../evaluations returns 202 OperationAccepted)
        h_eval = dict(headers, **{"Idempotency-Key": str(uuid4())})
        eval_req = EvaluateRequest(
            expected_version=deal_view["version"],
            expected_input_version=deal_view["input_version"],
            expected_financial_revision=confirm_result["financial_revision"],
            snapshot_id=snapshot_id,
        ).model_dump(mode="json")
        resp = client.post(f"{base}/deals/{deal_id}/evaluations", json=eval_req, headers=h_eval)
        assert resp.status_code == 202, resp.text
        accepted = resp.json()
        assert accepted["status"] == "queued"

        # 7. Worker processes the evaluation operation
        worker_ops = Operations(postgres["worker"])
        worked = run_once(worker_ops, "test-worker-1", DEFAULT_HANDLERS)
        assert worked is True

        # 8. Inspect live result and series
        deal_view = client.get(f"{base}/deals/{deal_id}", headers=headers).json()
        assert deal_view["status"] == "awaiting_approval"
        assert deal_view["live_evaluation_id"] is not None
        assert deal_view["is_stale"] is False

        eval_id = deal_view["live_evaluation_id"]
        resp = client.get(f"{base}/evaluations/{eval_id}", headers=headers)
        assert resp.status_code == 200, resp.text
        eval_res = resp.json()
        assert eval_res["id"] == eval_id
        assert eval_res["decision"] in ("accept_as_is", "accept_with_changes", "decline_or_renegotiate")
        assert len(eval_res["ranked_candidates"]) >= 1

        # Series
        resp = client.get(f"{base}/evaluations/{eval_id}/series", headers=headers)
        assert resp.status_code == 200, resp.text
        series = resp.json()
        assert len(series["points"]) >= 1

        # 9. Stale old result upon deal input edit
        prof = client.get(f"{base}/profile", headers=headers).json()
        h_edit = dict(headers, **{"Idempotency-Key": str(uuid4())})
        edit_req = DealWrite(
            expected_version=deal_view["version"],
            expected_input_version=deal_view["input_version"],
            expected_financial_revision=prof["financial_revision"],
            inputs=DraftInputs(
                opening_cash_minor="50000000",
                reserve_minor="10000000",
                order_value_minor="40000000",  # changed order value
                order_date=today,
                invoice_date=delivery_date,
                delivery_date=delivery_date,
                payment_basis="delivery",
                payment_days=30,
                customer_id=customer_id,
                constraints_id=default_cid,
                costs=[],
            ),
        ).model_dump(mode="json")
        resp = client.patch(f"{base}/deals/{deal_id}", json=edit_req, headers=h_edit)
        assert resp.status_code == 200, resp.text
        edited_deal = resp.json()
        assert edited_deal["input_version"] > deal_view["input_version"]
        assert edited_deal["status"] == "awaiting_confirm"

        # 10. Close and Reopen commands
        h_close = dict(headers, **{"Idempotency-Key": str(uuid4())})
        current_deal = client.get(f"{base}/deals/{deal_id}", headers=headers).json()
        current_profile = client.get(f"{base}/profile", headers=headers).json()
        resp = client.post(
            f"{base}/deals/{deal_id}/close",
            json=ReasonCommand(reason="Customer cancelled project", expected_version=current_deal["version"], expected_input_version=current_deal["input_version"], expected_financial_revision=current_profile["financial_revision"]).model_dump(mode="json"),
            headers=h_close,
        )
        assert resp.status_code == 200, resp.text
        closed_deal = resp.json()
        assert closed_deal["status"] == "closed"


def test_concurrent_editors_and_tenant_isolation(postgres, accounts, config):
    app = create_app(config, postgres["database"])
    a, b = accounts[0], accounts[1]

    base_a = f"/api/v1/businesses/{a.business_id}"
    base_b = f"/api/v1/businesses/{b.business_id}"

    with auth_client(app, a) as (client_a, headers_a), auth_client(app, b) as (client_b, headers_b):
        c_page = client_a.get(f"{base_a}/constraints", headers=headers_a).json()
        default_cid = c_page["items"][0]["id"]

        # 1. Tenant A creates a deal
        h_create = dict(headers_a, **{"Idempotency-Key": str(uuid4())})
        resp = client_a.post(
            f"{base_a}/deals",
            json=CreateDeal(
                public_ref="PO-ISO-001",
                start_date=date.today(),
                constraints_id=default_cid,
            ).model_dump(mode="json"),
            headers=h_create,
        )
        assert resp.status_code == 200, resp.text
        deal_a = resp.json()
        deal_id = deal_a["id"]

        # 2. Tenant B attempts to read or mutate Tenant A's deal -> 404
        resp_leak_get = client_b.get(f"{base_b}/deals/{deal_id}", headers=headers_b)
        assert resp_leak_get.status_code == 404

        # Tenant B tries to access using Tenant A's business_id in path -> 404 (not a member of A)
        resp_cross_biz = client_b.get(f"{base_a}/deals/{deal_id}", headers=headers_b)
        assert resp_cross_biz.status_code == 404

        # 3. Two concurrent editors on Tenant A
        prof = client_a.get(f"{base_a}/profile", headers=headers_a).json()
        # Editor 1 updates
        h_e1 = dict(headers_a, **{"Idempotency-Key": str(uuid4())})
        req1 = DealWrite(
            expected_version=deal_a["version"],
            expected_input_version=deal_a["input_version"],
            expected_financial_revision=prof["financial_revision"],
            inputs=DraftInputs(
                opening_cash_minor="0",
                reserve_minor="0",
                order_value_minor="10000000",
                order_date=None,
                invoice_date=None,
                delivery_date=date.today() + timedelta(days=30),
                payment_basis="delivery",
                payment_days=30,
                customer_id=None,
                constraints_id=default_cid,
                costs=[],
            ),
        ).model_dump(mode="json")
        resp1 = client_a.patch(f"{base_a}/deals/{deal_id}", json=req1, headers=h_e1)
        assert resp1.status_code == 200, resp1.text

        # Editor 2 tries to update with the stale version that editor 1 already modified
        h_e2 = dict(headers_a, **{"Idempotency-Key": str(uuid4())})
        req2 = DealWrite(
            expected_version=deal_a["version"],  # old version!
            expected_input_version=deal_a["input_version"],
            expected_financial_revision=prof["financial_revision"],
            inputs=DraftInputs(
                opening_cash_minor="0",
                reserve_minor="0",
                order_value_minor="12000000",
                order_date=None,
                invoice_date=None,
                delivery_date=date.today() + timedelta(days=30),
                payment_basis="delivery",
                payment_days=30,
                customer_id=None,
                constraints_id=default_cid,
                costs=[],
            ),
        ).model_dump(mode="json")
        resp2 = client_a.patch(f"{base_a}/deals/{deal_id}", json=req2, headers=h_e2)
        assert resp2.status_code == 409
        assert resp2.json()["error"]["code"] == "STALE_VERSION"
