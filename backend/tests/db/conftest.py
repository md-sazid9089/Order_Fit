"""Always creates a labeled disposable PG17 container. Never consumes application URLs."""

import json
import os
import secrets
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path
from unittest.mock import patch
from uuid import UUID, uuid4

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from psycopg import sql
from sqlalchemy import URL

from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.resources import SignUp
from orderfit.services.identity import IdentityService
from orderfit.store.db import SCHEMA_REVISION, Database
from orderfit.store.provision import provision_login

BACKEND = Path(__file__).resolve().parents[2]


def docker(*args, input=None):
    result = subprocess.run(
        ["docker", *args],
        input=input.encode("utf-8") if input is not None else None,
        capture_output=True,
    )
    if result.returncode:
        raise RuntimeError(
            "Disposable Docker test command failed: "
            + result.stderr.decode("utf-8")[-1500:]
            + result.stdout.decode("utf-8")[-7000:]
        )
    return result.stdout.decode("utf-8").strip()


@pytest.fixture(scope="session")
def postgres():
    suffix = uuid4().hex[:12]
    name = "orderfit-p1-test-" + suffix
    dbname = "orderfit_p1_test_" + suffix
    password = secrets.token_hex(24)
    docker(
        "run",
        "-d",
        "--rm",
        "--name",
        name,
        "--label",
        "orderfit.disposable=true",
        "-e",
        "POSTGRES_USER=migrator",
        "-e",
        "POSTGRES_PASSWORD=" + password,
        "-e",
        "POSTGRES_DB=" + dbname,
        "-p",
        "127.0.0.1::5432",
        "postgres:17-bookworm",
    )
    runtime = worker = None
    try:
        labels = json.loads(docker("inspect", "--format", "{{json .Config.Labels}}", name))
        assert labels.get("orderfit.disposable") == "true" and name.startswith("orderfit-p1-test-")
        port = int(docker("port", name, "5432/tcp").rsplit(":", 1)[1])
        url = URL.create(
            "postgresql+psycopg",
            username="migrator",
            password=password,
            host="127.0.0.1",
            port=port,
            database=dbname,
        ).render_as_string(hide_password=False)
        conninfo = url.replace("postgresql+psycopg://", "postgresql://", 1)
        for _ in range(60):
            try:
                with psycopg.connect(conninfo, connect_timeout=1) as c:
                    assert c.execute("SELECT current_database()").fetchone()[0] == dbname
                break
            except psycopg.OperationalError:
                time.sleep(0.5)
        else:
            raise RuntimeError("Disposable PostgreSQL did not start")
        print("\nDisposable PG17 target: " + name + " / " + dbname + " (loopback)")

        # Accept the application's declared schema, independently of unfinished
        # later-phase migration branches that may exist during development.
        def migrate(target=SCHEMA_REVISION, database_url=url):
            cfg = Config(str(BACKEND / "alembic.ini"))
            cfg.set_main_option("script_location", str(BACKEND / "migrations"))
            with patch.dict(os.environ, {"DATABASE_URL_DIRECT": database_url}):
                command.upgrade(cfg, target)

        def psql(script):
            return docker(
                "exec",
                "-i",
                name,
                "psql",
                "-X",
                "-v",
                "ON_ERROR_STOP=1",
                "-U",
                "migrator",
                "-d",
                dbname,
                input=script,
            )

        migrate("0001_core_schema")
        result = psql((BACKEND / "migrations/tests/test_schema.sql").read_text(encoding="utf-8"))
        assert "296 passed / 0 failed" in result
        print("Original 0001 SQL suite: 296/296 passed")
        # Original shell suite uses its own disposable rows; run in container's shell/client environment.
        original = docker(
            "exec",
            "-i",
            "-e",
            "PGUSER=migrator",
            "-e",
            "PGDATABASE=" + dbname,
            name,
            "bash",
            "-s",
            input=(BACKEND / "migrations/tests/test_concurrency.sh").read_text(encoding="utf-8"),
        )
        assert "CONCURRENCY TEST PASSED" in original
        print(original)
        with psycopg.connect(conninfo) as c:
            # Preserve legacy immutable results/options as well as the 400-row audit chain.
            c.execute(
                "INSERT INTO evaluation(business_id,deal_id,round,engine_version,input_hash,inputs,output,verdict,lowest_balance_minor) SELECT business_id,id,0,'legacy-test',sha256('legacy-test'),'{}','{}','no_feasible_plan',0 FROM deal"
            )
            c.execute(
                "INSERT INTO evaluation_option(business_id,evaluation_id,option_key,levers,cost_minor,lowest_balance_minor,meets_target) SELECT business_id,id,'legacy-test','{}',0,0,false FROM evaluation"
            )
            columns = {
                table: [
                    row[0]
                    for row in c.execute(
                        "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
                        (table,),
                    )
                ]
                for (table,) in c.execute(
                    "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename<>'alembic_version'"
                ).fetchall()
            }

            def historical_rows(c, table):
                return sorted(
                    map(
                        repr,
                        c.execute(
                            sql.SQL("SELECT {} FROM {}").format(
                                sql.SQL(",").join(map(sql.Identifier, columns[table])),
                                sql.Identifier(table),
                            )
                        ).fetchall(),
                    )
                )

            old = {table: historical_rows(c, table) for table in columns}
            assert old["deal"] and old["evaluation"] and old["operation_log"]
        migrate()
        # Run the original behavior assertions again on the forward schema.
        result = psql((BACKEND / "migrations/tests/test_schema.sql").read_text(encoding="utf-8"))
        assert "296 passed / 0 failed" in result
        print("Forward-schema SQL suite: 296/296 passed")
        with psycopg.connect(conninfo) as c:
            current = {table: historical_rows(c, table) for table in columns}
            assert current.pop("deal_transition") == sorted(
                old["deal_transition"] + [repr(("computing", "awaiting_confirm"))]
            )
            # 0016 adds exactly these reference roles and changes no others.
            assert current.pop("app_role") == sorted(
                old["app_role"]
                + [repr(("user", "T0", "Standard user")), repr(("admin", "T4", "Administrator"))]
            )
            assert current == {
                table: rows for table, rows in old.items() if table not in {"deal_transition", "app_role"}
            }
            runtime_pw, worker_pw = secrets.token_hex(24), secrets.token_hex(24)
            provision_login(c, "p1_runtime", runtime_pw)
            provision_login(c, "p1_worker", worker_pw, worker=True)
            # A second empty database exercises 0001+0002 in one clean upgrade.
        with psycopg.connect(conninfo, autocommit=True) as c:
            c.execute("CREATE DATABASE orderfit_p1_clean")
        clean_url = URL.create(
            "postgresql+psycopg",
            username="migrator",
            password=password,
            host="127.0.0.1",
            port=port,
            database="orderfit_p1_clean",
        ).render_as_string(hide_password=False)
        migrate(database_url=clean_url)
        # Original concurrent audit/optimistic-lock behavior also survives the forward schema.
        original = docker(
            "exec",
            "-i",
            "-e",
            "PGUSER=migrator",
            "-e",
            "PGDATABASE=" + dbname,
            name,
            "bash",
            "-s",
            input=(BACKEND / "migrations/tests/test_concurrency.sh").read_text(encoding="utf-8"),
        )
        assert "CONCURRENCY TEST PASSED" in original
        print("Forward-schema " + original)
        runtime_url = URL.create(
            "postgresql+psycopg",
            username="p1_runtime",
            password=runtime_pw,
            host="127.0.0.1",
            port=port,
            database=dbname,
        ).render_as_string(hide_password=False)
        worker_url = URL.create(
            "postgresql+psycopg",
            username="p1_worker",
            password=worker_pw,
            host="127.0.0.1",
            port=port,
            database=dbname,
        ).render_as_string(hide_password=False)
        runtime, worker = Database(runtime_url), Database(worker_url)
        runtime.validate_runtime()
        worker.validate_runtime(worker=True)
        yield {
            "database": runtime,
            "worker": worker,
            "url": runtime_url,
            "worker_url": worker_url,
            "migrator": conninfo,
            "migrator_url": url,
            "name": name,
            "psql": psql,
        }
    finally:
        for database in (runtime, worker):
            if database is not None:
                database.close()
        # Verify exact container identity/marker again; never clean a computed shared target.
        labels = json.loads(docker("inspect", "--format", "{{json .Config.Labels}}", name))
        if labels.get("orderfit.disposable") == "true" and name.startswith("orderfit-p1-test-"):
            docker("rm", "-f", name)


@pytest.fixture
def config(postgres, tmp_path):
    return RuntimeConfiguration(
        database_url=postgres["url"],
        session_secret="s" * 48,
        account_fingerprint_key="f" * 48,
        account_fingerprint_key_version=1,
        document_dir=str(tmp_path / "documents"),
        allowed_origins=["http://localhost:3000"],
        cookie_secure=False,
        llm_mode="off",
    )


@pytest.fixture(autouse=True)
def owned_queue(postgres):
    """Each serial test owns only operations it creates; preserve all queue history.

    This fixture's labeled, loopback-only DB is verified by ``postgres``. Cleanup
    runs even on assertion failure. Do not globally claim/drain other tests' jobs.
    Parallel pytest workers must use separate postgres fixtures (the default).
    """
    with psycopg.connect(postgres["migrator"]) as c:
        before = {r[0] for r in c.execute("SELECT id FROM operation")}
        presence_before = [r[0] for r in c.execute("SELECT id FROM worker_presence")]
    try:
        yield
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("DELETE FROM worker_presence WHERE NOT (id=ANY(%s::uuid[]))", (presence_before,))
            owned = [r[0] for r in c.execute("SELECT id FROM operation") if r[0] not in before]
            if owned:
                c.execute("UPDATE operation SET status='cancelled',lease_token=NULL,lease_expires_at=NULL "
                          "WHERE id=ANY(%s) AND status IN ('queued','running')", (owned,))


@dataclass
class Account:
    token: str
    csrf: str
    user_id: UUID
    business_id: UUID


@pytest.fixture
def accounts(postgres, config):
    service = IdentityService(postgres["database"], config)
    result = []
    for _ in range(2):
        view, token, csrf = service.authenticate(
            SignUp(
                email=f"{uuid4().hex}@example.test",
                password="Synthetic password 123!",
                full_name="Synthetic owner",
                business_name="Synthetic business",
                currency="BDT",
                timezone="Asia/Dhaka",
            ),
            str(uuid4()),
            None,
            service.csrf(),
            str(uuid4()),
        )
        result.append(Account(token, csrf, view.user_id, view.memberships[0].business_id))
    return result
