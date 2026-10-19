"""Allowlisted account email templates and encrypted durable admission."""

import hashlib
import hmac
from html import escape
from uuid import uuid4

from orderfit.api.errors import ApplicationError
from orderfit.contracts.mail import MailDelivery
from orderfit.services.mail_crypto import MailCipher
from orderfit.store import account_access_repository as repo

TEMPLATES = {
    "verify_email": ("Verify your OrderFit email", "/auth/verify-email"),
    "reset_password": ("Reset your OrderFit password", "/auth/reset-password"),
    "invitation": ("You have an OrderFit invitation", "/auth/invitations/accept"),
    "password_changed": ("Your OrderFit password was changed", None),
}


class AccountMail:
    def __init__(self, config):
        self.config = config
        self.cipher = MailCipher(config)

    def enabled(self, feature):
        return self.config.account_email_mode != "off" and getattr(self.config, feature)

    def require(self, feature):
        if not self.enabled(feature):
            raise ApplicationError(
                503, "ACCOUNT_EMAIL_UNAVAILABLE", "Account email is unavailable."
            )

    def prepare(self, kind, email, token=None):
        title, path = TEMPLATES[kind]
        if path:
            link = f"{self.config.public_app_origin}{path}#token={token}"
            body = f"{title}. Open this link and confirm in OrderFit:\n{link}\nIf you did not request this, ignore this email."
            html = f'<p>{escape(title)}.</p><p><a href="{escape(link, quote=True)}">Continue in OrderFit</a></p><p>If you did not request this, ignore this email.</p>'
        else:
            body = "Your OrderFit password was changed. Existing sessions were signed out. If you did not make this change, use account recovery. Your passkey requirement remains unchanged."
            html = f"<p>{escape(body)}</p>"
        payload = {
            "from": self.config.account_email_from,
            "to": [email],
            "subject": title,
            "text": body,
            "html": html,
        }
        mail = self.cipher.encrypt(uuid4(), kind, payload)
        key = self.config.account_fingerprint_key.get_secret_value().encode()
        mail["recipient_key"] = hmac.digest(
            key, b"account-mail-recipient.v1:" + email.encode(), "sha256"
        ).hex()
        return mail

    def invite(self, c, scope, invitation, token):
        self.require("invitation_email_enabled")
        for dimension, limit in (
            (f"owner:{scope.user_id}", 20),
            (f"business:{scope.business_id}", 100),
            (f"recipient:{scope.business_id}:{invitation['email']}", 3),
        ):
            key = hmac.digest(
                self.config.session_secret.get_secret_value().encode(),
                ("invitation-mail:" + dimension).encode(),
                "sha256",
            )
            if not repo.call(c, "rate", key=key, limit=limit):
                raise ApplicationError(429, "AUTH_RATE_LIMIT", "Try inviting again later.")
        repo.call(
            c,
            "enqueue_invitation",
            business=scope.business_id,
            invitation=invitation["id"],
            mail=self.prepare("invitation", invitation["email"], token),
        )

    @staticmethod
    def delivery(c, business_id, invitation_id):
        row = repo.call(c, "delivery", business=business_id, invitation=invitation_id)
        return MailDelivery.model_validate(row) if row else MailDelivery.not_requested()


def token_digest(token):
    return hashlib.sha256(token.encode()).digest()
