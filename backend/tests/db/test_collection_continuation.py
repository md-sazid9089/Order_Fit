"""HTTP consumer contracts for every supporting legacy collection, synthetic rows."""
from uuid import uuid4

from fastapi.testclient import TestClient

from orderfit.api.main import create_app
from tests.db.test_p4_documents import Session, make_deal, upload


def test_supporting_collections_have_signed_scoped_accurate_continuation(postgres, accounts, config):
    a = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        policy = s.read("/constraints")["items"][0]
        owner_settings = {k: v for k, v in policy["owner"].items() if k not in {"constraints_id", "version"}}
        def revision():
            return s.read("/profile")["financial_revision"]
        evidence = dict(document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
            source_role="baseline", page=None, quote=None, manual_attestation="Synthetic continuation evidence", override_reason=None)
        for i in range(3):
            lender = s.write("POST", "/payees", dict(expected_financial_revision=revision(), payee=dict(
                name=f"Paged lender {i}", kind="lender", category="finance", terms_days=None, terms_note=None,
                delay_tolerance_note=None, risk_rating=None, known_domains=[]))).json()
            s.write("POST", "/financing-offers", dict(expected_financial_revision=revision(), terms=dict(
                name=f"Paged loan {i}", kind="term_loan", interest_method="flat_term", interest_bps=100,
                fee_bps=0, fee_flat_minor="0", fee_at="draw", lead_days=0, min_minor="1000", max_minor="1000",
                step_minor="1000", term_days=30, available_from="2026-10-15", valid_until="2027-10-15",
                status="active", payee_id=lender["id"], payee_version=lender["version"], account_id=None,
                account_version=None, evidence=[evidence])))
            s.write("POST", "/constraints", dict(expected_financial_revision=revision(), reserve_minor=policy["reserve_minor"],
                owner=owner_settings, scenarios=policy["scenarios"], strategy_space=policy["strategy_space"], make_default=False))
            s.write("POST", "/cash-events", dict(expected_financial_revision=revision(), event=dict(
                deal_id=None, event_date="2026-11-01", amount_minor="100", direction="out", kind="rent",
                certainty="confirmed", description=f"Paged cost {i}", invoice_ref=None, is_deferrable=False,
                incremental=False, customer_id=None, payee_id=None, evidence=evidence)))
            s.write("POST", "/deals", dict(public_ref="PAGE-"+uuid4().hex, start_date="2026-10-15",
                customer_id=deal["inputs"]["customer_id"], constraints_id=policy["id"]))
            upload(s, deal["id"], f"page-{i}.txt", f"Synthetic source page {i}".encode(), "text/plain", "po", "customer_order")
        for path, total in [("/payees", 3), ("/financing-offers", 3), ("/constraints", 4),
                            ("/cash-events", 3), ("/deals", 4), (f"/deals/{deal['id']}/documents", 3)]:
            first = s.read(path+"?limit=2")
            assert len(first["items"]) == 2 and first["next_cursor"]
            token = first["next_cursor"]
            second = s.read(path+"?limit=2&cursor="+token)
            assert len(second["items"]) == total-2 and second["next_cursor"] is None
            assert len({r["id"] for r in first["items"] + second["items"]}) == total
            assert s.read(path+"?offset=1&cursor="+token, expect=422)["error"]["code"] == "INVALID_CURSOR"
            assert s.read("/customers?cursor="+token, expect=422)["error"]["code"] == "INVALID_CURSOR"
        # Default policy remains discoverable even after many non-default versions.
        default = s.read("/constraints?default_only=true")
        assert [p["id"] for p in default["items"]] == [policy["id"]]
        first = s.read("/constraints?limit=2")
        assert s.read("/constraints?default_only=true&cursor="+first["next_cursor"], expect=422)["error"]["code"] == "INVALID_CURSOR"
        docs = s.read(f"/deals/{deal['id']}/documents?limit=2")
        another = s.read("/deals?limit=2")["items"][0]
        assert s.read(f"/deals/{another['id']}/documents?cursor="+docs["next_cursor"], expect=422)["error"]["code"] == "INVALID_CURSOR"
