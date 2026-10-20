"""Provider-free shared test isolation; synthetic inputs live with their owning suites."""

import pytest


@pytest.fixture(autouse=True)
def _reset_provider_resilience_state():
    """The provider circuit breaker is process-wide; tests must not leak an open circuit."""
    from orderfit.agent import llm

    llm._breaker = llm._CircuitBreaker()
    yield
