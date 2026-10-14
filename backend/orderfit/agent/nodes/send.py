"""Simulated send in the MVP. Keyed by pending_action.action_id so a retry is a no-op; logged to audit."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
