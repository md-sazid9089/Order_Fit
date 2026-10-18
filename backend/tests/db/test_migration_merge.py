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
    assert heads == [SCHEMA_REVISION] == ["0021_admin_reads"]


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
