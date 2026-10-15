"""Password sessions and bounded provisioning; credentials never enter DTO responses/logs."""

import hashlib
import hmac
import json
import secrets
import time
from datetime import UTC, datetime

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.configuration import PASSWORD_HASH_PARAMETERS
from orderfit.contracts.protocol import request_body_digest
from orderfit.contracts.resources import SessionView, SignUp, StepUp, StepUpView
from orderfit.store.db import Scope, digest_token, set_context
from orderfit.store.repositories import IdentityRepository

PASSWORDS = PasswordHasher(type=Type.ID, **PASSWORD_HASH_PARAMETERS)
DUMMY_HASH = PASSWORDS.hash("synthetic-non-account-timing-padding")


class IdentityService:
    def __init__(self, database, config):
        self.database, self.config = database, config
        self.secret = config.session_secret.get_secret_value().encode()
        self.request_key = hmac.digest(self.secret, b"orderfit:idempotency-body:v1", "sha256")

    def csrf(self):
        payload = secrets.token_urlsafe(32) + "." + str(int(time.time()) + 1800)
        return payload + "." + hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()

    def session_csrf(self, session_id, expires_at):
        """Stable for one session; session revocation and idle expiry still apply."""
        nonce = hmac.new(self.secret, ("csrf-session:" + str(session_id)).encode(), hashlib.sha256).hexdigest()
        payload = nonce + "." + str(int(expires_at.timestamp()))
        return payload + "." + hmac.new(self.secret, payload.encode(), hashlib.sha256).hexdigest()

    def challenge(self, token, current_csrf):
        if token:
            try:
                with self.database.identity(token) as (c, scope, session):
                    csrf = self.session_csrf(scope.session_id, session["expires_at"])
                    if not hmac.compare_digest(bytes(session["csrf_digest"]), digest_token(csrf)):
                        c.execute(text("SELECT session_csrf(:digest,:csrf)"), {
                            "digest": digest_token(token), "csrf": digest_token(csrf)})
                    return csrf, datetime.fromtimestamp(int(session["expires_at"].timestamp()), UTC)
            except ApplicationError as exc:
                if exc.status != 401:
                    raise
        if current_csrf:
            try:
                self.validate_csrf(current_csrf, current_csrf, self.config.allowed_origins[0])
                return current_csrf, datetime.fromtimestamp(int(current_csrf.split(".")[1]), UTC)
            except ApplicationError:
                pass
        csrf = self.csrf()
        return csrf, datetime.fromtimestamp(int(csrf.split(".")[1]), UTC)

    def validate_csrf(self, cookie, header, origin):
        if (
            origin not in self.config.allowed_origins
            or not cookie
            or not header
            or not hmac.compare_digest(cookie, header)
        ):
            raise ApplicationError(403, "CSRF_REJECTED")
        try:
            nonce, expiry, signature = header.split(".")
            expected = hmac.new(
                self.secret, (nonce + "." + expiry).encode(), hashlib.sha256
            ).hexdigest()
            if (
                len(nonce) < 32
                or int(expiry) <= time.time()
                or not hmac.compare_digest(signature, expected)
            ):
                raise ValueError
        except (ValueError, TypeError) as exc:
            raise ApplicationError(403, "CSRF_REJECTED") from exc

    def rate_limit(self, email, source, purpose):
        # A separate committed transaction keeps failed login attempts counted.
        with self.database.engine.begin() as c:
            allowed = []
            for dimension in ("account:" + email.strip().lower(), "source:" + source):
                key = hmac.digest(self.secret, (purpose + ":" + dimension).encode(), "sha256")
                allowed.append(
                    c.execute(text("SELECT auth_rate_consume(:key)"), {"key": key}).scalar_one()
                )
        if not all(allowed):
            raise ApplicationError(429, "AUTH_RATE_LIMIT", "Try signing in later.")

    @staticmethod
    def verify(encoded, password):
        try:
            return PASSWORDS.verify(encoded or DUMMY_HASH, password)
        except (VerificationError, InvalidHashError):
            return False

    @staticmethod
    def view_connection(c, scope, session, csrf):
        user, memberships = IdentityRepository.profile(c, scope)
        preferences = {"timezone": "UTC", "language": "en", "in_app_notifications": True} | user[
            "preferences"
        ]
        return SessionView(
            user_id=user["id"],
            email=user["email"],
            profile={
                "full_name": user["full_name"],
                "preferences": {
                    k: preferences[k] for k in ("timezone", "language", "in_app_notifications")
                },
            },
            profile_version=user["version"],
            memberships=[dict(m) for m in memberships],
            csrf_token=csrf,
            expires_at=session["expires_at"],
            mfa_supported=False,
            email_verified=False,
        )

    def authenticate(self, data, key, current_token, csrf, source):
        signup = isinstance(data, SignUp)
        purpose = "signup" if signup else "signin"
        email = data.email.strip().lower()
        self.rate_limit(email, source, purpose)
        with self.database.engine.begin() as c:
            user = IdentityRepository.lookup(c, email)
        if not signup and (
            not self.verify(
                user["password_hash"] if user else None, data.password.get_secret_value()
            )
            or not user
            or user["status"] != "active"
            or user["mfa_enforced"]
        ):
            raise ApplicationError(401, "INVALID_CREDENTIALS", "Sign-in failed.")
        hashed = (
            PASSWORDS.hash(data.password.get_secret_value()) if signup else user["password_hash"]
        )
        scope_hash = hmac.digest(self.request_key, (purpose + ":" + email).encode(), "sha256")
        fingerprint = bytes.fromhex(request_body_digest(data, self.request_key))
        if not key or not key.strip() or len(key) > 200:
            raise ApplicationError(422, "INVALID_IDEMPOTENCY_KEY")
        with self.database.engine.begin() as c:
            cached = c.execute(
                text("SELECT auth_request_reserve(:scope,:key,:hash)"),
                {"scope": scope_hash, "key": key, "hash": fingerprint},
            ).scalar_one()
            if cached:
                row = (
                    c.execute(
                        text("SELECT * FROM session_resolve(:digest)"),
                        {"digest": digest_token(current_token)},
                    )
                    .mappings()
                    .one_or_none()
                )
                if row is None or str(row["session_id"]) != cached["session_id"]:
                    raise ApplicationError(
                        401, "AUTH_SESSION_RECOVERY_REQUIRED", "Sign in again with a fresh request."
                    )
                scope = Scope(row["user_id"], row["session_id"])
                set_context(c, user_id=scope.user_id, session_id=scope.session_id)
                return self.view_connection(c, scope, row, csrf), None, csrf
            if signup:
                c.execute(
                    text(
                        "SELECT owner_provision(:email,:name,:hash,:business,:currency,:timezone)"
                    ),
                    {
                        "email": email,
                        "name": data.full_name,
                        "hash": hashed,
                        "business": data.business_name,
                        "currency": data.currency,
                        "timezone": data.timezone,
                    },
                )
            token = secrets.token_urlsafe(32)
            new_csrf = self.csrf()
            c.execute(
                text("SELECT session_issue(:email,:hash,:token,:csrf)"),
                {
                    "email": email,
                    "hash": hashed,
                    "token": digest_token(token),
                    "csrf": digest_token(new_csrf),
                },
            )
            row = (
                c.execute(
                    text("SELECT * FROM session_resolve(:digest)"), {"digest": digest_token(token)}
                )
                .mappings()
                .one()
            )
            scope = Scope(row["user_id"], row["session_id"])
            new_csrf = self.session_csrf(scope.session_id, row["expires_at"])
            c.execute(text("SELECT session_csrf(:digest,:csrf)"), {
                "digest": digest_token(token), "csrf": digest_token(new_csrf)})
            set_context(c, user_id=scope.user_id, session_id=scope.session_id)
            view = self.view_connection(c, scope, row, new_csrf)
            c.execute(
                text("SELECT auth_request_complete(:scope,:key,:hash,CAST(:result AS jsonb))"),
                {
                    "scope": scope_hash,
                    "key": key,
                    "hash": fingerprint,
                    "result": json.dumps(
                        {"user_id": str(scope.user_id), "session_id": str(scope.session_id)}
                    ),
                },
            )
            c.execute(
                text("SELECT security_record(:digest,:code)"),
                {"digest": digest_token(token), "code": purpose.upper() + "_COMPLETED"},
            )
            return view, token, new_csrf

    def view(self, token, csrf):
        with self.database.identity(token) as (c, scope, row):
            if not csrf or not hmac.compare_digest(bytes(row["csrf_digest"]), digest_token(csrf)):
                raise ApplicationError(403, "CSRF_REJECTED")
            return self.view_connection(c, scope, row, csrf)

    def mutation_session(self, token, csrf):
        with self.database.identity(token) as (_, _, row):
            if not hmac.compare_digest(bytes(row["csrf_digest"]), digest_token(csrf)):
                raise ApplicationError(403, "CSRF_REJECTED")

    def signout(self, token):
        with self.database.engine.begin() as c:
            c.execute(text("SELECT session_revoke(:digest)"), {"digest": digest_token(token)})
            c.execute(
                text("SELECT security_record(:digest,'SIGNOUT_COMPLETED')"),
                {"digest": digest_token(token)},
            )

    def change_password(self, token, data, source):
        with self.database.identity(token) as (c, scope, _):
            email = c.execute(
                text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}
            ).scalar_one()
        self.rate_limit(email, source, "password")
        with self.database.engine.begin() as c:
            user = IdentityRepository.lookup(c, email)
        if not user or not self.verify(
            user["password_hash"], data.current_password.get_secret_value()
        ):
            raise ApplicationError(401, "INVALID_CREDENTIALS")
        hashed = PASSWORDS.hash(data.new_password.get_secret_value())
        with self.database.engine.begin() as c:
            if not c.execute(
                text("SELECT session_password(:digest,:expected,:new)"),
                {"digest": digest_token(token), "expected": user["password_hash"], "new": hashed},
            ).scalar_one():
                raise ApplicationError(409, "SESSION_CHANGED")
            c.execute(
                text("SELECT security_record(:digest,'PASSWORD_CHANGED')"),
                {"digest": digest_token(token)},
            )

    def step_up(self, token, data: StepUp) -> StepUpView:
        """Re-authenticate this session for one live, immutable action bundle."""
        with self.database.tenant(token, data.business_id, "execute") as (c, scope):
            bundle = c.execute(
                text("SELECT action,bundle_hash,expires_at FROM action_bundle "
                     "WHERE business_id=:b AND deal_id IS NOT NULL AND id=:id "
                     "AND expires_at>clock_timestamp() FOR SHARE"),
                {"b": data.business_id, "id": data.bundle_id},
            ).mappings().one_or_none()
            if bundle is None or bundle["action"] != data.purpose:
                raise ApplicationError(409, "BUNDLE_UNAVAILABLE")
            if not hmac.compare_digest(bytes(bundle["bundle_hash"]).hex(), data.bundle_hash):
                raise ApplicationError(409, "BUNDLE_HASH_MISMATCH")
            user = IdentityRepository.lookup(
                c, c.execute(text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}).scalar_one()
            )
            if user is None or user["status"] != "active" or user["mfa_enforced"]:
                raise ApplicationError(403, "STEP_UP_UNAVAILABLE")
            if not self.verify(user["password_hash"], data.password.get_secret_value()):
                raise ApplicationError(401, "INVALID_CREDENTIALS")
            row = c.execute(
                text("INSERT INTO step_up_grant(business_id,user_id,session_id,bundle_id,purpose,bundle_hash,expires_at) "
                     "VALUES(:b,:u,:s,:id,:p,:h,LEAST(clock_timestamp()+interval '5 minutes',:expiry)) "
                     "RETURNING id,expires_at"),
                {"b": data.business_id, "u": scope.user_id, "s": scope.session_id,
                 "id": data.bundle_id, "p": data.purpose, "h": bytes.fromhex(data.bundle_hash),
                 "expiry": bundle["expires_at"]},
            ).mappings().one()
            return StepUpView(grant_id=row["id"], expires_at=row["expires_at"], bundle_hash=data.bundle_hash)
