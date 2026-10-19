"""P7 tenant membership, invitations and business profile (owner permission)."""

from uuid import UUID

from fastapi import APIRouter, Query, Request

from orderfit.api.commands import command, read
from orderfit.contracts.primitives import Page, RevisionReason
from orderfit.contracts.resources import (
    BusinessProfileWrite,
    BusinessView,
    InvitationCreate,
    InvitationView,
    Member,
    MembershipWrite,
)
from orderfit.services import membership

router = APIRouter(prefix="/api/v1/businesses/{business_id}", tags=["membership"])


@router.get("/members", response_model=Page[Member], operation_id="members")
def members(business_id: UUID, request: Request, cursor: str | None = Query(None, max_length=2048),
            limit: int = Query(50, ge=1, le=100)):
    return read(request, business_id, "manage_members",
                lambda c, s, svc: membership.list_members(c, s, svc.cursors, cursor, limit))


@router.patch("/members/{user_id}", response_model=Member, operation_id="member_role")
def member_role(business_id: UUID, user_id: UUID, data: MembershipWrite, request: Request):
    return command(request, business_id, data, "manage_members",
                   lambda c, s, _: membership.change_role(c, s, user_id, data))


@router.post("/members/{user_id}/revoke", response_model=Member, operation_id="member_revoke")
def member_revoke(business_id: UUID, user_id: UUID, data: RevisionReason, request: Request):
    return command(request, business_id, data, "manage_members",
                   lambda c, s, _: membership.revoke_member(c, s, user_id, data))


@router.post("/invitations", response_model=InvitationView, status_code=201, operation_id="invitation_create")
def invitation_create(business_id: UUID, data: InvitationCreate, request: Request):
    # The one-time link is never written to the replay cache (token hashed at rest only).
    return command(request, business_id, data, "manage_members",
                   lambda c, s, svc: membership.invite(c, s, data, svc.account_mail),
                   cache=lambda view: view.model_copy(update={"invitation_url": None}))


@router.get("/invitations", response_model=Page[InvitationView], operation_id="invitations")
def invitations(business_id: UUID, request: Request, cursor: str | None = Query(None, max_length=2048),
                limit: int = Query(50, ge=1, le=100)):
    return read(request, business_id, "manage_members",
                lambda c, s, svc: membership.list_invitations(c, s, svc.cursors, cursor, limit))


@router.post("/invitations/{invitation_id}/reissue", response_model=InvitationView, status_code=201, operation_id="invitation_reissue")
def invitation_reissue(business_id: UUID, invitation_id: UUID, data: RevisionReason, request: Request):
    return command(request, business_id, data, "manage_members",
                   lambda c, s, svc: membership.reissue_invitation(c, s, invitation_id, data, svc.account_mail))


@router.post("/invitations/{invitation_id}/revoke", response_model=InvitationView, operation_id="invitation_revoke")
def invitation_revoke(business_id: UUID, invitation_id: UUID, data: RevisionReason, request: Request):
    return command(request, business_id, data, "manage_members",
                   lambda c, s, _: membership.revoke_invitation(c, s, invitation_id, data))


@router.patch("/profile", response_model=BusinessView, operation_id="business_profile_update")
def business_profile_update(business_id: UUID, data: BusinessProfileWrite, request: Request):
    return command(request, business_id, data, "manage_members",
                   lambda c, s, _: membership.update_business_profile(c, s, data))
