"""Bounded administrative reads; no runtime-wide RLS bypass or tenant writes."""

import time
from contextlib import contextmanager
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.exc import DBAPIError

from orderfit.api.errors import ApplicationError
from orderfit.contracts.admin import AdminCapabilities, AdminChecks, AdminSystem
from orderfit.contracts.primitives import Page
from orderfit.services.pagination import page_limit, split_page
from orderfit.store import admin_repository as repository
from orderfit.store.db import apply_timeouts

UNAVAILABLE = "Platform administrative reads are not enabled or their database prerequisites are unavailable."


def unavailable():
    return ApplicationError(503, "ADMIN_TELEMETRY_UNAVAILABLE", UNAVAILABLE)


def capabilities(identity):
    enabled = False
    if identity.config.admin_reads_enabled:
        try:
            with identity.database.transaction() as c:
                apply_timeouts(c)
                enabled = repository.prerequisites(c)
        except DBAPIError:
            enabled = False
    return AdminCapabilities(read_enabled=enabled, reason=None if enabled else UNAVAILABLE)


@contextmanager
def read_connection(identity, token):
    if not identity.config.admin_reads_enabled:
        raise unavailable()
    try:
        with identity.database.transaction() as c:
            apply_timeouts(c)
            if not repository.prerequisites(c):
                raise unavailable()
            scope = repository.identity(c, token)
            yield c, scope
    except DBAPIError as exc:
        state = getattr(exc.orig, "sqlstate", "")
        if state == "OA401":
            raise ApplicationError(401, "INVALID_SESSION", "Sign in to continue.") from exc
        if state == "OA403":
            raise ApplicationError(403, "FORBIDDEN", "Administrative privileges required.") from exc
        if state == "OA422":
            raise ApplicationError(503, "ADMIN_DATA_UNSUPPORTED",
                                   "Recorded administrative data cannot be displayed safely.") from exc
        if state in {"42501", "42883", "42P01"}:
            raise unavailable() from exc
        raise


def overview(identity, token):
    with read_connection(identity, token) as (c, _):
        return repository.overview(c, token)


def _position(codec, token, scope, name):
    if token is None:
        return None, int(time.time()) + 900
    invalid = ApplicationError(422, "INVALID_CURSOR", "Restart the listing from the first page.")
    bound, position = codec.decode_with_filters(token, business_id="platform", user_id=scope.user_id,
                                               listing="admin_" + name)
    try:
        expiry = int(bound["expires"])
        expected = {"session": str(scope.session_id), "expires": str(expiry), "order": name + ".v1"}
        if bound != expected or expiry <= time.time() or expiry > time.time() + 901:
            raise ValueError
        if len(position) != (1 if name == "users" else 2):
            raise ValueError
        UUID(position[-1])
        if name != "users":
            date = datetime.fromisoformat(position[0])
            if date.tzinfo is None or date.utcoffset() is None:
                raise ValueError
        return position, expiry
    except (ValueError, KeyError, TypeError) as exc:
        raise invalid from exc


def listing(identity, token, name, limit, cursor):
    page_limit(limit)
    with read_connection(identity, token) as (c, scope):
        position, expiry = _position(identity.cursors, cursor, scope, name)
        rows = repository.listing(c, token, name, limit + 1, position)
        rows, more = split_page(rows, limit)
        continuation = None
        if more:
            last = rows[-1]
            position = [str(last.id)] if name == "users" else [last.created_at.isoformat(), str(last.id)]
            continuation = identity.cursors.encode(
                business_id="platform", user_id=scope.user_id, listing="admin_" + name,
                filters={"session": scope.session_id, "expires": expiry, "order": name + ".v1"},
                position=position,
            )
        return Page[repository.MODELS[name]](items=rows, next_cursor=continuation)


def system(identity, token, storage):
    # Release authority locks before external health probes.
    with read_connection(identity, token):
        pass
    result = identity.database.readiness()
    try:
        storage_ok = bool(storage.writable()) if storage else None
    except Exception:  # noqa: BLE001 - unknown health is an explicit result
        storage_ok = None
    checks = AdminChecks(database=result.get("database"), schema_current=result.get("schema_current"),
                         storage_writable=storage_ok, worker_active=result.get("worker"))
    values = list(checks.model_dump().values())
    status = "degraded" if False in values else "unavailable" if None in values else "ready"
    # Recheck after probes: a revocation during a slow probe cannot publish data.
    with read_connection(identity, token):
        pass
    return AdminSystem(checked_at=datetime.now(UTC), status=status, checks=checks)
