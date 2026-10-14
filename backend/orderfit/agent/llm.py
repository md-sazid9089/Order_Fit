"""The ONLY place that calls the AI model.

Responsibilities: fixed model version, low temperature, structured output
parsed into Pydantic, retries (1 s then 4 s, then fall back to manual entry),
one re-ask on schema failure, and an audit entry per call (tokens, latency,
cost). Document text is always wrapped and labelled as data, never instructions.
"""

from pydantic import BaseModel


async def structured[T: BaseModel](prompt_name: str, variables: dict, schema: type[T]) -> T:
    """Render prompts/<prompt_name>.md, call the model, parse into ``schema``."""
    raise NotImplementedError


async def text_with_placeholders(prompt_name: str, variables: dict) -> str:
    """Return text that uses {placeholders} for every figure; never raw numbers."""
    raise NotImplementedError
