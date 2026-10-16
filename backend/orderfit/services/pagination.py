"""Opaque keyset cursors (README "Collections"): base64url canonical JSON + HMAC.

A cursor binds business, user, listing name, filters and sort order. It is a position, never
authority: every request is still authorized and re-filtered, and a cursor minted for another
user, business, listing or filter is rejected as invalid input.
"""

import base64
import hashlib
import hmac
import json
from datetime import datetime

from orderfit.api.errors import ApplicationError

CURSOR_VERSION = 1
DEFAULT_LIMIT = 50
MAX_LIMIT = 100


def _b64(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _unb64(text: str) -> bytes:
    return base64.urlsafe_b64decode(text + "=" * (-len(text) % 4))


def cursor_key(session_secret: bytes) -> bytes:
    """Dedicated derived key (domain separated from CSRF/idempotency keys)."""
    return hmac.digest(session_secret, b"orderfit:cursor:v1", "sha256")


class CursorCodec:
    def __init__(self, key: bytes):
        if len(key) < 32:
            raise ValueError("cursor key must have at least 32 bytes")
        self.key = key

    def _scope(self, business_id, user_id, listing, filters):
        return {
            "v": CURSOR_VERSION,
            "b": str(business_id),
            "u": str(user_id),
            "l": listing,
            "f": {k: (None if v is None else str(v)) for k, v in sorted((filters or {}).items())},
        }

    def encode(self, *, business_id, user_id, listing, position, filters=None) -> str:
        body = self._scope(business_id, user_id, listing, filters) | {"p": [str(v) for v in position]}
        raw = json.dumps(body, sort_keys=True, separators=(",", ":")).encode("utf-8")
        signature = hmac.new(self.key, raw, hashlib.sha256).digest()
        return _b64(raw) + "." + _b64(signature)

    def decode(self, token, *, business_id, user_id, listing, filters=None) -> list[str] | None:
        if token is None:
            return None
        bound, position = self.decode_with_filters(token, business_id=business_id, user_id=user_id, listing=listing)
        if bound != self._scope(business_id, user_id, listing, filters)["f"]:
            raise ApplicationError(422, "INVALID_CURSOR", "Restart the listing from the first page.")
        return position

    def decode_with_filters(self, token, *, business_id, user_id, listing) -> tuple[dict, list[str]]:
        """Verifies signature and business/user/listing; returns the bound filters to check."""
        invalid = ApplicationError(422, "INVALID_CURSOR", "Restart the listing from the first page.")
        try:
            if len(token) > 2048:
                raise ValueError
            encoded, signature = token.split(".")
            raw = _unb64(encoded)
            if not hmac.compare_digest(_unb64(signature), hmac.new(self.key, raw, hashlib.sha256).digest()):
                raise ValueError
            body = json.loads(raw)
            position, bound = body.pop("p"), body.pop("f")
            expected = self._scope(business_id, user_id, listing, None)
            expected.pop("f")
            if body != expected or not isinstance(bound, dict):
                raise ValueError
            if not isinstance(position, list) or not all(isinstance(v, str) for v in position):
                raise ValueError
            return bound, position
        except (ValueError, TypeError, KeyError, json.JSONDecodeError) as exc:
            raise invalid from exc


def page_limit(limit: int) -> int:
    if not 1 <= limit <= MAX_LIMIT:
        raise ApplicationError(422, "INVALID_INPUT", "Check the request fields.")
    return limit


def timestamp_position(value: datetime) -> str:
    return value.isoformat()


def split_page(rows, limit):
    """Fetch limit+1 rows; returns (page rows, has_more)."""
    return rows[:limit], len(rows) > limit
