"""Transaction guards retain their settings and locality with one setup round trip."""

import pytest
from sqlalchemy import event, text

from orderfit.store.db import Database, apply_timeouts

SETTINGS = text(
    "SELECT current_setting('lock_timeout'),current_setting('statement_timeout'),"
    "current_setting('idle_in_transaction_session_timeout')"
)


@pytest.mark.parametrize("rollback", [False, True])
def test_timeout_setup_is_one_statement_and_resets_on_pool_reuse(postgres, rollback):
    db = Database(postgres["url"], pool_size=1)
    statements = []

    def observe(_connection, _cursor, statement, _parameters, _context, _many):
        statements.append(statement)

    event.listen(db.engine, "before_cursor_execute", observe)
    try:
        with db.engine.begin() as c:
            defaults = c.execute(SETTINGS).one()
        try:
            with db.engine.begin() as c:
                statements.clear()
                apply_timeouts(c)
                assert len(statements) == 1
                assert c.execute(SETTINGS).one() == ("10s", "1min", "1min")
                if rollback:
                    raise RuntimeError("Synthetic rollback")
        except RuntimeError:
            assert rollback
        with db.engine.begin() as c:
            assert c.execute(SETTINGS).one() == defaults
    finally:
        db.close()
