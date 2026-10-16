"""Bounded administrator reads preserve runtime RLS and current authority."""

from contextlib import contextmanager

from sqlalchemy import select

from orderfit.api.errors import ApplicationError
from orderfit.store.tables import app_user


@contextmanager
def admin_connection(database, token):
    """Revalidate and lock authority in the same bounded transaction as the read.

    Runtime RLS stays enabled: this does not grant cross-tenant authority.
    A concurrent role revocation waits for this short transaction to finish.
    """
    with database.identity(token) as (conn, scope, _):
        allowed = conn.execute(
            select(app_user.c.is_platform_admin)
            .where(app_user.c.id == scope.user_id)
            .with_for_update(read=True)
        ).scalar_one_or_none()
        if allowed is not True:
            raise ApplicationError(403, "FORBIDDEN", "Administrative privileges required.")
        yield conn


