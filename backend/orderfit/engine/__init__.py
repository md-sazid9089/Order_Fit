"""Decision engine: pure, deterministic, no AI, no I/O.

Import rule (enforced by tests/test_architecture.py): this package may import
only the standard library, pydantic, and itself. Never agent/, api/, store/,
config, or any network/AI library.

Public entry point: ``analyse(EngineInput) -> Result``.
"""

from orderfit.engine.analyse import ENGINE_VERSION, analyse

__all__ = ["ENGINE_VERSION", "analyse"]
