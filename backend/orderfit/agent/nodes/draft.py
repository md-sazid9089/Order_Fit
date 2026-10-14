"""AI: message for the chosen option; numbers guard and terms guard must pass before it becomes pending_action."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
