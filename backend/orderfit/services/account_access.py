"""Verified email, generic reset admission and invitation-only registration."""

import hmac
import secrets
from uuid import uuid4

from orderfit.api.errors import ApplicationError
from orderfit.contracts.account_access import AccountAccessCapabilities
from orderfit.contracts.primitives import Acknowledgement
from orderfit.contracts.protocol import request_body_digest
from orderfit.services.account_mail import token_digest
from orderfit.services.identity import hash_password
from orderfit.services.password_policy import check_new_password
from orderfit.store import account_access_repository as repo
from orderfit.store.db import apply_timeouts, digest_token
from orderfit.store.repositories import IdentityRepository


class AccountAccess:
    def __init__(self, identity):
        self.identity = identity
        self.database = identity.database
        self.mail = identity.account_mail

    def capabilities(self):
        def state(flag):
            return "available" if self.mail.enabled(flag) else "disabled"

        return AccountAccessCapabilities(
            contract_version="account-access.v1",
            email_verification=state("email_verification_enabled"),
            password_recovery=state("password_recovery_enabled"),
            invitation_email=state("invitation_email_enabled"),
            invitation_registration=state("invitation_email_enabled"),
        )

    def rate(self, purpose, dimension, limit):
        key = hmac.digest(
            self.identity.secret, f"account-access:{purpose}:{dimension}".encode(), "sha256"
        )
        with self.database.transaction() as c:
            return repo.call(c, "rate", key=key, limit=limit)

    def source_limit(self, purpose, source):
        if not self.rate(
            purpose, "source:" + source, self.identity.config.account_email_source_limit
        ):
            raise ApplicationError(429, "AUTH_RATE_LIMIT", "Try again later.")

    def replay(self, c, route, subject, key, data):
        scope = hmac.digest(
            self.identity.request_key, f"account-access:{route}:{subject}".encode(), "sha256"
        )
        fingerprint = bytes.fromhex(request_body_digest(data, self.identity.request_key))
        cached = repo.call(c, "reserve", scope=scope, key=key, hash=fingerprint)
        return scope, fingerprint, Acknowledgement.model_validate(cached) if cached else None

    @staticmethod
    def finish(c, scope, key, fingerprint):
        ack = Acknowledgement(request_id=str(uuid4()), completed=True)
        repo.call(
            c,
            "complete",
            scope=scope,
            key=key,
            hash=fingerprint,
            result=ack.model_dump(mode="json"),
        )
        return ack

    def request(self, purpose, data, key, source, session=None):
        self.mail.require(
            "email_verification_enabled"
            if purpose == "verify_email"
            else "password_recovery_enabled"
        )
        self.source_limit(purpose, source)
        expected = None
        if purpose == "verify_email":
            with self.database.identity(session) as (c, scope, _):
                user, _ = IdentityRepository.profile(c, scope)
                email = user["email"]
            throttles = self.identity.rate_limit(email, source, "email_verification")
            with self.database.transaction() as c:
                auth = IdentityRepository.lookup(c, email)
            if not self.identity.verify(
                auth["password_hash"] if auth else None, data.current_password.get_secret_value()
            ):
                raise ApplicationError(401, "INVALID_CREDENTIALS")
            expected = auth["password_hash"]
            self.identity.rate_release(throttles)
        else:
            email = data.email.strip().lower()
        # Every address takes the same admission/crypto/query path. No provider call
        # or account-specific response. Suppression is committed with the same ACK.
        token = secrets.token_urlsafe(32)
        mail = self.mail.prepare(purpose, email, token)
        with self.database.transaction() as c:
            apply_timeouts(c)
            scope, fingerprint, cached = self.replay(c, purpose + ":request", email, key, data)
            if cached:
                return cached
            account = repo.call(c, "lookup", email=email)
            budget_key = hmac.digest(
                self.identity.secret, f"account-mail-budget:{purpose}:{email}".encode(), "sha256"
            )
            mail["budget_key"] = budget_key.hex()
            account = account or {"id": "00000000-0000-0000-0000-000000000000", "generation": 0}
            repo.call(
                c,
                "issue",
                user=account["id"],
                purpose=purpose,
                email=email,
                generation=account["generation"],
                id=uuid4(),
                digest=token_digest(token),
                session=digest_token(session),
                expected=expected,
                mail=mail,
            )
            return self.finish(c, scope, key, fingerprint)

    def confirm(self, purpose, data, key, source, session=None):
        self.mail.require(
            "email_verification_enabled"
            if purpose == "verify_email"
            else "password_recovery_enabled"
        )
        self.source_limit(purpose + ":confirm", source)
        digest = token_digest(data.token.get_secret_value())
        if not self.rate(purpose + ":confirm", digest.hex(), 15):
            raise ApplicationError(429, "AUTH_RATE_LIMIT", "Try again later.")
        if purpose == "reset_password":
            # The account email is not known until the token is redeemed, so only the
            # email-independent rules apply here.
            check_new_password(data.new_password.get_secret_value(), email="")
        hashed = (
            hash_password(data.new_password.get_secret_value())
            if purpose == "reset_password"
            else None
        )
        subject = digest.hex()
        if purpose == "verify_email":
            with self.database.identity(session) as (_, identity, _):
                subject += ":" + str(identity.user_id)
        with self.database.transaction() as c:
            apply_timeouts(c)
            scope, fingerprint, cached = self.replay(c, purpose + ":confirm", subject, key, data)
            if cached:
                return cached
            token = repo.call(c, "token", digest=digest, purpose=purpose)
            notice = (
                self.mail.prepare("password_changed", token["email"]) if token and hashed else None
            )
            if not repo.call(
                c,
                "confirm",
                digest=digest,
                purpose=purpose,
                session=digest_token(session),
                new=hashed,
                notice=notice,
            ):
                code = "RECOVERY_LINK_INVALID" if hashed else "VERIFICATION_LINK_INVALID"
                raise ApplicationError(400, code, "This link cannot be used. Request a new link.")
            return self.finish(c, scope, key, fingerprint)

    def register(self, data, key, source):
        self.mail.require("invitation_email_enabled")
        self.source_limit("invitation_register", source)
        digest = token_digest(data.token.get_secret_value())
        if not self.rate("invitation_register", digest.hex(), 15):
            raise ApplicationError(429, "AUTH_RATE_LIMIT", "Try again later.")
        check_new_password(data.password.get_secret_value(), email="")
        hashed = hash_password(data.password.get_secret_value())
        with self.database.transaction() as c:
            apply_timeouts(c)
            scope, fingerprint, cached = self.replay(
                c, "invitation_register", digest.hex(), key, data
            )
            if cached:
                return cached
            result = repo.call(c, "register", digest=digest, name=data.full_name, hash=hashed)
            if result != "created":
                raise ApplicationError(
                    409 if result == "exists" else 404,
                    "ACCOUNT_EXISTS" if result == "exists" else "INVITATION_UNAVAILABLE",
                )
            return self.finish(c, scope, key, fingerprint)
