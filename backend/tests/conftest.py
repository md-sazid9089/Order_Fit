"""Shared fixtures.

- rina_input: the Rina demo as an EngineInput (from data/demo/rina_business.json)
- fake_llm: replays recorded responses from tests/fixtures/llm/<prompt>__<case>.json
- catalogue: data/financing_catalogue.json
"""

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"
LLM_FIXTURES = Path(__file__).parent / "fixtures" / "llm"


@pytest.fixture(autouse=True)
def _reset_provider_resilience_state():
    """The provider circuit breaker is process-wide; tests must not leak an open circuit."""
    from orderfit.agent import llm

    llm._breaker = llm._CircuitBreaker()
    yield
