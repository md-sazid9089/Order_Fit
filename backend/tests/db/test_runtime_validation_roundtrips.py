"""Catalog batching preserves role separation and fails closed on schema drift."""

import pytest
from sqlalchemy import event, text

from orderfit.store.db import Database


def test_runtime_validation_one_query_and_role_separation(postgres):
    for url_key, worker, restricted in (
        ("url", False, True),
        ("url", True, False),
        ("worker_url", True, True),
        ("worker_url", False, False),
        ("migrator_url", False, False),
    ):
        db = Database(postgres[url_key])
        statements = []

        def observe(_c, _cursor, statement, _parameters, _context, _many, *, captured=statements):
            captured.append(statement)

        event.listen(db.engine, "before_cursor_execute", observe)
        try:
            with db.engine.connect() as c:
                statements.clear()
                assert db._runtime_checks(c, worker=worker) == (restricted, True)
                assert len(statements) == 1
        finally:
            db.close()


@pytest.mark.parametrize("missing", [False, True])
def test_runtime_validation_rejects_missing_or_wrong_schema(postgres, missing):
    owner = Database(postgres["migrator_url"])
    try:
        # Uncommitted drift in this fixture's disposable database; always rollback.
        with owner.engine.connect() as c:
            if missing:
                c.execute(text("DELETE FROM alembic_version"))
            else:
                c.execute(text("UPDATE alembic_version SET version_num='wrong_revision'"))
            assert owner._runtime_checks(c) == (False, False)
            c.rollback()
    finally:
        owner.close()
