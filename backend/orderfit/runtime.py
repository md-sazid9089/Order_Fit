"""Explicit local API/worker launcher; forwards only each process's settings."""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from dotenv import dotenv_values
from pydantic import ValidationError

from orderfit.contracts.configuration import RuntimeConfiguration

# Preserve OS execution essentials, never an inherited database/provider secret.
SYSTEM_VARIABLES = {
    "PATH",
    "SYSTEMROOT",
    "WINDIR",
    "COMSPEC",
    "PATHEXT",
    "TEMP",
    "TMP",
    "HOME",
    "USERPROFILE",
    "APPDATA",
    "LOCALAPPDATA",
    "LANG",
    "LC_ALL",
    "LC_CTYPE",
    "TZ",
}


def process_environment(values, inherited, *, worker=False):
    environment = {
        key: value for key, value in inherited.items() if key.upper() in SYSTEM_VARIABLES
    }
    for field in RuntimeConfiguration.model_fields:
        key = field.upper()
        if values.get(key) is not None:
            environment[key] = values[key]
    if worker:
        if not values.get("WORKER_DATABASE_URL"):
            raise ValueError("WORKER_DATABASE_URL is required for the worker")
        environment["DATABASE_URL"] = values["WORKER_DATABASE_URL"]
    else:
        environment.pop("RESEND_API_KEY", None)
        environment.pop("ACCOUNT_EMAIL_WORKER_ENABLED", None)
    if environment.get("LLM_PROVIDER") == "freellmpool":
        environment.pop("OPENAI_API_KEY", None)
    return environment


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("service", choices=("api", "worker"))
    parser.add_argument("--env-file", type=Path, default=Path(".env"))
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--once", action="store_true", help="Worker: poll once and exit")
    args = parser.parse_args()
    if not args.env_file.is_file():
        parser.error("The explicit environment file does not exist")
    if args.service == "api" and args.once:
        parser.error("--once applies only to the worker")
    try:
        values = dotenv_values(args.env_file, interpolate=False)
        environment = process_environment(values, os.environ, worker=args.service == "worker")
        config = {
            key.lower(): value
            for key, value in environment.items()
            if key.lower() in RuntimeConfiguration.model_fields
        }
        for name in ("allowed_origins", "trusted_proxy_ips", "account_email_encryption_keys"):
            if name in config:
                config[name] = json.loads(config[name])
        # The child validates again with its isolated environment. This prefix
        # prevents ordinary parent settings from filling omissions in this precheck.
        RuntimeConfiguration(_env_prefix="ORDERFIT_FILE_VALIDATION_", **config)
    except (ValueError, ValidationError):
        parser.error("Invalid runtime settings; compare the file with backend/.env.example")
    command = (
        [
            sys.executable,
            "-m",
            "orderfit.api.serve",
            "--host",
            args.host,
            "--port",
            str(args.port),
        ]
        if args.service == "api"
        else [sys.executable, "-m", "orderfit.workflow.worker"] + (["--once"] if args.once else [])
    )
    raise SystemExit(subprocess.call(command, env=environment))


if __name__ == "__main__":
    main()
