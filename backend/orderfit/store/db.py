"""Short synchronous SQLAlchemy transactions on psycopg 3. SQL owns DDL."""

import hashlib
from contextlib import contextmanager
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import create_engine, text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.protocol import PERMISSIONS

SCHEMA_REVISION = "0003_p3_results"


def digest_token(token: str | None) -> bytes:
    return hashlib.sha256((token or "").encode("utf-8")).digest()


@dataclass(frozen=True)
class Scope:
    user_id: UUID
    session_id: UUID
    business_id: UUID | None = None
    role: str | None = None


def set_context(connection, *, user_id, session_id, business_id=None):
    connection.execute(
        text(
            "SELECT set_config('app.user_id',:u,true),set_config('app.session_id',:s,true),set_config('app.business_id',:b,true)"
        ),
        {"u": str(user_id), "s": str(session_id), "b": str(business_id) if business_id else ""},
    )


class Database:
    def __init__(self, url: str, *, pool_size=5):
        self.engine = create_engine(
            url,
            pool_size=pool_size,
            max_overflow=0,
            pool_pre_ping=True,
            pool_reset_on_return="rollback",
            hide_parameters=True,
            connect_args={"prepare_threshold": None},
        )

    def validate_runtime(self, *, worker=False):
        with self.engine.connect() as c:
            r = (
                c.execute(
                    text(
                        "SELECT r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolcanlogin,pg_has_role(current_user,'orderfit_admin','MEMBER') AS admin,pg_has_role(current_user,'orderfit_app','USAGE') AS app,pg_has_role(current_user,'orderfit_worker','USAGE') AS worker FROM pg_roles r WHERE rolname=current_user"
                    )
                )
                .mappings()
                .one()
            )
            owns = c.execute(
                text(
                    "SELECT EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND pg_has_role(current_user,c.relowner,'USAGE'))"
                )
            ).scalar_one()
            if (
                r["rolsuper"]
                or r["rolbypassrls"]
                or r["rolcreaterole"]
                or r["rolcreatedb"]
                or r["rolreplication"]
                or not r["rolcanlogin"]
                or r["admin"]
                or owns
                or not r["app"]
                or (worker and not r["worker"])
                or (not worker and r["worker"])
            ):
                raise RuntimeError("A restricted non-owner runtime login is required")
            if (
                c.execute(text("SELECT version_num FROM alembic_version")).scalar_one()
                != SCHEMA_REVISION
            ):
                raise RuntimeError("Database schema is not current")

    @contextmanager
    def identity(self, token: str):
        with self.engine.begin() as c:
            row = (
                c.execute(
                    text("SELECT * FROM session_resolve(:digest)"), {"digest": digest_token(token)}
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise ApplicationError(401, "INVALID_SESSION", "Sign in to continue.")
            scope = Scope(row["user_id"], row["session_id"])
            set_context(c, user_id=scope.user_id, session_id=scope.session_id)
            yield c, scope, row

    @contextmanager
    def tenant(self, token: str, business_id: UUID, permission="read"):
        with self.identity(token) as (c, identity, _):
            set_context(
                c, user_id=identity.user_id, session_id=identity.session_id, business_id=business_id
            )
            lock = "FOR SHARE" if permission in {"read", "audit"} else "FOR UPDATE"
            c.execute(
                text("SELECT id FROM business WHERE id=:b " + lock), {"b": business_id}
            ).first()
            member = c.execute(
                text(
                    "SELECT m.role FROM membership m JOIN business b ON b.id=m.business_id WHERE m.user_id=:u AND m.business_id=:b AND m.revoked_at IS NULL AND b.status='active' FOR SHARE OF m"
                ),
                {"u": identity.user_id, "b": business_id},
            ).scalar_one_or_none()
            if member is None:
                raise ApplicationError(404, "NOT_FOUND")
            if member not in PERMISSIONS[permission]:
                raise ApplicationError(403, "FORBIDDEN")
            yield c, Scope(identity.user_id, identity.session_id, business_id, member)

    @contextmanager
    def job(self, operation_id: UUID, fence: UUID):
        with self.engine.begin() as c:
            row = (
                c.execute(
                    text("SELECT * FROM operation_context(:id,:token)"),
                    {"id": operation_id, "token": fence},
                )
                .mappings()
                .one_or_none()
            )
            if row is None:
                raise ApplicationError(409, "LEASE_OR_AUTHORIZATION_LOST")
            set_context(
                c,
                user_id=row["user_id"],
                session_id=row["session_id"],
                business_id=row["business_id"],
            )
            yield c, Scope(row["user_id"], row["session_id"], row["business_id"])

    def record_security(self, token, code):
        try:
            with self.engine.begin() as c:
                c.execute(
                    text("SELECT security_record(:digest,:code)"),
                    {"digest": digest_token(token), "code": code[:100]},
                )
        except Exception:
            import logging

            logging.getLogger("orderfit.security").error(
                "security_record_unavailable code=%s", code
            )

    def close(self):
        self.engine.dispose()
