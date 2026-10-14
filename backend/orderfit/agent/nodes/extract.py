"""AI: read order and supplier quote into OrderTerms / SupplierQuote with a SourceRef per field."""

from orderfit.agent.state import WorkflowState


async def run(state: WorkflowState) -> dict:
    raise NotImplementedError
