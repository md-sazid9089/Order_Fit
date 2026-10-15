"""Bound persistence queries; services own transactions and permissions."""

import json

from sqlalchemy import select, text

from orderfit.api.errors import ApplicationError
from orderfit.store.tables import app_user


def append_audit(c, scope, action: str, *, deal_id=None, payload=None, outcome="completed"):
    return (
        c.execute(
            text(
                "INSERT INTO operation_log(business_id,deal_id,actor,actor_user_id,tier,action,outcome,payload) VALUES(:b,:d,'system',:u,:tier,:action,:outcome,CAST(:payload AS jsonb)) RETURNING id,seq,row_hash"
            ),
            {
                "b": scope.business_id,
                "d": deal_id,
                "u": scope.user_id,
                "tier": {
                    "owner": "T3",
                    "risk_officer": "T3",
                    "commercial_lead": "T2",
                    "viewer": "T0",
                    "auditor": "T0",
                }.get(scope.role),
                "action": action,
                "outcome": outcome,
                "payload": json.dumps(payload or {}),
            },
        )
        .mappings()
        .one()
    )


class IdempotencyRepository:
    @staticmethod
    def reserve(c, business_id, key, scope, request_hash):
        if not key or not key.strip() or len(key) > 200:
            raise ApplicationError(422, "INVALID_IDEMPOTENCY_KEY")
        c.execute(
            text(
                "DELETE FROM idempotency_key WHERE business_id=:b AND key=:k AND expires_at<=clock_timestamp()"
            ),
            {"b": business_id, "k": key},
        )
        inserted = c.execute(
            text(
                "INSERT INTO idempotency_key(business_id,key,scope,request_hash) VALUES(:b,:k,:scope,:hash) ON CONFLICT DO NOTHING RETURNING key"
            ),
            {"b": business_id, "k": key, "scope": scope, "hash": request_hash},
        ).scalar_one_or_none()
        row = (
            c.execute(
                text("SELECT * FROM idempotency_key WHERE business_id=:b AND key=:k FOR UPDATE"),
                {"b": business_id, "k": key},
            )
            .mappings()
            .one()
        )
        if bytes(row["request_hash"]) != request_hash or row["scope"] != scope:
            raise ApplicationError(409, "IDEMPOTENCY_CONFLICT")
        if inserted is None and row["status"] != "completed":
            raise ApplicationError(409, "OPERATION_IN_PROGRESS")
        return row["response"] if inserted is None else None

    @staticmethod
    def complete(c, business_id, key, response):
        c.execute(
            text(
                "UPDATE idempotency_key SET status='completed',response=CAST(:r AS jsonb) WHERE business_id=:b AND key=:k"
            ),
            {"r": json.dumps(response), "b": business_id, "k": key},
        )


class IdentityRepository:
    @staticmethod
    def lookup(c, email):
        return (
            c.execute(text("SELECT * FROM auth_lookup(:email)"), {"email": email})
            .mappings()
            .one_or_none()
        )

    @staticmethod
    def profile(c, scope):
        user = (
            c.execute(
                select(app_user).where(app_user.c.id == scope.user_id),
            )
            .mappings()
            .one()
        )
        memberships = (
            c.execute(
                text("SELECT business_id,business_name,role FROM user_businesses(:u)"),
                {"u": scope.user_id},
            )
            .mappings()
            .all()
        )
        return user, memberships
