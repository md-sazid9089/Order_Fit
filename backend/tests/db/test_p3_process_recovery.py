"""Actual API/worker process restarts recover the same financial operation."""

import json
import os
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from uuid import UUID

import httpx

from orderfit.runtime import process_environment
from tests.db.p3_helpers import manual_evaluation
from tests.db.test_foundation import expire_lease


def runtime_environment(postgres, config, *, worker=False):
    values = {
        "DATABASE_URL": postgres["url"], "WORKER_DATABASE_URL": postgres["worker_url"],
        "SESSION_SECRET": config.session_secret.get_secret_value(),
        "ACCOUNT_FINGERPRINT_KEY": config.account_fingerprint_key.get_secret_value(),
        "ACCOUNT_FINGERPRINT_KEY_VERSION": "1", "DOCUMENT_DIR": config.document_dir,
        "ALLOWED_ORIGINS": json.dumps(config.allowed_origins), "COOKIE_SECURE": "false",
        "LLM_MODE": "off",
    }
    return process_environment(values, os.environ, worker=worker)


@contextmanager
def running_api(environment, port=None):
    if port is None:
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
    process = subprocess.Popen([
        sys.executable, "-m", "uvicorn", "orderfit.api.main:app", "--host", "127.0.0.1",
        "--port", str(port), "--no-access-log",
    ], env=environment, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=10) as client:
            for _ in range(100):
                if process.poll() is not None:
                    raise AssertionError("Isolated API process exited during startup")
                try:
                    if client.get("/health").status_code == 200:
                        break
                except httpx.TransportError:
                    pass
                time.sleep(0.1)
            else:
                raise AssertionError("Isolated API did not become healthy")
            yield client, port
    finally:
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait(timeout=5)


def authenticate(client, account):
    client.cookies.set("orderfit_session", account.token)
    client.cookies.set("orderfit_csrf", account.csrf)
    return {"Origin": "http://localhost:3000", "X-CSRF-Token": account.csrf}


def test_real_api_and_worker_restart_publish_once(postgres, accounts, config):
    a = accounts[0]
    api_env = runtime_environment(postgres, config)
    worker_env = runtime_environment(postgres, config, worker=True)
    with running_api(api_env) as (client, port):
        headers = authenticate(client, a)
        deal, confirmed, accepted = manual_evaluation(client, headers, a.business_id)

    # An actual worker claims the financial job and is terminated before it computes.
    child = subprocess.Popen([sys.executable, "-c", """
import os,time
from orderfit.store.db import Database
from orderfit.workflow.operations import Operations
db=Database(os.environ['DATABASE_URL'])
db.validate_runtime(worker=True)
claim=Operations(db).claim('p3-financial-crash-test')
print(claim['id'],flush=True)
time.sleep(60)
"""], env=worker_env, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True)
    try:
        from concurrent.futures import ThreadPoolExecutor
        with ThreadPoolExecutor(max_workers=1) as pool:
            claimed = pool.submit(child.stdout.readline)
            try:
                assert UUID(claimed.result(timeout=10).strip()) == UUID(accepted["operation_id"])
            finally:
                child.terminate()
                child.wait(timeout=5)
    finally:
        if child.poll() is None:
            child.kill()
            child.wait(timeout=5)
        child.stdout.close()
    expire_lease(postgres, UUID(accepted["operation_id"]))
    recovered = subprocess.run([sys.executable, "-m", "orderfit.workflow.worker", "--once"],
                               env=worker_env, capture_output=True, timeout=120)
    assert recovered.returncode == 0, "Restarted isolated worker failed"
    base = f"/api/v1/businesses/{a.business_id}"
    with running_api(api_env, port) as (client, _):
        headers = authenticate(client, a)
        operation = client.get(base + "/operations/" + accepted["operation_id"]).json()
        assert operation["status"] == "succeeded" and operation["result"]["kind"] == "completed", operation
        assert operation["attempt"] == 2
        current = client.get(base + f"/deals/{deal['id']}").json()
        evaluation_id = current["live_evaluation_id"]
        result = client.get(base + f"/evaluations/{evaluation_id}").json()
        assert result["snapshot_hash"] == confirmed["snapshot_hash"]
        assert result["as_is"]["base_incremental_profit_minor"] == "35000000"
        assert client.get(base + f"/evaluations/{evaluation_id}/series").json()["points"]
        assert len(client.get(base + f"/deals/{deal['id']}/evaluations").json()["items"]) == 1
    # A further poll/restart does not run the already completed operation again.
    again = subprocess.run([sys.executable, "-m", "orderfit.workflow.worker", "--once"],
                           env=worker_env, capture_output=True, timeout=15)
    assert again.returncode == 0
    with running_api(api_env, port) as (client, _):
        authenticate(client, a)
        assert client.get(base + f"/deals/{deal['id']}").json()["live_evaluation_id"] == evaluation_id
        assert client.get(base + f"/operations/{accepted['operation_id']}").json()["attempt"] == 2
