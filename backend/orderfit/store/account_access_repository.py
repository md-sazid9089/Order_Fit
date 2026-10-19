"""Bound, narrow auth/mail SQL helpers; no runtime table-secret access."""

import json

from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError

STATEMENTS = {
    "lookup": "SELECT account_access_lookup(:email)",
    "token": "SELECT account_token_lookup(:digest,:purpose)",
    "reserve": "SELECT auth_request_reserve(:scope,:key,:hash)",
    "complete": "SELECT auth_request_complete(:scope,:key,:hash,CAST(:result AS jsonb))",
    "issue": "SELECT account_access_issue(:user,:purpose,:email,:generation,:id,:digest,:session,:expected,CAST(:mail AS jsonb))",
    "confirm": "SELECT account_access_confirm(:digest,:purpose,:session,:new,CAST(:notice AS jsonb))",
    "register": "SELECT account_invitation_register(:digest,:name,:hash)",
    "enqueue_invitation": "SELECT account_invitation_enqueue(:business,:invitation,CAST(:mail AS jsonb))",
    "delivery": "SELECT account_mail_delivery(:business,:invitation)",
    "cancel": "SELECT account_mail_cancel(:business,:invitation)",
    "rate": "SELECT auth_rate_consume(:key,:limit)",
    "claim": "SELECT * FROM account_mail_claim()",
    "valid": "SELECT account_mail_valid(:id,:fence)",
    "publish": "SELECT account_mail_publish(:id,:fence,:status,:provider,:delay)",
    "event": "SELECT account_mail_event_record(:id,:provider,:type,:at)",
}


def call(c, operation, **parameters):
    for key in ("mail", "notice", "result"):
        if key in parameters and parameters[key] is not None:
            parameters[key] = json.dumps(parameters[key])
    try:
        result = c.execute(text(STATEMENTS[operation]), parameters)
    except DBAPIError as exc:
        if operation == "reserve" and getattr(exc.orig, "sqlstate", "") == "OF003":
            raise ApplicationError(409, "IDEMPOTENCY_CONFLICT") from exc
        raise
    if operation == "claim":
        return result.mappings().one_or_none()
    return result.scalar_one_or_none()


def invitations_page(c, business_id, limit, after):
    return (
        c.execute(
            text(
                "SELECT id,email,role,version,expires_at,accepted_at,revoked_at,created_at, "
                "account_mail_delivery(:b,id) AS delivery "
                "FROM membership_invitation WHERE business_id=:b "
                "AND (CAST(:at AS timestamptz) IS NULL OR (created_at,id)<(CAST(:at AS timestamptz),CAST(:id AS uuid))) "
                "ORDER BY created_at DESC,id DESC LIMIT :limit"
            ),
            {
                "b": business_id,
                "limit": limit + 1,
                "at": after[0] if after else None,
                "id": after[1] if after else None,
            },
        )
        .mappings()
        .all()
    )
