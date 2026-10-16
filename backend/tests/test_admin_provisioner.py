"""Provisioning must refuse databases without the atomic revocation/audit guard."""

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest


def test_missing_authority_trigger_prevents_any_provisioning_write(monkeypatch):
    path = Path(__file__).resolve().parents[2] / "scripts" / "provision_admin.py"
    spec = importlib.util.spec_from_file_location("synthetic_admin_provisioner", path)
    module = importlib.util.module_from_spec(spec)
    # Import must not load application files or select an actual configured target.
    with patch("dotenv.load_dotenv"), patch.dict("os.environ", {
        "DATABASE_URL_DIRECT": "postgresql+psycopg://synthetic@127.0.0.1/disposable"
    }, clear=True):
        spec.loader.exec_module(module)
    connection = MagicMock()
    connection.execute.return_value.scalar_one.return_value = False
    engine = MagicMock()
    engine.begin.return_value.__enter__.return_value = connection
    monkeypatch.setattr(module, "get_engine", lambda: engine)
    with pytest.raises(RuntimeError, match="migration before provisioning"):
        module.set_admin_role("synthetic@example.test", True)
    connection.execute.assert_called_once()
    assert str(connection.execute.call_args.args[0]).startswith("SELECT EXISTS")
