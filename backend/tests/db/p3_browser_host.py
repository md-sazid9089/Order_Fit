"""Opt-in disposable P3 browser host; never reads configured application URLs.

Run from backend with locked dev dependencies. The labeled PG17 fixture owns
its database and cleanup. Create the specified stop file to shut down cleanly.
"""

import argparse
import secrets
import subprocess
import sys
import time
from pathlib import Path
from tempfile import TemporaryDirectory

from orderfit.contracts.configuration import RuntimeConfiguration
from tests.db.conftest import postgres
from tests.db.test_p3_process_recovery import running_api, runtime_environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--stop-file", type=Path, required=True)
    args = parser.parse_args()
    if args.stop_file.exists():
        parser.error("Choose an absent stop file")
    fixture = postgres.__wrapped__()
    database = next(fixture)
    try:
        with TemporaryDirectory(prefix="orderfit-p3-browser-") as documents:
            config = RuntimeConfiguration(
                database_url=database["url"], session_secret=secrets.token_hex(32),
                account_fingerprint_key=secrets.token_hex(32), account_fingerprint_key_version=1,
                document_dir=documents, allowed_origins=["http://localhost:3127"],
                cookie_secure=False, llm_mode="off")
            with running_api(runtime_environment(database, config), 8127):
                worker = subprocess.Popen([sys.executable, "-m", "orderfit.workflow.worker"],
                    env=runtime_environment(database, config, worker=True),
                    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                try:
                    print("P3_BROWSER_READY api=http://localhost:8127 web=http://localhost:3127", flush=True)
                    while not args.stop_file.exists():
                        if worker.poll() is not None:
                            raise RuntimeError("Disposable browser worker exited")
                        time.sleep(1)
                finally:
                    worker.terminate()
                    worker.wait(timeout=5)
    finally:
        fixture.close()


if __name__ == "__main__":
    main()
