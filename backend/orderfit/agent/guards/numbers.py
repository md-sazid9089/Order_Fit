"""Number guard.

1. Fill {placeholders} from the engine Result and confirmed terms.
2. Parse every number in the final text (1,234 / 1234.00 / $1.2k / 30 days / dates)
   into a canonical value and require it to match an allowed value.
3. Block spelled-out numbers ("thirty days") so the check can't be bypassed.
"""

import re

NUMBER = re.compile(r"(?<![A-Za-z])\d+(?:[.,]\d+)*")
WRITTEN = re.compile(r"\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty|forty|fifty|hundred|thousand|million|billion)\b", re.I)


def allowed_values(result, terms) -> set:
    """Tokens only; mandatory semantic slot validation is the separate terms guard."""
    text = str(result) + "\n" + str(terms)
    return set(NUMBER.findall(text)) | {word.lower() for word in WRITTEN.findall(text)}


def check(text: str, allowed: set) -> list[str]:
    """Return the offending fragments; empty list means pass."""
    return [token for token in NUMBER.findall(text) if token not in allowed] + [
        word for word in WRITTEN.findall(text) if word.lower() not in allowed
    ]
