"""Provider-free account contract, encryption and bounded transport regressions."""

import asyncio
import base64
import json
from uuid import uuid4

import httpx
import pytest
from cryptography.exceptions import InvalidTag
from pydantic import SecretStr, ValidationError

from orderfit.contracts.account_access import InvitationRegister, PasswordResetConfirm
from orderfit.contracts.configuration import RuntimeConfiguration
from orderfit.services.account_mail import AccountMail
from orderfit.services.mail_crypto import MailCipher
from orderfit.services.resend import ResendTransport, retry_after


def mail_config(**changes):
    return RuntimeConfiguration(
        **(
            {
                "database_url": "postgresql+psycopg://unused@localhost/unused",
                "session_secret": "s" * 48,
                "account_fingerprint_key": "f" * 48,
                "account_fingerprint_key_version": 1,
                "document_dir": "unused",
                "allowed_origins": ["http://localhost:3000"],
                "public_app_origin": "http://localhost:3000",
                "account_email_mode": "recorded",
                "email_verification_enabled": True,
                "password_recovery_enabled": True,
                "invitation_email_enabled": True,
                "account_email_from": "OrderFit <accounts@example.test>",
                "account_email_active_key_id": "test-v1",
                "account_email_encryption_keys": {"test-v1": base64.b64encode(b"k" * 32).decode()},
            }
            | changes
        )
    )


def test_cipher_roundtrip_binds_identity_and_purpose():
    cipher = MailCipher(mail_config())
    mid = uuid4()
    encrypted = cipher.encrypt(mid, "reset_password", {"text": "synthetic secret"})
    row = encrypted | {"id": mid, "kind": "reset_password"}
    for key in ("ciphertext", "nonce", "payload_hash"):
        row[key] = bytes.fromhex(row[key])
    assert cipher.decrypt(row) == {"text": "synthetic secret"}
    for change in ({"id": uuid4()}, {"kind": "invitation"}, {"ciphertext": b"tampered"}):
        with pytest.raises(InvalidTag):
            cipher.decrypt(row | change)


def test_template_token_only_in_ciphertext_and_link_is_fixed():
    config = mail_config()
    mail = AccountMail(config).prepare("reset_password", "test@example.test", "synthetic-token")
    assert "synthetic-token" not in json.dumps(mail)
    row = mail | {"kind": "reset_password"}
    for key in ("ciphertext", "nonce", "payload_hash"):
        row[key] = bytes.fromhex(row[key])
    payload = MailCipher(config).decrypt(row)
    assert payload["to"] == ["test@example.test"]
    assert "http://localhost:3000/auth/reset-password#token=synthetic-token" in payload["text"]


@pytest.mark.parametrize(
    "change",
    [
        {"public_app_origin": "https://evil.test"},
        {"public_app_origin": "http://localhost:3000/path"},
        {"account_email_environment": "production"},
        {"email_verification_enabled": False},
        {"account_email_active_key_id": "missing"},
        {"account_email_encryption_keys": {"test-v1": "bad"}},
        {"account_email_from": "test@example.test\r\nBcc: evil@example.test"},
        {"account_email_mode": "off"},
    ],
)
def test_enabled_configuration_fails_closed(change):
    with pytest.raises((ValueError, ValidationError)):
        mail_config(**change)


def test_disabled_defaults_need_no_provider_secrets():
    config = mail_config(
        account_email_mode="off",
        email_verification_enabled=False,
        password_recovery_enabled=False,
        invitation_email_enabled=False,
        account_email_encryption_keys={},
    )
    assert not AccountMail(config).enabled("password_recovery_enabled")


@pytest.mark.parametrize(
    "model,data",
    [
        (
            PasswordResetConfirm,
            {
                "token": "x" * 43,
                "new_password": "valid password 123",
                "email": "other@example.test",
            },
        ),
        (
            InvitationRegister,
            {
                "token": "x" * 43,
                "password": "valid password 123",
                "full_name": "Invitee",
                "role": "owner",
            },
        ),
        (PasswordResetConfirm, {"token": "short", "new_password": "valid password 123"}),
    ],
)
def test_unknown_authority_and_invalid_tokens_rejected(model, data):
    with pytest.raises(ValidationError):
        model.model_validate(data)


@pytest.mark.parametrize(
    "status,body,expected",
    [
        (200, {"id": "provider-id"}, "accepted"),
        (200, {}, "retry"),
        (429, {}, "retry"),
        (503, {}, "retry"),
        (422, {}, "rejected"),
        (409, {"name": "concurrent_idempotent_requests"}, "retry"),
        (409, {"name": "invalid_idempotent_request"}, "rejected"),
    ],
)
def test_transport_keeps_provider_key_and_classifies_outcomes(status, body, expected):
    seen = []

    def respond(request):
        seen.append(request.headers["Idempotency-Key"])
        return httpx.Response(status, json=body, headers={"Retry-After": "120"})

    client = httpx.AsyncClient(transport=httpx.MockTransport(respond))
    try:
        config = mail_config().model_copy(update={"resend_api_key": SecretStr("synthetic-key")})
        adapter = ResendTransport(config, client)
        assert adapter.send({"to": ["synthetic@example.test"]}, "account-mail/fixed")[0] == expected
        adapter.send({"to": ["synthetic@example.test"]}, "account-mail/fixed")
    finally:
        asyncio.run(client.aclose())
    assert seen == ["account-mail/fixed", "account-mail/fixed"]


def test_retry_after_bounds():
    assert retry_after("120") == 120
    assert retry_after("invalid") == 60
    assert retry_after("9999999") == 82800


def test_shared_wire_examples_validate_against_backend_dtos():
    from pathlib import Path

    from orderfit.contracts.account_access import (
        AccountAccessCapabilities,
        PasswordResetRequest,
        TokenConfirm,
        VerificationRequest,
    )
    from orderfit.contracts.primitives import Acknowledgement, RevisionReason
    from orderfit.contracts.resources import InvitationCreate, InvitationView

    path = Path(__file__).resolve().parents[2] / "docs/contracts/account-access-examples.json"
    examples = json.loads(path.read_text(encoding="utf-8"))
    for key, model in {
        "password_reset_request": PasswordResetRequest,
        "request_acknowledgement": Acknowledgement,
        "verification_request": VerificationRequest,
        "token_confirm": TokenConfirm,
        "password_reset_confirm": PasswordResetConfirm,
        "invitation_register": InvitationRegister,
        "invitation_create": InvitationCreate,
        "invitation_reissue": RevisionReason,
        "invitation_response": InvitationView,
        "capabilities": AccountAccessCapabilities,
    }.items():
        model.model_validate(examples[key])
    with pytest.raises(ValidationError):
        PasswordResetConfirm.model_validate(examples["invalid_reset_confirm"])
    with pytest.raises(ValidationError):
        InvitationRegister.model_validate(examples["invalid_registration_authority"])


def test_launcher_keeps_send_authority_out_of_api():
    from orderfit.runtime import process_environment

    values = {
        "DATABASE_URL": "api",
        "WORKER_DATABASE_URL": "worker",
        "RESEND_API_KEY": "synthetic-send-key",
        "ACCOUNT_EMAIL_WORKER_ENABLED": "true",
        "ACCOUNT_EMAIL_ENCRYPTION_KEYS": "{}",
    }
    api = process_environment(values, {})
    worker = process_environment(values, {}, worker=True)
    assert "RESEND_API_KEY" not in api and "ACCOUNT_EMAIL_WORKER_ENABLED" not in api
    assert (
        worker["RESEND_API_KEY"] == "synthetic-send-key"
        and worker["ACCOUNT_EMAIL_WORKER_ENABLED"] == "true"
    )
    assert api["ACCOUNT_EMAIL_ENCRYPTION_KEYS"] == worker["ACCOUNT_EMAIL_ENCRYPTION_KEYS"]
