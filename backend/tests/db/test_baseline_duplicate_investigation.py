"""Characterize the reported duplicate bug; passing means it is reproducible.

These are investigation probes, not acceptance of duplicate financial obligations.
Convert the assertions to rejection/warning expectations when implementing a policy.
"""

from uuid import uuid4

from orderfit.api.main import create_app
from tests.db.test_p3_vertical_slice import auth_client
from tests.db.test_p4_documents import Session, drain, make_deal, operation, upload


def event(description="Synthetic rent", invoice_ref=None):
    return dict(
        deal_id=None, event_date="2026-11-01", amount_minor="125000",
        direction="out", kind="rent", certainty="confirmed", description=description,
        invoice_ref=invoice_ref, is_deferrable=False, incremental=False,
        customer_id=None, payee_id=None,
        evidence=dict(document_id=None, content_hash=None, candidate_id=None,
                      confirmed_field_id=None, source_role="baseline", page=None,
                      quote=None, manual_attestation="Synthetic investigation ledger",
                      override_reason=None),
    )


def test_manual_duplicate_retry_edit_and_cashflow(postgres, accounts, config):
    a = accounts[0]
    with auth_client(create_app(config, postgres["database"]), a) as (client, headers):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        make_deal(s)
        before = int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"])
        body = dict(expected_financial_revision=s.read("/profile")["financial_revision"],
                    event=event())
        command_headers = headers | {"Idempotency-Key": str(uuid4())}
        first = client.post(s.base + "/cash-events", json=body, headers=command_headers)
        assert first.status_code == 200, first.text
        replay = client.post(s.base + "/cash-events", json=body, headers=command_headers)
        assert replay.status_code == 200 and replay.json() == first.json()
        stale = s.write("POST", "/cash-events", body, expect=(409,))
        assert stale.json()["error"]["code"] == "STALE_FINANCIAL_REVISION"

        body["expected_financial_revision"] = s.read("/profile")["financial_revision"]
        second = s.write("POST", "/cash-events", body).json()
        assert second["id"] != first.json()["id"]
        assert second["event"] == first.json()["event"]
        assert int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"]) == before - 250000

        # An edit can turn a previously distinct event into the same obligation too.
        third = s.write("POST", "/cash-events", dict(
            expected_financial_revision=s.read("/profile")["financial_revision"],
            event=event("Different initial description", "INV-DISTINCT"))).json()
        changed = s.write("PATCH", f"/cash-events/{third['id']}", dict(
            expected_version=third["version"],
            expected_financial_revision=s.read("/profile")["financial_revision"],
            event=event())).json()
        assert changed["event"] == first.json()["event"]
        assert int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"]) == before - 375000
        live = [r for r in s.read("/cash-events")["items"] if not r["voided_at"]]
        assert len(live) == 3
        print("PROBE manual: exact replay=one ID; stale revision=409; fresh duplicate=200; edit to duplicate=200; 3 x 125000 counted")


def test_repreview_same_csv_and_manual_overlap(postgres, accounts, config):
    a = accounts[0]
    app = create_app(config, postgres["database"])
    with auth_client(app, a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        data = ("event_date,amount,direction,kind,certainty,description,invoice_ref\n"
                "2026-11-01,1250.00,out,rent,confirmed,Synthetic rent,INV-REPEAT\n"
                "2026-11-01,1250.00,out,rent,confirmed,Synthetic rent,INV-REPEAT\n")
        doc = upload(s, deal["id"], "duplicate-probe.csv", data.encode(),
                     "text/csv", "csv", "baseline").json()
        ids = []
        for _ in range(2):
            revision = s.read("/profile")["financial_revision"]
            accepted = s.write("POST", "/cash-events/csv-preview", dict(
                document_id=doc["id"], currency="BDT",
                expected_financial_revision=revision, as_of="2026-10-15")).json()
            drain(postgres, app, "off")
            preview = s.read(f"/cash-events/csv-previews/{operation(s, accepted)['result']['resource_id']}")
            assert len(preview["events"]) == 1 and len(preview["duplicate_keys"]) == 1
            confirmed = s.write("POST", "/cash-events/csv-confirm", dict(
                preview_id=preview["id"], preview_hash=preview["preview_hash"],
                expected_financial_revision=revision)).json()
            ids.append(confirmed["items"][0]["id"])
        assert ids[0] != ids[1]
        manual = s.write("POST", "/cash-events", dict(
            expected_financial_revision=s.read("/profile")["financial_revision"],
            event=event(invoice_ref="INV-REPEAT"))).json()
        assert manual["id"] not in ids
        live = [r for r in s.read("/cash-events")["items"] if not r["voided_at"]]
        assert len(live) == 3 and sum(int(r["event"]["amount_minor"]) for r in live) == 375000
        print("PROBE CSV: within-file duplicate removed; same document with new preview imported twice; manual same invoice accepted; 3 rows persisted")


def test_distinct_storage_ids_pass_snapshot_and_engine_duplicate_guards():
    from orderfit.agent.nodes.compute import to_engine_input
    from orderfit.contracts.financial import ConfirmedInputV1
    from orderfit.engine.diagnostics import coverage_and_duplicate_warnings
    from orderfit.engine.events import parse_events
    from orderfit.engine.timeline import sweep
    from orderfit.engine.validation import validate_case
    from tests.contracts.examples import snapshot

    raw = snapshot()
    original = raw["baseline_events"][0]
    original["invoice_ref"] = "SAME-RENT-INVOICE"
    raw["baseline_events"].append(original | {
        "event_id": "9007199254740994", "original_obligation_id": "obl-9007199254740994"})
    confirmed = ConfirmedInputV1.model_validate(raw)
    case = to_engine_input(confirmed).model_dump(mode="python", exclude_none=True)
    _, blocks = validate_case(case)
    assert not any(b["code"] == "E-DUPLICATE-OBLIGATION" for b in blocks)
    assert not any(f["code"] == "W-POSSIBLE-DUPLICATE" for f in coverage_and_duplicate_warnings(case))
    events = parse_events(case["baseline_events"], "baseline", "BDT")
    day = events[0].date
    close = sweep(case["opening_balance"], events, case["as_of"], day)[day][1]
    assert close == case["opening_balance"] - 24000000
    print("PROBE engine: same baseline invoice with distinct row/obligation IDs accepted; no duplicate flag; both amounts counted")
