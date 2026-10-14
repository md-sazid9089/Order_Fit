"""Single entry point. The agent's compute node is the only caller.

Bump ENGINE_VERSION on any change that can alter a Result, so stored results
can be re-run and compared after a fix.
"""

from orderfit.engine.models import EngineInput, Result

ENGINE_VERSION = "0.1.0"


def analyse(engine_input: EngineInput) -> Result:
    """Baseline, every option combination, loan sizing, stress scan, ranking."""
    raise NotImplementedError
