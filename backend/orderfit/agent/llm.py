"""The ONLY place that calls the AI model.

P4 implements OpenAI Responses with typed output and off/recorded/live modes,
a configured evaluated model, bounded requests and coordinated job retries.
No live fallback from unknown recordings. Record provenance and safe errors;
source text remains untrusted data. P0 pins the SDK without making API calls.
"""

from pydantic import BaseModel


async def structured[T: BaseModel](prompt_name: str, variables: dict, schema: type[T]) -> T:
    """Render prompts/<prompt_name>.md, call the model, parse into ``schema``."""
    raise NotImplementedError


async def text_with_placeholders(prompt_name: str, variables: dict) -> str:
    """Return text that uses {placeholders} for every figure; never raw numbers."""
    raise NotImplementedError
