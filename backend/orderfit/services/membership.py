"""P7 tenant membership, invitations and business profile (owner-only, audited).

Authorization: the route opens ``tenant(..., "manage_members")``, which re-reads the actor's
current role on every request and holds the business row FOR UPDATE. Concurrent membership
commands therefore serialize on the business lock; the SQL last-owner trigger is the backstop.
"""

import hashlib
import secrets

from orderfit.api.errors import ApplicationError
from orderfit.contracts.mail import MailDelivery
from orderfit.contracts.primitives import Page, RevisionReason
from orderfit.contracts.resources import (
    BusinessProfileWrite,
    BusinessView,
    InvitationCreate,
    InvitationView,
    Member,
    MembershipWrite,
)
from orderfit.services.pagination import page_limit, split_page, timestamp_position
from orderfit.store import account_access_repository as access_repo
from orderfit.store import membership_repository as repo
from orderfit.store.repositories import BusinessRepository, append_audit

INVITATION_HOURS = 72
INVITATION_PATH = "/auth/invitations/accept#token="
LISTING = "members"


def _member(row) -> Member:
    return Member(
        user_id=row["user_id"],
        email=row["email"],
        full_name=row["full_name"],
        role=row["role"],
        version=row["version"],
        revoked_at=row["revoked_at"],
    )


def _financial_revision(c, scope, expected):
    row = repo.business_row(c, scope.business_id)
    if row["financial_revision"] != expected:
        raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
    return row


def list_members(c, scope, cursors, cursor, limit) -> Page[Member]:
    limit = page_limit(limit)
    after = cursors.decode(cursor, business_id=scope.business_id, user_id=scope.user_id, listing=LISTING)
    rows, more = split_page(repo.members_page(c, scope.business_id, after, limit), limit)
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = cursors.encode(
            business_id=scope.business_id,
            user_id=scope.user_id,
            listing=LISTING,
            position=[timestamp_position(last["created_at"]), last["user_id"]],
        )
    return Page[Member](items=[_member(r) for r in rows], next_cursor=next_cursor)


def _locked_member(c, scope, user_id, command):
    _financial_revision(c, scope, command.expected_financial_revision)
    row = repo.member(c, scope.business_id, user_id, lock=True)
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if row["revoked_at"] is not None:
        raise ApplicationError(409, "MEMBERSHIP_REVOKED")
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    return row


def change_role(c, scope, user_id, command: MembershipWrite) -> Member:
    row = _locked_member(c, scope, user_id, command)
    if row["role"] == command.role:
        return _member(row)
    if row["role"] == "owner" and not repo.other_active_owner(c, scope.business_id, user_id):
        raise ApplicationError(409, "LAST_OWNER", "Add another owner before changing this role.")
    repo.set_role(c, scope.business_id, user_id, command.role)
    append_audit(
        c, scope, "membership_role_changed",
        payload={"user_id": str(user_id), "from": row["role"], "to": command.role},
    )
    return _member(repo.member(c, scope.business_id, user_id))


def revoke_member(c, scope, user_id, command: RevisionReason) -> Member:
    row = _locked_member(c, scope, user_id, command)
    if row["role"] == "owner" and not repo.other_active_owner(c, scope.business_id, user_id):
        raise ApplicationError(409, "LAST_OWNER", "Add another owner before revoking this member.")
    repo.revoke(c, scope.business_id, user_id)
    append_audit(
        c, scope, "membership_revoked",
        payload={"user_id": str(user_id), "role": row["role"], "reason": command.reason},
    )
    return _member(repo.member(c, scope.business_id, user_id))


def _invitation_view(row, url=None) -> InvitationView:
    return InvitationView(
        id=row["id"], email=row["email"], role=row["role"], version=row["version"],
        expires_at=row["expires_at"], accepted_at=row["accepted_at"], revoked_at=row["revoked_at"],
        invitation_url=url,
        delivery=MailDelivery.not_requested(),
    )


def invite(c, scope, command: InvitationCreate, mail=None) -> InvitationView:
    """Returns the view with the one-time link.

    Only the SHA-256 digest of the 256-bit token is stored. The route caches a copy without
    the link for idempotent replay, so a lost response requires revoking and reissuing.
    """
    _financial_revision(c, scope, command.expected_financial_revision)
    email = command.email.strip().lower()
    existing = repo.member_by_email(c, scope.business_id, email)
    if existing is not None and existing["revoked_at"] is None:
        raise ApplicationError(409, "ALREADY_MEMBER")
    pending = repo.open_invitation(c, scope.business_id, email)
    if pending is not None:
        if not pending["expired"]:
            raise ApplicationError(409, "INVITATION_PENDING", "Revoke the open invitation first.")
        repo.revoke_invitation(c, scope.business_id, pending["id"], scope.user_id, "Expired; superseded by a new invitation.")
        access_repo.call(c, "cancel", business=scope.business_id, invitation=pending["id"])
    token = secrets.token_urlsafe(32)
    row = repo.insert_invitation(
        c, scope.business_id, email, command.role, hashlib.sha256(token.encode("utf-8")).digest(),
        scope.user_id, INVITATION_HOURS,
    )
    append_audit(
        c, scope, "invitation_created",
        payload={"invitation_id": str(row["id"]), "role": command.role},
    )
    if mail and mail.enabled("invitation_email_enabled"):
        mail.invite(c, scope, row, token)
        return _invitation_view(row).model_copy(update={"delivery": mail.delivery(c, scope.business_id, row["id"])})
    return _invitation_view(row, INVITATION_PATH + token)


def revoke_invitation(c, scope, invitation_id, command: RevisionReason) -> InvitationView:
    _financial_revision(c, scope, command.expected_financial_revision)
    row = repo.invitation(c, scope.business_id, invitation_id, lock=True)
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    if row["accepted_at"] is not None or row["revoked_at"] is not None:
        raise ApplicationError(409, "INVITATION_CLOSED")
    row = repo.revoke_invitation(c, scope.business_id, invitation_id, scope.user_id, command.reason)
    access_repo.call(c, "cancel", business=scope.business_id, invitation=invitation_id)
    append_audit(c, scope, "invitation_revoked", payload={"invitation_id": str(invitation_id), "reason": command.reason})
    delivery = access_repo.call(c, "delivery", business=scope.business_id, invitation=invitation_id)
    return _invitation_view(row).model_copy(update={"delivery": MailDelivery.model_validate(delivery) if delivery else MailDelivery.not_requested()})


def list_invitations(c, scope, cursors, cursor, limit):
    limit = page_limit(limit)
    after = cursors.decode(cursor, business_id=scope.business_id, user_id=scope.user_id, listing="invitations")
    rows, more = split_page(access_repo.invitations_page(c, scope.business_id, limit, after), limit)
    views = [_invitation_view(row).model_copy(update={"delivery": MailDelivery.model_validate(row["delivery"]) if row["delivery"] else MailDelivery.not_requested()}) for row in rows]
    next_cursor = None
    if more:
        last = rows[-1]
        next_cursor = cursors.encode(business_id=scope.business_id, user_id=scope.user_id, listing="invitations",
                                     position=[timestamp_position(last["created_at"]), str(last["id"])])
    return Page[InvitationView](items=views, next_cursor=next_cursor)


def reissue_invitation(c, scope, invitation_id, command, mail):
    mail.require("invitation_email_enabled")
    _financial_revision(c, scope, command.expected_financial_revision)
    row = repo.invitation(c, scope.business_id, invitation_id, lock=True)
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    if row["accepted_at"] is not None or row["revoked_at"] is not None:
        raise ApplicationError(409, "INVITATION_CLOSED")
    revoke_invitation(c, scope, invitation_id, command)
    result = invite(c, scope, InvitationCreate(email=row["email"], role=row["role"],
                    expected_financial_revision=command.expected_financial_revision), mail)
    append_audit(c, scope, "invitation_reissued", payload={"old_invitation_id": str(invitation_id), "invitation_id": str(result.id)})
    return result


PROFILE_KEYS = ("address", "phone", "trade_registration", "tax_id")


def update_business_profile(c, scope, command: BusinessProfileWrite) -> BusinessView:
    row = repo.business_row(c, scope.business_id)
    if row["version"] != command.expected_version:
        raise ApplicationError(409, "STALE_VERSION")
    if row["financial_revision"] != command.expected_financial_revision:
        raise ApplicationError(409, "STALE_FINANCIAL_REVISION")
    profile = command.profile
    # Allowlisted JSON only: no security/control flags can be stored through this path.
    stored = {k: getattr(profile, k) for k in PROFILE_KEYS if getattr(profile, k) is not None}
    repo.update_business_profile(c, scope.business_id, profile.name, profile.timezone, stored)
    append_audit(c, scope, "business_profile_updated", payload={"fields": sorted(["name", "timezone", *stored])})
    return BusinessRepository.get_profile(c, scope.business_id)
