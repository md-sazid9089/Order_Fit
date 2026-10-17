"""Multipart command identity and immutable-source integrity on restricted PG17 logins."""

import hashlib
import json
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from orderfit.api.main import create_app
from tests.db.test_p4_documents import Session, drain, make_deal, operation, versions


@pytest.fixture
def upload_case(postgres, config, accounts):
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        session = Session(client, account, f"/api/v1/businesses/{account.business_id}")
        deal = make_deal(session)
        yield client, session, deal, account


def upload(client, session, deal, key, *, body=b"Original synthetic source", metadata=None,
           name="source.txt", mime="text/plain"):
    metadata = metadata or dict(kind="other", source_role="other", **versions(session, deal["id"]))
    return client.post(
        session.base + f"/deals/{deal['id']}/documents",
        headers=session.headers | {"Idempotency-Key": key},
        data={"metadata": json.dumps(metadata)}, files={"file": (name, body, mime)},
    )


def counts(postgres, account, deal):
    with postgres["database"].tenant(account.token, account.business_id) as (c, _):
        return tuple(c.execute(text("""
            SELECT (SELECT count(*) FROM document WHERE business_id=:b AND deal_id=:d),
                   (SELECT count(*) FROM document_parse WHERE business_id=:b AND deal_id=:d),
                   (SELECT count(*) FROM operation_log WHERE business_id=:b AND deal_id=:d
                     AND action='upload_document')
        """), {"b": account.business_id, "d": deal["id"]}).one())


def test_upload_key_binds_bytes_metadata_actor_and_path(upload_case, postgres, accounts):
    client, session, deal, account = upload_case
    key = str(uuid4())
    metadata = dict(kind="other", source_role="other", **versions(session, deal["id"]))
    first = upload(client, session, deal, key, metadata=metadata)
    assert first.status_code == 201, first.text
    assert counts(postgres, account, deal) == (1, 1, 1)

    # A different source under the same command identity must not create new evidence.
    changed = upload(client, session, deal, key, body=b"Changed synthetic source", metadata=metadata)
    assert changed.status_code == 409, changed.text
    assert changed.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    renamed = upload(client, session, deal, key, metadata=metadata, name="different.txt")
    assert renamed.status_code == 409, renamed.text
    assert renamed.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    reclassified = upload(client, session, deal, key, metadata=metadata | {"kind": "cash", "source_role": "baseline"})
    assert reclassified.status_code == 409, reclassified.text
    assert reclassified.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"

    other_deal = session.write("POST", "/deals", dict(
        public_ref="DOC-" + uuid4().hex[:10], start_date=deal["start_date"],
        customer_id=deal["inputs"]["customer_id"],
        constraints_id=deal["inputs"]["constraints_id"],
    )).json()
    foreign_path = upload(client, session, other_deal, key)
    assert foreign_path.status_code == 409, foreign_path.text
    assert foreign_path.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert counts(postgres, account, other_deal) == (0, 0, 0)

    other = accounts[1]
    with postgres["database"].tenant(account.token, account.business_id, "manage_members") as (c, _):
        c.execute(text("INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'commercial_lead')"),
                  {"u": other.user_id, "b": account.business_id})
    client.cookies.set("orderfit_session", other.token)
    client.cookies.set("orderfit_csrf", other.csrf)
    other_session = Session(client, other, session.base)
    foreign_actor = upload(client, other_session, deal, key, metadata=metadata)
    assert foreign_actor.status_code == 409, foreign_actor.text
    assert foreign_actor.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert counts(postgres, account, deal) == (1, 1, 1)
    assert len(list(client.app.state.documents.root.rglob("*.tmp"))) == 0
    assert len([p for p in client.app.state.documents.root.rglob("*") if p.is_file()]) == 1
    with postgres["database"].tenant(account.token, account.business_id) as (c, _):
        row = c.execute(text("SELECT scope,status,response->>'id' FROM idempotency_key "
                             "WHERE business_id=:b AND key=:k"),
                        {"b": account.business_id, "k": key}).one()
        assert tuple(row) == (session.base + f"/deals/{deal['id']}/documents", "completed", first.json()["id"])

    # Keys belong to a business: an independent tenant may use the same text safely.
    own_session = Session(client, other, f"/api/v1/businesses/{other.business_id}")
    own_deal = make_deal(own_session)
    own_upload = upload(client, own_session, own_deal, key)
    assert own_upload.status_code == 201, own_upload.text
    assert own_upload.json()["id"] != first.json()["id"]


def test_csv_preview_rejects_substituted_bytes_and_recovers_original(upload_case, postgres):
    client, session, deal, account = upload_case
    original = b"event_date,amount,direction,kind\n2026-11-01,100.00,out,payroll\n"
    substituted = original.replace(b"100.00", b"900.00")
    metadata = dict(kind="csv", source_role="baseline", **versions(session, deal["id"]))
    response = upload(client, session, deal, str(uuid4()), body=original, metadata=metadata,
                      name="ledger.csv", mime="text/csv")
    assert response.status_code == 201, response.text
    document = response.json()

    def preview():
        accepted = session.write("POST", "/cash-events/csv-preview", dict(
            document_id=document["id"], currency="BDT", as_of="2026-10-15",
            expected_financial_revision=session.read("/profile")["financial_revision"],
        )).json()
        drain(postgres, client.app, "off")
        return operation(session, accepted)

    positive = preview()
    assert positive["status"] == "succeeded", positive
    result = session.read(f"/cash-events/csv-previews/{positive['result']['resource_id']}")
    assert result["events"][0]["amount_minor"] == "10000"

    def persisted():
        with postgres["database"].tenant(account.token, account.business_id) as (c, _):
            return tuple(c.execute(text("""
                SELECT (SELECT count(*) FROM csv_preview WHERE business_id=:b),
                       (SELECT count(*) FROM cash_event WHERE business_id=:b),
                       (SELECT count(*) FROM operation_log WHERE business_id=:b AND action='csv_preview')
            """), {"b": account.business_id}).one())

    before = persisted()
    storage_path = client.app.state.documents._path(account.business_id, deal["id"], document["id"])
    storage_path.write_bytes(substituted)
    refused = preview()
    assert refused["status"] == "failed", refused
    assert refused["result"]["error"]["code"] == "DOCUMENT_INTEGRITY_FAILURE"
    assert persisted() == before
    assert session.read(f"/deals/{deal['id']}/documents/{document['id']}")["content_hash"] == hashlib.sha256(original).hexdigest()
    storage_path.write_bytes(original)
    recovered = preview()
    assert recovered["status"] == "succeeded", recovered
    result = session.read(f"/cash-events/csv-previews/{recovered['result']['resource_id']}")
    assert result["events"][0]["amount_minor"] == "10000"


def test_upload_replays_without_reparse_and_preserves_content_dedupe(upload_case, postgres, monkeypatch):
    client, session, deal, account = upload_case
    key = str(uuid4())
    metadata = dict(kind="other", source_role="other", **versions(session, deal["id"]))
    first = upload(client, session, deal, key, metadata=metadata)
    assert first.status_code == 201, first.text
    duplicate = upload(client, session, deal, str(uuid4()))
    assert duplicate.status_code == 201 and duplicate.json()["id"] == first.json()["id"]

    def refuse_parse(*args):
        raise AssertionError("A completed upload command must replay without parsing again")

    monkeypatch.setattr("orderfit.api.routes.documents.parse", refuse_parse)
    replay = upload(client, session, deal, key, metadata=metadata)
    assert replay.status_code == 201 and replay.json() == first.json()
    assert counts(postgres, account, deal) == (1, 1, 1)
    assert len([p for p in client.app.state.documents.root.rglob("*") if p.is_file()]) == 1


def test_concurrent_upload_replay_commits_one_source_and_audit(upload_case, postgres):
    client, session, deal, account = upload_case
    key = str(uuid4())
    metadata = dict(kind="other", source_role="other", **versions(session, deal["id"]))
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: upload(client, session, deal, key, metadata=metadata), range(2)))
    assert [r.status_code for r in results] == [201, 201], [r.text for r in results]
    assert results[0].json() == results[1].json()
    assert counts(postgres, account, deal) == (1, 1, 1)
    assert len([p for p in client.app.state.documents.root.rglob("*") if p.is_file()]) == 1


def test_concurrent_upload_key_conflict_has_no_second_source(upload_case, postgres):
    client, session, deal, account = upload_case
    key = str(uuid4())
    metadata = dict(kind="other", source_role="other", **versions(session, deal["id"]))
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda body: upload(client, session, deal, key, metadata=metadata, body=body),
                                    [b"First synthetic source", b"Second synthetic source"]))
    assert sorted(r.status_code for r in results) == [201, 409], [r.text for r in results]
    refused = next(r for r in results if r.status_code == 409)
    assert refused.json()["error"]["code"] == "IDEMPOTENCY_CONFLICT"
    assert counts(postgres, account, deal) == (1, 1, 1)
    assert len([p for p in client.app.state.documents.root.rglob("*") if p.is_file()]) == 1


@pytest.mark.parametrize("storage_failure", ["filesystem_tamper", "adapter_substitution", "adapter_checksum_error"])
def test_download_checks_immutable_database_hash(upload_case, postgres, monkeypatch, storage_failure):
    client, session, deal, account = upload_case
    body = b"Original synthetic source"
    response = upload(client, session, deal, str(uuid4()), body=body)
    assert response.status_code == 201, response.text
    document = response.json()
    assert hashlib.sha256(body).hexdigest() == document["content_hash"]
    good = client.get(document["download_url"])
    assert good.status_code == 200 and good.content == body
    storage = client.app.state.documents
    substituted = b"Changed synthetic source!"  # same length, so the digest must be checked too
    assert len(substituted) == len(body)
    if storage_failure == "filesystem_tamper":
        storage._path(account.business_id, deal["id"], document["id"]).write_bytes(substituted)
    elif storage_failure == "adapter_substitution":
        # Even a backend whose own checksum passes cannot replace the immutable DB identity.
        monkeypatch.setattr(storage, "read", lambda *args: substituted)
    else:
        def invalid(*args):
            raise ValueError("stored document checksum mismatch")
        monkeypatch.setattr(storage, "read", invalid)
    refused = client.get(document["download_url"])
    assert refused.status_code == 503, refused.text
    assert refused.json()["error"]["code"] == "DOCUMENT_INTEGRITY_FAILURE"
    assert body not in refused.content and substituted not in refused.content
    assert "no-store" in refused.headers["Cache-Control"]
    assert session.read(f"/deals/{deal['id']}/documents/{document['id']}")["content_hash"] == document["content_hash"]
    assert counts(postgres, account, deal) == (1, 1, 1)
