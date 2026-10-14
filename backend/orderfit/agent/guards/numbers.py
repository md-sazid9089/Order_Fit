"""Number guard.

1. Fill {placeholders} from the engine Result and confirmed terms.
2. Parse every number in the final text (1,234 / 1234.00 / $1.2k / 30 days / dates)
   into a canonical value and require it to match an allowed value.
3. Block spelled-out numbers ("thirty days") so the check can't be bypassed.
"""


def allowed_values(result, terms) -> set:
    raise NotImplementedError


def check(text: str, allowed: set) -> list[str]:
    """Return the offending fragments; empty list means pass."""
    raise NotImplementedError
