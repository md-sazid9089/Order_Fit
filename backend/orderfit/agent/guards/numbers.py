"""Number guard.

1. Fill {placeholders} from the engine Result and confirmed terms.
2. Parse every number in the final text (1,234 / 1234.00 / $1.2k / 30 days / dates)
   into a canonical value and require it to match an allowed value.
3. Block spelled-out numbers ("thirty days") so the check can't be bypassed.
"""

import re
from decimal import Decimal, InvalidOperation

NUMBER = re.compile(r"(?<!\d)\d+(?:[.,]\d+)*")
_UNITS = (
    "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen "
    "fifteen sixteen seventeen eighteen nineteen twenty thirty forty fifty sixty seventy "
    "eighty ninety hundred thousand million billion dozen lakh crore"
).split()
WRITTEN = re.compile(r"\b(?:" + "|".join(_UNITS) + r")\b|[একদুইতিনচারপাঁচছয়সাতআটনয়দশশতহাজারলক্ষকোটি]+|[एकदोतिनचारपाँचछसातआठनौदससौहजारलाखकरोड़]+|[一二三四五六七八九十百千万亿两]+", re.I)
_GROUPED = re.compile(r"\d{1,3}(?:,\d{3})+(?:\.\d+)?")


def canonical(token: str) -> str:
    """Canonical comparison form: properly grouped numbers lose commas and trailing zeros.

    A comma that is not a thousands separator is kept verbatim, so "1,2" never equals 12.
    """
    raw = token.replace(",", "") if _GROUPED.fullmatch(token) or "," not in token else token
    try:
        value = Decimal(raw)
    except InvalidOperation:
        return raw
    return format(value.normalize(), "f")


def _figures(value, out: set, lines: bool = True) -> None:
    """Collect figures from result leaves only: never dictionary keys, identifiers or hashes.

    Top-level strings and list items are canonical typed lines (the numbers/words they
    contain are the result); inside mappings/models only numeric leaves and purely numeric
    strings (decimal minor-unit strings) count, never free text such as ids or hashes.
    """
    if isinstance(value, bool) or value is None:
        return
    if isinstance(value, (int, Decimal)):
        out.add(canonical(str(value)))
    elif isinstance(value, str):
        if lines:
            out.update(canonical(t) for t in NUMBER.findall(value))
            out.update(word.lower() for word in WRITTEN.findall(value))
        elif NUMBER.fullmatch(value):
            out.add(canonical(value))
    elif isinstance(value, dict):
        for item in value.values():
            _figures(item, out, False)
    elif isinstance(value, (list, tuple, set, frozenset)):
        for item in value:
            _figures(item, out, lines)
    elif hasattr(value, "model_dump"):
        _figures(value.model_dump(mode="json"), out, False)


def allowed_values(result, terms) -> set:
    """Tokens only; mandatory semantic slot validation is the separate terms guard.

    ``result`` and ``terms`` may be typed lines, mappings or models; only their figure
    leaves become allowed, so an identifier or hash that merely contains digits does not
    whitelist those digits.
    """
    allowed: set = set()
    _figures(result, allowed)
    _figures(terms, allowed)
    return allowed


def check(text: str, allowed: set) -> list[str]:
    """Return the offending fragments; empty list means pass."""
    native_digits = [char for char in text if char.isdecimal() and not char.isascii()]
    return native_digits + [token for token in NUMBER.findall(text) if canonical(token) not in allowed] + [
        word for word in WRITTEN.findall(text) if word.lower() not in allowed
    ]
