"""The plan's disk gate is a precondition, not a post-load warning."""

from collections import namedtuple

import pytest

from tests.stress.run_plan2 import disk_preflight

Usage = namedtuple("Usage", "total used free")


@pytest.mark.parametrize("free,allowed", [(14999, False), (15000, True), (15001, True)])
def test_disk_free_boundary_is_fifteen_percent(tmp_path, monkeypatch, free, allowed):
    monkeypatch.setattr("tests.stress.run_plan2.shutil.disk_usage",
                        lambda _: Usage(100000, 100000-free, free))
    result = disk_preflight([tmp_path])
    assert result["passed"] is allowed
    assert result["minimum_percent"] == 15


def test_full_workspace_does_not_hide_low_space_on_another_required_volume(tmp_path, monkeypatch):
    workspace, database = tmp_path / "workspace", tmp_path / "database"
    workspace.mkdir()
    database.mkdir()
    def usage(path):
        free = 50000 if path == workspace.resolve() else 7000
        return Usage(100000, 100000-free, free)
    monkeypatch.setattr("tests.stress.run_plan2.shutil.disk_usage", usage)
    result = disk_preflight([workspace, database])
    assert result["passed"] is False
    assert [row["free_percent"] for row in result["paths"]] == [50, 7]
