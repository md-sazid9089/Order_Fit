"""Process liveness, independent of job leases and expensive work."""
import logging
import threading
from contextlib import contextmanager

INTERVAL_SECONDS = 10
EXPIRY_SECONDS = 60  # SQL contract; never supplied by API/client traffic
LOG = logging.getLogger("orderfit.worker")


@contextmanager
def worker_presence(database, worker_id, *, interval=INTERVAL_SECONDS):
    database.publish_presence(worker_id)  # Fail startup if authority/storage is unavailable.
    stopped = threading.Event()

    def pulse():
        while not stopped.wait(interval):
            try:
                database.publish_presence(worker_id)
            except Exception:  # noqa: BLE001 - expiry fails closed; retry next interval
                LOG.warning("worker_presence_unavailable")

    thread = threading.Thread(target=pulse, name="worker-presence", daemon=True)
    thread.start()
    try:
        yield
    finally:
        stopped.set()
        thread.join()  # channel has bounded pool/connect/statement waits; no late republish
        try:
            database.publish_presence(worker_id, False)
        except Exception:  # noqa: BLE001 - process death/shutdown uses the same expiry
            LOG.warning("worker_presence_shutdown_unavailable")
