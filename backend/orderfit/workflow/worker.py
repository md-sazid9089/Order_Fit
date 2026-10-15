"""Separate durable worker entry point. P2+ register actual capability handlers."""

import argparse
import os
import threading
import time
from uuid import uuid4

from sqlalchemy import text

from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.workflow import ErrorDetail, FailedResult, SafeError
from orderfit.store.db import Database
from orderfit.store.documents import PrivateDocuments
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


def run_once(operations, worker, handlers):
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
        with operations.database.job(claim["id"], claim["lease_token"]) as (c, _):
            row = (
                c.execute(text("SELECT * FROM operation WHERE id=:id"), {"id": claim["id"]})
                .mappings()
                .one()
            )
            job = operation_dto(row)
        handler = handlers.get(job.kind)
        result = handler(job) if handler else failure("CAPABILITY_UNAVAILABLE")
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
    del documents
    database = Database(config.database_url.get_secret_value())
    database.validate_runtime(worker=True)
    operations = Operations(database)
    worker = str(uuid4())
    try:
        while True:
            worked = run_once(operations, worker, {})
            if args.once:
                break
            if not worked:
                time.sleep(1)
    finally:
        database.close()


if __name__ == "__main__":
    main()
