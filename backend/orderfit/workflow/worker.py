"""Separate durable worker entry point. P2+ register actual capability handlers."""

import argparse
import inspect
import json
import logging
import multiprocessing
import os
import signal
import threading
from uuid import uuid4

from sqlalchemy import text

from orderfit.agent.nodes.compute import compute
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.workflow import (
    BlockedResult,
    CompletedResult,
    ErrorDetail,
    FailedResult,
    Finding,
    OperationResult,
    SafeError,
)
from orderfit.engine.models import Result
from orderfit.services.evaluations import build_evaluation_dto
from orderfit.store.db import Database
from orderfit.store.documents import create_document_store
from orderfit.store.repositories import EvaluationRepository
from orderfit.workflow.execution import run_execution
from orderfit.workflow.operations import Operations, operation_dto


class RetryableJobError(Exception):
    """Only a handler's explicitly classified transient error is retried."""


def failure(code):
    return FailedResult(
        kind="failed",
        error=SafeError(
            code=code,
            message="The operation could not be completed.",
            request_id=uuid4(),
            details=ErrorDetail(),
            retryable=code == "TRANSIENT_JOB_FAILURE",
        ),
    )


def _compute_child(snapshot_json, send_conn, memory_bytes):
    try:
        from orderfit.workflow.compute_limits import limit_memory

        memory_job = limit_memory(memory_bytes)
        snapshot = ConfirmedInputV1.model_validate_json(snapshot_json)
        comp = compute(snapshot)
        send_conn.send({"snapshot_hash": comp.snapshot_hash,
                        "reference_input_hash": comp.reference_input_hash,
                        "result": comp.result.model_dump(mode="json")})
        del memory_job
    except BaseException as exc:
        send_conn.send({"error": type(exc).__name__})
    finally:
        send_conn.close()


def bounded_compute(snapshot: ConfirmedInputV1, timeout_seconds: int = 90,
                    memory_bytes: int = 512 * 1024 * 1024):
    ctx = multiprocessing.get_context("spawn")
    receive, send = ctx.Pipe(duplex=False)
    process = ctx.Process(target=_compute_child,
                          args=(snapshot.model_dump_json(), send, memory_bytes), daemon=True)
    process.start()
    send.close()
    try:
        if not receive.poll(timeout_seconds):
            process.terminate()
            process.join(5)
            raise TimeoutError("analysis time budget exceeded")
        payload = receive.recv()
        process.join(5)
        if "error" in payload:
            if payload["error"] == "MemoryError":
                raise MemoryError("analysis memory budget exceeded")
            raise RuntimeError("analysis subprocess failed")
        from orderfit.agent.nodes.compute import Computation
        return Computation(payload["snapshot_hash"], payload["reference_input_hash"],
                           Result.model_validate_json(json.dumps(payload["result"])))
    finally:
        receive.close()
        if process.is_alive():
            process.terminate()
            process.join(5)


# Multi-transaction handlers own their fenced transactions and finish their operation.
run_execution.owns_transactions = True
DEFAULT_HANDLERS = {
    "execute": run_execution,
}


HEARTBEAT_SECONDS = 15
HEARTBEAT_RETRY_SECONDS = (1, 2, 4)  # bounded retries inside one interval (lease is 60 s)


def heartbeat_loop(operations, claim, stopped, *, interval=HEARTBEAT_SECONDS,
                   retry_delays=HEARTBEAT_RETRY_SECONDS):
    """Extend the lease until ``stopped`` is set or the database reports the lease lost.

    Only an explicit ``False`` from operation_heartbeat (lease expired, reclaimed or
    authorization revoked) stops the loop. A transient exception (pool/network/timeout) is
    retried a bounded number of times within the interval and then the loop simply keeps
    going at the next interval; it never gives up permanently on one error. Publication is
    still decided by the database fence (``Database.fence``/operation_finish), never by
    this thread, so a missed heartbeat can only let the lease lapse, not authorize a write.
    """
    while not stopped.wait(interval):
        for attempt, delay in enumerate((*retry_delays, None)):
            try:
                valid = operations.heartbeat(claim)
            except Exception as exc:  # noqa: BLE001 - classified as transient, retried
                LOG.warning("heartbeat_retry operation_id=%s attempt=%s error=%s",
                            claim["id"], attempt + 1, type(exc).__name__)
                if delay is None or stopped.wait(delay):
                    break
                continue
            if not valid:
                stopped.set()  # explicit lease loss: stop extending it
            break


def run_once(operations, worker, handlers, runtime=None):
    claim = operations.claim(worker)
    if claim is None:
        return False
    stopped = threading.Event()
    thread = threading.Thread(target=heartbeat_loop, args=(operations, claim, stopped), daemon=True)
    thread.start()
    retry = False
    try:
        with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
            claimed_row = c.execute(text("SELECT * FROM operation WHERE id=:id"), {"id": claim["id"]}).mappings().one()
            job = operation_dto(claimed_row)
            snapshot_id = claimed_row["snapshot_id"]
        if job.kind == "evaluate":
            # Read the immutable payload in a short scoped transaction.
            with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
                row = c.execute(text("SELECT payload FROM input_snapshot WHERE id=:id AND business_id=:b"),
                                {"id": snapshot_id, "b": claim["business_id"]}).mappings().one_or_none()
                if row is None:
                    raise RuntimeError("confirmed snapshot is unavailable")
                snapshot = ConfirmedInputV1.model_validate(row["payload"])
            computation = bounded_compute(snapshot)
            eval_id = uuid4()
            with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
                # One statement per row, in the documented order business -> deal -> operation
                # (as operation_claim/operation_finish do). A single multi-table FOR UPDATE OF
                # leaves the acquisition order to the planner and can deadlock with them.
                revision = c.execute(text("SELECT financial_revision FROM business WHERE id=:b FOR UPDATE"),
                                     {"b": claim["business_id"]}).mappings().one()["financial_revision"]
                deal = c.execute(text("SELECT input_version,status FROM deal WHERE business_id=:b AND id=:d FOR UPDATE"),
                                 {"b": claim["business_id"], "d": job.deal_id}).mappings().one_or_none()
                if deal is None or deal["input_version"] != snapshot.input_version or revision != snapshot.financial_revision or deal["status"] != "computing":
                    result = BlockedResult(kind="blocked", outcome="stale", findings=[Finding(code="STALE_INPUT_VERSION",field=None,message="Inputs changed. Refresh before continuing.",blocking=True,resolution="refresh")])
                elif not operations.database.fence(c, claim["id"], claim["lease_token"]):
                    # Same predicate operation_finish applies, re-evaluated after the
                    # business/deal/operation locks: a revocation or a cancellation request
                    # racing the job must not publish an evaluation. operation_finish then
                    # records 'cancelled' (cancellation) or 'failed' (revocation), whatever
                    # result is passed. A cancellation requested before this transaction
                    # opened already made Database.job refuse the lease.
                    result = failure("AUTHORIZATION_REVOKED")
                elif computation.result.decision in {"analysis_limit", "needs_input", "unsupported_escalate", "blocked_data_conflict"}:
                    outcome = computation.result.decision
                    code, message = {
                        "analysis_limit": ("ANALYSIS-LIMIT", "The analysis exceeded its configured work limit."),
                        "needs_input": ("INPUT-REVIEW-REQUIRED", "Required input is missing or unresolved."),
                        "unsupported_escalate": ("UNSUPPORTED-CAPABILITY", "This input uses a capability that is not enabled."),
                        "blocked_data_conflict": ("DATA-CONFLICT", "Conflicting source data must be resolved before evaluation."),
                    }[outcome]
                    result = BlockedResult(kind="blocked", outcome=outcome, findings=[Finding(code=code,field=None,message=message,blocking=True,resolution="correct_input")])
                else:
                    dto = build_evaluation_dto(snapshot, computation, snapshot_id, eval_id)
                    EvaluationRepository.publish_evaluation(c, scope, dto, snapshot, computation)
                    result = CompletedResult(kind="completed", resource_id=dto.id,
                        resource_url=f"/api/v1/businesses/{claim['business_id']}/evaluations/{dto.id}")
                from pydantic import TypeAdapter
                serialized = TypeAdapter(OperationResult).dump_json(result).decode()
                finished = c.execute(text("SELECT operation_finish(:id,:token,CAST(:result AS jsonb),false)"),
                    {"id": claim["id"], "token": claim["lease_token"], "result": serialized}).scalar_one()
                if not finished:
                    raise RuntimeError("operation lease lost before publication")
            return True
        owned = handlers.get(job.kind)
        if owned is not None and getattr(owned, "owns_transactions", False):
            owned(operations, claim, job, runtime)
            return True
        if job.kind in {"whatif", "draft", "reply"} and job.kind not in handlers:
            from orderfit.workflow.preparation import run_preparation
            run_preparation(operations, claim, job, runtime)
            return True
        if job.kind == "extract" and runtime is not None and "extract" not in handlers:
            # Provider call happens outside any database transaction.
            from orderfit.workflow.extraction import run_extract

            result = run_extract(operations, claim, job, runtime)
        else:
          with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
            row = (
                c.execute(text("SELECT * FROM operation WHERE id=:id"), {"id": claim["id"]})
                .mappings()
                .one()
            )
            job = operation_dto(row)
            handler = handlers.get(job.kind)
            if handler:
                sig = inspect.signature(handler)
                if len(sig.parameters) >= 3:
                    result = handler(job, c, scope)
                else:
                    result = handler(job)
            elif job.kind == "csv_preview" and runtime is not None:
                from orderfit.workflow.extraction import handle_csv_preview

                result = handle_csv_preview(job, c, scope, runtime)
            else:
                result = failure("CAPABILITY_UNAVAILABLE")
    except (TimeoutError, MemoryError):
        result = BlockedResult(kind="blocked", outcome="analysis_limit", findings=[Finding(
            code="ANALYSIS-LIMIT", field=None,
            message="The analysis exceeded the process time or memory limit. Reduce the analysis size before retrying.",
            blocking=True, resolution="correct_input")])
    except RetryableJobError:
        result, retry = failure("TRANSIENT_JOB_FAILURE"), True
    except Exception:
        result = failure("JOB_FAILED")
    finally:
        stopped.set()
        thread.join(timeout=2)
    operations.finish(claim, result, retry=retry)
    return True


LOG = logging.getLogger("orderfit.worker")


def install_shutdown_handlers(stop: threading.Event):
    """SIGTERM/SIGINT request a graceful stop: no new claim; the in-flight job runs to its
    normal fenced finish (or, if killed later, its lease simply expires and is reclaimed)."""

    def request_stop(signum, _frame):
        if not stop.is_set():
            LOG.info("worker_shutdown_requested signal=%s", signum)
        stop.set()

    previous = {}
    for sig in (signal.SIGTERM, signal.SIGINT):
        previous[sig] = signal.signal(sig, request_stop)
    return previous


def serve(operations, worker, handlers, runtime, stop: threading.Event, *, once=False, step=None):
    """Claim loop. Checks ``stop`` only between jobs, so a job is never abandoned mid-way."""
    step = step or run_once
    while not stop.is_set():
        worked = step(operations, worker, handlers, runtime)
        if once:
            break
        if not worked:
            stop.wait(1)


def run_worker(database, runtime, *, once=False, handlers=None, step=None, stop=None) -> int:
    """Validate the restricted login, serve until stopped, always close the pool; exit 0."""
    stop = stop or threading.Event()
    previous = install_shutdown_handlers(stop)
    try:
        database.validate_runtime(worker=True)
        from orderfit.workflow.presence import worker_presence

        worker_id = uuid4()
        with database.presence_channel() as channel, worker_presence(channel, worker_id):
            serve(Operations(database), str(worker_id), handlers or DEFAULT_HANDLERS, runtime, stop,
                  once=once, step=step)
        LOG.info("worker_stopped")
        return 0
    finally:
        database.close()
        for sig, handler in previous.items():
            signal.signal(sig, handler)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if os.environ.get("DATABASE_URL_DIRECT"):
        raise RuntimeError("Migration credentials must not be injected into worker")
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    config = RuntimeConfiguration()
    documents = create_document_store(config)
    from pathlib import Path

    from orderfit.agent.llm import LLMSettings
    from orderfit.workflow.extraction import Runtime

    runtime = Runtime(
        llm=LLMSettings(
            mode=config.llm_mode,
            model=config.openai_model,
            api_key=config.openai_api_key.get_secret_value() if config.openai_api_key else None,
            timeout_seconds=config.provider_timeout_seconds,
            max_output_tokens=config.provider_max_output_tokens,
            concurrency=config.provider_concurrency,
            recordings_dir=Path(config.llm_recordings_dir) if config.llm_recordings_dir else None,
        ),
        documents=documents,
        job_attempts=config.job_attempts,
    )
    raise SystemExit(run_worker(Database(config.database_url.get_secret_value()), runtime, once=args.once))


if __name__ == "__main__":
    main()
