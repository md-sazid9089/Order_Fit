"""Pure regressions for the runtime-hardening audit: CSV guard, heartbeat, settings."""

import threading
from uuid import uuid4

import pytest
from pydantic import ValidationError

from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.exports import csv_cell
from orderfit.workflow.worker import heartbeat_loop


def test_csv_guard_neutralizes_whitespace_led_formulas_and_control_prefixes():
    for value in (" =1+1", " +cmd", "  -2", " @SUM(A1)", "\n=1", "\x0b=1", "\x0c=1",
                  "\nplain", "\tq", "\rr", "=x", "+x", "-x", "@x"):
        assert csv_cell(value) == "'" + value, repr(value)
    for value in ("ok", "a=b", "1-2", "", None, " plain", "x\n=1"):
        assert csv_cell(value) == ("" if value is None else value), repr(value)


class FakeOperations:
    def __init__(self, outcomes):
        self.outcomes = list(outcomes)
        self.calls = 0

    def heartbeat(self, claim):
        self.calls += 1
        outcome = self.outcomes.pop(0) if self.outcomes else True
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def run_loop(operations, ticks, retry_delays=(0, 0, 0)):
    """Drive the loop for a fixed number of intervals with zero waits."""
    stopped = threading.Event()
    waits = {"n": 0}
    real_wait = stopped.wait

    def wait(timeout=None):
        if timeout == 0.0001:  # interval tick
            waits["n"] += 1
            if waits["n"] > ticks:
                stopped.set()
        return real_wait(0)

    stopped.wait = wait
    heartbeat_loop(operations, {"id": uuid4()}, stopped, interval=0.0001, retry_delays=retry_delays)
    return stopped


def test_heartbeat_retries_transient_errors_and_keeps_running():
    ops = FakeOperations([OSError("blip"), True, TimeoutError("slow"), OSError("x"), True, True])
    stopped = run_loop(ops, ticks=3)
    # Tick 1: error then success; tick 2: two errors then success; tick 3: success.
    assert ops.calls == 6
    assert stopped.is_set()  # set by the test after three ticks, not by the errors


def test_heartbeat_exhausted_retries_do_not_stop_the_loop():
    ops = FakeOperations([OSError("down")] * 4 + [True])
    run_loop(ops, ticks=2, retry_delays=(0, 0, 0))
    assert ops.calls == 5  # 1 + 3 retries in tick 1, then tick 2 still heartbeats


def test_heartbeat_stops_only_on_explicit_lease_loss():
    ops = FakeOperations([True, False, True])
    stopped = threading.Event()
    heartbeat_loop(ops, {"id": uuid4()}, stopped, interval=0, retry_delays=(0,))
    assert stopped.is_set() and ops.calls == 2


def settings(**overrides):
    return RuntimeConfiguration(
        database_url="postgresql+psycopg://u:p@localhost/db", session_secret="s" * 48,
        account_fingerprint_key="f" * 48, account_fingerprint_key_version=1, document_dir=".",
        allowed_origins=["http://localhost:3000"], **overrides,
    )


def test_auth_and_upload_limits_are_separately_configurable_and_bounded():
    default = settings()
    assert (default.auth_account_limit, default.auth_source_limit) == (15, 300)
    assert (default.upload_concurrency, default.upload_source_concurrency) == (4, 2)
    assert settings(auth_source_limit=5000).auth_source_limit == 5000
    for bad in (dict(auth_account_limit=16), dict(auth_account_limit=0), dict(auth_source_limit=14),
                dict(upload_concurrency=0), dict(upload_source_concurrency=65)):
        with pytest.raises(ValidationError):
            settings(**bad)


def test_upload_body_deadlines_are_configurable_and_bounded():
    default = settings()
    assert (default.upload_body_timeout_seconds, default.upload_idle_timeout_seconds) == (120, 30)
    for bad in (dict(upload_body_timeout_seconds=0), dict(upload_body_timeout_seconds=601),
                dict(upload_idle_timeout_seconds=0), dict(upload_idle_timeout_seconds=121)):
        with pytest.raises(ValidationError):
            settings(**bad)


def test_api_docs_are_off_by_default_and_opt_in(monkeypatch):
    from fastapi.testclient import TestClient

    from orderfit.api.main import api_docs_enabled, create_app

    assert settings().expose_api_docs is False
    hidden = create_app(settings())
    client = TestClient(hidden)  # no lifespan: only static routes are exercised
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert client.get(path).status_code == 404, path
    # The in-process schema used by contract export and tests is unaffected.
    assert "/health" in hidden.openapi()["paths"]
    shown = TestClient(create_app(settings(expose_api_docs=True)))
    for path in ("/docs", "/redoc", "/openapi.json"):
        assert shown.get(path).status_code == 200, path
    # The module-level app (no explicit settings) reads EXPOSE_API_DOCS; absent means off.
    monkeypatch.delenv("EXPOSE_API_DOCS", raising=False)
    assert api_docs_enabled(None) is False
    monkeypatch.setenv("EXPOSE_API_DOCS", "true")
    assert api_docs_enabled(None) is True
    monkeypatch.setenv("EXPOSE_API_DOCS", "false")
    assert api_docs_enabled(None) is False
