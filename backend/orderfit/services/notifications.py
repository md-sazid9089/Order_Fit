"""P7 recipient notifications: per-user rows generated in the event's own transaction (SQL
triggers in 0012). Reads and marks are restricted to the caller by RLS as well as by query.
"""

from sqlalchemy import text

from orderfit.api.errors import ApplicationError
from orderfit.contracts.primitives import Acknowledgement, Page
from orderfit.contracts.resources import Notification, NotificationsRead
from orderfit.services.pagination import page_limit, split_page, timestamp_position

LISTING = "notifications"
COLUMNS = "id,user_id,deal_id,severity,title,message,action_url,created_at,read_at"


def _view(row) -> Notification:
    return Notification(
        id=str(row["id"]), user_id=row["user_id"], deal_id=row["deal_id"], severity=row["severity"],
        title=row["title"], message=row["message"], action_url=row["action_url"],
        created_at=row["created_at"], read_at=row["read_at"],
    )


def list_own(c, scope, cursors, cursor, limit) -> Page[Notification]:
    limit = page_limit(limit)
    after = cursors.decode(cursor, business_id=scope.business_id, user_id=scope.user_id, listing=LISTING)
    rows = c.execute(
        text(
            "SELECT " + COLUMNS + " FROM notification WHERE business_id=:b AND user_id=:u "
            "AND (CAST(:c AS timestamptz) IS NULL OR (created_at,id)<(CAST(:c AS timestamptz),CAST(:i AS bigint))) "
            "ORDER BY created_at DESC,id DESC LIMIT :n"
        ),
        {"b": scope.business_id, "u": scope.user_id, "c": after[0] if after else None,
         "i": after[1] if after else None, "n": limit + 1},
    ).mappings().all()
    rows, more = split_page(rows, limit)
    next_cursor = None
    if more:
        next_cursor = cursors.encode(
            business_id=scope.business_id, user_id=scope.user_id, listing=LISTING,
            position=[timestamp_position(rows[-1]["created_at"]), rows[-1]["id"]],
        )
    return Page[Notification](items=[_view(r) for r in rows], next_cursor=next_cursor)


def read_one(c, scope, notification_id: int) -> Notification:
    row = c.execute(
        text(
            "UPDATE notification SET read_at=coalesce(read_at,clock_timestamp()) "
            "WHERE business_id=:b AND user_id=:u AND id=:id RETURNING " + COLUMNS
        ),
        {"b": scope.business_id, "u": scope.user_id, "id": notification_id},
    ).mappings().one_or_none()
    if row is None:
        raise ApplicationError(404, "NOT_FOUND")
    return _view(row)


def read_through(c, scope, command: NotificationsRead, request_id: str) -> Acknowledgement:
    c.execute(
        text(
            "UPDATE notification SET read_at=clock_timestamp() "
            "WHERE business_id=:b AND user_id=:u AND id<=:id AND read_at IS NULL"
        ),
        {"b": scope.business_id, "u": scope.user_id, "id": int(command.through_id)},
    )
    return Acknowledgement(request_id=request_id, completed=True)
