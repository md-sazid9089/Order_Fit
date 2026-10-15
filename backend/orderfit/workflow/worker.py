"""Separate durable worker entry point. P2+ register actual capability handlers."""

import argparse
import inspect
import json
import multiprocessing
import os
import threading
import time
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
from orderfit.store.documents import PrivateDocuments
from orderfit.store.repositories import EvaluationRepository
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


DEFAULT_HANDLERS = {
}


def run_once(operations, worker, handlers, runtime=None):
    claim = operations.claim(worker)
    if claim is None:
        return False
    stopped = threading.Event()

    def heartbeat():
        while not stopped.wait(15):
            try:
                valid = operations.heartbeat(claim)
            except Exception:
                # A lost lease must never be treated as permission to publish. The
                # final database fence decides; recovery can reclaim expired work.
                valid = False
            if not valid:
                stopped.set()

    thread = threading.Thread(target=heartbeat, daemon=True)
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
                fresh = c.execute(text("SELECT d.input_version,d.status,b.financial_revision,o.cancellation_requested FROM deal d JOIN business b ON b.id=d.business_id JOIN operation o ON o.id=:op WHERE d.business_id=:b AND d.id=:d FOR UPDATE OF b,d,o"),
                                  {"op": claim["id"], "b": claim["business_id"], "d": job.deal_id}).mappings().one_or_none()
                if fresh is None or fresh["input_version"] != snapshot.input_version or fresh["financial_revision"] != snapshot.financial_revision or fresh["status"] != "computing":
                    result = BlockedResult(kind="blocked", outcome="stale", findings=[Finding(code="STALE_INPUT_VERSION",field=None,message="Inputs changed. Refresh before continuing.",blocking=True,resolution="refresh")])
                elif fresh["cancellation_requested"]:
                    result = BlockedResult(kind="blocked", outcome="stale", findings=[Finding(code="OPERATION-CANCELLED",field=None,message="The evaluation was cancelled before publication.",blocking=True,resolution="refresh")])
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


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true")
    args = parser.parse_args()
    if os.environ.get("DATABASE_URL_DIRECT"):
        raise RuntimeError("Migration credentials must not be injected into worker")
    config = RuntimeConfiguration()
    documents = PrivateDocuments(config.document_dir)
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
    database = Database(config.database_url.get_secret_value())
    database.validate_runtime(worker=True)
    operations = Operations(database)
    worker = str(uuid4())
    try:
        while True:
            worked = run_once(operations, worker, DEFAULT_HANDLERS, runtime)
            if args.once:
                break
            if not worked:
                time.sleep(1)
    finally:
        database.close()


if __name__ == "__main__":
    main()
