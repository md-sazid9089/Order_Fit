"""Regression tests for audit repairs: tenant locking order/timeouts and publish-time authorization."""

import time

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.agent.nodes.compute import compute as real_compute
from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.store import db as store_db
from orderfit.store.db import Database
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import run_once
from tests.db.p3_helpers import manual_evaluation


def test_non_member_never_requests_tenant_lock_and_reads_share(postgres, accounts, monkeypatch):
    a, b = accounts
    monkeypatch.setitem(store_db.TRANSACTION_TIMEOUTS, "lock_timeout", "500ms")
    db = Database(postgres["url"], pool_size=1)
    try:
        with psycopg.connect(postgres["migrator"]) as holder:
            holder.execute("SELECT id FROM business WHERE id=%s FOR UPDATE", (b.business_id,))
            started = time.monotonic()
            # Non-member: membership is checked first, so the held row lock is never touched.
            with pytest.raises(ApplicationError) as error:
                with db.tenant(a.token, b.business_id, "prepare"):
                    pass
            assert error.value.status == 404
            assert time.monotonic() - started < 0.4
            # Wrong role/permission also fails before any lock request.
            holder.rollback()
        with psycopg.connect(postgres["migrator"]) as holder:
            holder.execute("SELECT id FROM business WHERE id=%s FOR SHARE", (a.business_id,))
            # A read-only GET needing 'prepare' takes FOR SHARE and does not wait on a share holder.
            with db.tenant(a.token, a.business_id, "prepare", readonly=True):
                pass
            # A write-class request needs FOR UPDATE and fails fast on lock_timeout (retryable 503).
            with pytest.raises(DBAPIError) as error:
                with db.tenant(a.token, a.business_id, "prepare"):
                    pass
            assert error.value.orig.sqlstate == "55P03"
        # Timeouts are transaction-local: the reused pooled connection keeps server defaults.
        with db.engine.begin() as c:
            assert c.execute(text("SHOW lock_timeout")).scalar_one() == "0"
    finally:
        db.close()


def test_revocation_during_compute_publishes_no_evaluation(postgres, accounts, config, monkeypatch):
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": account.csrf}
        deal, _, accepted = manual_evaluation(client, headers, account.business_id)

        def compute_then_revoke(snapshot, *args, **kwargs):
            computation = real_compute(snapshot)
            with psycopg.connect(postgres["migrator"], autocommit=True) as admin:
                admin.execute(
                    "UPDATE auth_session SET revoked_at=clock_timestamp() WHERE user_id=%s",
                    (account.user_id,),
                )
            return computation

        monkeypatch.setattr("orderfit.workflow.worker.bounded_compute", compute_then_revoke)
        assert run_once(Operations(postgres["worker"]), "revocation-race", {})
        with psycopg.connect(postgres["migrator"]) as admin:
            evaluations = admin.execute(
                "SELECT count(*) FROM evaluation WHERE deal_id=%s", (deal["id"],)
            ).fetchone()[0]
            status, subphase = admin.execute(
                "SELECT status,subphase FROM operation WHERE deal_id=%s",
                (deal["id"],),
            ).fetchone()
        assert evaluations == 0
        assert (status, subphase) == ("failed", "authorization_revoked")


def test_storage_hash_mismatch_leaves_no_orphan_file(postgres, accounts, config):
    import json
    from pathlib import Path

    from tests.db.test_p4_documents import Session, make_deal, versions

    app = create_app(config, postgres["database"])
    account = accounts[0]
    with TestClient(app, raise_server_exceptions=False) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        s = Session(client, account, f"/api/v1/businesses/{account.business_id}")
        deal = make_deal(s)
        original = app.state.documents.put

        def corrupt_hash(*args, **kwargs):
            key, _stored, size = original(*args, **kwargs)  # bytes really land on disk
            return key, "00" * 32, size

        app.state.documents.put = corrupt_hash
        meta = dict(kind="po", source_role="customer_order", **versions(s, deal["id"]))
        s.write("POST", f"/deals/{deal['id']}/documents", None, expect=(503,),
                data={"metadata": json.dumps(meta)}, files={"file": ("a.txt", b"order text", "text/plain")})
        assert [p for p in Path(config.document_dir).rglob("*") if p.is_file()] == []
