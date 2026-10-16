"""P7/P8 pure checks: cursors, CSV export safety, fingerprints, proxy trust, readiness,
failure logging and worker graceful shutdown. No database, provider or network."""

import logging
import signal
import threading
from contextlib import contextmanager
from datetime import date
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import ValidationError

from orderfit.api.errors import ApplicationError, install_errors
from orderfit.api.serve import proxy_options
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.resources import FlagResolution, NotificationsRead
from orderfit.services.accounts import Fingerprinter
from orderfit.services.documents import parse_cash_csv
from orderfit.services.exports import cash_csv, csv_cell, major_units
from orderfit.services.pagination import CursorCodec
from orderfit.workflow import worker as worker_module

KEY = b"k" * 32


def codec():
    return CursorCodec(KEY)


def test_cursor_binds_business_user_listing_filters_and_rejects_tampering():
    b, u = uuid4(), uuid4()
    token = codec().encode(business_id=b, user_id=u, listing="members", position=["2026-10-16T00:00:00+00:00", "x"],
                           filters={"payee_id": "p"})
    assert codec().decode(token, business_id=b, user_id=u, listing="members", filters={"payee_id": "p"}) == [
        "2026-10-16T00:00:00+00:00", "x"]
    for kwargs in (
        dict(business_id=uuid4(), user_id=u, listing="members", filters={"payee_id": "p"}),
        dict(business_id=b, user_id=uuid4(), listing="members", filters={"payee_id": "p"}),
        dict(business_id=b, user_id=u, listing="audit", filters={"payee_id": "p"}),
        dict(business_id=b, user_id=u, listing="members", filters={"payee_id": "q"}),
    ):
        with pytest.raises(ApplicationError) as error:
            codec().decode(token, **kwargs)
        assert error.value.code == "INVALID_CURSOR"
    body, signature = token.split(".")
    for forged in (body + "A." + signature, body + "." + signature[:-2] + "AA", "garbage", "a.b.c", "x" * 3000):
        with pytest.raises(ApplicationError):
            codec().decode(forged, business_id=b, user_id=u, listing="members", filters={"payee_id": "p"})
    with pytest.raises(ApplicationError):
        CursorCodec(b"z" * 32).decode(token, business_id=b, user_id=u, listing="members", filters={"payee_id": "p"})


def test_csv_export_escapes_formulas_and_round_trips_through_importer():
    assert [csv_cell(v) for v in ("=1+1", "+x", "-y", "@z", "\tq", "\rr", "ok", None)] == [
        "'=1+1", "'+x", "'-y", "'@z", "'\tq", "'\rr", "ok", ""]
    assert major_units(1) == "0.01" and major_units(123456789012) == "1234567890.12" and major_units(-5) == "-0.05"
    rows = [dict(id=7, event_date=date(2026, 11, 2), amount_minor=1250005, direction="out", kind="payroll",
                 certainty="confirmed", description="=HYPERLINK(\"http://x\")", invoice_ref="INV, 1",
                 is_deferrable=False)]
    content = cash_csv(rows, "BDT").decode("utf-8")
    assert content.startswith("event_id,event_date,amount,direction,kind,certainty,description,invoice_ref,is_deferrable,amount_minor,currency\r\n")
    assert "'=HYPERLINK" in content and '"INV, 1"' in content
    parsed = parse_cash_csv(content, date(2026, 10, 16))
    assert not parsed.errors
    event = parsed.events[0]
    assert (event["amount_minor"], event["kind"], event["invoice_ref"]) == ("1250005", "payroll", "INV, 1")


def test_account_fingerprint_is_keyed_versioned_and_normalized():
    a = Fingerprinter(b"a" * 32, 1)
    assert a.normalize(" 12-34 56ab ") == "123456AB"
    assert a.fingerprint("123456AB") == a.fingerprint(a.normalize("1234 56ab"))
    assert a.fingerprint("123456AB") != Fingerprinter(b"b" * 32, 2).fingerprint("123456AB")
    for bad in ("12", "12345!", "x" * 65):
        with pytest.raises(ApplicationError):
            a.normalize(bad)


def test_contract_adjustments():
    with pytest.raises(ValidationError):
        NotificationsRead(through_id="0")
    assert NotificationsRead(through_id="42").through_id == "42"
    base = dict(expected_version=1, expected_input_version=1, expected_financial_revision=1, reason="r",
                evidence=dict(document_id=None, content_hash=None, candidate_id=None, confirmed_field_id=None,
                              source_role="other", page=None, quote=None, manual_attestation="Attested",
                              override_reason=None))
    assert FlagResolution(**base).bank_verification is None
    with pytest.raises(ValidationError):
        FlagResolution(**base, bank_verification=dict(reply_id=str(uuid4()), account_id=str(uuid4()),
                                                      written_evidence="too short"))


def config(**overrides):
    values = dict(database_url="postgresql+psycopg://u:p@localhost/db", session_secret="s" * 48,
                  account_fingerprint_key="f" * 48, account_fingerprint_key_version=1, document_dir=".",
                  allowed_origins=["http://localhost:3000"])
    return RuntimeConfiguration(**(values | overrides))


def test_proxy_trust_is_explicit_and_off_by_default():
    assert config().trusted_proxy_ips == []
    assert proxy_options([]) == {"proxy_headers": False}
    assert proxy_options(["10.0.0.0/8", "192.0.2.4"]) == {
        "proxy_headers": True, "forwarded_allow_ips": "10.0.0.0/8,192.0.2.4"}
    assert config(trusted_proxy_ips=["10.1.2.3", "fd00::/8"]).trusted_proxy_ips == ["10.1.2.3", "fd00::/8"]
    for bad in (["*"], ["proxy.example"], ["10.0.0.0/33"]):
        with pytest.raises(ValidationError):
            config(trusted_proxy_ips=bad)


def test_unhandled_failure_is_logged_with_client_request_id_without_secrets(caplog):
    app = FastAPI()
    install_errors(app)

    @app.post("/boom")
    def boom():
        raise RuntimeError("secret-account-9988 password=hunter2")

    # Alembic's fileConfig (DB fixture migrations) disables pre-existing loggers in-process.
    logging.getLogger("orderfit.api").disabled = False
    with TestClient(app, raise_server_exceptions=False) as client, caplog.at_level(logging.ERROR, "orderfit.api"):
        response = client.post("/boom?token=leak", json={"password": "hunter2"},
                               headers={"Cookie": "orderfit_session=abc"})
    assert response.status_code == 503
    request_id = response.json()["error"]["request_id"]
    records = [r for r in caplog.records if r.name == "orderfit.api"]
    assert len(records) == 1
    line = records[0].getMessage()
    assert request_id in line and "route=/boom" in line and "error_type=RuntimeError" in line
    for secret in ("secret-account", "hunter2", "token=leak", "abc"):
        assert secret not in line
    assert records[0].exc_info is None


def test_expected_errors_are_not_logged_as_failures(caplog):
    app = FastAPI()
    install_errors(app)

    @app.get("/missing")
    def missing():
        raise ApplicationError(404, "NOT_FOUND")

    with TestClient(app) as client, caplog.at_level(logging.ERROR, "orderfit.api"):
        assert client.get("/missing").status_code == 404
    assert not [r for r in caplog.records if r.name == "orderfit.api"]


class FakeDatabase:
    def __init__(self, readiness=None):
        self.status = readiness or {"database": True, "schema_current": True, "worker": True, "backlog_seconds": 0}
        self.closed = False

    def validate_runtime(self, **_):
        pass

    def readiness(self):
        return dict(self.status)

    def publish_presence(self, *args):
        pass

    @contextmanager
    def presence_channel(self):
        yield self

    def close(self):
        self.closed = True


def ready_client(tmp_path, database):
    from orderfit.api.main import create_app

    return TestClient(create_app(config(document_dir=str(tmp_path / "docs")), database))


@pytest.mark.parametrize("status,ok", [
    ({"database": True, "schema_current": True, "worker": False, "backlog_seconds": 0}, False),
    ({"database": False, "schema_current": False, "worker": False, "backlog_seconds": None}, False),
    ({"database": True, "schema_current": False, "worker": False, "backlog_seconds": None}, False),
])
def test_ready_requires_database_schema_and_storage(tmp_path, status, ok):
    with ready_client(tmp_path, FakeDatabase(status)) as client:
        response = client.get("/ready")
        assert client.get("/health").json() == {"status": "ok"}
    assert response.status_code == (200 if ok else 503)
    body = response.json()
    assert body == {"status": "ready" if ok else "unavailable", "storage": True, "backlog_seconds": None, **status}
    assert response.headers["cache-control"] == "private, no-store"


def test_ready_reports_unwritable_storage(tmp_path):
    with ready_client(tmp_path, FakeDatabase()) as client:
        client.app.state.documents.writable = lambda: False
        response = client.get("/ready")
    assert response.status_code == 503 and response.json()["storage"] is False
    assert not list((tmp_path / "docs").glob(".ready-*"))


@contextmanager
def restored_signals():
    previous = {s: signal.getsignal(s) for s in (signal.SIGTERM, signal.SIGINT)}
    try:
        yield
    finally:
        for s, h in previous.items():
            signal.signal(s, h)


def test_worker_sigterm_finishes_in_flight_job_then_closes_pool_and_exits_zero():
    events = []
    database = FakeDatabase()
    database.validate_runtime = lambda **_: events.append("validated")

    def step(operations, worker, handlers, runtime):
        events.append("claimed")
        signal.raise_signal(signal.SIGTERM)  # arrives mid-job
        events.append("finished")  # the job is not abandoned
        return True

    with restored_signals():
        before = signal.getsignal(signal.SIGTERM)
        code = worker_module.run_worker(database, None, step=step)
        assert signal.getsignal(signal.SIGTERM) is before
    assert code == 0
    assert events == ["validated", "claimed", "finished"]  # no second claim after the signal
    assert database.closed


def test_worker_sigint_while_idle_stops_promptly_and_closes_pool():
    database = FakeDatabase()
    calls = []

    def idle(*_):
        calls.append(1)
        if len(calls) == 2:
            threading.Timer(0.05, lambda: signal.raise_signal(signal.SIGINT)).start()
        return False

    with restored_signals():
        assert worker_module.run_worker(database, None, step=idle) == 0
    assert database.closed and len(calls) >= 2


def test_worker_closes_pool_when_runtime_validation_fails():
    database = FakeDatabase()

    def reject(**_):
        raise RuntimeError("A restricted non-owner runtime login is required")

    database.validate_runtime = reject
    with restored_signals(), pytest.raises(RuntimeError):
        worker_module.run_worker(database, None, step=lambda *_: pytest.fail("must not claim"))
    assert database.closed


def test_finding_flag_id_is_an_optional_bigint_string():
    from orderfit.contracts.workflow import Finding

    base = dict(code="P5-BANK-CHANGE", field="recipient", message="Verify.", blocking=True,
                resolution="correct_input")
    assert Finding(**base).flag_id is None  # computed findings carry no stored flag
    assert Finding(**base, flag_id="42").flag_id == "42"
    for bad in (42, "0", "-1", "abc", "9" * 20):
        with pytest.raises(ValidationError):
            Finding(**base, flag_id=bad)


def test_bodyless_commands_bind_an_optional_empty_body_matching_the_catalogue():
    """Catalogue and mounted routes agree: absent/null/{} accepted, any field rejected."""
    from orderfit.api.main import create_app
    from orderfit.contracts.catalogue import ENDPOINTS
    from orderfit.contracts.export import build_openapi
    from orderfit.contracts.primitives import EmptyRequest

    optional = {e.operation_id for e in ENDPOINTS if e.optional_body}
    assert optional == {"decision_export", "cash_export", "notification_read"}
    assert all(e.request is EmptyRequest for e in ENDPOINTS if e.optional_body)
    spec = build_openapi()
    for path in spec["paths"].values():
        for op in path.values():
            if op["operationId"] in optional:
                body = op["requestBody"]
                assert body["required"] is False
                assert body["content"]["application/json"]["schema"]["anyOf"][1] == {"type": "null"}
    # The mounted app documents (and FastAPI binds) the same optional EmptyRequest | null body.
    runtime = {op["operationId"]: op for path in create_app().openapi()["paths"].values()
               for op in path.values()}
    for name in optional:
        body = runtime[name]["requestBody"]
        assert not body.get("required", False)
        assert body["content"]["application/json"]["schema"]["anyOf"] == [
            {"$ref": "#/components/schemas/EmptyRequest"}, {"type": "null"}]
    with pytest.raises(ValidationError):
        EmptyRequest.model_validate({"x": 1})
