"""P1 acceptance tests under actual distinct runtime LOGIN credentials."""

import hashlib
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from pathlib import Path
from threading import Event
from uuid import UUID, uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.protocol import canonical_bytes
from orderfit.contracts.resources import SignUp
from orderfit.contracts.workflow import CancelOperation
from orderfit.services.identity import IdentityService
from orderfit.store.db import Database, digest_token
from orderfit.store.repositories import append_audit
from orderfit.workflow.operations import Admission, Operations
from orderfit.workflow.worker import RetryableJobError, failure, run_once


@pytest.fixture
def config(postgres, tmp_path):
    return RuntimeConfiguration(
        database_url=postgres["url"],
        session_secret="s" * 48,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=str(tmp_path / "documents"),
        allowed_origins=["http://localhost:3000"],
        cookie_secure=False,
        llm_mode="off",
    )


@dataclass
class Account:
    token: str
    csrf: str
    user_id: UUID
    business_id: UUID


@pytest.fixture
def accounts(postgres, config):
    service = IdentityService(postgres["database"], config)
    result = []
    for _ in range(2):
        view, token, csrf = service.authenticate(
            SignUp(
                email=f"{uuid4().hex}@example.test",
                password="Synthetic password 123!",
                full_name="Synthetic owner",
                business_name="Synthetic business",
                currency="BDT",
                timezone="Asia/Dhaka",
            ),
            str(uuid4()),
            None,
            service.csrf(),
            str(uuid4()),
        )
        result.append(Account(token, csrf, view.user_id, view.memberships[0].business_id))
    return result


def admission(db, account, **changes):
    with db.tenant(account.token, account.business_id) as (c, _):
        revision = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": account.business_id}
        ).scalar_one()
    return Admission(
        kind="csv_preview",
        deal_id=None,
        expected_version=None,
        expected_input_version=None,
        expected_financial_revision=revision,
        snapshot_id=None,
        source_document_id=None,
        **changes,
    )


def expire_lease(postgres, operation_id):
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE operation SET lease_expires_at=clock_timestamp()-interval '1 second',available_at=clock_timestamp() WHERE id=%s",
            (operation_id,),
        )


def allow_retry(postgres, operation_id):
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE operation SET available_at=clock_timestamp() WHERE id=%s", (operation_id,)
        )


def test_empty_and_populated_upgrade_and_runtime_logins(postgres):
    postgres["database"].validate_runtime()
    postgres["worker"].validate_runtime(worker=True)


def test_privileged_runtime_rejected_and_queue_helpers_private(postgres):
    privileged = Database(postgres["migrator_url"])
    try:
        with pytest.raises(RuntimeError, match="restricted"):
            privileged.validate_runtime()
    finally:
        privileged.close()
    with pytest.raises(RuntimeError, match="restricted"):
        postgres["worker"].validate_runtime()
    for query in (
        "SELECT * FROM auth_session",
        "SELECT password_hash FROM app_user",
        "SELECT * FROM operation_claim('forbidden')",
    ):
        with pytest.raises(DBAPIError):
            with postgres["database"].engine.begin() as c:
                c.execute(text(query))


def test_two_tenants_no_context_and_pool_reset(postgres, accounts):
    a, b = accounts
    # Separate actual LOGIN connections, with a one-connection pool to force reuse.
    db = Database(postgres["url"], pool_size=1)
    try:
        for account in (a, b):
            with db.tenant(account.token, account.business_id) as (c, scope):
                assert scope.user_id == account.user_id
                assert c.execute(text("SELECT id FROM business")).scalars().all() == [
                    account.business_id
                ]
            with db.engine.begin() as c:
                assert c.execute(text("SELECT count(*) FROM business")).scalar_one() == 0
                assert (
                    c.execute(
                        text("SELECT nullif(current_setting('app.user_id',true),'')")
                    ).scalar_one()
                    is None
                )
        with pytest.raises(ApplicationError) as error:
            with db.tenant(a.token, b.business_id):
                pass
        assert error.value.status == 404
        with pytest.raises(RuntimeError):
            with db.tenant(a.token, a.business_id):
                raise RuntimeError("force rollback")
        with db.engine.begin() as c:
            assert c.execute(text("SELECT count(*) FROM business")).scalar_one() == 0
        with pytest.raises(ApplicationError):
            with db.tenant("forged-session", a.business_id):
                pass
    finally:
        db.close()


def test_auth_http_csrf_unknown_fields_safe_errors_and_restart(postgres, config):
    app = create_app(config, Database(postgres["url"]))
    body = dict(
        email=f"{uuid4().hex}@example.test",
        password="Synthetic password 123!",
        full_name="HTTP owner",
        business_name="HTTP business",
        currency="USD",
        timezone="UTC",
    )
    with TestClient(app, raise_server_exceptions=False) as client:
        csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
        headers = {
            "X-CSRF-Token": csrf,
            "Idempotency-Key": str(uuid4()),
            "Origin": "http://localhost:3000",
        }
        assert (
            client.post(
                "/api/v1/auth/signup", json=body, headers={"Idempotency-Key": "csrf-negative"}
            ).status_code
            == 403
        )
        invalid = client.post(
            "/api/v1/auth/signup", json=body | {"actor_user_id": str(uuid4())}, headers=headers
        )
        assert invalid.status_code == 422 and "Synthetic password" not in invalid.text
        response = client.post("/api/v1/auth/signup", json=body, headers=headers)
        assert response.status_code == 201, response.text
        view = response.json()
        assert view["mfa_supported"] is False and view["email_verified"] is False
        assert (
            "HttpOnly" in response.headers["set-cookie"]
            and "SameSite=lax" in response.headers["set-cookie"]
        )
        assert client.get("/api/v1/auth/me").status_code == 200
        headers["X-CSRF-Token"] = view["csrf_token"]
        headers["Idempotency-Key"] = str(uuid4())
        duplicate = client.post("/api/v1/auth/signup", json=body, headers=headers)
        assert duplicate.status_code == 409
        assert not any(
            secret in duplicate.text
            for secret in (body["password"], body["email"], "INSERT", "app_user_email")
        )
        assert client.get("/api/v1/unknown").json()["error"]["code"] == "NOT_FOUND"
        oversized = client.post("/api/v1/auth/signin", content=b"x" * 1048577)
        assert (
            oversized.status_code == 413 and UUID(oversized.json()["error"]["request_id"]).int != 0
        )
        token = client.cookies.get("orderfit_session")
        csrf = client.cookies.get("orderfit_csrf")
        business = view["memberships"][0]["business_id"]
        assert client.get(f"/api/v1/businesses/{business}/capabilities").status_code == 200
        denied = client.get(f"/api/v1/businesses/{uuid4()}/capabilities")
        assert denied.status_code == 404 and "SELECT" not in denied.text
        assert client.get("/api/v1/auth/me?actor_id=forged").status_code == 200
    # New process/engine sees the persisted cookie without any in-memory identity cache.
    with TestClient(
        create_app(config, Database(postgres["url"])), raise_server_exceptions=False
    ) as client:
        client.cookies.set("orderfit_session", token)
        client.cookies.set("orderfit_csrf", csrf)
        assert client.get("/api/v1/auth/me").json()["user_id"] == view["user_id"]
        headers = {
            "X-CSRF-Token": csrf,
            "Idempotency-Key": str(uuid4()),
            "Origin": "https://attacker.example",
        }
        assert client.post("/api/v1/auth/signout", headers=headers).status_code == 403
        headers["Origin"] = "http://localhost:3000"
        assert client.post("/api/v1/auth/signout", headers=headers).status_code == 200
        client.cookies.set("orderfit_session", token)
        assert client.get("/api/v1/auth/me").status_code == 401
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute("SELECT count(*) FROM security_event WHERE code='CSRF_REJECTED'").fetchone()[
                0
            ]
            >= 1
        )
        assert c.execute(
            "SELECT token_digest FROM auth_session WHERE user_id=%s", (view["user_id"],)
        ).fetchone()[0] == digest_token(token)


@pytest.mark.parametrize("change", ["expired", "idle", "mfa", "disabled"])
def test_session_expiry_and_unsupported_mfa_fail_closed(postgres, accounts, change):
    a = accounts[0]
    with psycopg.connect(postgres["migrator"]) as c:
        if change == "expired":
            c.execute(
                "UPDATE auth_session SET created_at=clock_timestamp()-interval '9 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE user_id=%s",
                (a.user_id,),
            )
        elif change == "idle":
            c.execute(
                "UPDATE auth_session SET last_active_at=clock_timestamp()-interval '31 minutes' WHERE user_id=%s",
                (a.user_id,),
            )
        else:
            c.execute(
                "UPDATE app_user SET "
                + ("mfa_enforced=true" if change == "mfa" else "status='suspended'")
                + " WHERE id=%s",
                (a.user_id,),
            )
    with pytest.raises(ApplicationError) as error:
        with postgres["database"].tenant(a.token, a.business_id):
            pass
    assert error.value.status == 401


def test_concurrent_admission_replay_conflicts_and_audit(postgres, accounts):
    db, a = postgres["database"], accounts[0]
    operations = Operations(db)
    command, key = admission(db, a), str(uuid4())

    def submit(_):
        return operations.admit(a.token, a.business_id, key, command)

    with ThreadPoolExecutor(max_workers=4) as pool:
        ids = [r.operation_id for r in pool.map(submit, range(4))]
    assert len(set(ids)) == 1
    with pytest.raises(ApplicationError) as error:
        operations.admit(
            a.token, a.business_id, key, command.model_copy(update={"kind": "explain"})
        )
    assert error.value.code == "IDEMPOTENCY_CONFLICT"
    with db.tenant(a.token, a.business_id) as (c, scope):
        assert c.execute(text("SELECT count(*) FROM operation")).scalar_one() == 1
        assert (
            c.execute(
                text("SELECT count(*) FROM operation_log WHERE action='operation_admit'")
            ).scalar_one()
            == 1
        )
        row = (
            c.execute(text("SELECT * FROM verify_operation_log(:b)"), {"b": a.business_id})
            .mappings()
            .one()
        )
        assert row["ok"]
        append_audit(c, scope, "test_append")
    claim = Operations(postgres["worker"]).claim("cleanup")
    assert claim["id"] == ids[0]
    Operations(postgres["worker"]).finish(claim, failure("SYNTHETIC_TEST"))


def test_claim_restart_fencing_retry_and_cancellation(postgres, accounts):
    a, b = accounts
    api, worker = Operations(postgres["database"]), Operations(postgres["worker"])
    accepted = api.admit(a.token, a.business_id, str(uuid4()), admission(postgres["database"], a))
    with ThreadPoolExecutor(max_workers=2) as pool:
        claims = list(pool.map(worker.claim, ["first-process", "racing-process"]))
    assert len([claim for claim in claims if claim]) == 1
    first = next(claim for claim in claims if claim)
    assert first["id"] == accepted.operation_id
    assert worker.claim("competing-process") is None
    expire_lease(postgres, first["id"])
    restarted = Operations(Database(postgres["worker_url"]))
    try:
        second = restarted.claim("restarted-process")
        assert first["lease_token"] != second["lease_token"]
        assert not worker.heartbeat(first)
        assert not worker.finish(first, failure("STALE_WORKER"))
        assert restarted.heartbeat(second)
        assert restarted.finish(second, failure("TRANSIENT_JOB_FAILURE"), retry=True)
        allow_retry(postgres, second["id"])
        third = restarted.claim("last-attempt")
        assert restarted.finish(third, failure("TRANSIENT_JOB_FAILURE"), retry=True)
        result = api.get(a.token, a.business_id, accepted.operation_id)
        assert result.status == "failed" and result.attempt == 3
        assert not restarted.finish(third, failure("DUPLICATE_PUBLISH"))
    finally:
        restarted.database.close()
    with pytest.raises(ApplicationError):
        api.get(b.token, b.business_id, accepted.operation_id)
    pending = api.admit(a.token, a.business_id, str(uuid4()), admission(postgres["database"], a))
    current = api.get(a.token, a.business_id, pending.operation_id)
    cancelled = api.cancel(
        a.token,
        a.business_id,
        pending.operation_id,
        "cancel-key",
        CancelOperation(
            expected_operation_version=current.version, reason="Synthetic cancellation"
        ),
    )
    assert cancelled.cancellation_requested
    assert worker.claim("cancel-sweep") is None
    assert api.get(a.token, a.business_id, pending.operation_id).status == "cancelled"


def test_revocation_serializes_admission_and_prevents_publication(postgres, accounts):
    a, b = accounts
    db, worker = postgres["database"], Operations(postgres["worker"])
    # B is a preparer in A; A remains the last owner throughout this test.
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        c.execute(
            text(
                "INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'commercial_lead')"
            ),
            {"u": b.user_id, "b": a.business_id},
        )
    preparer = Account(b.token, b.csrf, b.user_id, a.business_id)
    accepted = Operations(db).admit(b.token, a.business_id, str(uuid4()), admission(db, preparer))
    claim = worker.claim("revoked-worker")
    assert claim["id"] == accepted.operation_id
    entered, release = Event(), Event()

    def admitted_transaction():
        with db.tenant(b.token, a.business_id, "prepare"):
            entered.set()
            assert release.wait(5)

    def revoke():
        with db.tenant(a.token, a.business_id, "prepare") as (c, _):
            c.execute(
                text(
                    "UPDATE membership SET revoked_at=clock_timestamp() WHERE business_id=:b AND user_id=:u"
                ),
                {"b": a.business_id, "u": b.user_id},
            )

    with ThreadPoolExecutor(max_workers=2) as pool:
        admitted = pool.submit(admitted_transaction)
        assert entered.wait(5)
        revocation = pool.submit(revoke)
        assert not revocation.done()
        release.set()
        admitted.result(timeout=5)
        revocation.result(timeout=5)
    assert not worker.heartbeat(claim)
    assert worker.finish(claim, failure("SHOULD_NOT_PUBLISH"))
    assert (
        Operations(db).get(a.token, a.business_id, accepted.operation_id).subphase
        == "authorization_revoked"
    )
    with pytest.raises(ApplicationError):
        Operations(db).admit(b.token, a.business_id, str(uuid4()), admission(db, a))
    with pytest.raises(DBAPIError) as error:
        with db.tenant(a.token, a.business_id, "prepare") as (c, _):
            c.execute(
                text(
                    "UPDATE membership SET revoked_at=clock_timestamp() WHERE user_id=:u AND business_id=:b"
                ),
                {"u": a.user_id, "b": a.business_id},
            )
    assert error.value.orig.sqlstate == "OF009"


def test_business_revision_blocks_old_job_and_worker_has_no_financial_handler(postgres, accounts):
    a = accounts[0]
    db, api, worker = (
        postgres["database"],
        Operations(postgres["database"]),
        Operations(postgres["worker"]),
    )
    accepted = api.admit(a.token, a.business_id, str(uuid4()), admission(db, a))
    claim = worker.claim("stale-input")
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        c.execute(
            text("UPDATE business SET baseline_settings='{}' WHERE id=:b"), {"b": a.business_id}
        )
    assert worker.finish(claim, failure("NOT_PUBLISHED"))
    assert api.get(a.token, a.business_id, accepted.operation_id).result.outcome == "stale"
    accepted = api.admit(a.token, a.business_id, str(uuid4()), admission(db, a))
    assert run_once(worker, "no-future-capability", {})
    assert (
        api.get(a.token, a.business_id, accepted.operation_id).result.error.code
        == "CAPABILITY_UNAVAILABLE"
    )
    accepted = api.admit(a.token, a.business_id, str(uuid4()), admission(db, a))

    def transient(_):
        raise RetryableJobError

    assert run_once(worker, "synthetic-transient", {"csv_preview": transient})
    assert api.get(a.token, a.business_id, accepted.operation_id).status == "queued"
    allow_retry(postgres, accepted.operation_id)
    assert run_once(worker, "cleanup", {})


def create_deal(db, a):
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        customer = c.execute(
            text("INSERT INTO customer(business_id,name) VALUES(:b,:name) RETURNING id"),
            {"b": a.business_id, "name": str(uuid4())},
        ).scalar_one()
        deal = c.execute(
            text(
                "INSERT INTO deal(business_id,public_ref,customer_id,constraints_id,created_by,opening_cash_minor,order_value_minor,start_date,delivery_date,payment_days,payment_basis) SELECT id,:ref,:customer,default_constraints_id,:u,10000,10000,'2026-10-15','2026-10-16',30,'delivery' FROM business WHERE id=:b RETURNING id"
            ),
            {"b": a.business_id, "u": a.user_id, "ref": uuid4().hex, "customer": customer},
        ).scalar_one()
        c.execute(text("UPDATE deal SET status='awaiting_confirm' WHERE id=:d"), {"d": deal})
    return deal


def insert_snapshot(c, a, deal):
    iv, fr = c.execute(
        text(
            "SELECT d.input_version,b.financial_revision FROM deal d JOIN business b ON b.id=d.business_id WHERE d.id=:d"
        ),
        {"d": deal},
    ).one()
    payload = json.loads(
        (Path(__file__).parents[1] / "contracts/fixtures/snapshot.canonical.json").read_text(
            encoding="utf-8"
        )
    )
    payload.update(
        business_id=str(a.business_id), deal_id=str(deal), input_version=iv, financial_revision=fr
    )
    canonical = canonical_bytes(ConfirmedInputV1.model_validate(payload))
    sid = c.execute(
        text(
            "INSERT INTO input_snapshot(business_id,deal_id,input_version,financial_revision,schema_version,payload,canonical_payload,snapshot_hash,confirmed_by) VALUES(:b,:d,:iv,:fr,'confirmed-input.v1',CAST(:payload AS jsonb),:canonical,:hash,:u) RETURNING id"
        ),
        {
            "b": a.business_id,
            "d": deal,
            "iv": iv,
            "fr": fr,
            "payload": canonical.decode(),
            "canonical": canonical,
            "hash": hashlib.sha256(canonical).digest(),
            "u": a.user_id,
        },
    ).scalar_one()
    return sid, iv, fr


def test_snapshot_immutability_child_freshness_and_state_recovery(postgres, accounts):
    a, b = accounts
    db, api, worker = (
        postgres["database"],
        Operations(postgres["database"]),
        Operations(postgres["worker"]),
    )
    deal = create_deal(db, a)
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        sid, iv, fr = insert_snapshot(c, a, deal)
        version = c.execute(text("SELECT version FROM deal WHERE id=:d"), {"d": deal}).scalar_one()
    for sql in (
        "UPDATE input_snapshot SET payload='{}'",
        "DELETE FROM input_snapshot",
        "TRUNCATE input_snapshot",
    ):
        with pytest.raises(DBAPIError):
            with db.tenant(a.token, a.business_id, "prepare") as (c, _):
                c.execute(text(sql))
    command = Admission(
        kind="evaluate",
        deal_id=deal,
        expected_version=version,
        expected_input_version=iv,
        expected_financial_revision=fr,
        snapshot_id=sid,
        source_document_id=None,
    )
    accepted = api.admit(a.token, a.business_id, str(uuid4()), command)
    claim = worker.claim("snapshot-worker")
    assert claim["id"] == accepted.operation_id
    # OLD-state protection: combined transition + financial edit still fails.
    with pytest.raises(DBAPIError) as error:
        with db.tenant(a.token, a.business_id, "prepare") as (c, _):
            c.execute(
                text(
                    "UPDATE deal SET status='awaiting_confirm',order_value_minor=20000 WHERE id=:d"
                ),
                {"d": deal},
            )
    assert error.value.orig.sqlstate == "OF003"
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        c.execute(
            text(
                "INSERT INTO cash_event(business_id,event_date,amount_minor,direction,kind) VALUES(:b,'2026-10-20',100,'out','other')"
            ),
            {"b": a.business_id},
        )
    assert worker.finish(claim, failure("SHOULD_BE_STALE"))
    assert api.get(a.token, a.business_id, accepted.operation_id).result.outcome == "stale"
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        assert (
            c.execute(text("SELECT status FROM deal WHERE id=:d"), {"d": deal}).scalar_one()
            == "awaiting_confirm"
        )
        c.execute(text("UPDATE deal SET order_value_minor=20000 WHERE id=:d"), {"d": deal})
        assert (
            c.execute(text("SELECT input_version FROM deal WHERE id=:d"), {"d": deal}).scalar_one()
            > iv
        )
    with pytest.raises(DBAPIError):
        with db.tenant(a.token, a.business_id, "prepare") as (c, _):
            # Correct hash cannot authorize a forged confirmer.
            forged = Account(a.token, a.csrf, b.user_id, a.business_id)
            insert_snapshot(c, forged, deal)


def test_cross_deal_source_fks_and_direct_child_revision(postgres, accounts):
    a, b = accounts
    db = postgres["database"]
    d1, d2, other = create_deal(db, a), create_deal(db, a), create_deal(db, b)
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        before = c.execute(
            text("SELECT input_version FROM deal WHERE id=:d"), {"d": d1}
        ).scalar_one()
        doc = c.execute(
            text(
                "INSERT INTO document(business_id,deal_id,kind,content_hash,storage_key,original_filename,mime_type,size_bytes,uploaded_by) VALUES(:b,:d,'po',:h,'generated','synthetic.txt','text/plain',1,:u) RETURNING id"
            ),
            {"b": a.business_id, "d": d1, "h": b"x" * 32, "u": a.user_id},
        ).scalar_one()
        assert (
            c.execute(text("SELECT input_version FROM deal WHERE id=:d"), {"d": d1}).scalar_one()
            == before + 1
        )
        revision = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": a.business_id}
        ).scalar_one()
        c.execute(
            text("UPDATE document SET source_role='customer_order' WHERE id=:id"), {"id": doc}
        )
        assert (
            c.execute(
                text("SELECT financial_revision FROM business WHERE id=:b"), {"b": a.business_id}
            ).scalar_one()
            == revision + 1
        )
    for deal in (d2, other):
        with pytest.raises(DBAPIError):
            with db.tenant(a.token, a.business_id, "prepare") as (c, _):
                c.execute(
                    text(
                        "INSERT INTO extracted_field(business_id,deal_id,document_id,field,value,confidence) VALUES(:b,:d,:doc,'test','1',1)"
                    ),
                    {"b": a.business_id, "d": deal, "doc": doc},
                )
    with pytest.raises(DBAPIError):
        with db.tenant(a.token, a.business_id, "prepare") as (c, _):
            c.execute(text("UPDATE document SET deal_id=:d WHERE id=:id"), {"d": d2, "id": doc})


def test_password_change_revokes_all_sessions_and_bad_login_is_generic(postgres, accounts, config):
    from orderfit.contracts.resources import PasswordChange, SignIn

    a = accounts[0]
    service = IdentityService(postgres["database"], config)
    with postgres["database"].identity(a.token) as (c, scope, _):
        email = c.execute(
            text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}
        ).scalar_one()
    login = SignIn(email=email, password="Synthetic password 123!")
    _, second, _ = service.authenticate(login, str(uuid4()), None, service.csrf(), str(uuid4()))
    for data in (
        SignIn(email=email, password="incorrect"),
        SignIn(email="missing@example.test", password="incorrect"),
    ):
        with pytest.raises(ApplicationError) as error:
            service.authenticate(data, str(uuid4()), None, service.csrf(), str(uuid4()))
        assert (error.value.status, error.value.code) == (401, "INVALID_CREDENTIALS")
    service.change_password(
        a.token,
        PasswordChange(
            current_password="Synthetic password 123!",
            new_password="Changed synthetic password 456!",
        ),
        str(uuid4()),
    )
    for token in (a.token, second):
        with pytest.raises(ApplicationError):
            with postgres["database"].identity(token):
                pass


def test_auth_lost_response_recovery_and_key_body_conflict(postgres, config):
    service = IdentityService(postgres["database"], config)
    data = SignUp(
        email=f"{uuid4().hex}@example.test",
        password="Synthetic password 123!",
        full_name="Recovery",
        business_name="Recovery",
        currency="USD",
        timezone="UTC",
    )
    key = str(uuid4())
    view, token, csrf = service.authenticate(data, key, None, service.csrf(), str(uuid4()))
    replay, new_token, _ = service.authenticate(data, key, token, csrf, str(uuid4()))
    assert replay.user_id == view.user_id and new_token is None
    with pytest.raises(ApplicationError) as error:
        service.authenticate(data, key, None, service.csrf(), str(uuid4()))
    assert error.value.code == "AUTH_SESSION_RECOVERY_REQUIRED"
    with pytest.raises(DBAPIError) as error:
        service.authenticate(
            data.model_copy(update={"business_name": "Different"}), key, token, csrf, str(uuid4())
        )
    assert error.value.orig.sqlstate == "OF003"


def test_forged_operation_actor_and_role_downgrade(postgres, accounts):
    a, b = accounts
    db, worker = postgres["database"], Operations(postgres["worker"])
    with pytest.raises(DBAPIError) as error:
        with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
            c.execute(
                text(
                    "INSERT INTO operation(business_id,actor_user_id,session_id,kind,request_hash,financial_revision,config_version) VALUES(:b,:u,:s,'csv_preview',:h,1,'operation.v1')"
                ),
                {"b": a.business_id, "u": b.user_id, "s": scope.session_id, "h": b"x" * 32},
            )
    assert error.value.orig.sqlstate == "42501"
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        c.execute(
            text(
                "INSERT INTO membership(user_id,business_id,role) VALUES(:u,:b,'commercial_lead')"
            ),
            {"u": b.user_id, "b": a.business_id},
        )
    preparer = Account(b.token, b.csrf, b.user_id, a.business_id)
    accepted = Operations(db).admit(b.token, a.business_id, str(uuid4()), admission(db, preparer))
    with db.tenant(a.token, a.business_id, "prepare") as (c, _):
        c.execute(
            text("UPDATE membership SET role='viewer' WHERE business_id=:b AND user_id=:u"),
            {"u": b.user_id, "b": a.business_id},
        )
    assert worker.claim("downgraded-actor") is None
    result = Operations(db).get(a.token, a.business_id, accepted.operation_id)
    assert result.status == "failed" and result.result.error.code == "AUTHORIZATION_REVOKED"
    with pytest.raises(ApplicationError) as error:
        with db.tenant(b.token, a.business_id, "prepare"):
            pass
    assert error.value.status == 403


def test_runtime_core_mappings_match_manual_sql(postgres):
    from sqlalchemy import inspect

    from orderfit.store.tables import metadata

    schema = inspect(postgres["database"].engine)
    for table in metadata.tables.values():
        actual = {column["name"]: column["type"] for column in schema.get_columns(table.name)}
        for column in table.columns:
            assert column.name in actual
            assert column.type._type_affinity == actual[column.name]._type_affinity


def test_worker_process_death_and_restart_recovers_same_operation(postgres, accounts, config):
    a = accounts[0]
    api = Operations(postgres["database"])
    # Keep this recovery test independent of newly enabled P4 CSV handlers.
    pending = admission(postgres["database"], a).model_copy(update={"kind": "explain"})
    accepted = api.admit(a.token, a.business_id, str(uuid4()), pending)
    environment = {
        key: value
        for key, value in os.environ.items()
        if key not in {"DATABASE_URL_DIRECT", "DATABASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"}
    }
    environment.update(
        DATABASE_URL=postgres["worker_url"],
        SESSION_SECRET=config.session_secret.get_secret_value(),
        ACCOUNT_FINGERPRINT_KEY=config.account_fingerprint_key.get_secret_value(),
        ACCOUNT_FINGERPRINT_KEY_VERSION="1",
        DOCUMENT_DIR=config.document_dir,
        ALLOWED_ORIGINS=json.dumps(config.allowed_origins),
        LLM_MODE="off",
    )
    code = """import os,time
from orderfit.store.db import Database
from orderfit.workflow.operations import Operations
db=Database(os.environ['DATABASE_URL'])
db.validate_runtime(worker=True)
claim=Operations(db).claim('crash-test-process')
print(claim['id'], flush=True)
time.sleep(60)
"""
    process = subprocess.Popen(
        [sys.executable, "-c", code],
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    try:
        # Bounded future avoids an unbounded pipe read if a child cannot claim.
        with ThreadPoolExecutor(max_workers=1) as pool:
            claimed = pool.submit(process.stdout.readline)
            try:
                assert UUID(claimed.result(timeout=10).strip()) == accepted.operation_id
            finally:
                process.terminate()
                process.wait(timeout=5)
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stdout.close()
        process.stderr.close()
    expire_lease(postgres, accepted.operation_id)
    restarted = subprocess.run(
        [sys.executable, "-m", "orderfit.workflow.worker", "--once"],
        env=environment,
        capture_output=True,
        timeout=15,
    )
    assert restarted.returncode == 0
    result = api.get(a.token, a.business_id, accepted.operation_id)
    assert result.attempt == 2 and result.status == "failed"
    assert result.result.error.code == "CAPABILITY_UNAVAILABLE"
