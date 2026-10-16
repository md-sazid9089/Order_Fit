"""Phishing-resistant second factor; no private authenticator keys reach the server."""

import hmac
import json
import secrets
from uuid import UUID

from sqlalchemy import text
from webauthn import (
    generate_authentication_options,
    generate_registration_options,
    options_to_json,
    verify_authentication_response,
    verify_registration_response,
)
from webauthn.helpers import base64url_to_bytes
from webauthn.helpers.structs import (
    AuthenticatorSelectionCriteria,
    PublicKeyCredentialDescriptor,
    UserVerificationRequirement,
)

from orderfit.api.errors import ApplicationError
from orderfit.contracts.resources import PasskeyOptions
from orderfit.store.db import Scope, digest_token, set_context
from orderfit.store.repositories import IdentityRepository


class Passkeys:
    def __init__(self, identity):
        self.identity = identity
        self.db = identity.database
        self.config = identity.config
        if not self.config.webauthn_rp_id:
            raise ApplicationError(503, "MFA_NOT_CONFIGURED", "Passkey setup is unavailable.")

    def begin(self, purpose, data, token, csrf, source):
        if purpose == "enroll":
            with self.db.identity(token) as (c, scope, _):
                user, _ = IdentityRepository.profile(c, scope)
                email = user["email"]
        else:
            email = data.email
        throttles = self.identity.rate_limit(email, source, "passkey_begin")
        with self.db.transaction() as c:
            user = IdentityRepository.lookup(c, email)
        if (not self.identity.verify(user["password_hash"] if user else None,
                                     data.password.get_secret_value())
            or not user or user["status"] != "active" or user["mfa_enforced"]):
            raise ApplicationError(401, "INVALID_CREDENTIALS", "Verification failed.")
        challenge = secrets.token_bytes(32)
        with self.db.transaction() as c:
            result = c.execute(text("SELECT passkey_begin(:p,:email,:hash,:token,:csrf,:ch,:rp,:origin)"), {
                "p": purpose, "email": email, "hash": user["password_hash"],
                "token": digest_token(token), "csrf": digest_token(csrf), "ch": challenge,
                "rp": self.config.webauthn_rp_id, "origin": self.config.webauthn_origin,
            }).scalar_one()
        if not result:
            raise ApplicationError(403, "MFA_REAUTH_REQUIRED", "Sign in again before managing passkeys.")
        self.identity.rate_release(throttles)
        keys = [PublicKeyCredentialDescriptor(id=bytes.fromhex(k)) for k in result["credentials"]]
        common = dict(rp_id=self.config.webauthn_rp_id, challenge=challenge, timeout=60000)
        if purpose == "enroll":
            options = generate_registration_options(**common, rp_name="OrderFit",
                user_id=UUID(result["user_id"]).bytes, user_name=email,
                exclude_credentials=keys,
                authenticator_selection=AuthenticatorSelectionCriteria(
                    user_verification=UserVerificationRequirement.REQUIRED))
        else:
            options = generate_authentication_options(**common, allow_credentials=keys,
                user_verification=UserVerificationRequirement.REQUIRED)
        return PasskeyOptions(challenge_id=result["id"], public_key=json.loads(options_to_json(options)))

    def finish(self, purpose, data, token, csrf, source):
        # The consumed grant commits even when cryptographic validation fails.
        with self.db.transaction() as c:
            ch = c.execute(text("SELECT passkey_take(:id,:p,:token,:csrf)"), {
                "id": data.challenge_id, "p": purpose, "token": digest_token(token),
                "csrf": digest_token(csrf),
            }).scalar_one()
        if not ch:
            raise ApplicationError(403, "MFA_CHALLENGE_INVALID", "Start a new passkey verification.")
        throttles = self.identity.rate_limit(ch["user_id"], source, "passkey_assertion")
        credential = data.credential
        try:
            if ch["rp"] != self.config.webauthn_rp_id or ch["origin"] != self.config.webauthn_origin:
                raise ValueError
            args = dict(credential=credential, expected_challenge=bytes.fromhex(ch["challenge"]),
                        expected_rp_id=ch["rp"], expected_origin=ch["origin"], require_user_verification=True)
            if purpose == "enroll":
                verified = verify_registration_response(**args)
            else:
                key_id = base64url_to_bytes(credential["id"])
                key = next(k for k in ch["credentials"] if hmac.compare_digest(bytes.fromhex(k["id"]), key_id))
                handle = credential.get("response", {}).get("userHandle")
                if handle is not None and base64url_to_bytes(handle) != UUID(ch["user_id"]).bytes:
                    raise ValueError
                verified = verify_authentication_response(**args,
                    credential_public_key=bytes.fromhex(key["public_key"]),
                    credential_current_sign_count=key["sign_count"])
        except Exception as exc:  # library messages may contain authenticator input
            raise ApplicationError(403, "MFA_VERIFICATION_FAILED", "Passkey verification failed.") from exc
        with self.db.transaction() as c:
            if purpose == "enroll":
                accepted = c.execute(text("SELECT passkey_enrolled(:id,:token,:key,:pub,:count)"), {
                    "id": data.challenge_id, "token": digest_token(token),
                    "key": verified.credential_id, "pub": verified.credential_public_key,
                    "count": verified.sign_count,
                }).scalar_one()
                if not accepted:
                    raise ApplicationError(403, "MFA_CHALLENGE_INVALID")
                result = None
            else:
                new_token = secrets.token_urlsafe(32)
                new_csrf = self.identity.csrf()
                sid = c.execute(text("SELECT passkey_authenticated(:id,:key,:old,:new,:token,:csrf,:previous)"), {
                    "id": data.challenge_id, "key": verified.credential_id,
                    "old": key["sign_count"], "new": verified.new_sign_count,
                    "token": digest_token(new_token), "csrf": digest_token(new_csrf),
                    "previous": digest_token(token),
                }).scalar_one()
                if not sid:
                    raise ApplicationError(403, "MFA_CHALLENGE_INVALID")
                row = c.execute(text("SELECT * FROM session_resolve(:digest)"), {
                    "digest": digest_token(new_token)}).mappings().one()
                scope = Scope(row["user_id"], row["session_id"])
                new_csrf = self.identity.session_csrf(scope.session_id, row["expires_at"])
                c.execute(text("SELECT session_csrf(:digest,:csrf)"), {
                    "digest": digest_token(new_token), "csrf": digest_token(new_csrf)})
                set_context(c, user_id=scope.user_id, session_id=scope.session_id)
                result = self.identity.view_connection(c, scope, row, new_csrf), new_token, new_csrf
        self.identity.rate_release(throttles)
        return result
