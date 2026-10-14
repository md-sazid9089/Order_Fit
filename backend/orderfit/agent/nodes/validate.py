"""Rules, no AI: totals add up, dates unambiguous, payment basis known, limits respected; run injection and fraud guards. Used on first pass and on every reply."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
