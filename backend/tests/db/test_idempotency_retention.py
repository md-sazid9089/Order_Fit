"""Idempotency keys: the restricted runtime login cannot delete or re-expire an unexpired key.

0003 granted DELETE on idempotency_key to orderfit_app with only an application-level expiry
check (IdempotencyRepository.reserve). Removing an unexpired key lets a retried request run
its effect twice, so the database now refuses it (0014_idempotency_execution_hardening).
"""

from uuid import uuid4

import psycopg
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from orderfit.store.repositories import IdempotencyRepository

HASH = b"\x01" * 32


def reserve(postgres, account, key):
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
        assert IdempotencyRepository.reserve(c, account.business_id, key, "probe", HASH) is None


def test_runtime_cannot_delete_or_reexpire_an_unexpired_key(postgres, accounts):
    account = accounts[0]
    key = "probe-" + uuid4().hex
    reserve(postgres, account, key)
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
            c.execute(text("DELETE FROM idempotency_key WHERE business_id=:b AND key=:k"),
                      {"b": account.business_id, "k": key})
    assert exc.value.orig.sqlstate == "OF003"
    # Shortening the expiry first is not a way around it: the runtime cannot write expires_at.
    with pytest.raises(DBAPIError) as exc:
        with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
            c.execute(text("UPDATE idempotency_key SET expires_at=clock_timestamp()-interval '1 second' "
                           "WHERE business_id=:b AND key=:k"), {"b": account.business_id, "k": key})
    assert exc.value.orig.sqlstate == "42501"
    with psycopg.connect(postgres["migrator"]) as admin:
        assert admin.execute("SELECT count(*) FROM idempotency_key WHERE key=%s", (key,)).fetchone()[0] == 1


def test_expired_key_cleanup_and_completion_still_work(postgres, accounts):
    account = accounts[0]
    key = "expired-" + uuid4().hex
    reserve(postgres, account, key)
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
        IdempotencyRepository.complete(c, account.business_id, key, {"done": True})
    # The cached response is replayed while the key is live.
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
        assert IdempotencyRepository.reserve(c, account.business_id, key, "probe", HASH) == {"done": True}
    with psycopg.connect(postgres["migrator"]) as admin:  # time passes (disposable migrator only)
        admin.execute("UPDATE idempotency_key SET expires_at=clock_timestamp()-interval '1 second' WHERE key=%s",
                      (key,))
    # reserve() removes the expired key as the runtime role and admits the request afresh.
    with postgres["database"].tenant(account.token, account.business_id, "prepare") as (c, _):
        assert IdempotencyRepository.reserve(c, account.business_id, key, "probe", HASH) is None
    with psycopg.connect(postgres["migrator"]) as admin:
        status = admin.execute("SELECT status FROM idempotency_key WHERE key=%s", (key,)).fetchone()[0]
    assert status == "in_progress"
