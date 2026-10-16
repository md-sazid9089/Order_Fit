"""Tenant queue admission while the caller holds the business write lock."""

from sqlalchemy import text

from orderfit.api.errors import ApplicationError

MAX_PENDING_OPERATIONS = 25


def ensure_operation_capacity(connection, business_id):
    # The enclosing tenant transaction serializes admissions for this business.
    # Replay is resolved before this check; recovering an accepted command uses no slot.
    pending = connection.execute(text(
        "SELECT count(*) FROM (SELECT 1 FROM operation WHERE business_id=:b "
        "AND status IN ('queued','running') LIMIT :cap) pending"
    ), {"b": business_id, "cap": MAX_PENDING_OPERATIONS}).scalar_one()
    if pending >= MAX_PENDING_OPERATIONS:
        raise ApplicationError(429, "OPERATION_CAPACITY", "Too many operations are pending. Try again later.")
