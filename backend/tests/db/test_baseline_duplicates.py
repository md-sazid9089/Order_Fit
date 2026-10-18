"""Persisted regressions for source identity, reviewed matches and stale recovery."""

from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.store.baseline_duplicates import check_source
from tests.db import test_p7_operations as p7
from tests.db.test_migration_merge import _fresh_database, _upgrade
from tests.db.test_p3_vertical_slice import auth_client
from tests.db.test_p4_documents import Session, drain, make_deal, operation, upload

world = p7.world


def event(description="Synthetic rent", invoice_ref=None, **changes):
    return dict(
        deal_id=None, event_date="2026-11-01", amount_minor="125000",
        direction="out", kind="rent", certainty="confirmed", description=description,
        invoice_ref=invoice_ref, is_deferrable=False, incremental=False,
        customer_id=None, payee_id=None,
        evidence=dict(document_id=None, content_hash=None, candidate_id=None,
                      confirmed_field_id=None, source_role="baseline", page=None,
                      quote=None, manual_attestation="Synthetic duplicate regression ledger",
                      override_reason=None),
    ) | changes


def review(*ids):
    return dict(matching_event_ids=list(ids), reason="Separate obligations verified against the source ledger")


def create(s, ev=None, **kwargs):
    return s.write("POST", "/cash-events", dict(
        expected_financial_revision=s.read("/profile")["financial_revision"],
        event=ev or event(), **kwargs)).json()


def preview(s, postgres, app, doc):
    revision = s.read("/profile")["financial_revision"]
    accepted = s.write("POST", "/cash-events/csv-preview", dict(
        document_id=doc["id"], currency="BDT", expected_financial_revision=revision,
        as_of="2026-10-15")).json()
    drain(postgres, app, "off")
    data = s.read(f"/cash-events/csv-previews/{operation(s, accepted)['result']['resource_id']}")
    return data, dict(preview_id=data["id"], preview_hash=data["preview_hash"],
                      expected_financial_revision=revision)


def test_manual_retry_review_edit_void_and_cashflow(postgres, accounts, config):
    a = accounts[0]
    with auth_client(create_app(config, postgres["database"]), a) as (client, headers):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        make_deal(s)
        before = int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"])
        body = dict(expected_financial_revision=s.read("/profile")["financial_revision"], event=event())
        command_headers = headers | {"Idempotency-Key": str(uuid4())}
        first = client.post(s.base + "/cash-events", json=body, headers=command_headers)
        assert first.status_code == 200, first.text
        first = first.json()
        replay = client.post(s.base + "/cash-events", json=body, headers=command_headers)
        assert replay.status_code == 200 and replay.json() == first
        stale = s.write("POST", "/cash-events", body, expect=(409,))
        assert stale.json()["error"]["code"] == "STALE_FINANCIAL_REVISION"

        body["expected_financial_revision"] = s.read("/profile")["financial_revision"]
        blocked = s.write("POST", "/cash-events", body, expect=(409,)).json()["error"]
        assert blocked["code"] == "BASELINE_DUPLICATE_REVIEW_REQUIRED"
        assert blocked["details"]["matching_event_ids"] == [first["id"]]
        assert int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"]) == before - 125000
        second = create(s, duplicate_review=review(first["id"]))
        assert s.read(f"/cash-events/{second['id']}/duplicates")["matching_events"] == []
        assert int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"]) == before - 250000

        third = create(s, event(amount_minor="126000"))
        edit = dict(expected_version=third["version"],
                    expected_financial_revision=s.read("/profile")["financial_revision"], event=event())
        rejected = s.write("PATCH", f"/cash-events/{third['id']}", edit, expect=(409,)).json()
        assert set(rejected["error"]["details"]["matching_event_ids"]) == {first["id"], second["id"]}
        edit["duplicate_review"] = review(first["id"])
        s.write("PATCH", f"/cash-events/{third['id']}", edit, expect=(409,))
        edit["duplicate_review"] = review(first["id"], second["id"])
        changed = s.write("PATCH", f"/cash-events/{third['id']}", edit).json()
        assert changed["event"] == first["event"]
        assert s.read(f"/cash-events/{third['id']}/duplicates")["matching_events"] == []

        # Voiding removes an event from financial matching without erasing history.
        for row in (first, second, changed):
            s.write("POST", f"/cash-events/{row['id']}/void", dict(
                expected_version=row["version"],
                expected_financial_revision=s.read("/profile")["financial_revision"],
                reason="Duplicate test cleanup through audited void"))
        replacement = create(s)
        assert replacement["id"] not in {first["id"], second["id"], changed["id"]}
        assert int(s.read("/cash-flow")["points"][-1]["baseline_close_minor"]) == before - 125000


def test_csv_source_repeat_overlap_atomicity_and_void(postgres, accounts, config):
    a = accounts[0]
    app = create_app(config, postgres["database"])
    with auth_client(app, a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        header = "event_date,amount,direction,kind,certainty,description,invoice_ref\n"
        line = "2026-11-01,1250.00,out,rent,confirmed,Synthetic rent,INV-REPEAT\n"
        bad = upload(s, deal["id"], "repeated.csv", (header + line * 2).encode(),
                     "text/csv", "csv", "baseline").json()
        data, body = preview(s, postgres, app, bad)
        assert any(e["code"] == "CSV-POSSIBLE-DUPLICATE" for e in data["errors"])
        s.write("POST", "/cash-events/csv-confirm", body, expect=(422,))
        doc = upload(s, deal["id"], "single.csv", (header + line).encode(),
                     "text/csv", "csv", "baseline").json()
        _, body = preview(s, postgres, app, doc)
        first = s.write("POST", "/cash-events/csv-confirm", body).json()["items"][0]
        with pytest.raises(DBAPIError) as duplicate_claim:
            with postgres["database"].tenant(a.token, a.business_id, "manage_finance") as (c, _):
                c.execute(text("INSERT INTO cash_event_source_claim SELECT * FROM cash_event_source_claim"))
        assert duplicate_claim.value.orig.sqlstate == "23505"
        with pytest.raises(DBAPIError):
            with postgres["database"].tenant(a.token, a.business_id, "manage_finance") as (c, _):
                c.execute(text("DELETE FROM cash_event_source_claim"))
        _, repeat = preview(s, postgres, app, doc)
        denied = s.write("POST", "/cash-events/csv-confirm", repeat, expect=(409,)).json()["error"]
        assert denied["code"] == "BASELINE_SOURCE_ALREADY_IMPORTED"
        assert denied["details"]["matching_event_ids"] == [first["id"]]

        # New file version: one new payment followed by a matching existing invoice.
        # Failure on row 3 must roll back row 2 and every source claim/confirmation.
        revised = header + "2026-11-02,7.00,out,tax,confirmed,Tax,\n" + line
        doc2 = upload(s, deal["id"], "overlap.csv", revised.encode(),
                      "text/csv", "csv", "baseline").json()
        _, overlap = preview(s, postgres, app, doc2)
        denied = s.write("POST", "/cash-events/csv-confirm", overlap, expect=(409,)).json()["error"]
        assert denied["details"]["source_row"] == 3
        assert len(s.read("/cash-events")["items"]) == 1
        overlap["duplicate_reviews"] = [dict(row_number=3, duplicate_review=review(first["id"]))]
        imported = s.write("POST", "/cash-events/csv-confirm", overlap).json()["items"]
        assert len(imported) == 2

        manual = dict(expected_financial_revision=s.read("/profile")["financial_revision"],
                      event=event(invoice_ref=" inv-repeat ", event_date="2026-12-01", amount_minor="500"))
        denied = s.write("POST", "/cash-events", manual, expect=(409,)).json()["error"]
        assert set(denied["details"]["matching_event_ids"]) == {first["id"], imported[1]["id"]}
        s.write("POST", f"/cash-events/{first['id']}/void", dict(
            expected_version=first["version"], expected_financial_revision=manual["expected_financial_revision"],
            reason="Source event corrected by audited void"))
        _, repeat = preview(s, postgres, app, doc)
        denied = s.write("POST", "/cash-events/csv-confirm", repeat, expect=(409,)).json()["error"]
        assert denied["code"] == "BASELINE_SOURCE_ALREADY_IMPORTED"


def test_legacy_review_gate_version_binding_rls_and_immutability(postgres, accounts, config):
    a, other = accounts
    app = create_app(config, postgres["database"])
    with auth_client(app, a) as (client, headers):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        first = create(s)
        # Simulate pre-fix financial history without erasing or merging anything.
        with postgres["database"].tenant(a.token, a.business_id, "manage_finance") as (c, _):
            second_id = str(c.execute(text("""INSERT INTO cash_event
              (business_id,event_date,amount_minor,direction,kind,certainty,description,evidence)
              SELECT business_id,event_date,amount_minor,direction,kind,certainty,description,evidence
              FROM cash_event WHERE id=:id RETURNING id"""), {"id": int(first["id"])}).scalar_one())
        gate = s.read(f"/deals/{deal['id']}/review")
        assert any(f["code"] == "BASELINE_DUPLICATE_UNRESOLVED" and f["blocking"] for f in gate["findings"])
        assert gate["candidate_snapshot"] is None
        candidates = s.read(f"/cash-events/{second_id}/duplicates")
        assert [r["id"] for r in candidates["matching_events"]] == [first["id"]]
        body = dict(expected_version=candidates["version"],
                    expected_financial_revision=candidates["financial_revision"],
                    duplicate_review=review(first["id"]))
        command_headers = headers | {"Idempotency-Key": str(uuid4())}
        result = client.post(s.base + f"/cash-events/{second_id}/duplicate-review", json=body, headers=command_headers)
        assert result.status_code == 200, result.text
        assert result.json()["financial_revision"] > body["expected_financial_revision"]
        assert result.json()["matching_events"] == []
        assert client.post(s.base + f"/cash-events/{second_id}/duplicate-review", json=body,
                           headers=command_headers).json() == result.json()
        assert not any(f["code"] == "BASELINE_DUPLICATE_UNRESOLVED"
                       for f in s.read(f"/deals/{deal['id']}/review")["findings"])
        with postgres["database"].tenant(a.token, a.business_id, "manage_finance") as (c, _):
            c.execute(text("UPDATE cash_event SET description='Evidence changed' WHERE id=:id"), {"id": int(second_id)})
        assert s.read(f"/cash-events/{second_id}/duplicates")["matching_events"]
        with pytest.raises(DBAPIError):
            with postgres["database"].tenant(a.token, a.business_id, "manage_finance") as (c, _):
                c.execute(text("DELETE FROM cash_event_duplicate_review WHERE business_id=:b"), {"b": a.business_id})
    with auth_client(app, other) as (client, headers):
        assert client.get(f"/api/v1/businesses/{a.business_id}/cash-events/{second_id}/duplicates").status_code == 404
        assert client.post(f"/api/v1/businesses/{a.business_id}/cash-events/{second_id}/duplicate-review",
                           json=body, headers=headers | {"Idempotency-Key": str(uuid4())}).status_code == 404
    with postgres["database"].tenant(other.token, other.business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM cash_event_duplicate_review")).scalar_one() == 0


def test_concurrent_duplicate_commands_have_one_winner(postgres, accounts, config):
    a = accounts[0]
    app = create_app(config, postgres["database"])
    with auth_client(app, a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        make_deal(s)
        body = dict(expected_financial_revision=s.read("/profile")["financial_revision"], event=event())
    barrier = Barrier(2)

    def submit(_):
        with auth_client(app, a) as (client, headers):
            barrier.wait(timeout=10)
            return client.post(f"/api/v1/businesses/{a.business_id}/cash-events", json=body,
                               headers=headers | {"Idempotency-Key": str(uuid4())})

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(submit, range(2)))
    assert sorted(r.status_code for r in results) == [200, 409]
    assert next(r for r in results if r.status_code == 409).json()["error"]["code"] == "STALE_FINANCIAL_REVISION"


def test_migration_backfills_source_claims_preserves_duplicates_and_invalidates(postgres):
    url, conninfo = _fresh_database(postgres, "baseline_duplicate_legacy_cutover")
    _upgrade(url, "0021_admin_reads")
    user, business, constraints, deal, document, preview_id = [uuid4() for _ in range(6)]
    with psycopg.connect(conninfo) as c:
        c.execute("INSERT INTO app_user(id,email,full_name,status) VALUES(%s,'legacy@probe.invalid','Synthetic legacy','active')", (user,))
        c.execute("INSERT INTO business(id,name,currency) VALUES(%s,'Synthetic legacy','BDT')", (business,))
        c.execute("INSERT INTO owner_constraints(id,business_id,version,safety_reserve_minor,created_by) VALUES(%s,%s,1,0,%s)", (constraints, business, user))
        c.execute("INSERT INTO deal(id,business_id,public_ref,constraints_id,created_by,currency,start_date,reserve_minor) VALUES(%s,%s,'LEGACY',%s,%s,'BDT','2026-10-15',0)", (deal, business, constraints, user))
        c.execute("INSERT INTO document(id,business_id,deal_id,kind,content_hash,storage_key,original_filename,mime_type,size_bytes,uploaded_by,source_role) VALUES(%s,%s,%s,'csv',decode(repeat('aa',32),'hex'),'synthetic','legacy.csv','text/csv',20,%s,'baseline')", (document, business, deal, user))
        for _ in range(2):
            c.execute("INSERT INTO cash_event(business_id,event_date,amount_minor,direction,kind,source_document_id,source_quote) VALUES(%s,'2026-11-01',125000,'out','rent',%s,'row 2')", (business, document))
        c.execute("INSERT INTO csv_preview(id,business_id,deal_id,document_id,financial_revision,currency,as_of,events,errors,duplicate_keys,preview_hash) VALUES(%s,%s,%s,%s,1,'BDT','2026-10-15','[{\"row\":2},{\"row\":3}]','[]','[]',decode(repeat('bb',32),'hex'))", (preview_id, business, deal, document))
        c.execute("INSERT INTO csv_confirmation(preview_id,business_id,confirmed_by) VALUES(%s,%s,%s)", (preview_id, business, user))
        before = c.execute("SELECT id,amount_minor,event_date,version FROM cash_event ORDER BY id").fetchall()
        revision = c.execute("SELECT financial_revision FROM business WHERE id=%s", (business,)).fetchone()[0]
    _upgrade(url, "0022_baseline_duplicates")
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT id,amount_minor,event_date,version FROM cash_event ORDER BY id").fetchall() == before
        assert c.execute("SELECT cash_event_id,source_row FROM cash_event_source_claim").fetchall() == [(before[0][0], 2)]
        assert c.execute("SELECT count(*) FROM cash_event_duplicate_review").fetchone()[0] == 0
        assert c.execute("SELECT financial_revision FROM business WHERE id=%s", (business,)).fetchone()[0] == revision + 1
        assert c.execute("SELECT count(*) FROM operation_log WHERE action='baseline_duplicate_policy_cutover'").fetchone()[0] == 1
    engine = create_engine(url)
    try:
        with engine.begin() as c, pytest.raises(ApplicationError) as unlinked_source:
            check_source(c, business, "aa" * 32, 3, preview_id=uuid4())
        assert unlinked_source.value.code == "BASELINE_SOURCE_ALREADY_IMPORTED"
        assert unlinked_source.value.details.matching_event_ids == []
    finally:
        engine.dispose()


def test_csv_installments_use_stable_source_row_reviews(postgres, accounts, config):
    a = accounts[0]
    app = create_app(config, postgres["database"])
    with auth_client(app, a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        contents = ("event_date,amount,direction,kind,invoice_ref\n"
                    "2026-11-01,10.00,out,rent,INSTALLMENT\n"
                    "2026-12-01,20.00,out,rent, installment \n")
        doc = upload(s, deal["id"], "installments.csv", contents.encode(),
                     "text/csv", "csv", "baseline").json()
        _, body = preview(s, postgres, app, doc)
        error = s.write("POST", "/cash-events/csv-confirm", body, expect=(409,)).json()["error"]
        assert error["code"] == "BASELINE_DUPLICATE_REVIEW_REQUIRED"
        assert error["details"]["source_row"] == 3
        assert error["details"]["matching_event_ids"] == []
        assert error["details"]["matching_source_rows"] == [2]
        assert s.read("/cash-events")["items"] == []
        body["duplicate_reviews"] = [dict(row_number=3, matching_source_rows=[2],
                                         duplicate_review=review())]
        saved = s.write("POST", "/cash-events/csv-confirm", body).json()["items"]
        assert len(saved) == 2
        assert s.read(f"/cash-events/{saved[1]['id']}/duplicates")["matching_events"] == []


def test_known_counterparties_are_distinct_unknown_matches_both(postgres, accounts, config):
    a = accounts[0]
    with auth_client(create_app(config, postgres["database"]), a) as (client, _):
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        make_deal(s)
        ids = []
        for name in ("Landlord one", "Landlord two"):
            payee = s.write("POST", "/payees", dict(
                expected_financial_revision=s.read("/profile")["financial_revision"],
                payee=dict(name=name, kind="supplier", category="other", terms_days=None,
                           terms_note=None, delay_tolerance_note=None, risk_rating=None, known_domains=[]))).json()
            ids.append(create(s, event(payee_id=payee["id"]))["id"])
        blocked = s.write("POST", "/cash-events", dict(
            expected_financial_revision=s.read("/profile")["financial_revision"], event=event()), expect=(409,)).json()
        assert set(blocked["error"]["details"]["matching_event_ids"]) == set(ids)


def test_viewer_can_inspect_but_cannot_review(world):
    owner = world["signup"]()
    viewer = p7.join(world, owner, "viewer")
    first = owner.ok("POST", "/cash-events", dict(
        expected_financial_revision=owner.revision(), event=event()))
    assert viewer.read(f"/cash-events/{first['id']}/duplicates")["event"]["id"] == first["id"]
    response = viewer.send("POST", f"/cash-events/{first['id']}/duplicate-review", dict(
        expected_version=first["version"], expected_financial_revision=viewer.revision(),
        duplicate_review=review(first["id"])))
    assert response.status_code == 403
