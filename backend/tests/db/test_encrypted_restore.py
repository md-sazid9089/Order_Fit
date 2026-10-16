"""Synthetic joint PG17/document recovery through a real encrypted restic repository.

No application URLs or environment files. Both databases are freshly created in
the fixture's labeled disposable container. Nothing is restored over a live DB.
"""

import hashlib
import json
import os
import secrets
import shutil
import subprocess
import time
from datetime import UTC, datetime
from unittest.mock import patch
from uuid import uuid4

import psycopg
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from psycopg import sql
from pydantic import SecretStr
from sqlalchemy.engine import make_url

from orderfit.api.main import create_app
from orderfit.contracts.resources import SignIn
from orderfit.services.exports import verify_audit_export
from orderfit.services.identity import IdentityService
from orderfit.store.db import SCHEMA_REVISION, Database
from tests.db.conftest import accounts as account_fixture
from tests.db.test_p4_documents import Session, make_deal, upload

RESTIC = "restic/restic@sha256:136600b6ff6843d61d355f7f71f460a166429f35de6fd11b568fece3c9a4d510"


def process(args, *, input=None, success=True):
    result = subprocess.run(args, input=input, capture_output=True, timeout=180)
    if success and result.returncode:
        raise RuntimeError("Disposable recovery command failed; sensitive diagnostics withheld")
    return result


def test_encrypted_joint_restore_authz_integrity_and_corruption(postgres, config, tmp_path):
    labels = json.loads(process(["docker", "inspect", "--format", "{{json .Config.Labels}}", postgres["name"]]).stdout)
    assert labels.get("orderfit.disposable") == "true"
    assert postgres["name"].startswith("orderfit-p1-test-")
    names = ["orderfit_restore_" + uuid4().hex[:12] for _ in range(2)]
    source, target = names
    root = tmp_path / "recovery"
    cut = root / "cut"
    cut.mkdir(parents=True, mode=0o700)
    password = root / "repository-key"
    password.write_text(secrets.token_hex(32), encoding="ascii")
    os.chmod(password, 0o600)
    runtime = restored = None
    created = []
    try:
        with psycopg.connect(postgres["migrator"], autocommit=True) as c:
            assert c.execute("SELECT current_database()").fetchone()[0] == make_url(postgres["migrator_url"]).database
            for name in names:
                c.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
                created.append(name)
        owner = make_url(postgres["migrator_url"]).set(database=source).render_as_string(hide_password=False)
        migration = Config("alembic.ini")
        with patch.dict(os.environ, {"DATABASE_URL_DIRECT": owner}):
            command.upgrade(migration, SCHEMA_REVISION)
        source_url = make_url(postgres["url"]).set(database=source)
        runtime = Database(source_url)
        runtime.validate_runtime()
        source_config = config.model_copy(update={"database_url": SecretStr(source_url.render_as_string(hide_password=False)),
                                                  "document_dir": str(cut / "objects"),
                                                  "webauthn_rp_id": "localhost",
                                                  "webauthn_origin": "http://localhost:3000"})
        accounts = account_fixture.__wrapped__({"database": runtime}, source_config)
        inventory = []
        audit_heads = {}
        emails = {}
        # These isolated services have no worker/provider and are closed before the cut.
        for account in accounts:
            with TestClient(create_app(source_config, runtime)) as client:
                client.cookies.set("orderfit_session", account.token)
                client.cookies.set("orderfit_csrf", account.csrf)
                session = Session(client, account, f"/api/v1/businesses/{account.business_id}")
                deal = make_deal(session)
                content = ("Synthetic recovery document " + uuid4().hex).encode()
                document = upload(session, deal["id"], "recovery.txt", content, "text/plain", "other", "other").json()
                inventory.append((account, deal["id"], document["id"], hashlib.sha256(content).hexdigest()))
                audit = client.get(f"/api/v1/businesses/{account.business_id}/audit/export").json()
                assert verify_audit_export(audit)["ok"]
                audit_heads[account.user_id] = (audit["head_hash"], len(audit["rows"]))
                emails[account.user_id] = client.get("/api/v1/auth/me").json()["email"]
                pending = client.post("/api/v1/auth/passkeys/enroll/options", json={"password": "Synthetic password 123!"},
                                      headers=session.headers | {"Idempotency-Key": str(uuid4())})
                assert pending.status_code == 200
        cut_at = datetime.now(UTC).isoformat()
        dump = process(["docker", "exec", postgres["name"], "pg_dump", "-U", "migrator", "-d", source, "-Fc"]).stdout
        assert dump.startswith(b"PGDMP")
        (cut / "database.dump").write_bytes(dump)
        os.chmod(cut / "database.dump", 0o600)
        manifest = {str(p.relative_to(cut)): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in cut.rglob("*") if p.is_file()}
        (cut / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        uid = str(os.getuid()) if hasattr(os, "getuid") else "10001"

        def restic(*args, success=True):
            return process(["docker", "run", "--rm", "--label", "orderfit.disposable=true",
                            "--network", "none", "--read-only", "--cap-drop", "ALL",
                            "--security-opt", "no-new-privileges", "--user", uid,
                            "--tmpfs", "/tmp:rw,nosuid,nodev,size=256m",
                            "-v", f"{root.resolve()}:/work", "-e", "HOME=/tmp",
                            "-e", "RESTIC_REPOSITORY=/work/repository",
                            "-e", "RESTIC_PASSWORD_FILE=/work/repository-key", RESTIC,
                            "--no-cache", *args], success=success)

        restic("init")
        restic("backup", "/work/cut", "--tag", "orderfit-synthetic-consistent-cut")
        restic("check", "--read-data")
        wrong = root / "wrong-key"
        wrong.write_text(secrets.token_hex(32), encoding="ascii")
        os.chmod(wrong, 0o600)
        assert restic("--password-file", "/work/wrong-key", "snapshots", success=False).returncode != 0
        restore_started = time.monotonic()
        restic("restore", "latest", "--target", "/work/restored")
        recovered = root / "restored" / "work" / "cut"
        assert recovered.is_dir()
        for name, digest in manifest.items():
            assert hashlib.sha256((recovered / name).read_bytes()).hexdigest() == digest
        process(["docker", "exec", "-i", postgres["name"], "pg_restore", "--exit-on-error", "--no-owner",
                 "-U", "migrator", "-d", target], input=(recovered / "database.dump").read_bytes())
        # A backup must not resurrect sessions or pending MFA assertions revoked
        # after its cut. Quarantine authentication before exposing restored data.
        target_owner = make_url(postgres["migrator_url"]).set(database=target).render_as_string(hide_password=False)
        with psycopg.connect(target_owner.replace("postgresql+psycopg://", "postgresql://", 1)) as c:
            assert c.execute("SELECT current_database()").fetchone()[0] == target
            assert c.execute("SELECT count(*) FROM auth_passkey_challenge").fetchone()[0] == 2
            c.execute("INSERT INTO security_event(user_id,code) SELECT DISTINCT user_id,'RESTORE_SESSION_REVOKED' FROM auth_session WHERE revoked_at IS NULL")
            c.execute("UPDATE auth_session SET revoked_at=clock_timestamp(),version=version+1 WHERE revoked_at IS NULL")
            c.execute("DELETE FROM auth_passkey_challenge")
            assert c.execute("SELECT count(*) FROM auth_passkey_challenge").fetchone()[0] == 0
        restored_url = make_url(postgres["url"]).set(database=target)
        restored = Database(restored_url)
        restored.validate_runtime()
        restored_config = config.model_copy(update={"database_url": SecretStr(restored_url.render_as_string(hide_password=False)),
                                                    "document_dir": str(recovered / "objects")})
        for index, (account, deal, document, digest) in enumerate(inventory):
            with TestClient(create_app(restored_config, restored)) as old_client:
                old_client.cookies.set("orderfit_session", account.token)
                old_client.cookies.set("orderfit_csrf", account.csrf)
                assert old_client.get("/api/v1/auth/me").status_code == 401
            identity = IdentityService(restored, restored_config)
            _, account.token, account.csrf = identity.authenticate(
                SignIn(email=emails[account.user_id], password="Synthetic password 123!"),
                str(uuid4()), None, identity.csrf(), "synthetic-restore")
            with TestClient(create_app(restored_config, restored)) as client:
                client.cookies.set("orderfit_session", account.token)
                client.cookies.set("orderfit_csrf", account.csrf)
                own = f"/api/v1/businesses/{account.business_id}/deals/{deal}/documents/{document}/download"
                result = client.get(own)
                assert result.status_code == 200
                assert hashlib.sha256(result.content).hexdigest() == digest
                audit = client.get(f"/api/v1/businesses/{account.business_id}/audit/export").json()
                assert verify_audit_export(audit)["ok"]
                assert (audit["head_hash"], len(audit["rows"])) == audit_heads[account.user_id]
                foreign = inventory[1 - index]
                assert client.get(f"/api/v1/businesses/{foreign[0].business_id}/deals/{foreign[1]}/documents/{foreign[2]}/download").status_code == 404
        restore_seconds = round(time.monotonic() - restore_started, 3)
        # Corrupt only a copy of this test's repository; the verified backup survives.
        corrupt = root / "corrupt"
        shutil.copytree(root / "repository", corrupt)
        pack = next(p for p in (corrupt / "data").rglob("*") if p.is_file())
        content = bytearray(pack.read_bytes())
        content[len(content) // 2] ^= 1
        assert pack.resolve().is_relative_to(corrupt.resolve())
        # Restic correctly makes packs read-only. Change only this disposable
        # copy's mode to simulate an attacker altering encrypted backup bytes.
        os.chmod(pack, 0o600)
        pack.write_bytes(content)
        assert restic("--repo", "/work/corrupt", "check", "--read-data", success=False).returncode != 0
        evidence = {"schema_revision": SCHEMA_REVISION, "cut_utc": cut_at,
                    "tenants": 2, "documents": 2, "audit_chains": 2,
                    "restore_seconds": restore_seconds, "old_sessions_rejected": True,
                    "fresh_login_tenant_isolation": True, "wrong_key_rejected": True,
                    "corruption_detected": True}
        (tmp_path / "encrypted-restore-evidence.json").write_text(json.dumps(evidence), encoding="utf-8")
    finally:
        for db in (runtime, restored):
            if db:
                db.close()
        # Both names were generated and created above, on the verified container only.
        with psycopg.connect(postgres["migrator"], autocommit=True) as c:
            for name in created:
                assert name.startswith("orderfit_restore_")
                c.execute(sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(sql.Identifier(name)))
