"""Password sessions and bounded provisioning; credentials never enter DTO responses/logs."""

import hashlib
import hmac
import json
import secrets
import time
from contextlib import contextmanager
from datetime import UTC, datetime
from threading import BoundedSemaphore

from argon2 import PasswordHasher, Type
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.configuration import PASSWORD_HASH_PARAMETERS
from orderfit.contracts.protocol import request_body_digest
from orderfit.contracts.resources import (
    InvitationAccept,
    ProfileWrite,
    SessionView,
    SignUp,
    StepUp,
    StepUpView,
)
from orderfit.services.pagination import CursorCodec, cursor_key
from orderfit.store.db import Scope, digest_token, set_context
from orderfit.store.repositories import IdentityRepository

PASSWORDS = PasswordHasher(type=Type.ID, **PASSWORD_HASH_PARAMETERS)
DUMMY_HASH = PASSWORDS.hash("synthetic-non-account-timing-padding")
PASSWORD_WORK = BoundedSemaphore(2)


@contextmanager
def password_capacity():
    """Bound Argon2 memory/CPU across accounts and sources, without an unbounded wait."""
    if not PASSWORD_WORK.acquire(blocking=False):
        raise ApplicationError(429, "AUTH_CAPACITY", "Too many verification requests. Try again shortly.")
    try:
        yield
    finally:
        PASSWORD_WORK.release()


def hash_password(password):
    with password_capacity():
        return PASSWORDS.hash(password)


class IdentityService:
    def __init__(self, database, config):
        self.database, self.config = database, config
        self.secret = config.session_secret.get_secret_value().encode()
        self.request_key = hmac.digest(self.secret, b"orderfit:idempotency-body:v1", "sha256")
        self.cursors = CursorCodec(cursor_key(self.secret))

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

    def rate_limit(self, email, source, purpose, *, session_id=None, message="Try signing in later."):
        """Consume one attempt from each throttle key before the password is verified.

        Keys: the account (strict ``auth_account_limit``), the step-up session (same strict
        limit) and the source address (``auth_source_limit``, a coarse ceiling: behind a shared
        proxy every user has the same source, so a strict per-source limit would let one client
        lock everyone out). Counting before verification bounds concurrent guesses; callers
        refund the returned keys with :meth:`rate_release` only after a successful
        verification. When one key refuses, the keys already consumed for this attempt are
        refunded, because the attempt never reaches verification. A separate committed
        transaction keeps failed attempts counted when the caller's transaction rolls back.
        """
        dimensions = [("account:" + email.strip().lower(), self.config.auth_account_limit)]
        if session_id is not None:
            dimensions.append(("session:" + str(session_id), self.config.auth_account_limit))
        if source is not None:
            dimensions.append(("source:" + source, self.config.auth_source_limit))
        consumed = []
        with self.database.engine.begin() as c:
            for dimension, limit in dimensions:
                key = hmac.digest(self.secret, (purpose + ":" + dimension).encode(), "sha256")
                if not c.execute(
                    text("SELECT auth_rate_consume(:key,:limit)"), {"key": key, "limit": limit}
                ).scalar_one():
                    for earlier in consumed:
                        c.execute(text("SELECT auth_rate_release(:key)"), {"key": earlier})
                    break
                consumed.append(key)
            else:
                return consumed
        raise ApplicationError(429, "AUTH_RATE_LIMIT", message)

    def rate_release(self, keys):
        """Refund a verified attempt: only failed guesses count toward the throttles."""
        if not keys:
            return
        with self.database.engine.begin() as c:
            for key in keys:
                c.execute(text("SELECT auth_rate_release(:key)"), {"key": key})

    @staticmethod
    def verify(encoded, password):
        with password_capacity():
            try:
                return PASSWORDS.verify(encoded or DUMMY_HASH, password)
            except (VerificationError, InvalidHashError):
                return False

    def view_connection(self, c, scope, session, csrf):
        user, memberships = IdentityRepository.profile(c, scope)
        preferences = {"timezone": "UTC", "language": "en", "in_app_notifications": True} | user[
            "preferences"
        ]
        is_admin = bool(user.get("is_platform_admin", False))
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
            mfa_supported=bool(self.config.webauthn_rp_id),
            mfa_enabled=bool(user.get("passkey_required", False)),
            email_verified=False,
            is_platform_admin=is_admin,
        )

    def authenticate(self, data, key, current_token, csrf, source):
        signup = isinstance(data, SignUp)
        purpose = "signup" if signup else "signin"
        email = data.email.strip().lower()
        throttles = self.rate_limit(email, source, purpose)
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
        if not signup:
            with self.database.transaction() as c:
                required = c.execute(text("SELECT passkey_required(:email,:hash)"), {
                    "email": email, "hash": user["password_hash"]}).scalar_one()
            if required:
                self.rate_release(throttles)
                raise ApplicationError(409, "MFA_REQUIRED", "Verify your passkey to finish signing in.")
            # A verified sign-in is not a guess. Sign-ups stay counted: they create accounts.
            self.rate_release(throttles)
        hashed = (
            hash_password(data.password.get_secret_value()) if signup else user["password_hash"]
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
                ).scalar_one()
            token = secrets.token_urlsafe(32)
            new_csrf = self.csrf()
            # Replace this browser's old session atomically with the new one. Other
            # devices remain signed in; failed authentication never reaches revocation.
            if current_token:
                c.execute(text("SELECT session_revoke(:digest)"),
                          {"digest": digest_token(current_token)})
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
        throttles = self.rate_limit(email, source, "password")
        with self.database.engine.begin() as c:
            user = IdentityRepository.lookup(c, email)
        if not user or not self.verify(
            user["password_hash"], data.current_password.get_secret_value()
        ):
            raise ApplicationError(401, "INVALID_CREDENTIALS")
        self.rate_release(throttles)
        hashed = hash_password(data.new_password.get_secret_value())
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

    def update_profile(self, token, csrf, data: ProfileWrite) -> SessionView:
        """Self-only global profile; the RLS policy also restricts UPDATE to app.user_id."""
        # Lock order for one user: session row (session_resolve) then app_user. Since
        # 0013_runtime_hardening session_password() takes the same order (all sessions in id
        # order, then app_user), so a concurrent password change cannot deadlock with this.
        with self.database.identity(token) as (c, scope, row):
            current = c.execute(
                text("SELECT version FROM app_user WHERE id=:u FOR UPDATE"), {"u": scope.user_id}
            ).scalar_one()
            if current != data.expected_version:
                raise ApplicationError(409, "STALE_VERSION")
            c.execute(
                text("UPDATE app_user SET full_name=:n, preferences=CAST(:p AS jsonb) WHERE id=:u"),
                {
                    "n": data.profile.full_name,
                    "p": json.dumps(data.profile.preferences.model_dump(mode="json")),
                    "u": scope.user_id,
                },
            )
            c.execute(
                text("SELECT security_record(:digest,'PROFILE_UPDATED')"), {"digest": digest_token(token)}
            )
            return self.view_connection(c, scope, row, csrf)

    def accept_invitation(self, token, csrf, data: InvitationAccept) -> SessionView:
        """Signed-in, matching-email, single-use acceptance; every failure is one generic 404."""
        digest = hashlib.sha256(data.token.get_secret_value().encode("utf-8")).digest()
        with self.database.identity(token) as (c, scope, row):
            accepted = c.execute(
                text("SELECT business_id,role FROM invitation_accept(:d)"), {"d": digest}
            ).mappings().one_or_none()
            if accepted is None:
                raise ApplicationError(404, "INVITATION_UNAVAILABLE", "This invitation cannot be used.")
            return self.view_connection(c, scope, row, csrf)

    def step_up(self, token, data: StepUp) -> StepUpView:
        """Re-authenticate this session for one live, immutable action bundle."""
        # Password guessing is bounded per account and per session (not per address, so one
        # shared office address cannot lock other users out), counted before verification.
        with self.database.identity(token) as (c, scope, _):
            email = c.execute(
                text("SELECT email FROM app_user WHERE id=:u"), {"u": scope.user_id}
            ).scalar_one()
        throttles = self.rate_limit(email, None, "step_up", session_id=scope.session_id,
                                    message="Too many verification attempts. Try again later.")
        verified = False
        try:
            with self.database.tenant(token, data.business_id, "execute") as (c, scope):
                bundle = c.execute(
                    text("SELECT action,bundle_hash,expires_at FROM action_bundle "
                         "WHERE business_id=:b AND deal_id IS NOT NULL AND id=:id "
                         # Bundles are immutable (no UPDATE grant); a row lock is unnecessary
                         # and would require UPDATE privilege the runtime role lacks.
                         "AND expires_at>clock_timestamp()"),
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
                verified = True
                row = c.execute(
                    # One instant for created/expiry: separate clock reads could exceed the
                    # five-minute CHECK by microseconds.
                    text("INSERT INTO step_up_grant(business_id,user_id,session_id,bundle_id,purpose,bundle_hash,created_at,expires_at) "
                         "SELECT :b,:u,:s,:id,:p,:h,t.now,LEAST(t.now+interval '5 minutes',:expiry) "
                         "FROM (SELECT clock_timestamp() AS now) t "
                         "RETURNING id,expires_at"),
                    {"b": data.business_id, "u": scope.user_id, "s": scope.session_id,
                     "id": data.bundle_id, "p": data.purpose, "h": bytes.fromhex(data.bundle_hash),
                     "expiry": bundle["expires_at"]},
                ).mappings().one()
                return StepUpView(grant_id=row["id"], expires_at=row["expires_at"], bundle_hash=data.bundle_hash)
        finally:
            if verified:  # refunded after the transaction ends; a correct password is not a guess
                self.rate_release(throttles)
