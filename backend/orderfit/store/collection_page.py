"""Shared keyset mechanics for legacy collections; row mapping stays in repositories."""
from datetime import date, datetime
from uuid import UUID

from sqlalchemy import desc, tuple_

from orderfit.api.errors import ApplicationError
from orderfit.services.pagination import page_limit


def collection_page(c, query, table, business_id, sort, limit, offset, *,
                    cursor=None, cursors=None, scope=None, filters=None):
    page_limit(limit)
    listing = f"{table.name}:{sort.name}:desc:v1"
    filters = filters or {}
    if cursor is not None:
        if offset or cursors is None or scope is None:
            raise ApplicationError(422, "INVALID_CURSOR", "Use cursor without offset.")
        position = cursors.decode(cursor, business_id=business_id, user_id=scope.user_id,
                                  listing=listing, filters=filters)
        try:
            if len(position) != 2:
                raise ValueError
            value = position[0]
            # PostgreSQL biz_date DOMAIN exposes object, while its data_type is DATE.
            kind = getattr(sort.type, "data_type", sort.type).python_type
            value = (datetime.fromisoformat(value) if kind is datetime else
                     date.fromisoformat(value) if kind is date else kind(value))
            identity = (UUID(position[1]) if table.c.id.type.python_type is UUID
                        else table.c.id.type.python_type(position[1]))
        except (ValueError, TypeError) as exc:
            raise ApplicationError(422, "INVALID_CURSOR") from exc
        query = query.where(tuple_(sort, table.c.id) < tuple_(value, identity))
    rows = c.execute(query.order_by(desc(sort), desc(table.c.id))
                     .limit(limit + 1).offset(offset)).mappings().all()
    more, rows = len(rows) > limit, rows[:limit]
    continuation = None
    if more:
        if cursors is not None and scope is not None:
            last = rows[-1]
            continuation = cursors.encode(business_id=business_id, user_id=scope.user_id,
                listing=listing, filters=filters, position=[last[sort.name], last["id"]])
        else:
            # Internal callers retain explicit offset compatibility. HTTP always
            # supplies the codec and returns scoped, signed keyset continuation.
            continuation = str(offset + limit)
    return rows, continuation
