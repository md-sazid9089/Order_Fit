"""Short synchronous SQLAlchemy transactions on psycopg 3. SQL owns DDL."""

import hashlib
from contextlib import contextmanager
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy import create_engine, text
from sqlalchemy.exc import TimeoutError as PoolTimeout

from orderfit.api.errors import ApplicationError
from orderfit.contracts.protocol import PERMISSIONS

SCHEMA_REVISION = "0020_ai_workflow"


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


# Transaction-local guards (SET LOCAL semantics via set_config(..., true)): nothing is
# session-level, so PgBouncer transaction pooling and pool reuse stay safe. A blocked
# lock or runaway statement fails as 55P03/57014 and maps to a retryable 503.
TRANSACTION_TIMEOUTS = {
    "lock_timeout": "10s",
    "statement_timeout": "60s",
    "idle_in_transaction_session_timeout": "60s",
}


def apply_timeouts(connection):
    # One network round trip; all settings remain transaction-local and precede
    # session resolution/tenant locks exactly as before.
    connection.execute(
        text(
            "SELECT set_config('lock_timeout',:lock_timeout,true),"
            "set_config('statement_timeout',:statement_timeout,true),"
            "set_config('idle_in_transaction_session_timeout',:idle_in_transaction_session_timeout,true)"
        ),
        TRANSACTION_TIMEOUTS,
    )


class Database:
    def __init__(self, url: str, *, pool_size=5, pool_timeout=3):
        self.engine = create_engine(
            url,
            pool_size=pool_size,
            max_overflow=0,
            pool_timeout=pool_timeout,
            pool_pre_ping=True,
            pool_reset_on_return="rollback",
            hide_parameters=True,
            connect_args={"prepare_threshold": None, "connect_timeout": 5},
        )

    @staticmethod
    def _runtime_checks(c, *, worker=False) -> tuple[bool, bool]:
        """(restricted non-owner login, schema revision current)."""
        # One catalog snapshot and round trip; retain every role/inheritance and
        # ownership check. A missing revision fails closed; multiple rows error.
        r = (
            c.execute(
                text(
                    "SELECT r.rolsuper,r.rolbypassrls,r.rolcreaterole,r.rolcreatedb,r.rolreplication,r.rolcanlogin,"
                    "pg_has_role(current_user,'orderfit_admin','MEMBER') AS admin,"
                    "pg_has_role(current_user,'orderfit_app','USAGE') AS app,"
                    "pg_has_role(current_user,'orderfit_worker','USAGE') AS worker,"
                    "(EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p') AND pg_has_role(current_user,c.relowner,'MEMBER')) "
                    "OR EXISTS(SELECT FROM pg_database d WHERE d.datname=current_database() AND pg_has_role(current_user,d.datdba,'MEMBER')) "
                    "OR EXISTS(SELECT FROM pg_roles p WHERE (p.rolsuper OR p.rolbypassrls OR p.rolcreaterole OR p.rolcreatedb OR p.rolreplication) AND pg_has_role(current_user,p.oid,'MEMBER'))) AS owns,"
                    "(SELECT version_num FROM alembic_version)=:revision AS schema_current "
                    "FROM pg_roles r WHERE rolname=current_user"
                ),
                {"revision": SCHEMA_REVISION},
            )
            .mappings()
            .one()
        )
        restricted = not (
            r["rolsuper"]
            or r["rolbypassrls"]
            or r["rolcreaterole"]
            or r["rolcreatedb"]
            or r["rolreplication"]
            or not r["rolcanlogin"]
            or r["admin"]
            or r["owns"]
            or not r["app"]
            or (worker and not r["worker"])
            or (not worker and r["worker"])
        )
        current = r["schema_current"] is True
        return restricted, current

    def validate_runtime(self, *, worker=False):
        with self.engine.connect() as c:
            restricted, current = self._runtime_checks(c, worker=worker)
            if not restricted:
                raise RuntimeError("A restricted non-owner runtime login is required")
            if not current:
                raise RuntimeError("Database schema is not current")

    def readiness(self) -> dict:
        """Safe booleans only; never raises and never returns driver or URL text."""
        status = {"database": False, "schema_current": False, "worker": False,
                  "backlog_seconds": None}
        try:
            with self.engine.begin() as c:
                c.execute(text("SELECT set_config('statement_timeout','5s',true)"))
                restricted, current = self._runtime_checks(c)
                status["database"] = restricted
                status["schema_current"] = restricted and current
                if status["schema_current"]:
                    backlog = c.execute(text("SELECT p7_queue_backlog_seconds()")).scalar_one()
                    status["backlog_seconds"] = max(0, backlog)
                    status["worker"] = c.execute(text("SELECT worker_capacity_live()")).scalar_one()
        except Exception:  # noqa: BLE001 - readiness reports, it does not propagate
            import logging

            logging.getLogger("orderfit.readiness").warning("readiness_database_check_failed")
        return status

    def publish_presence(self, worker_id, active=True):
        """Worker-only helper, fixed DB-time expiry, no tenant context or job locks."""
        with self.engine.begin() as c:
            c.execute(text("SELECT set_config('statement_timeout','3s',true),"
                           "set_config('lock_timeout','1s',true)"))
            c.execute(text("SELECT worker_presence_publish(:id,:active)"),
                      {"id": worker_id, "active": active})

    @contextmanager
    def presence_channel(self):
        """One reserved connection so job-pool saturation cannot starve liveness."""
        channel = Database(self.engine.url, pool_size=1, pool_timeout=3)
        try:
            yield channel
        finally:
            channel.close()

    @contextmanager
    def identity(self, token: str):
        with self.transaction() as c:
            # session_resolve updates/locks the session row: bound that first query too.
            apply_timeouts(c)
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
    def transaction(self):
        try:
            with self.engine.begin() as c:
                yield c
        except PoolTimeout as exc:
            raise ApplicationError(503, "DATABASE_CAPACITY", "The database is busy. Retry shortly.") from exc

    @contextmanager
    def tenant(self, token: str, business_id: UUID, permission="read", *, readonly=None):
        """Membership and role are checked before any tenant row lock is requested.

        ``readonly`` (default: the read/audit permissions) selects a shared business
        lock; a route that only reads but needs a write-class permission (for example a
        GET requiring ``prepare``) passes ``readonly=True`` so it never takes FOR UPDATE.
        """
        if readonly is None:
            readonly = permission in {"read", "audit"}
        with self.identity(token) as (c, identity, _):
            set_context(
                c, user_id=identity.user_id, session_id=identity.session_id, business_id=business_id
            )
            # Unlocked pre-check: a non-member gets 404 without waiting on another tenant's lock.
            query = text(
                "SELECT m.role FROM membership m JOIN business b ON b.id=m.business_id WHERE m.user_id=:u AND m.business_id=:b AND m.revoked_at IS NULL AND b.status='active'"
            )
            if c.execute(query, {"u": identity.user_id, "b": business_id}).scalar_one_or_none() is None:
                raise ApplicationError(404, "NOT_FOUND")
            # Documented lock order: business first, then the caller's membership row. Taking
            # the membership share lock first deadlocked two owners changing each other.
            c.execute(
                text("SELECT id FROM business WHERE id=:b " + ("FOR SHARE" if readonly else "FOR UPDATE")),
                {"b": business_id},
            ).first()
            member = c.execute(
                text(query.text + " FOR SHARE OF m"), {"u": identity.user_id, "b": business_id}
            ).scalar_one_or_none()
            if member is None:
                raise ApplicationError(404, "NOT_FOUND")
            if member not in PERMISSIONS[permission]:
                raise ApplicationError(403, "FORBIDDEN")
            if not c.execute(text("SELECT session_authority_current(:s,:b)"),
                             {"s": identity.session_id, "b": business_id}).scalar_one():
                raise ApplicationError(403, "SESSION_REAUTH_REQUIRED", "Your role changed. Sign in again to continue.")
            yield c, Scope(identity.user_id, identity.session_id, business_id, member)

    @contextmanager
    def job(self, operation_id: UUID, fence: UUID, *, settlement=False):
        """A fenced worker transaction under the operation's verified actor context.

        ``settlement=True`` (execution settlement only) uses ``operation_settle_context``:
        the same lease/authorization predicate without the cancellation condition, because
        a cancellation requested after every effect committed has nothing left to stop.
        """
        context = "operation_settle_context" if settlement else "operation_context"
        with self.engine.begin() as c:
            row = (
                c.execute(
                    text(f"SELECT * FROM {context}(:id,:token)"),
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
            apply_timeouts(c)
            yield c, Scope(row["user_id"], row["session_id"], row["business_id"])

    @staticmethod
    def fence(c, operation_id: UUID, token: UUID, *, settlement=False) -> bool:
        """Lock the operation row, then recheck lease token, expiry and authorization.

        Call after the business and deal locks (documented order: business, deal, related
        rows, operation). ``job()`` checks the lease only when the transaction starts; an
        effect must re-run this inside its own transaction so a worker whose lease lapsed or
        was reclaimed meanwhile cannot commit. Claim, heartbeat and finish all need this row,
        so the lease cannot change hands between this check and commit. ``settlement`` has the
        meaning documented on ``job``.
        """
        context = "operation_settle_context" if settlement else "operation_context"
        c.execute(text("SELECT id FROM operation WHERE id=:id FOR UPDATE"), {"id": operation_id})
        return c.execute(
            text(f"SELECT EXISTS(SELECT FROM {context}(:id,:token))"),
            {"id": operation_id, "token": token},
        ).scalar_one()

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
