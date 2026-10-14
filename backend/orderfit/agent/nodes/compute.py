"""Engine call. The ONLY caller of engine.analyse.

Translates the confirmed Deal into EngineInput (minor units, bps, day offsets),
picks the target tolerance from the customer's trust level, runs the engine,
and logs an engine_run audit entry with engine_version and input_hash.
"""

from orderfit.agent.state import WorkflowState

TARGET_TOLERANCE_BY_TRUST = {
    "new": 15,
    "reliable": 15,
    "weakening": 30,
    "downturn": 60,
}


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
