"""Session rotation and hostile tenant checks on disposable PG17 runtime logins."""

from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from psycopg import sql
from sqlalchemy import event, text

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.resources import SignIn
from orderfit.services.identity import IdentityService
from orderfit.store.admission import MAX_PENDING_OPERATIONS
from orderfit.workflow.operations import Admission, Operations


def test_login_replaces_old_browser_session_and_replay_keeps_replacement(postgres, config, accounts):
    service = IdentityService(postgres["database"], config)
    a, _ = accounts
    with postgres["database"].identity(a.token) as (c, scope, _):
        email = c.execute(text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}).scalar_one()
    data = SignIn(email=email, password="Synthetic password 123!")
    key = str(uuid4())
    _, replacement, csrf = service.authenticate(data, key, a.token, a.csrf, str(uuid4()))
    assert replacement and replacement != a.token
    with pytest.raises(ApplicationError) as error:
        service.view(a.token, a.csrf)
    assert error.value.status == 401
    assert service.view(replacement, csrf).user_id == a.user_id
    replay, token, _ = service.authenticate(data, key, replacement, csrf, str(uuid4()))
    assert token is None and replay.user_id == a.user_id
    service.signout(replacement)
    with pytest.raises(ApplicationError) as error:
        service.view(replacement, csrf)
    assert error.value.status == 401


def test_hostile_tenant_cannot_read_guess_export_or_batch_mutate_foreign_business(postgres, config, accounts):
    a, b = accounts
    app = create_app(config, postgres["database"])
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        base = f"/api/v1/businesses/{b.business_id}"
        for suffix in ("profile", "deals", "cash-events", "members", "notifications", "accounts", "audit", "audit/export", "exports/" + str(uuid4()) + "/download", "operations/" + str(uuid4())):
            result = client.get(f"{base}/{suffix}")
            assert result.status_code == 404, suffix
            assert "no-store" in result.headers["Cache-Control"]
        assert client.get(f"/api/v1/businesses/{a.business_id}/profile").status_code == 200
        # Membership is verified even for batch mutation endpoints.
        response = client.post(base + "/notifications/read", json={"through_id": "9223372036854775807"}, headers={
            "Origin": "http://localhost:3000", "X-CSRF-Token": a.csrf, "Idempotency-Key": str(uuid4()),
        })
        assert response.status_code == 404


def test_queue_cap_serializes_concurrent_admissions_and_keeps_replay_and_other_tenant(postgres, accounts):
    a, b = accounts
    operations = Operations(postgres["database"])

    def command(account):
        with postgres["database"].tenant(account.token, account.business_id) as (c, _):
            revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b"),
                                 {"b": account.business_id}).scalar_one()
        return Admission(kind="csv_preview", deal_id=None, expected_version=None, expected_input_version=None,
                         expected_financial_revision=revision, snapshot_id=None, source_document_id=None)

    data = command(a)
    first_key = str(uuid4())
    first = operations.admit(a.token, a.business_id, first_key, data)
    for _ in range(MAX_PENDING_OPERATIONS - 2):
        operations.admit(a.token, a.business_id, str(uuid4()), data)

    def submit():
        try:
            operations.admit(a.token, a.business_id, str(uuid4()), data)
            return 202
        except ApplicationError as exc:
            assert exc.code == "OPERATION_CAPACITY"
            return exc.status

    with ThreadPoolExecutor(max_workers=2) as executor:
        assert sorted(executor.map(lambda _: submit(), range(2))) == [202, 429]
    # Execution has a separate admission producer; it must obey the same cap.
    from orderfit.store import execution_repository

    with pytest.raises(ApplicationError) as error:
        with postgres["database"].tenant(a.token, a.business_id, "execute") as (c, scope):
            execution_repository.insert_operation(c, operation_id=uuid4(), scope=scope,
                deal={"id": uuid4(), "input_version": 1}, revision=data.expected_financial_revision,
                run_id=uuid4(), fingerprint=b"s" * 32)
    assert error.value.code == "OPERATION_CAPACITY"
    assert operations.admit(a.token, a.business_id, first_key, data).operation_id == first.operation_id
    assert operations.admit(b.token, b.business_id, str(uuid4()), command(b)).operation_id


def test_noninheriting_owner_membership_is_rejected(postgres):
    parent = "audit_owner_" + uuid4().hex[:12]
    table = "audit_owned_" + uuid4().hex[:12]
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(sql.SQL("CREATE ROLE {} NOLOGIN").format(sql.Identifier(parent)))
        c.execute(sql.SQL("CREATE TABLE {} (id integer)").format(sql.Identifier(table)))
        c.execute(sql.SQL("ALTER TABLE {} OWNER TO {}").format(sql.Identifier(table), sql.Identifier(parent)))
        c.execute(sql.SQL("GRANT {} TO p1_runtime WITH INHERIT FALSE, SET TRUE").format(sql.Identifier(parent)))
    try:
        with postgres["database"].engine.connect() as c:
            assert not c.execute(text("SELECT pg_has_role(current_user,:parent,'USAGE')"), {"parent": parent}).scalar_one()
            assert c.execute(text("SELECT pg_has_role(current_user,:parent,'MEMBER')"), {"parent": parent}).scalar_one()
        with pytest.raises(RuntimeError, match="restricted"):
            postgres["database"].validate_runtime()
        assert not postgres["database"].readiness()["database"]
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute(sql.SQL("REVOKE {} FROM p1_runtime").format(sql.Identifier(parent)))
            c.execute(sql.SQL("DROP TABLE {}").format(sql.Identifier(table)))
            c.execute(sql.SQL("DROP ROLE {}").format(sql.Identifier(parent)))
    postgres["database"].validate_runtime()


def test_session_resolution_has_transaction_timeouts_before_it_locks(postgres, accounts):
    statements = []
    database = postgres["database"]

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    event.listen(database.engine, "before_cursor_execute", capture)
    try:
        with database.identity(accounts[0].token):
            pass
    finally:
        event.remove(database.engine, "before_cursor_execute", capture)
    resolution = next(i for i, q in enumerate(statements) if "session_resolve" in q)
    assert resolution == 3
    assert all("set_config" in q for q in statements[:resolution])


def test_every_tenant_table_forces_rls_and_definer_entrypoints_are_not_public(postgres):
    with postgres["database"].engine.connect() as c:
        tables = c.execute(text("""
            SELECT t.relname,t.relrowsecurity,t.relforcerowsecurity
            FROM pg_class t JOIN pg_namespace n ON n.oid=t.relnamespace
            WHERE n.nspname='public' AND t.relkind IN ('r','p')
              AND (t.relname='business' OR EXISTS(SELECT FROM pg_attribute a
                   WHERE a.attrelid=t.oid AND a.attname='business_id' AND NOT a.attisdropped))
        """)).all()
        assert len(tables) >= 30
        assert [(name, rls, force) for name, rls, force in tables if not (rls and force)] == []
        exposed = c.execute(text("""
            SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace,
              LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
            WHERE n.nspname='public' AND p.prosecdef AND p.prorettype<>'trigger'::regtype
              AND acl.grantee=0 AND acl.privilege_type='EXECUTE'
        """)).scalars().all()
        assert exposed == []


def test_pdf_capacity_returns_429_without_persisting_failed_evidence(postgres, config, accounts):
    import io

    from pypdf import PdfWriter

    from orderfit.services.documents import PDF_WORK
    from tests.db.test_p4_documents import Session, make_deal, upload

    writer, data = PdfWriter(), io.BytesIO()
    writer.add_blank_page(width=100, height=100)
    writer.write(data)
    account = accounts[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        session = Session(client, account, f"/api/v1/businesses/{account.business_id}")
        deal = make_deal(session)
        assert PDF_WORK.acquire(blocking=False)
        assert PDF_WORK.acquire(blocking=False)
        try:
            refused = upload(session, deal["id"], "synthetic.pdf", data.getvalue(),
                             "application/pdf", "other", "other", expect=(429,))
            assert refused.json()["error"]["code"] == "PARSER_CAPACITY"
        finally:
            PDF_WORK.release()
            PDF_WORK.release()
        assert session.read(f"/deals/{deal['id']}/documents")["items"] == []
        retried = upload(session, deal["id"], "synthetic.pdf", data.getvalue(),
                         "application/pdf", "other", "other").json()
        assert retried["parse_status"] == "ocr_required"
        with postgres["database"].tenant(account.token, account.business_id) as (c, _):
            assert c.execute(text("SELECT parser_version FROM document_parse WHERE document_id=:d"),
                             {"d": retried["id"]}).scalar_one() == "p4.2"
