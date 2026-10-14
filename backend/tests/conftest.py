"""Shared fixtures.

- rina_input: the Rina demo as an EngineInput (from data/demo/rina_business.json)
- fake_llm: replays recorded responses from tests/fixtures/llm/<prompt>__<case>.json
- catalogue: data/financing_catalogue.json
"""

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
LLM_FIXTURES = Path(__file__).parent / "fixtures" / "llm"
