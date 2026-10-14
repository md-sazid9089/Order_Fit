"""AI: extract ONLY the proposed terms from the counterparty reply; route to validate, never straight to compute."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
