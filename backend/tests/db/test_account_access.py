"""Restricted-role, disposable-only account-access integration evidence."""

import re
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import psycopg
import pytest
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.contracts.account_access import (
    InvitationRegister,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenConfirm,
    VerificationRequest,
)
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.contracts.primitives import RevisionReason
from orderfit.contracts.resources import InvitationAccept, InvitationCreate, SignIn
from orderfit.services.account_access import AccountAccess
from orderfit.services.identity import IdentityService
from orderfit.services.mail_crypto import MailCipher
from orderfit.services.membership import (
    invite,
    list_invitations,
    reissue_invitation,
    revoke_invitation,
)
from orderfit.store import account_access_repository as repo
from orderfit.workflow.account_mail import run_mail_once
from tests.db import test_p6_approval
from tests.test_account_access import mail_config

case = test_p6_approval.case

PASSWORD = "Synthetic password 123!"
NEW_PASSWORD = "Updated synthetic password 456!"


@pytest.fixture
def access(postgres, config):
    enabled = RuntimeConfiguration.model_validate(
        config.model_dump()
        | {
            name: value
            for name, value in mail_config().model_dump().items()
            if name.startswith(
                (
                    "account_email",
                    "public_app",
                    "email_verification",
                    "password_recovery",
                    "invitation_email",
                )
            )
        }
    )
    return AccountAccess(IdentityService(postgres["database"], enabled))


def email_for(access, account):
    return access.identity.view(account.token, account.csrf).email


def token_from(postgres, access, user_id, purpose):
    with psycopg.connect(postgres["migrator"], row_factory=psycopg.rows.dict_row) as c:
        row = c.execute(
            "SELECT * FROM account_mail_outbox WHERE user_id=%s AND kind=%s ORDER BY created_at DESC LIMIT 1",
            (user_id, purpose),
        ).fetchone()
    return re.search(
        r"#token=([^\s]+)", MailCipher(access.identity.config).decrypt(row)["text"]
    ).group(1)


def verify_email(postgres, access, account):
    access.request(
        "verify_email",
        VerificationRequest(current_password=PASSWORD),
        str(uuid4()),
        "verification",
        account.token,
    )
    token = token_from(postgres, access, account.user_id, "verify_email")
    access.confirm(
        "verify_email", TokenConfirm(token=token), str(uuid4()), "verification", account.token
    )
    return token


def request_reset(postgres, access, account):
    access.request(
        "reset_password",
        PasswordResetRequest(email=email_for(access, account)),
        str(uuid4()),
        "reset",
    )
    return token_from(postgres, access, account.user_id, "reset_password")


def test_verified_reset_atomic_replay_and_sessions(postgres, access, accounts):
    account = accounts[0]
    verify_email(postgres, access, account)
    assert access.identity.view(account.token, account.csrf).password_recovery_eligible
    email = email_for(access, account)
    token = request_reset(postgres, access, account)
    body = PasswordResetConfirm(token=token, new_password=NEW_PASSWORD)
    key = str(uuid4())
    first = access.confirm("reset_password", body, key, "reset")
    assert access.confirm("reset_password", body, key, "reset") == first
    with pytest.raises(ApplicationError) as exc:
        access.identity.view(account.token, account.csrf)
    assert exc.value.code == "INVALID_SESSION"
    with pytest.raises(ApplicationError) as exc:
        access.confirm("reset_password", body, str(uuid4()), "reset")
    assert exc.value.code == "RECOVERY_LINK_INVALID"
    with pytest.raises(ApplicationError) as exc:
        access.confirm(
            "reset_password",
            body.model_copy(
                update={"new_password": type(body.new_password)("Different password 789!")}
            ),
            key,
            "reset",
        )
    assert exc.value.code == "IDEMPOTENCY_CONFLICT"
    view, _, _ = access.identity.authenticate(
        SignIn(email=email, password=NEW_PASSWORD),
        str(uuid4()),
        None,
        access.identity.csrf(),
        "new-login",
    )
    assert view.user_id == account.user_id
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute(
                "SELECT count(*) FROM account_mail_outbox WHERE user_id=%s AND kind='password_changed'",
                (account.user_id,),
            ).fetchone()[0]
            == 1
        )
        assert (
            c.execute(
                "SELECT credential_generation FROM app_user WHERE id=%s", (account.user_id,)
            ).fetchone()[0]
            == 2
        )


def test_public_unknown_unverified_and_disabled_are_generic(postgres, access, accounts):
    for email in (email_for(access, accounts[0]), "missing-" + uuid4().hex + "@example.test"):
        ack = access.request(
            "reset_password", PasswordResetRequest(email=email), str(uuid4()), "generic"
        )
        assert ack.completed is True
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute(
                "SELECT count(*) FROM account_mail_outbox WHERE user_id=%s", (accounts[0].user_id,)
            ).fetchone()[0]
            == 0
        )


def test_verification_wrong_user_and_wrong_purpose(postgres, access, accounts):
    account = accounts[0]
    access.request(
        "verify_email",
        VerificationRequest(current_password=PASSWORD),
        str(uuid4()),
        "verify",
        account.token,
    )
    token = token_from(postgres, access, account.user_id, "verify_email")
    for purpose, body, session in [
        ("verify_email", TokenConfirm(token=token), accounts[1].token),
        ("reset_password", PasswordResetConfirm(token=token, new_password=NEW_PASSWORD), None),
    ]:
        with pytest.raises(ApplicationError):
            access.confirm(purpose, body, str(uuid4()), "wrong", session)
    assert not access.identity.view(account.token, account.csrf).email_verified


def test_concurrent_reset_exactly_one_wins(postgres, access, accounts):
    account = accounts[0]
    verify_email(postgres, access, account)
    body = PasswordResetConfirm(
        token=request_reset(postgres, access, account), new_password=NEW_PASSWORD
    )

    def reset(_):
        try:
            access.confirm("reset_password", body, str(uuid4()), str(uuid4()))
            return "ok"
        except ApplicationError as exc:
            return exc.code

    with ThreadPoolExecutor(2) as pool:
        results = list(pool.map(reset, range(2)))
    assert sorted(results) == ["RECOVERY_LINK_INVALID", "ok"]


def test_reset_keeps_passkey_requirement(postgres, access, accounts):
    account = accounts[0]
    verify_email(postgres, access, account)
    email = email_for(access, account)
    token = request_reset(postgres, access, account)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("UPDATE app_user SET passkey_required=true WHERE id=%s", (account.user_id,))
    access.confirm(
        "reset_password",
        PasswordResetConfirm(token=token, new_password=NEW_PASSWORD),
        str(uuid4()),
        "reset",
    )
    with pytest.raises(ApplicationError) as exc:
        access.identity.authenticate(
            SignIn(email=email, password=NEW_PASSWORD),
            str(uuid4()),
            None,
            access.identity.csrf(),
            "login",
        )
    assert exc.value.code == "MFA_REQUIRED"


def test_runtime_cannot_read_private_account_tables(postgres):
    for table in (
        "account_access_token",
        "account_mail_outbox",
        "account_mail_event",
        "account_mail_suppression",
    ):
        with postgres["database"].transaction() as c, pytest.raises(DBAPIError):
            from sqlalchemy import text

            c.execute(text("SELECT * FROM " + table))


def create_invitation(postgres, access, account, email):
    with postgres["database"].tenant(account.token, account.business_id, "manage_members") as (
        c,
        scope,
    ):
        from sqlalchemy import text

        revision = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": account.business_id}
        ).scalar_one()
        result = invite(
            c,
            scope,
            InvitationCreate(email=email, role="viewer", expected_financial_revision=revision),
            access.mail,
        )
    return result, revision


def test_invitation_list_register_accept_and_reissue(postgres, access, accounts):
    owner = accounts[0]
    email = "invite-" + uuid4().hex + "@example.test"
    invitation, revision = create_invitation(postgres, access, owner, email)
    assert invitation.invitation_url is None and invitation.delivery.status == "queued"
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (
        c,
        scope,
    ):
        page = list_invitations(c, scope, access.identity.cursors, None, 50)
        assert page.items[0].id == invitation.id
        replacement = reissue_invitation(
            c,
            scope,
            invitation.id,
            RevisionReason(
                expected_version=invitation.version,
                expected_financial_revision=revision,
                reason="Replace initial invite",
            ),
            access.mail,
        )
    assert replacement.id != invitation.id
    with psycopg.connect(postgres["migrator"], row_factory=psycopg.rows.dict_row) as c:
        row = c.execute(
            "SELECT * FROM account_mail_outbox WHERE invitation_id=%s", (replacement.id,)
        ).fetchone()
    token = re.search(
        r"#token=([^\s]+)", MailCipher(access.identity.config).decrypt(row)["text"]
    ).group(1)
    data = InvitationRegister(token=token, full_name="New invitee", password=PASSWORD)
    key = str(uuid4())
    assert access.register(data, key, "register") == access.register(data, key, "register")
    view, new_token, csrf = access.identity.authenticate(
        SignIn(email=email, password=PASSWORD),
        str(uuid4()),
        None,
        access.identity.csrf(),
        "invitee-login",
    )
    assert view.memberships == [] and not view.email_verified
    accepted = access.identity.accept_invitation(new_token, csrf, InvitationAccept(token=token))
    assert accepted.memberships[0].business_id == owner.business_id


def test_revoke_cancels_queued_delivery(postgres, access, accounts):
    owner = accounts[0]
    invitation, revision = create_invitation(
        postgres, access, owner, "cancel-" + uuid4().hex + "@example.test"
    )
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (
        c,
        scope,
    ):
        revoke_invitation(
            c,
            scope,
            invitation.id,
            RevisionReason(
                expected_version=invitation.version,
                expected_financial_revision=revision,
                reason="Cancel invite",
            ),
        )
        assert access.mail.delivery(c, owner.business_id, invitation.id).status == "cancelled"


def test_worker_acceptance_and_early_webhook(postgres, access, accounts):
    owner = accounts[0]
    invitation, _ = create_invitation(
        postgres, access, owner, "deliver-" + uuid4().hex + "@example.test"
    )
    with psycopg.connect(postgres["migrator"]) as c:
        # Isolate this claim from other tests' queue history, without deleting rows.
        c.execute(
            "UPDATE account_mail_outbox SET next_attempt_at=clock_timestamp()+interval '1 day' WHERE status='queued' AND invitation_id IS DISTINCT FROM %s",
            (invitation.id,),
        )
    worker_config = access.identity.config.model_copy(update={"account_email_worker_enabled": True})

    class Transport:
        def send(self, payload, provider_key):
            with postgres["database"].transaction() as c:
                from datetime import UTC, datetime

                repo.call(
                    c,
                    "event",
                    id=str(uuid4()),
                    provider="early-" + str(invitation.id),
                    type="email.delivered",
                    at=datetime.now(UTC),
                )
            return "accepted", "early-" + str(invitation.id), 1

    assert run_mail_once(postgres["worker"], worker_config, Transport())
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        delivery = access.mail.delivery(c, owner.business_id, invitation.id)
        assert delivery.status == "delivered" and delivery.delivered_at is not None


def test_reset_contended_session_is_retryable_and_never_partial(postgres, access, accounts):
    account = accounts[0]
    verify_email(postgres, access, account)
    body = PasswordResetConfirm(
        token=request_reset(postgres, access, account), new_password=NEW_PASSWORD
    )
    key = str(uuid4())
    with postgres["database"].identity(account.token):
        with pytest.raises(DBAPIError) as exc:
            access.confirm("reset_password", body, key, "contended")
        assert exc.value.orig.sqlstate == "55P03"
    assert access.identity.view(account.token, account.csrf).email_verified
    assert access.confirm("reset_password", body, key, "contended").completed


def test_authenticated_password_change_invalidates_reset_and_notifies(postgres, access, accounts):
    from orderfit.contracts.resources import PasswordChange

    account = accounts[0]
    verify_email(postgres, access, account)
    reset_token = request_reset(postgres, access, account)
    access.identity.change_password(
        account.token,
        PasswordChange(current_password=PASSWORD, new_password=NEW_PASSWORD),
        "change",
    )
    with pytest.raises(ApplicationError) as exc:
        access.confirm(
            "reset_password",
            PasswordResetConfirm(token=reset_token, new_password=PASSWORD),
            str(uuid4()),
            "old-token",
        )
    assert exc.value.code == "RECOVERY_LINK_INVALID"
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute(
                "SELECT count(*) FROM account_mail_outbox WHERE user_id=%s AND kind='password_changed'",
                (account.user_id,),
            ).fetchone()[0]
            == 1
        )


def test_old_password_issuer_cannot_publish_after_reset(postgres, access, accounts):
    from sqlalchemy import text

    from orderfit.store.repositories import IdentityRepository

    account = accounts[0]
    verify_email(postgres, access, account)
    email = email_for(access, account)
    with postgres["database"].transaction() as c:
        old_hash = IdentityRepository.lookup(c, email)["password_hash"]
    token = request_reset(postgres, access, account)
    access.confirm(
        "reset_password",
        PasswordResetConfirm(token=token, new_password=NEW_PASSWORD),
        str(uuid4()),
        "reset",
    )
    with postgres["database"].transaction() as c, pytest.raises(DBAPIError) as exc:
        c.execute(
            text("SELECT session_issue(:email,:hash,:token,:csrf)"),
            {"email": email, "hash": old_hash, "token": b"t" * 32, "csrf": b"c" * 32},
        )
    assert exc.value.orig.sqlstate == "42501"


def test_expiry_and_fresh_verification_gate(postgres, access, accounts):
    account = accounts[0]
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE auth_session SET created_at=clock_timestamp()-interval '10 minutes' WHERE user_id=%s",
            (account.user_id,),
        )
    with pytest.raises(DBAPIError) as exc:
        access.request(
            "verify_email",
            VerificationRequest(current_password=PASSWORD),
            str(uuid4()),
            "old-session",
            account.token,
        )
    assert exc.value.orig.sqlstate == "AC403"
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE auth_session SET created_at=clock_timestamp() WHERE user_id=%s",
            (account.user_id,),
        )
    verify_email(postgres, access, account)
    token = request_reset(postgres, access, account)
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE account_access_token SET created_at=clock_timestamp()-interval '32 minutes', expires_at=clock_timestamp()-interval '3 minutes' WHERE user_id=%s AND purpose='reset_password'",
            (account.user_id,),
        )
    with pytest.raises(ApplicationError) as exc:
        access.confirm(
            "reset_password",
            PasswordResetConfirm(token=token, new_password=NEW_PASSWORD),
            str(uuid4()),
            "expired",
        )
    assert exc.value.code == "RECOVERY_LINK_INVALID"


def test_worker_reclaim_fences_and_preserves_exact_mail(postgres, access, accounts):
    invitation, _ = create_invitation(
        postgres, access, accounts[0], "lease-" + uuid4().hex + "@example.test"
    )
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE account_mail_outbox SET next_attempt_at=clock_timestamp()+interval '1 day' WHERE status='queued' AND invitation_id IS DISTINCT FROM %s",
            (invitation.id,),
        )
    with postgres["worker"].transaction() as c:
        first = repo.call(c, "claim")
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE account_mail_outbox SET lease_expires_at=clock_timestamp()-interval '1 second' WHERE id=%s",
            (first["id"],),
        )
    with postgres["worker"].transaction() as c:
        second = repo.call(c, "claim")
        assert second["id"] == first["id"] and second["lease_token"] != first["lease_token"]
        assert bytes(second["ciphertext"]) == bytes(first["ciphertext"])
        assert second["provider_key"] == first["provider_key"]
        assert not repo.call(
            c,
            "publish",
            id=first["id"],
            fence=first["lease_token"],
            status="accepted",
            provider="old-fence",
            delay=1,
        )
        assert repo.call(
            c,
            "publish",
            id=second["id"],
            fence=second["lease_token"],
            status="retry",
            provider=None,
            delay=1,
        )
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE account_mail_outbox SET first_attempt_at=clock_timestamp()-interval '24 hours',next_attempt_at=clock_timestamp() WHERE id=%s",
            (first["id"],),
        )
    with postgres["worker"].transaction() as c:
        assert repo.call(c, "claim") is None
    with psycopg.connect(postgres["migrator"]) as c:
        assert c.execute(
            "SELECT status,ciphertext FROM account_mail_outbox WHERE id=%s", (first["id"],)
        ).fetchone() == ("unknown", None)


def test_http_contract_csrf_and_signed_webhooks(postgres, access, accounts):
    import base64
    import json
    from datetime import UTC, datetime, timedelta

    from fastapi.testclient import TestClient
    from svix.webhooks import Webhook

    from orderfit.api.main import create_app

    secret = "whsec_" + base64.b64encode(b"w" * 32).decode()
    config = RuntimeConfiguration.model_validate(
        access.identity.config.model_dump()
        | {"account_email_mode": "resend", "resend_webhook_secret": secret}
    )
    with TestClient(create_app(config, postgres["database"])) as client:
        assert client.get("/api/v1/auth/account-access").json()["password_recovery"] == "available"
        request = {"email": "unknown-" + uuid4().hex + "@example.test"}
        assert client.post("/api/v1/auth/password-reset/request", json=request).status_code == 422
        csrf = client.get("/api/v1/auth/csrf").json()["csrf_token"]
        result = client.post(
            "/api/v1/auth/password-reset/request",
            json=request,
            headers={
                "Origin": "http://localhost:3000",
                "X-CSRF-Token": csrf,
                "Idempotency-Key": str(uuid4()),
            },
        )
        assert result.status_code == 202 and set(result.json()) == {"request_id", "completed"}
        now = datetime.now(UTC)
        raw = json.dumps(
            {
                "type": "email.delivered",
                "created_at": now.isoformat(),
                "data": {"email_id": str(uuid4())},
            }
        )
        event_id = str(uuid4())
        headers = {
            "svix-id": event_id,
            "svix-timestamp": str(int(now.timestamp())),
            "svix-signature": Webhook(secret).sign(event_id, now, raw),
            "Content-Type": "application/json",
        }
        for _ in range(2):
            assert (
                client.post("/api/v1/webhooks/resend", content=raw, headers=headers).status_code
                == 200
            )
        assert (
            client.post("/api/v1/webhooks/resend", content=raw + " ", headers=headers).status_code
            == 400
        )
        old = now - timedelta(minutes=10)
        headers.update(
            {
                "svix-timestamp": str(int(old.timestamp())),
                "svix-signature": Webhook(secret).sign(event_id, old, raw),
            }
        )
        assert (
            client.post("/api/v1/webhooks/resend", content=raw, headers=headers).status_code == 400
        )
        assert (
            client.post("/api/v1/webhooks/resend", content=b"x" * (256 * 1024 + 1)).status_code
            == 413
        )
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute(
                "SELECT count(*) FROM account_mail_event WHERE event_id=%s", (event_id,)
            ).fetchone()[0]
            == 1
        )


def test_http_invitation_replay_pagination_and_cross_tenant(postgres, access, accounts):
    from fastapi.testclient import TestClient
    from sqlalchemy import text

    from orderfit.api.main import create_app

    owner, other = accounts
    with postgres["database"].tenant(owner.token, owner.business_id) as (c, _):
        revision = c.execute(
            text("SELECT financial_revision FROM business WHERE id=:b"), {"b": owner.business_id}
        ).scalar_one()
    with TestClient(create_app(access.identity.config, postgres["database"])) as client:
        client.cookies.set("orderfit_session", owner.token, domain="testserver.local", path="/")
        client.cookies.set("orderfit_csrf", owner.csrf, domain="testserver.local", path="/")
        headers = {
            "Origin": "http://localhost:3000",
            "X-CSRF-Token": owner.csrf,
            "Idempotency-Key": str(uuid4()),
        }
        path = f"/api/v1/businesses/{owner.business_id}/invitations"
        body = {
            "email": "http-invite-" + uuid4().hex + "@example.test",
            "role": "viewer",
            "expected_financial_revision": revision,
        }
        first = client.post(path, json=body, headers=headers)
        assert first.status_code == 201 and first.json()["invitation_url"] is None
        assert client.post(path, json=body, headers=headers).json() == first.json()
        invitation = first.json()
        reissue_body = {
            "expected_version": invitation["version"],
            "expected_financial_revision": revision,
            "reason": "Refresh link",
        }
        headers["Idempotency-Key"] = str(uuid4())
        reissue_path = path + f"/{invitation['id']}/reissue"
        second = client.post(reissue_path, json=reissue_body, headers=headers)
        assert second.status_code == 201 and second.json()["id"] != invitation["id"]
        assert client.post(reissue_path, json=reissue_body, headers=headers).json() == second.json()
        page = client.get(path, params={"limit": 1}).json()
        assert page["items"][0]["id"] == second.json()["id"] and page["next_cursor"]
        older = client.get(path, params={"limit": 1, "cursor": page["next_cursor"]}).json()
        assert older["items"][0]["id"] == invitation["id"]
        client.cookies.set("orderfit_session", other.token, domain="testserver.local", path="/")
        client.cookies.set("orderfit_csrf", other.csrf, domain="testserver.local", path="/")
        assert client.get(path).status_code == 404
    with psycopg.connect(postgres["migrator"]) as c:
        assert (
            c.execute(
                "SELECT count(*) FROM account_mail_outbox WHERE invitation_id IN (%s,%s)",
                (invitation["id"], second.json()["id"]),
            ).fetchone()[0]
            == 2
        )


def test_private_helper_owner_cannot_be_runtime_authority(postgres):
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute("GRANT orderfit_account_owner TO p1_runtime")
    try:
        with pytest.raises(RuntimeError):
            postgres["database"].validate_runtime()
    finally:
        with psycopg.connect(postgres["migrator"]) as c:
            c.execute("REVOKE orderfit_account_owner FROM p1_runtime")


def test_reset_fences_queued_execution_and_preserves_approval_history(
    case, postgres, access, accounts
):
    from tests.db.test_p6_execution import committable, drain, execute

    owner = accounts[0]
    verify_email(postgres, access, owner)
    bundle, approval = committable(case)
    operation = execute(case, bundle, approval)
    reset_token = request_reset(postgres, access, owner)
    access.confirm(
        "reset_password",
        PasswordResetConfirm(token=reset_token, new_password=NEW_PASSWORD),
        str(uuid4()),
        "reset-execution",
    )
    drain(postgres)
    with psycopg.connect(postgres["migrator"]) as c:
        status, result = c.execute(
            "SELECT status,result FROM operation WHERE id=%s", (operation["operation_id"],)
        ).fetchone()
        assert status == "failed" and result["error"]["code"] == "AUTHORIZATION_REVOKED"
        assert (
            c.execute(
                "SELECT count(*) FROM sandbox_effect WHERE business_id=%s", (owner.business_id,)
            ).fetchone()[0]
            == 0
        )
        assert c.execute(
            "SELECT g.consumed_at IS NOT NULL FROM approval a JOIN step_up_grant g ON g.id=a.step_up_grant_id WHERE a.id=%s",
            (approval["id"],),
        ).fetchone()[0]


def test_delivery_precedence_and_complaint_suppresses_reissue(postgres, access, accounts):
    from datetime import UTC, datetime, timedelta

    owner = accounts[0]
    invitation, revision = create_invitation(
        postgres, access, owner, "suppressed-" + uuid4().hex + "@example.test"
    )
    with psycopg.connect(postgres["migrator"]) as c:
        c.execute(
            "UPDATE account_mail_outbox SET next_attempt_at=clock_timestamp()+interval '1 day' WHERE status='queued' AND invitation_id IS DISTINCT FROM %s",
            (invitation.id,),
        )
    provider = str(uuid4())
    with postgres["worker"].transaction() as c:
        claim = repo.call(c, "claim")
        assert repo.call(
            c,
            "publish",
            id=claim["id"],
            fence=claim["lease_token"],
            status="accepted",
            provider=provider,
            delay=1,
        )
    now = datetime.now(UTC)
    with postgres["database"].transaction() as c:
        for kind in ("email.complained", "email.delivered", "email.bounced", "email.sent"):
            repo.call(
                c,
                "event",
                id=str(uuid4()),
                provider=provider,
                type=kind,
                at=now - timedelta(minutes=1),
            )
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (
        c,
        scope,
    ):
        assert access.mail.delivery(c, owner.business_id, invitation.id).status == "complained"
        replacement = reissue_invitation(
            c,
            scope,
            invitation.id,
            RevisionReason(
                expected_version=invitation.version,
                expected_financial_revision=revision,
                reason="Reissue after a complaint",
            ),
            access.mail,
        )
    with postgres["worker"].transaction() as c:
        assert repo.call(c, "claim") is None
    with postgres["database"].tenant(owner.token, owner.business_id, "manage_members") as (c, _):
        delivery = access.mail.delivery(c, owner.business_id, replacement.id)
        assert delivery.status == "failed" and delivery.failure_code == "DELIVERY_SUPPRESSED"
