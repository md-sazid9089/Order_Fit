"""Remediation acceptance on the verified disposable database, never application URLs."""
import subprocess
import sys
import time
from contextlib import ExitStack
from uuid import uuid4

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.resources import CustomerCreate, CustomerInput
from orderfit.services.identity import IdentityService
from orderfit.store.repositories import BusinessRepository, CustomerRepository
from orderfit.workflow.presence import worker_presence
from tests.db.test_p3_process_recovery import runtime_environment
from tests.process_memory import kill_owned_tree


def test_pool_saturation_is_typed_retryable_and_recovers(postgres, config, accounts):
    db, account = postgres["database"], accounts[0]
    with TestClient(create_app(config, db)) as client:
        client.cookies.set("orderfit_session", account.token)
        with ExitStack() as held:
            for _ in range(5):
                held.enter_context(db.engine.connect())
            began = time.monotonic()
            response = client.get(f"/api/v1/businesses/{account.business_id}/profile")
            assert response.status_code == 503
            assert response.json()["error"]["code"] == "DATABASE_CAPACITY"
            assert response.json()["error"]["retryable"]
            assert time.monotonic()-began < 5
        assert client.get(f"/api/v1/businesses/{account.business_id}/profile").status_code == 200
    assert db.engine.pool.checkedout() == 0


def test_worker_storage_restricted_expiry_multiple_workers_and_shutdown(postgres):
    api, worker = postgres["database"], postgres["worker"]
    one, two = uuid4(), uuid4()
    assert not api.readiness()["worker"]
    with pytest.raises(DBAPIError):
        api.publish_presence(one)
    for db in (api, worker):
        with pytest.raises(DBAPIError), db.engine.begin() as c:
            c.execute(text("INSERT INTO worker_presence VALUES(:id,current_user,now(),now())"), {"id": one})
        with pytest.raises(DBAPIError), db.engine.begin() as c:
            c.execute(text("SELECT count(*) FROM worker_presence"))
    # Background pulses continue during work outside transactions; no job lease needed.
    with worker_presence(worker, one, interval=.1):
        assert api.readiness()["worker"]
        with psycopg.connect(postgres["migrator"]) as c:
            initial = c.execute("SELECT heartbeat_at FROM worker_presence WHERE id=%s", (one,)).fetchone()[0]
        time.sleep(.3)
        with psycopg.connect(postgres["migrator"]) as c:
            assert c.execute("SELECT heartbeat_at FROM worker_presence WHERE id=%s", (one,)).fetchone()[0] > initial
        worker.publish_presence(two)
    assert api.readiness()["worker"]  # shutting down one process doesn't remove another
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("UPDATE worker_presence SET expires_at=clock_timestamp()-interval '1 second' WHERE id=%s", (two,))
    assert not api.readiness()["worker"]
    worker.publish_presence(two)
    assert api.readiness()["worker"]
    worker.publish_presence(two, False)
    assert not api.readiness()["worker"]


def test_real_worker_idle_long_work_kill_expiry_and_restart(postgres, config):
    env = runtime_environment(postgres, config, worker=True)
    api = postgres["database"]
    # Use the production lifecycle with a deliberately slow bounded handler step.
    code = """
import os,time
from orderfit.store.db import Database
from orderfit.workflow.worker import run_worker
def slow(*args):
    time.sleep(120)
    return True
run_worker(Database(os.environ['DATABASE_URL']),None,step=slow)
"""
    def start(code):
        return subprocess.Popen([sys.executable, "-c", code], env=env,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    process = start(code)
    try:
        deadline = time.monotonic() + 15
        while not api.readiness()["worker"]:
            assert process.poll() is None and time.monotonic() < deadline
            time.sleep(.1)
        # Cross at least one production pulse while main loop is occupied.
        time.sleep(12)
        with psycopg.connect(postgres["migrator"]) as c:
            age = c.execute("SELECT extract(epoch FROM clock_timestamp()-max(heartbeat_at)) FROM worker_presence").fetchone()[0]
        assert age < 5 and api.readiness()["worker"]
        kill_owned_tree(process)
        killed = time.monotonic()
        while api.readiness()["worker"]:
            assert time.monotonic()-killed < 65
            time.sleep(.5)
        print(f"PRESENCE_METRIC death_expiry_seconds={time.monotonic()-killed:.3f}")
        # Fresh process UUID and actual idle claim loop recover readiness.
        process = start("import os; from orderfit.store.db import Database; from orderfit.workflow.worker import run_worker; run_worker(Database(os.environ['DATABASE_URL']),None)")
        deadline = time.monotonic()+15
        while not api.readiness()["worker"]:
            assert process.poll() is None and time.monotonic() < deadline
            time.sleep(.1)
    finally:
        if process.poll() is None:
            kill_owned_tree(process)
        # Exact UUIDs created during this test are owned by owned_queue teardown.


def test_signed_customer_pages_ties_archives_insertions_and_scope(postgres, config, accounts):
    db, a = postgres["database"], accounts[0]
    codec = IdentityService(db, config).cursors
    with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
        for i in range(53):
            revision = BusinessRepository.get_profile(c, a.business_id).financial_revision
            CustomerRepository.create_customer(c, scope, CustomerCreate(
                expected_financial_revision=revision,
                customer=CustomerInput(name=f"Paged {i}", known_domains=[], red_flags=[])))
    # Reproduce equal sort values, including archived history.
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("UPDATE customer SET created_at='2026-01-01',archived_at=CASE WHEN name='Paged 0' THEN now() ELSE NULL END WHERE business_id=%s", (a.business_id,))
    def page(cursor=None, offset=0, account=a):
        with db.tenant(account.token, account.business_id) as (c, scope):
            return CustomerRepository.list_customers(c, account.business_id, 50, offset,
                cursor=cursor, cursors=codec, scope=scope)
    first = page()
    assert len(first.items) == 50 and first.next_cursor
    with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
        CustomerRepository.create_customer(c, scope, CustomerCreate(
            expected_financial_revision=BusinessRepository.get_profile(c, a.business_id).financial_revision,
            customer=CustomerInput(name="Concurrent newer row", known_domains=[], red_flags=[])))
    second = page(first.next_cursor)
    assert len(second.items) == 3 and second.next_cursor is None
    assert len({r.id for r in first.items + second.items}) == 53
    assert any(r.archived_at for r in first.items + second.items)
    assert {r.id for r in second.items} == {r.id for r in page(offset=51).items}
    for token, offset, account in [(first.next_cursor, 1, a), (first.next_cursor, 0, accounts[1]), ("wrong", 0, a)]:
        with pytest.raises(ApplicationError) as error:
            page(token, offset, account)
        assert error.value.code == "INVALID_CURSOR" and error.value.status == 422
    for listing in ("payee:created_at:desc:v1", "customer:created_at:asc:v1"):
        with pytest.raises(ApplicationError):
            codec.decode(first.next_cursor, business_id=a.business_id, user_id=a.user_id, listing=listing)
