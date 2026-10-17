"""Real HTTP arrival-rate experiment using only the labeled disposable PG17 fixture.

Run explicitly: python -m tests.stress.run_plan2 --output <private-run-dir>
No application environment file or caller-selected database/URL is accepted.
"""

import argparse
import asyncio
import hashlib
import json
import math
import os
import secrets
import shutil
import sys
import tempfile
import time
from collections import Counter, defaultdict
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4

import httpx
import psycopg
from sqlalchemy import text

from orderfit.api.main import create_app
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.store.db import SCHEMA_REVISION
from tests.db.conftest import accounts as accounts_fixture
from tests.db.conftest import postgres as postgres_fixture
from tests.db.test_p3_process_recovery import authenticate, running_api, runtime_environment
from tests.process_memory import descendants, process_alive, resident_bytes


def distribution(values):
    ordered = sorted(values)
    if not ordered:
        return {"n": 0}
    result = {"n": len(ordered), "p50_ms": ordered[math.ceil(len(ordered) * .5) - 1],
              "p95_ms": ordered[math.ceil(len(ordered) * .95) - 1], "max_ms": ordered[-1]}
    if len(ordered) >= 1000:
        result["p99_ms"] = ordered[math.ceil(len(ordered) * .99) - 1]
    return result


def within_latency_budget(summary):
    for route, row in summary["latency"].items():
        p95, p99 = (2000, 5000) if route in {"create", "replay"} else (1000, 2000)
        if row.get("p95_ms", 0) > p95 or row.get("p99_ms", 0) > p99:
            return False
    return True


def disk_preflight(roots):
    """Fail closed at the plan's fixed 15% free-space gate before provisioning."""
    rows = []
    for root in dict.fromkeys(Path(path).resolve() for path in roots):
        while not root.exists():
            root = root.parent
        usage = shutil.disk_usage(root)
        rows.append(dict(path=str(root), total_bytes=usage.total, free_bytes=usage.free,
                         free_percent=100 * usage.free / usage.total))
    return dict(minimum_percent=15, passed=all(row["free_percent"] >= 15 for row in rows), paths=rows)


def require_owned_processes_exit(pids):
    # The Windows venv redirector can exit just before its Python child. Allow
    # bounded shutdown propagation, then still require every known PID to exit.
    deadline = time.monotonic() + 5
    while any(process_alive(pid) for pid in pids) and time.monotonic() < deadline:
        time.sleep(.05)
    assert not any(process_alive(pid) for pid in pids), "Owned API process survived teardown"


class Experiment:
    def __init__(self, output, pg, config, accounts, client_keep_alive):
        self.output, self.pg, self.config, self.accounts = output, pg, config, accounts
        self.prefix = "ST2-" + uuid4().hex[:8]
        self.constraints, self.deals, self.replays = {}, {}, {}
        self.created = {i: set() for i in range(len(accounts))}
        self.intents = {i: set() for i in range(len(accounts))}
        self.client_keep_alive = client_keep_alive
        self.completed = Counter()
        self.stages = []
        self.file = (output / "load.jsonl").open("w", encoding="utf-8")
        self.requests_file = (output / "requests.jsonl").open("w", encoding="utf-8", buffering=1)

    def emit(self, kind, **data):
        row = {"kind": kind, "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), **data}
        self.file.write(json.dumps(row) + "\n")
        self.file.flush()
        print(json.dumps(row), flush=True)

    def body(self, tenant, suffix):
        return {"public_ref": f"{self.prefix}-{tenant}-{suffix}", "start_date": "2026-10-17",
                "constraints_id": self.constraints[tenant]}

    def seed(self, client, count):
        for i, account in enumerate(self.accounts):
            headers = authenticate(client, account)
            base = f"/api/v1/businesses/{account.business_id}"
            response = client.get(base + "/constraints")
            assert response.status_code == 200
            self.constraints[i] = response.json()["items"][0]["id"]
            for n in range(count):
                key = str(uuid4())
                body = self.body(i, f"seed-{n}")
                self.intents[i].add(body["public_ref"])
                response = client.post(base + "/deals", json=body,
                                       headers=headers | {"Idempotency-Key": key})
                assert response.status_code == 200, response.status_code
                identity = response.json()["id"]
                self.created[i].add(identity)
                if n == 0:
                    self.deals[i], self.replays[i] = identity, (key, body)
        self.emit("seed", tenants=len(self.accounts), deals_per_tenant=count)

    async def stage(self, url, label, rate, seconds, mixed=False, maximum=128):
        began = time.perf_counter()
        active, counts, durations, lag = set(), Counter(), defaultdict(list), []
        samples, unexpected = [], []
        started = dropped = 0
        clients = []
        for account in self.accounts:
            clients.append(httpx.AsyncClient(base_url=url, timeout=15,
                limits=httpx.Limits(max_connections=maximum, max_keepalive_connections=maximum,
                                   keepalive_expiry=self.client_keep_alive),
                cookies={"orderfit_session": account.token, "orderfit_csrf": account.csrf},
                headers={"Origin": "http://localhost:3000", "X-CSRF-Token": account.csrf}))

        async def request(sequence):
            i = sequence % len(self.accounts)
            client, account = clients[i], self.accounts[i]
            base = f"/api/v1/businesses/{account.business_id}"
            choice = (sequence // len(self.accounts)) % (10 if mixed else 6)
            route, method, body, headers, expected = "profile", "GET", None, {}, 200
            path = base + "/profile"
            if choice == 1:
                route, path = "pipeline", base + "/deals?limit=20"
            elif choice == 2:
                route, path = "deal", base + "/deals/" + self.deals[i]
            elif choice == 3:
                route, path = "constraints", base + "/constraints?limit=20"
            elif choice == 4:
                route, path = "customers", base + "/customers?limit=20"
            elif choice == 5:
                route, path = "notifications", base + "/notifications?limit=20"
            elif choice == 6:
                route, method, path = "create", "POST", base + "/deals"
                body, headers = self.body(i, uuid4().hex), {"Idempotency-Key": str(uuid4())}
                self.intents[i].add(body["public_ref"])
            elif choice == 7:
                route, method, path = "replay", "POST", base + "/deals"
                key, body = self.replays[i]
                headers = {"Idempotency-Key": key}
            elif choice == 8:
                route, path, expected = "cross_tenant", base + "/deals/" + self.deals[(i + 1) % len(self.accounts)], 404
            elif choice == 9:
                route, path, expected = "invalid_limit", base + "/deals?limit=101", 422
            start = time.perf_counter()
            status, code, response_bytes, error_type = None, "", 0, None
            try:
                response = await client.request(method, path, json=body, headers=headers)
                status, response_bytes = response.status_code, len(response.content)
                # Uvicorn's configured connection ceiling rejects before ASGI
                # with a plain-text 503; distinguish it from DB/app capacity.
                if status == 503 and response.text.strip() == "Service Unavailable":
                    code = "SERVER_CAPACITY"
                    counts[f"{i}:{route}:{status}:{code}"] += 1
                    counts["backpressure"] += 1
                    return
                payload = response.json()
                code = payload.get("error", {}).get("code", "") if isinstance(payload, dict) else ""
                counts[f"{i}:{route}:{response.status_code}:{code}"] += 1
                if response.status_code == 503 and code == "DATABASE_CAPACITY":
                    counts["backpressure"] += 1
                else:
                    assert response.status_code == expected, (route, response.status_code, code)
                    if route == "create":
                        assert payload["public_ref"] == body["public_ref"]
                        self.created[i].add(payload["id"])
                        self.completed[i] += 1
                    if route == "replay":
                        assert payload["id"] == self.deals[i]
                    if route == "pipeline":
                        assert all(item["public_ref"].startswith(f"{self.prefix}-{i}-")
                                   for item in payload["items"])
                    if route == "deal":
                        assert payload["id"] == self.deals[i]
                    if route == "profile":
                        assert payload["id"] == str(account.business_id)
            except (httpx.HTTPError, ValueError, AssertionError, KeyError) as exc:
                # Never serialize raw HTTP bodies, cookies or credential-bearing driver text.
                unexpected.append({"route": route, "type": type(exc).__name__})
                error_type = type(exc).__name__
            finally:
                duration = (time.perf_counter() - start) * 1000
                durations[route].append(duration)
                self.requests_file.write(json.dumps(dict(stage=label, sequence=sequence, tenant=i,
                    route=route, method=method, status=status, code=code, response_bytes=response_bytes,
                    elapsed_ms=duration, unexpected_error=error_type)) + "\n")

        async def sample():
            next_notice = began
            while time.perf_counter() - began < seconds or active:
                now = time.perf_counter()
                api_tree = set().union(*(descendants(pid) for pid in self.api_pids))
                api_memory = sum(resident_bytes(pid) for pid in api_tree)
                samples.append({"seconds": now - began, "api_tree_rss": api_memory,
                                "in_flight": len(active), "completed": sum(map(len, durations.values()))})
                if now >= next_notice:
                    self.emit("progress", stage=label, seconds=round(now-began, 1),
                              completed=sum(map(len, durations.values())), in_flight=len(active),
                              api_tree_rss=api_memory, unexpected=len(unexpected))
                    next_notice = now + 30
                await asyncio.sleep(2)

        self.emit("stage_start", stage=label, rate=rate, seconds=seconds, mixed=mixed)
        monitor = asyncio.create_task(sample())
        sequence = 0
        try:
            while sequence / rate < seconds:
                due = began + sequence / rate
                # Windows' coarse asyncio timer can wake early. Recheck the
                # monotonic deadline instead of sending a future arrival now.
                while (remaining := due - time.perf_counter()) > 0:
                    await asyncio.sleep(remaining)
                lag.append((time.perf_counter() - due) * 1000)
                if unexpected:
                    raise AssertionError("HTTP invariant failed; inspect sanitized load.jsonl")
                if len(active) >= maximum:
                    dropped += 1
                else:
                    task = asyncio.create_task(request(sequence))
                    active.add(task)
                    task.add_done_callback(active.discard)
                    started += 1
                sequence += 1
            if active:
                await asyncio.gather(*active)
            # Include the entire offered-load window even at low rates, where
            # the last scheduled arrival precedes the end by nearly 1/rate.
            while (remaining := began + seconds - time.perf_counter()) > 0:
                await asyncio.sleep(remaining)
        finally:
            if active:
                await asyncio.gather(*active, return_exceptions=True)
            monitor.cancel()
            await asyncio.gather(monitor, return_exceptions=True)
            await asyncio.gather(*(client.aclose() for client in clients))
            elapsed = time.perf_counter() - began
            summary = dict(stage=label, offered_rate=rate, scheduled=sequence, started=started,
                dropped=dropped, elapsed_seconds=elapsed, counts=dict(counts),
                latency={route: distribution(values) for route, values in durations.items()},
                generator_lag=distribution(lag), unexpected=unexpected[:20],
                memory_first=samples[0]["api_tree_rss"] if samples else None,
                memory_last=samples[-1]["api_tree_rss"] if samples else None,
                memory_peak=max((row["api_tree_rss"] for row in samples), default=0))
            self.stages.append(summary)
            self.emit("stage_end", **summary)
            with (self.output / "samples.jsonl").open("a", encoding="utf-8") as f:
                for row in samples:
                    f.write(json.dumps({"stage": label, **row}) + "\n")
        assert not unexpected, unexpected[:5]
        assert started == sum(map(len, durations.values()))
        return summary

    def reconcile(self):
        # Query with runtime credentials under the real tenant context, then no context.
        for i, account in enumerate(self.accounts):
            with self.pg["database"].tenant(account.token, account.business_id) as (c, _):
                rows = c.execute(text("SELECT id,public_ref FROM deal")).all()
                actual = {str(row.id) for row in rows}
                assert self.created[i] <= actual, "An acknowledged deal disappeared"
                assert all(row.public_ref in self.intents[i] for row in rows), "Unrequested deal found"
                recovered = len(actual - self.created[i])
                self.created[i].update(actual)
                assert c.execute(text("SELECT ok FROM verify_operation_log(:b)"),
                                 {"b": account.business_id}).scalar_one()
                self.emit("reconciled", tenant=i, saved_deals=len(actual), new_creates=self.completed[i],
                          recovered_unknown_writes=recovered, audit_chain=True)
        with self.pg["database"].engine.connect() as c:
            assert c.execute(text("SELECT count(*) FROM deal")).scalar_one() == 0
        assert self.pg["database"].engine.pool.checkedout() == 0
        with psycopg.connect(self.pg["migrator"]) as c:
            assert c.execute("SELECT current_database()").fetchone()[0].startswith("orderfit_p1_test_")
            idle = c.execute("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() "
                             "AND state='idle in transaction'").fetchone()[0]
            assert idle == 0
        self.emit("connection_recovery", observer_checkedout=0, idle_in_transaction=idle,
                  unscoped_deals=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--stage-seconds", type=int, default=60)
    parser.add_argument("--soak-seconds", type=int, default=7200)
    parser.add_argument("--seed-deals", type=int, default=100)
    parser.add_argument("--businesses", type=int, default=2)
    parser.add_argument("--rates", type=int, nargs="+", default=[2, 5, 10, 20, 40, 80])
    parser.add_argument("--repetitions", type=int, default=3)
    parser.add_argument("--client-keep-alive", type=float, default=2)
    parser.add_argument("--soak-rate", type=float)
    args = parser.parse_args()
    assert 5 <= args.stage_seconds <= 300 and 0 <= args.soak_seconds <= 28800
    assert 1 <= args.seed_deals <= 10000
    assert 2 <= args.businesses <= 20 and args.businesses % 2 == 0
    assert 1 <= args.repetitions <= 3 and all(1 <= rate <= 80 for rate in args.rates)
    assert 0 < args.client_keep_alive <= 10
    assert args.soak_rate is None or 0 < args.soak_rate <= 80
    assert not any(os.environ.get(name) for name in
                   ("DATABASE_URL", "DATABASE_URL_DIRECT", "WORKER_DATABASE_URL", "OPENAI_API_KEY"))
    args.output.mkdir(parents=True, exist_ok=False)
    roots = [args.output, Path(tempfile.gettempdir())]
    docker_wsl = Path(os.environ.get("LOCALAPPDATA", tempfile.gettempdir())) / "Docker" / "wsl"
    if docker_wsl.exists():
        roots.append(docker_wsl)
    if Path("/var/lib/docker").exists():
        roots.append(Path("/var/lib/docker"))
    preflight = disk_preflight(roots)
    (args.output / "preflight.json").write_text(json.dumps(preflight, indent=2), encoding="utf-8")
    if not preflight["passed"]:
        raise RuntimeError("Stress run blocked: a required storage volume has less than 15% free space. See preflight.json.")
    fixture = postgres_fixture.__wrapped__()
    pg = next(fixture)
    experiment = None
    try:
        with TemporaryDirectory(prefix="orderfit-stress2-documents-") as documents:
            config = RuntimeConfiguration(database_url=pg["url"],
                session_secret=secrets.token_hex(32), account_fingerprint_key=secrets.token_hex(32),
                account_fingerprint_key_version=1, document_dir=documents,
                allowed_origins=["http://localhost:3000"], cookie_secure=False, llm_mode="off")
            accounts = []
            for _ in range(args.businesses // 2):
                accounts.extend(accounts_fixture.__wrapped__(pg, config))
            experiment = Experiment(args.output, pg, config, accounts, args.client_keep_alive)
            routes = [{"path": r.path, "methods": sorted(r.methods or [])}
                      for r in create_app(config, pg["database"]).routes if hasattr(r, "methods")]
            assert not any("/admin" in r["path"] for r in routes)
            (args.output / "routes.json").write_text(json.dumps(routes, indent=2), encoding="utf-8")
            experiment.emit("manifest", schema=SCHEMA_REVISION, python=sys.version.split()[0],
                cpu_count=os.cpu_count(), seed_deals=args.seed_deals, businesses=len(accounts),
                client_keep_alive_seconds=args.client_keep_alive,
                scope="synthetic businesses; one session each; real HTTP; no jobs/providers",
                server_limits=dict(concurrency=64, keep_alive_seconds=5, graceful_shutdown_seconds=20,
                                   proxy_headers=False))
            api_environment = runtime_environment(pg, config)
            # The shared recovery helper launches Uvicorn's CLI. Its documented
            # UVICORN_* settings reproduce api.serve's production limits while
            # retaining a private loopback listener and sanitized environment.
            api_environment.update(UVICORN_LIMIT_CONCURRENCY="64", UVICORN_TIMEOUT_KEEP_ALIVE="5",
                                   UVICORN_TIMEOUT_GRACEFUL_SHUTDOWN="20", UVICORN_PROXY_HEADERS="false")
            with running_api(api_environment) as (client, port):
                # running_api's Popen is located through the owned process tree; record
                # only a newly started descendant whose parent belongs to this process.
                own_tree = descendants(os.getpid()) - {os.getpid()}
                assert own_tree
                experiment.api_pids = own_tree
                experiment.seed(client, args.seed_deals)
                url = f"http://127.0.0.1:{port}"
                passed_per_repeat = []
                for repeat in range(args.repetitions):
                    passed = []
                    for rate in args.rates:
                        summary = asyncio.run(experiment.stage(url, f"ramp-{repeat+1}-{rate}",
                                                              rate, args.stage_seconds, mixed=True))
                        bad_latency = not within_latency_budget(summary)
                        if summary["dropped"] or summary["counts"].get("backpressure") or bad_latency:
                            experiment.emit("capacity_knee", repeat=repeat+1, rate=rate)
                            break
                        passed.append(rate)
                    passed_per_repeat.append(passed)
                if args.soak_seconds:
                    assert all(passed_per_repeat), "No passing ramp envelope for soak"
                    candidate = min(max(passed) for passed in passed_per_repeat)
                    soak_rate = args.soak_rate or candidate * .6
                    experiment.emit("soak_selection", rate=soak_rate, candidate_rate=candidate,
                                    passing_rates=passed_per_repeat,
                                    method="explicit" if args.soak_rate else "60-percent-lowest-repeated-candidate")
                    soaked = asyncio.run(experiment.stage(url, "soak", soak_rate, args.soak_seconds, mixed=True))
                    assert not soaked["dropped"] and not soaked["counts"].get("backpressure"), "Soak exceeded admission envelope"
                    assert within_latency_budget(soaked), "Soak exceeded latency envelope"
                experiment.reconcile()
                time.sleep(10)
                api_tree = set().union(*(descendants(pid) for pid in experiment.api_pids))
                experiment.emit("quiescence", seconds=10,
                                api_tree_rss=sum(resident_bytes(pid) for pid in api_tree))
            require_owned_processes_exit(experiment.api_pids)
            # API restart: replay the original writes without a replacement key.
            with running_api(api_environment) as (client, _):
                restarted_pids = descendants(os.getpid()) - {os.getpid()}
                for i, account in enumerate(accounts):
                    headers = authenticate(client, account)
                    key, body = experiment.replays[i]
                    response = client.post(f"/api/v1/businesses/{account.business_id}/deals", json=body,
                                           headers=headers | {"Idempotency-Key": key})
                    assert response.status_code == 200 and response.json()["id"] == experiment.deals[i]
                experiment.reconcile()
                experiment.emit("restart_replay", passed=True)
            require_owned_processes_exit(restarted_pids)
            experiment.emit("process_cleanup", owned_api_processes_exited=True)
            source = Path(__file__).read_bytes()
            experiment.emit("complete", harness_sha256=hashlib.sha256(source).hexdigest())
    except BaseException:
        if experiment:
            try:
                # Preserve same-intent DB evidence even after an unknown HTTP
                # outcome; never issue a fresh-key replacement write on abort.
                experiment.reconcile()
                experiment.emit("aborted", persisted_state_reconciled=True)
            except Exception as exc:
                experiment.emit("abort_reconciliation_failed", error_type=type(exc).__name__)
        raise
    finally:
        if experiment:
            experiment.file.close()
            experiment.requests_file.close()
        fixture.close()


if __name__ == "__main__":
    main()
