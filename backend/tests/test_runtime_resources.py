"""Runtime imports must work without the repository's external data directory."""

import shutil
import subprocess
import sys
from pathlib import Path


def test_document_lexicon_ships_with_package(tmp_path):
    package = Path(__file__).resolve().parents[1] / "orderfit"
    shutil.copytree(package, tmp_path / "orderfit", ignore=shutil.ignore_patterns("__pycache__"))
    # -I excludes the checkout and PYTHONPATH; only the copied runtime package is added.
    check = """
import sys
sys.path.insert(0, sys.argv[1])
from orderfit.services.documents import PAYMENT_BASIS_LEXICON, quote_supports
assert set(PAYMENT_BASIS_LEXICON) == {'en', 'bn', 'hi', 'zh-Hans'}
assert quote_supports('payment_basis', 'delivery', 'Payment on delivery', 'Payment on delivery') == 'ok'
"""
    result = subprocess.run(
        [sys.executable, "-I", "-c", check, str(tmp_path)],
        cwd=tmp_path, capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
