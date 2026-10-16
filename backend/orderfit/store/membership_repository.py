"""Tenant membership, invitation and business-profile persistence (SQL matches 0012)."""

import json

from sqlalchemy import text


def members_page(c, business_id, after, limit):
    """Stable (created_at,user_id) order; ``after`` is a decoded cursor position."""
    return c.execute(
        text(
            "SELECT m.user_id,u.email,u.full_name,m.role,m.version,m.revoked_at,m.created_at "
            "FROM membership m JOIN app_user u ON u.id=m.user_id WHERE m.business_id=:b "
            "AND (CAST(:c AS timestamptz) IS NULL OR (m.created_at,m.user_id)>(CAST(:c AS timestamptz),CAST(:i AS uuid))) "
            "ORDER BY m.created_at,m.user_id LIMIT :n"
        ),
        {"b": business_id, "c": after[0] if after else None, "i": after[1] if after else None, "n": limit + 1},
    ).mappings().all()


def member(c, business_id, user_id, *, lock=False):
    return c.execute(
        text(
            "SELECT m.user_id,u.email,u.full_name,m.role,m.version,m.revoked_at FROM membership m "
            "JOIN app_user u ON u.id=m.user_id WHERE m.business_id=:b AND m.user_id=:u"
            + (" FOR UPDATE OF m" if lock else "")
        ),
        {"b": business_id, "u": user_id},
    ).mappings().one_or_none()


def other_active_owner(c, business_id, user_id):
    return c.execute(
        text(
            "SELECT EXISTS(SELECT FROM membership m JOIN app_user u ON u.id=m.user_id WHERE m.business_id=:b "
            "AND m.user_id<>:u AND m.role='owner' AND m.revoked_at IS NULL AND u.status='active')"
        ),
        {"b": business_id, "u": user_id},
    ).scalar_one()


def set_role(c, business_id, user_id, role):
    c.execute(
        text("UPDATE membership SET role=:r WHERE business_id=:b AND user_id=:u"),
        {"r": role, "b": business_id, "u": user_id},
    )


def revoke(c, business_id, user_id):
    c.execute(
        text("UPDATE membership SET revoked_at=clock_timestamp() WHERE business_id=:b AND user_id=:u"),
        {"b": business_id, "u": user_id},
    )


def member_by_email(c, business_id, email):
    return c.execute(
        text(
            "SELECT m.user_id,m.revoked_at FROM membership m JOIN app_user u ON u.id=m.user_id "
            "WHERE m.business_id=:b AND u.email=:e"
        ),
        {"b": business_id, "e": email},
    ).mappings().one_or_none()


def open_invitation(c, business_id, email):
    return c.execute(
        text(
            "SELECT id,expires_at<=clock_timestamp() AS expired FROM membership_invitation "
            "WHERE business_id=:b AND email=:e AND accepted_at IS NULL AND revoked_at IS NULL FOR UPDATE"
        ),
        {"b": business_id, "e": email},
    ).mappings().one_or_none()


INVITATION_COLUMNS = "id,email,role,expires_at,revoked_at,accepted_at,version"


def insert_invitation(c, business_id, email, role, digest, actor, lifetime_hours):
    return c.execute(
        text(
            "INSERT INTO membership_invitation(business_id,email,role,token_digest,invited_by,created_at,expires_at) "
            "SELECT :b,:e,:r,:d,:u,t.now,t.now+make_interval(hours=>:h) FROM (SELECT clock_timestamp() AS now) t "
            "RETURNING " + INVITATION_COLUMNS
        ),
        {"b": business_id, "e": email, "r": role, "d": digest, "u": actor, "h": lifetime_hours},
    ).mappings().one()


def invitation(c, business_id, invitation_id, *, lock=False):
    return c.execute(
        text(
            "SELECT " + INVITATION_COLUMNS + " FROM membership_invitation WHERE business_id=:b AND id=:id"
            + (" FOR UPDATE" if lock else "")
        ),
        {"b": business_id, "id": invitation_id},
    ).mappings().one_or_none()


def revoke_invitation(c, business_id, invitation_id, actor, reason):
    return c.execute(
        text(
            "UPDATE membership_invitation SET revoked_at=clock_timestamp(),revoked_by=:u,revoke_reason=:r "
            "WHERE business_id=:b AND id=:id RETURNING " + INVITATION_COLUMNS
        ),
        {"b": business_id, "id": invitation_id, "u": actor, "r": reason},
    ).mappings().one()


def business_row(c, business_id):
    return c.execute(
        text("SELECT version,financial_revision,profile FROM business WHERE id=:b FOR UPDATE"),
        {"b": business_id},
    ).mappings().one()


def update_business_profile(c, business_id, name, timezone, profile):
    c.execute(
        text("UPDATE business SET name=:n,timezone=:t,profile=CAST(:p AS jsonb) WHERE id=:b"),
        {"n": name, "t": timezone, "p": json.dumps(profile, sort_keys=True), "b": business_id},
    )
