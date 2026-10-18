"""Safe, actionable schema mismatch diagnostics without relaxing startup guards."""

from unittest.mock import MagicMock

import pytest

from orderfit.store.db import SCHEMA_REVISION, Database


@pytest.mark.parametrize("revisions, expected", [
    (["0020_ai_workflow"], "0020_ai_workflow"),
    ([], "<none>"),
    (["untrusted://private/value"], "<unrecognized>"),
])
def test_schema_mismatch_names_required_and_deployed_without_connection_secrets(revisions, expected):
    database = Database.__new__(Database)
    database.engine = MagicMock()
    connection = database.engine.connect.return_value.__enter__.return_value
    connection.execute.return_value.scalars.return_value.all.return_value = revisions
    database._runtime_checks = MagicMock(return_value=(True, False))
    with pytest.raises(RuntimeError) as error:
        database.validate_runtime()
    message = str(error.value)
    assert f"required {SCHEMA_REVISION}; deployed {expected}" in message
    assert "database owner" in message and "Alembic" in message
    assert "untrusted://private/value" not in message


def test_healthy_startup_has_no_diagnostic_query_and_restricted_role_still_required():
    database = Database.__new__(Database)
    database.engine = MagicMock()
    connection = database.engine.connect.return_value.__enter__.return_value
    database._runtime_checks = MagicMock(return_value=(True, True))
    database.validate_runtime(worker=True)
    database._runtime_checks.assert_called_once_with(connection, worker=True)
    connection.execute.assert_not_called()
    database._runtime_checks.return_value = (False, False)
    with pytest.raises(RuntimeError, match="restricted non-owner"):
        database.validate_runtime()
    connection.execute.assert_not_called()
