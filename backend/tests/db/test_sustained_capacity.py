"""Bounded 60-second local capacity/recovery experiment, synthetic fixture only.

Thresholds set before measurement: no unhandled error or isolation/replay breach;
both tenants progress; service p95 < 5 s (local diagnostic budget, not an SLO);
no checked-out connections or live owned child after recovery. Deliberate typed
429/409 are expected. Memory is measured, not tuned to an arbitrary absolute cap.
"""
import gc
import io
import json
import os
import subprocess
import sys
import threading
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from pypdf import PdfWriter
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.workflow import CancelOperation, CompletedResult
from orderfit.services.documents import UploadRejected, parse
from orderfit.services.identity import hash_password
from orderfit.workflow.operations import Operations
from tests.db.test_foundation import admission
from tests.db.test_p3_process_recovery import runtime_environment
from tests.db.test_p3_review_regressions import save, setup_deal
from tests.process_memory import descendants, kill_owned_tree, resident_bytes


def test_sustained_local_service_capacity_and_recovery(postgres, accounts, config):
    db, worker = postgres["database"], Operations(postgres["worker"])
    api = Operations(db)
    setups = [setup_deal(postgres, a) for a in accounts]
    commands = [admission(db, a) for a in accounts]
    keys = [str(uuid4()), str(uuid4())]
    replays = [api.admit(a.token, a.business_id, keys[i], commands[i]).operation_id for i, a in enumerate(accounts)]
    counts, durations, queue_waits = Counter(), [], []
    guard, stopped = threading.Lock(), threading.Event()
    baseline_memory = resident_bytes(os.getpid())
    baseline_children = descendants(os.getpid())
    # A real separate compute process covers three existing representative heavy
    # inputs without changing engine fixtures, admission limits or golden outputs.
    engine = subprocess.Popen([sys.executable, "-m", "tests.engine.benchmark_engine"],
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    memory = []
    consumer_errors = []
    lifecycle = []
    worker_env = runtime_environment(postgres, config, worker=True)
    sentinel_code = "import os,time; from orderfit.store.db import Database; from orderfit.workflow.worker import run_worker; run_worker(Database(os.environ['DATABASE_URL']),None,step=lambda *args: time.sleep(120))"
    def start_presence_worker():
        return subprocess.Popen([sys.executable, "-c", sentinel_code], env=worker_env,
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    presence_process = [start_presence_worker()]

    def observe():
        while not stopped.wait(.2):
            owned, engine_tree = descendants(os.getpid()), descendants(engine.pid)
            memory.append((resident_bytes(os.getpid()), sum(resident_bytes(pid) for pid in engine_tree),
                           sum(resident_bytes(pid) for pid in owned - engine_tree - {os.getpid()})))
            elapsed = time.monotonic()-began
            if elapsed >= 20 and not lifecycle:
                kill_owned_tree(presence_process[0])
                lifecycle.append({"killed_at_seconds": elapsed})
            elif elapsed >= 25 and len(lifecycle) == 1:
                presence_process[0] = start_presence_worker()
                lifecycle.append({"restarted_at_seconds": elapsed})

    def traffic(index):
        a, cmd = accounts[index % 2], commands[index % 2]
        n = 0
        while time.monotonic() < deadline:
            began = time.perf_counter()
            try:
                kind = n % 5
                if kind == 0:
                    with db.tenant(a.token, a.business_id) as (c, _):
                        assert c.execute(text("SELECT count(*) FROM business")).scalar_one() == 1
                    label = "read"
                elif kind == 1:
                    assert api.admit(a.token, a.business_id, keys[index % 2], cmd).operation_id == replays[index % 2]
                    label = "replay"
                elif kind == 2:
                    accepted = api.admit(a.token, a.business_id, str(uuid4()), cmd)
                    label = "admitted"
                    current = api.get(a.token, a.business_id, accepted.operation_id)
                    if current.status in {"queued", "running"}:
                        api.cancel(a.token, a.business_id, accepted.operation_id, str(uuid4()),
                            CancelOperation(expected_operation_version=current.version, reason="Synthetic load cancellation"))
                        label = "cancelled"
                elif kind == 3:
                    deal, inputs = setups[index % 2]
                    with db.tenant(a.token, a.business_id, "prepare") as (c, scope):
                        save(c, scope, deal, inputs)
                    label = "editor_saved"
                else:
                    api.admit(a.token, a.business_id, str(uuid4()), cmd)
                    label = "admitted"
            except ApplicationError as exc:
                assert (exc.status, exc.code) in {(429, "OPERATION_CAPACITY"), (409, "STALE_VERSION"),
                    (409, "OPERATION_STATE_CONFLICT"), (503, "DATABASE_CAPACITY")}, (exc.status, exc.code)
                label = exc.code
            with guard:
                counts[f"tenant{index % 2}:{label}"] += 1
                durations.append((time.perf_counter()-began)*1000)
            n += 1

    def drain_until_stopped():
        try:
            consume()
        except Exception as exc:  # propagate background assertion/driver failures
            consumer_errors.append(type(exc).__name__)

    def consume():
        while not stopped.is_set():
            claim = worker.claim("sustained-synthetic-worker")
            if claim:
                try:
                    with postgres["worker"].job(claim["id"], claim["lease_token"]) as (c, _):
                        wait = c.execute(text("SELECT extract(epoch FROM started_at-queued_at) FROM operation WHERE id=:id"), {"id": claim["id"]}).scalar_one()
                    queue_waits.append(float(wait))
                except ApplicationError as exc:
                    assert exc.code == "LEASE_OR_AUTHORIZATION_LOST"  # cancellation racing claim
                worker.finish(claim, CompletedResult(kind="completed", resource_id=claim["id"], resource_url="/synthetic-capacity-result"))
            else:
                stopped.wait(.02)

    pdf, data = PdfWriter(), io.BytesIO()
    pdf.add_blank_page(width=100, height=100)
    pdf.write(data)
    def cpu_work(i):
        try:
            if i % 2:
                hash_password("Synthetic saturation password 123!")
                return "password_accepted"
            assert parse(data.getvalue(), "application/pdf").status == "ocr_required"
            return "parser_accepted"
        except ApplicationError as exc:
            assert exc.code == "AUTH_CAPACITY" and exc.status == 429
            return exc.code
        except UploadRejected as exc:
            assert exc.code == "PARSER_CAPACITY"
            return exc.code

    monitor = threading.Thread(target=observe, daemon=True)
    consumer = threading.Thread(target=drain_until_stopped, daemon=True)
    began = time.monotonic()
    deadline = began + 60
    monitor.start()
    consumer.start()
    try:
        with ThreadPoolExecutor(max_workers=16) as pool:
            futures = [pool.submit(traffic, i) for i in range(8)]
            cpu = list(pool.map(cpu_work, range(32)))
            for future in futures:
                future.result()
        elapsed = time.monotonic()-began
        output, errors = engine.communicate(timeout=180)
        assert engine.returncode == 0, errors[-500:]
    finally:
        stopped.set()
        consumer.join(timeout=10)
        monitor.join(timeout=2)
        if engine.poll() is None:
            kill_owned_tree(engine)
        if presence_process[0].poll() is None:
            kill_owned_tree(presence_process[0])
    assert not consumer.is_alive()
    assert not consumer_errors
    assert len(lifecycle) == 2
    gc.collect()
    time.sleep(2)
    recovered_memory = resident_bytes(os.getpid())
    assert descendants(os.getpid()) <= baseline_children
    durations.sort()
    p95 = durations[int(len(durations)*.95)]
    assert p95 < 5000
    assert all(counts[f"tenant{i}:read"] > 20 and counts[f"tenant{i}:replay"] > 20 for i in range(2))
    assert db.engine.pool.checkedout() == postgres["worker"].engine.pool.checkedout() == 0
    assert all(label in cpu for label in ("AUTH_CAPACITY", "PARSER_CAPACITY", "parser_accepted", "password_accepted"))
    print("SUSTAINED_METRIC " + json.dumps({
        "seconds": elapsed, "service_concurrency": 8, "cpu_concurrency": 8, "tenants": 2,
        "sessions": 2, "counts": dict(counts), "cpu_counts": dict(Counter(cpu)),
        "service_requests": len(durations), "p50_ms": durations[len(durations)//2], "p95_ms": p95,
        "max_ms": durations[-1], "queue_wait_max_seconds": max(queue_waits, default=0),
        "memory_before": baseline_memory, "parent_peak": max(p for p, _, _ in memory),
        "engine_child_peak": max(ch for _, ch, _ in memory), "other_children_peak": max(ch for _, _, ch in memory),
        "combined_peak": max(p+ch+other for p, ch, other in memory),
        "memory_after_gc": recovered_memory, "checked_out_after": 0, "engine": json.loads(output),
        "worker_lifecycle": lifecycle,
        "limits": "Windows sampled working sets including descendant Python redirectors, presence worker and parser children; Docker DB RSS excluded; finite 60-second load, not hosted capacity"}))
