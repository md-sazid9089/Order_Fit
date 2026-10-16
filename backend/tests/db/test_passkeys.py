"""Real signed WebAuthn ceremonies on restricted, disposable PostgreSQL logins."""

import base64
import hashlib
import json
import secrets
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import cbor2
import psycopg
import pytest
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi.testclient import TestClient

from orderfit.api.errors import ApplicationError
from orderfit.api.main import create_app
from orderfit.contracts.resources import PasskeyResponse
from orderfit.services.identity import hash_password
from orderfit.services.passkeys import Passkeys

PASSWORD = "Synthetic password 123!"
ORIGIN = "http://localhost:3000"


def b64(value):
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode()


class Authenticator:
    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.id = secrets.token_bytes(32)

    def credential(self, options, *, enroll=False, origin=ORIGIN, uv=True, rp="localhost"):
        client = json.dumps({"type": "webauthn.create" if enroll else "webauthn.get",
                             "challenge": options["public_key"]["challenge"],
                             "origin": origin, "crossOrigin": False}).encode()
        flags = (0x45 if enroll else 0x05) if uv else (0x41 if enroll else 0x01)
        auth = hashlib.sha256(rp.encode()).digest() + bytes([flags]) + (0 if enroll else 1).to_bytes(4)
        if enroll:
            pub = self.key.public_key().public_numbers()
            cose = cbor2.dumps({1: 2, 3: -7, -1: 1, -2: pub.x.to_bytes(32), -3: pub.y.to_bytes(32)})
            auth += bytes(16) + len(self.id).to_bytes(2) + self.id + cose
            response = {"clientDataJSON": b64(client), "attestationObject": b64(cbor2.dumps({
                "fmt": "none", "attStmt": {}, "authData": auth}))}
        else:
            response = {"clientDataJSON": b64(client), "authenticatorData": b64(auth),
                        "signature": b64(self.key.sign(auth + hashlib.sha256(client).digest(), ec.ECDSA(hashes.SHA256())))}
        return {"id": b64(self.id), "rawId": b64(self.id), "type": "public-key", "response": response}


def write(client, path, body):
    return client.post("/api/v1/auth/" + path, json=body, headers={
        "Origin": ORIGIN, "X-CSRF-Token": client.cookies.get("orderfit_csrf"),
        "Idempotency-Key": str(uuid4())})


@pytest.fixture
def enabled(postgres, config, accounts):
    config = config.model_copy(update={"webauthn_rp_id": "localhost", "webauthn_origin": ORIGIN})
    account = accounts[0]
    with psycopg.connect(postgres["migrator"]) as c:
        email = c.execute("SELECT email FROM app_user WHERE id=%s", (account.user_id,)).fetchone()[0]
    with TestClient(create_app(config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", account.token, domain="testserver.local", path="/")
        client.cookies.set("orderfit_csrf", account.csrf, domain="testserver.local", path="/")
        key = Authenticator()
        response = write(client, "passkeys/enroll/options", {"password": PASSWORD})
        assert response.status_code == 200, response.json()
        options = response.json()
        response = write(client, "passkeys/enroll/verify", {
            "challenge_id": options["challenge_id"], "credential": key.credential(options, enroll=True)})
        assert response.status_code == 200, response.json()
        assert not bool(client.cookies.get("orderfit_session"))
        assert client.get("/api/v1/auth/csrf").status_code == 200
        yield client, key, email, account, accounts[1]


def login_options(client, email):
    result = write(client, "passkeys/login/options", {"email": email, "password": PASSWORD})
    assert result.status_code == 200, result.json()
    return result.json()


def test_real_mfa_login_cookie_rotation_tenancy_and_replay(postgres, enabled):
    client, key, email, owner, other = enabled
    assert write(client, "signin", {"email": email, "password": PASSWORD}).json()["error"]["code"] == "MFA_REQUIRED"
    options = login_options(client, email)
    body = {"challenge_id": options["challenge_id"], "credential": key.credential(options)}
    response = write(client, "passkeys/login/verify", body)
    assert response.status_code == 200, response.json()
    assert response.json()["mfa_enabled"] is True
    assert "token" not in response.json()
    assert "HttpOnly" in response.headers["set-cookie"]
    assert client.get(f"/api/v1/businesses/{owner.business_id}/profile").status_code == 200
    assert client.get(f"/api/v1/businesses/{other.business_id}/profile").status_code == 404
    assert write(client, "passkeys/login/verify", body).status_code == 403
    with psycopg.connect(postgres["migrator"]) as c:
        assert c.execute("SELECT count(*) FROM auth_session WHERE user_id=%s AND revoked_at IS NULL", (owner.user_id,)).fetchone()[0] == 1
        assert c.execute("SELECT count(*) FROM security_event WHERE user_id=%s AND code='MFA_SIGNIN_COMPLETED'", (owner.user_id,)).fetchone()[0] == 1


@pytest.mark.parametrize("attack", ["origin", "uv", "rp", "signature", "expired", "csrf"])
def test_invalid_assertions_issue_no_session_and_cannot_replay(postgres, enabled, attack):
    client, key, email, owner, _ = enabled
    options = login_options(client, email)
    args = {"origin": "https://attacker.example"} if attack == "origin" else {"uv": False} if attack == "uv" else {"rp": "attacker.example"} if attack == "rp" else {}
    credential = key.credential(options, **args)
    if attack == "signature":
        credential["response"]["signature"] = b64(bytes(64))
    if attack == "expired":
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("UPDATE auth_passkey_challenge SET expires_at=clock_timestamp()-interval '1 second' WHERE id=%s", (options["challenge_id"],))
    if attack == "csrf":
        client.cookies.clear()
        client.get("/api/v1/auth/csrf")
    result = write(client, "passkeys/login/verify", {"challenge_id": options["challenge_id"], "credential": credential})
    assert result.status_code == 403
    assert not bool(client.cookies.get("orderfit_session"))
    if attack not in ("expired", "csrf"):
        valid = write(client, "passkeys/login/verify", {"challenge_id": options["challenge_id"], "credential": key.credential(options)})
        assert valid.status_code == 403
    with psycopg.connect(postgres["migrator"]) as c:
        assert c.execute("SELECT count(*) FROM auth_session WHERE user_id=%s AND revoked_at IS NULL", (owner.user_id,)).fetchone()[0] == 0


def test_password_only_database_issuer_and_private_table_reads_fail(postgres, enabled):
    _, _, email, owner, _ = enabled
    from sqlalchemy import text
    from sqlalchemy.exc import DBAPIError
    with psycopg.connect(postgres["migrator"]) as c:
        expected = c.execute("SELECT password_hash FROM app_user WHERE id=%s", (owner.user_id,)).fetchone()[0]
    with pytest.raises(DBAPIError):
        with postgres["database"].transaction() as c:
            c.execute(text("SELECT session_issue(:email,:hash,:token,:csrf)"), {
                "email": email, "hash": expected, "token": secrets.token_bytes(32), "csrf": secrets.token_bytes(32)})
    for table in ("auth_passkey", "auth_passkey_challenge"):
        with pytest.raises(DBAPIError):
            with postgres["database"].transaction() as c:
                c.execute(text("SELECT * FROM " + table))


def test_concurrent_assertion_completion_issues_exactly_one_session(postgres, enabled):
    client, key, email, owner, _ = enabled
    with pytest.raises(ApplicationError) as error:
        with postgres["database"].identity(owner.token):
            pass
    assert error.value.status == 401
    options = login_options(client, email)
    data = PasskeyResponse(challenge_id=options["challenge_id"], credential=key.credential(options))
    csrf = client.cookies.get("orderfit_csrf")
    service = Passkeys(client.app.state.identity)

    def finish():
        try:
            service.finish("login", data, None, csrf, "synthetic-concurrent")
            return "accepted"
        except ApplicationError as exc:
            assert exc.status == 403
            return "denied"

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(lambda _: finish(), range(2))) == ["accepted", "denied"]
    with psycopg.connect(postgres["migrator"]) as c:
        assert c.execute("SELECT count(*) FROM auth_session WHERE user_id=%s AND revoked_at IS NULL", (owner.user_id,)).fetchone()[0] == 1


def test_password_change_after_first_factor_rejects_completion(postgres, enabled):
    client, key, email, owner, _ = enabled
    options = login_options(client, email)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("UPDATE app_user SET password_hash=%s WHERE id=%s", (hash_password("Different synthetic password!"), owner.user_id))
    result = write(client, "passkeys/login/verify", {"challenge_id": options["challenge_id"], "credential": key.credential(options)})
    assert result.status_code == 403
    assert not bool(client.cookies.get("orderfit_session"))
