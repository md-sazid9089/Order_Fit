"""Reproducible, synthetic phase-audit bursts; only the disposable PG fixture is used.

Run explicitly with pytest -s to retain STRESS_METRIC JSON records. Latencies include
client-side pool waiting and are diagnostics, not production service-level promises.
"""

import json
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from time import perf_counter
from uuid import UUID, uuid4

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.resources import CustomerCreate, CustomerInput
from orderfit.services import execution
from orderfit.store.admission import MAX_PENDING_OPERATIONS
from orderfit.store.repositories import BusinessRepository, CustomerRepository, DealRepository
from orderfit.workflow.operations import Operations
from tests.db import test_p6_approval
from tests.db.test_foundation import admission
from tests.db.test_p3_review_regressions import save, setup_deal
from tests.db.test_p6_execution import (
    _execute_request,
    approved,
    db_rows,
    drain,
    effects_per_action,
    work,
)

case = test_p6_approval.case


def burst(label, count, workers, function):
    def measured(i):
        start = perf_counter()
        result = function(i)
        return result, (perf_counter() - start) * 1000

    start = perf_counter()
    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(measured, range(count)))
    elapsed = perf_counter() - start
    durations = sorted(t for _, t in results)
    print("STRESS_METRIC " + json.dumps(dict(
        label=label, requests=count, concurrency=workers,
        elapsed_seconds=round(elapsed, 3),
        p50_ms=round(durations[len(durations) // 2], 2),
        p95_ms=round(durations[min(len(durations) - 1, int(len(durations) * .95))], 2),
        max_ms=round(durations[-1], 2),
    )))
    return [value for value, _ in results]


def test_64_same_key_admissions_publish_one_operation_and_audit(postgres, accounts):
    db, a = postgres["database"], accounts[0]
    operations = Operations(db)
    command, key = admission(db, a), str(uuid4())
    ids = burst("same-key-admission", 64, 16,
                lambda _: operations.admit(a.token, a.business_id, key, command).operation_id)
    assert len(set(ids)) == 1
    with db.tenant(a.token, a.business_id) as (c, _):
        assert c.execute(text("SELECT count(*) FROM operation")).scalar_one() == 1
        assert c.execute(text("SELECT count(*) FROM operation_log WHERE action='operation_admit'")).scalar_one() == 1
        assert c.execute(text("SELECT ok FROM verify_operation_log(:b)"), {"b": a.business_id}).scalar_one()


def test_64_distinct_admissions_enforce_exact_capacity_and_tenant_fairness(postgres, accounts):
    db, a = postgres["database"], accounts[0]
    operations = Operations(db)
    command = admission(db, a)

    def submit(_):
        try:
            operations.admit(a.token, a.business_id, str(uuid4()), command)
            return "accepted"
        except ApplicationError as exc:
            assert exc.status == 429 and exc.code == "OPERATION_CAPACITY"
            return "capacity"

    results = Counter(burst("distinct-key-capacity", 64, 16, submit))
    assert results == {"accepted": MAX_PENDING_OPERATIONS, "capacity": 64 - MAX_PENDING_OPERATIONS}
    b = accounts[1]
    assert operations.admit(b.token, b.business_id, str(uuid4()), admission(db, b)).operation_id


def test_128_interleaved_tenant_reads_leave_no_pooled_context(postgres, accounts):
    db = postgres["database"]
    expected = {}
    for a in accounts:
        expected[a.business_id] = Operations(db).admit(
            a.token, a.business_id, str(uuid4()), admission(db, a)).operation_id

    def read(i):
        a = accounts[i % 2]
        with db.tenant(a.token, a.business_id) as (c, _):
            rows = c.execute(text("SELECT id,business_id FROM operation")).all()
            assert rows == [(expected[a.business_id], a.business_id)]
        return True

    assert all(burst("tenant-pool-reuse", 128, 16, read))
    with db.engine.connect() as c:
        assert c.execute(text("SELECT count(*) FROM operation")).scalar_one() == 0


def test_24_competing_editors_have_one_winner(postgres, accounts):
    db, a = postgres["database"], accounts[0]
    deal, inputs = setup_deal(postgres, a)

    def edit(i):
        try:
            with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
                save(c, scope, deal, inputs.model_copy(update={"order_value_minor": str(300001 + i)}))
            return "saved"
        except ApplicationError as exc:
            assert exc.status == 409 and exc.code == "STALE_VERSION"
            return "conflict"

    assert Counter(burst("competing-editors", 24, 16, edit)) == {"saved": 1, "conflict": 23}
    with db.tenant(a.token, a.business_id) as (c, _):
        fresh = DealRepository.get_deal(c, a.business_id, deal.id)
        assert fresh.version > deal.version


def test_24_execute_clicks_and_8_workers_produce_one_sandbox_effect(case, postgres):
    s = case
    mid = test_p6_approval.reviewed(s)["identity"]["message_id"]
    bundle, approval = approved(s, "send_message", [mid])
    request = _execute_request(s, bundle, approval)
    before = s["read"](f"/deals/{s['deal']['id']}")["negotiation_round"]

    def submit(_):
        a = s["account"]
        with postgres["database"].tenant(a.token, a.business_id, "execute") as (c, scope):
            return execution.admit(c, scope, UUID(bundle["manifest"]["id"]),
                                   request, str(uuid4()), bytes(32)).operation_id

    assert len(set(burst("execute-double-click", 24, 16, submit))) == 1
    burst("competing-workers", 8, 8, lambda i: work(postgres, f"stress-worker-{i}"))
    drain(postgres)
    run_id = s["read"](f"/bundles/{bundle['manifest']['id']}")["run_id"]
    assert s["read"](f"/execution-runs/{run_id}")["status"] == "succeeded"
    assert effects_per_action(postgres, s, run_id) == [1]
    assert db_rows(postgres, s, "SELECT count(*) AS n FROM execution_run WHERE bundle_id=:b",
                   b=UUID(bundle["manifest"]["id"]))[0]["n"] == 1
    assert s["read"](f"/deals/{s['deal']['id']}")["negotiation_round"] == before + 1


def test_readiness_requires_a_worker_process(postgres):
    # No worker process is started anywhere in this test or its postgres fixture.
    status = postgres["database"].readiness()
    print("STRESS_METRIC " + json.dumps(dict(label="no-worker-readiness", observed=status)))
    assert status["database"] and status["schema_current"]
    assert status["worker"] is False


def test_customer_page_exposes_continuation_for_51_records(postgres, accounts):
    db, a = postgres["database"], accounts[0]
    with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
        for i in range(51):
            revision = BusinessRepository.get_profile(c, a.business_id).financial_revision
            CustomerRepository.create_customer(c, scope, CustomerCreate(
                expected_financial_revision=revision,
                customer=CustomerInput(name=f"Synthetic page customer {i}", known_domains=[], red_flags=[])))
    with db.tenant(a.token, a.business_id) as (c, _):
        first = CustomerRepository.list_customers(c, a.business_id)
        second = CustomerRepository.list_customers(c, a.business_id, offset=50)
    print("STRESS_METRIC " + json.dumps(dict(label="customer-pagination", first_count=len(first.items),
          next_cursor=first.next_cursor, offset_50_count=len(second.items))))
    assert len(first.items) == 50 and len(second.items) == 1
    assert first.next_cursor is not None
