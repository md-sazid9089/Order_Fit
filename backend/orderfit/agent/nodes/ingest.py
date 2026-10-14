"""Store each document by content hash (scoped per business); reject duplicates (D-09)."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
