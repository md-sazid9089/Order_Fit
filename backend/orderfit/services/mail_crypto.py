"""Versioned account-mail AEAD; keys never reside in PostgreSQL."""

import base64
import hashlib
import json
import secrets
from urllib.parse import urlsplit

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def validate_mail_configuration(config):
    enabled = any(
        (
            config.email_verification_enabled,
            config.password_recovery_enabled,
            config.invitation_email_enabled,
            config.account_email_worker_enabled,
        )
    )
    if config.password_recovery_enabled and not config.email_verification_enabled:
        raise ValueError("Password recovery requires email verification")
    if (
        config.account_email_mode == "recorded"
        and config.account_email_environment != "development"
    ):
        raise ValueError("Recorded account email is development-only")
    if not enabled:
        return
    if config.account_email_mode == "off":
        raise ValueError("Enabled account email requires a delivery mode")
    origin = urlsplit(config.public_app_origin or "")
    local = (
        config.account_email_environment == "development"
        and origin.scheme == "http"
        and origin.hostname in {"localhost", "127.0.0.1"}
    )
    if (
        not origin.netloc
        or origin.username
        or origin.password
        or origin.path
        or origin.query
        or origin.fragment
        or (origin.scheme != "https" and not local)
        or config.public_app_origin not in config.allowed_origins
    ):
        raise ValueError("Account email requires an exact trusted application origin")
    if (
        not config.account_email_from
        or any(c in config.account_email_from for c in "\r\n")
        or "@" not in config.account_email_from
    ):
        raise ValueError("A fixed account email sender is required")
    if config.account_email_active_key_id not in config.account_email_encryption_keys:
        raise ValueError("An active account email encryption key is required")
    for key in config.account_email_encryption_keys.values():
        if len(base64.b64decode(key.get_secret_value(), validate=True)) != 32:
            raise ValueError("Account email keys must encode 32 bytes")
    if config.account_email_mode == "resend":
        if not config.resend_webhook_secret:
            raise ValueError("A webhook secret is required")
        if config.account_email_worker_enabled and not config.resend_api_key:
            raise ValueError("Mail worker requires Resend send credentials")


class MailCipher:
    def __init__(self, config):
        self.key_id = config.account_email_active_key_id
        self.keys = config.account_email_encryption_keys

    @staticmethod
    def aad(mail_id, kind):
        return f"account-mail.v1:{mail_id}:{kind}:1".encode()

    def encrypt(self, mail_id, kind, payload):
        raw = json.dumps(
            payload, sort_keys=True, ensure_ascii=False, separators=(",", ":")
        ).encode()
        nonce = secrets.token_bytes(12)
        key = base64.b64decode(self.keys[self.key_id].get_secret_value(), validate=True)
        return {
            "id": str(mail_id),
            "key_id": self.key_id,
            "nonce": nonce.hex(),
            "ciphertext": AESGCM(key).encrypt(nonce, raw, self.aad(mail_id, kind)).hex(),
            "payload_hash": hashlib.sha256(raw).hexdigest(),
        }

    def decrypt(self, row):
        key = base64.b64decode(self.keys[row["key_id"]].get_secret_value(), validate=True)
        raw = AESGCM(key).decrypt(
            bytes(row["nonce"]), bytes(row["ciphertext"]), self.aad(row["id"], row["kind"])
        )
        if hashlib.sha256(raw).digest() != bytes(row["payload_hash"]):
            raise ValueError("Mail integrity failed")
        return json.loads(raw)
