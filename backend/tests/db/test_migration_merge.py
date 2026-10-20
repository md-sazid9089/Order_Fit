"""The two revisions after 0015 join at one head, from either partially-upgraded state."""

import os
from pathlib import Path
from unittest.mock import patch

import psycopg
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy.engine import make_url

from orderfit.store.db import SCHEMA_REVISION

BACKEND = Path(__file__).resolve().parents[2]


def _config():
    cfg = Config(str(BACKEND / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND / "migrations"))
    return cfg


def _fresh_database(postgres, name):
    with psycopg.connect(postgres["migrator"], autocommit=True) as c:
        c.execute(f"CREATE DATABASE {name}")
    url = make_url(postgres["migrator_url"]).set(database=name)
    return url.render_as_string(hide_password=False), url.set(drivername="postgresql").render_as_string(
        hide_password=False)


def _upgrade(url, target):
    with patch.dict(os.environ, {"DATABASE_URL_DIRECT": url}):
        command.upgrade(_config(), target)


def test_application_requires_the_sole_merge_head():
    heads = ScriptDirectory.from_config(_config()).get_heads()
    assert heads == [SCHEMA_REVISION] == ["0025_admin_read_isolation"]
    assert ScriptDirectory.from_config(_config()).get_revision(SCHEMA_REVISION).down_revision == "0024_admin_user_management"


def test_admin_forward_repair_preserves_rows_and_removes_shared_role_access(postgres):
    url, conninfo = _fresh_database(postgres, "orderfit_admin_forward_repair")
    _upgrade(url, "0023_account_access")
    with psycopg.connect(conninfo) as connection:
        user_id = connection.execute(
            "INSERT INTO app_user(email,full_name) VALUES('repair@example.test','Synthetic repair') RETURNING id"
        ).fetchone()[0]
        before = connection.execute("SELECT id,email,full_name,version FROM app_user ORDER BY id").fetchall()
    _upgrade(url, "0024_admin_user_management")
    with psycopg.connect(conninfo) as connection:
        assert connection.execute(
            "SELECT pg_has_role('orderfit_app','orderfit_admin_api','USAGE')"
        ).fetchone()[0]
        assert connection.execute(
            "SELECT has_any_column_privilege('orderfit_admin_reader','membership','SELECT')"
        ).fetchone()[0]
        connection.execute("GRANT orderfit_admin_api TO p1_worker")
    try:
        _upgrade(url, "head")
        with psycopg.connect(conninfo) as connection:
            assert connection.execute("SELECT id,email,full_name,version FROM app_user ORDER BY id").fetchall() == before
            assert connection.execute("SELECT id FROM app_user WHERE id=%s", (user_id,)).fetchone()
            assert connection.execute("SELECT version_num FROM alembic_version").fetchone()[0] == SCHEMA_REVISION
            assert not connection.execute(
                "SELECT has_any_column_privilege('orderfit_admin_reader','membership','SELECT')"
            ).fetchone()[0]
            assert connection.execute(
                "SELECT count(*) FROM pg_policies WHERE tablename='membership' AND policyname='admin_summary_read'"
            ).fetchone()[0] == 0
            for role in ("orderfit_app", "orderfit_worker", "orderfit_readonly", "p1_worker"):
                assert not connection.execute(
                    "SELECT pg_has_role(%s,'orderfit_admin_api','USAGE')", (role,)
                ).fetchone()[0]
                assert not connection.execute(
                    "SELECT has_function_privilege(%s,'admin_read_users(bytea,integer,uuid)','EXECUTE')", (role,)
                ).fetchone()[0]
    finally:
        with psycopg.connect(conninfo) as connection:
            connection.execute("REVOKE orderfit_admin_api FROM p1_worker,orderfit_app")


def test_merge_heads_database_upgrades_through_platform_authority_and_passkeys(postgres):
    """Production Neon sits at 0017_merge_heads; existing accounts survive the passkey line."""
    url, conninfo = _fresh_database(postgres, "orderfit_merge_neon_state")
    _upgrade(url, "0017_merge_heads")
    user_id = "6f1c2a1e-0000-4000-8000-00000000a017"
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT to_regclass('public.auth_passkey')").fetchone()[0] is None
        c.execute("INSERT INTO app_user (id, email, full_name, status, password_hash) "
                  "VALUES (%s, 'existing@example.test', 'Existing', 'active', 'hash')", (user_id,))
        roles_before = c.execute("SELECT code, tier, description FROM app_role ORDER BY code").fetchall()

    _upgrade(url, "head")
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT version_num FROM alembic_version").fetchall() == [(SCHEMA_REVISION,)]
        for table in ("worker_presence", "auth_passkey", "auth_passkey_challenge"):
            assert c.execute("SELECT to_regclass(%s)", (f"public.{table}",)).fetchone()[0] is not None
        assert c.execute("SELECT email, password_hash, passkey_required, is_platform_admin FROM app_user "
                         "WHERE id = %s", (user_id,)).fetchone() == (
            "existing@example.test", "hash", False, False)
        assert c.execute("SELECT code, tier, description FROM app_role ORDER BY code").fetchall() == roles_before


def test_role_branch_database_upgrades_through_worker_presence(postgres):
    """Neon reached 0016_add_user_admin_roles from the Ui-improve branch before worker presence."""
    url, conninfo = _fresh_database(postgres, "orderfit_merge_roles_first")
    _upgrade(url, "0016_add_user_admin_roles")
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT version_num FROM alembic_version").fetchall() == [("0016_add_user_admin_roles",)]
        assert c.execute("SELECT to_regclass('public.worker_presence')").fetchone()[0] is None
        roles_before = c.execute("SELECT code, tier, description FROM app_role ORDER BY code").fetchall()
    assert {"user", "admin"} <= {code for code, _, _ in roles_before}

    _upgrade(url, "head")
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT version_num FROM alembic_version").fetchall() == [(SCHEMA_REVISION,)]
        assert c.execute("SELECT to_regclass('public.worker_presence')").fetchone()[0] is not None
        assert c.execute("SELECT code, tier, description FROM app_role ORDER BY code").fetchall() == roles_before


def test_presence_branch_database_upgrades_through_role_rows(postgres):
    """A database already on main's 0016_worker_presence gains the role rows and the same head."""
    url, conninfo = _fresh_database(postgres, "orderfit_merge_presence_first")
    _upgrade(url, "0016_worker_presence")
    _upgrade(url, "head")
    with psycopg.connect(conninfo) as c:
        assert c.execute("SELECT version_num FROM alembic_version").fetchall() == [(SCHEMA_REVISION,)]
        codes = {r[0] for r in c.execute("SELECT code FROM app_role")}
    assert {"user", "admin"} <= codes
