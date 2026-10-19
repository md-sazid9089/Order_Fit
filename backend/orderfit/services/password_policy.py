"""Acceptance policy for new passwords, following NIST SP 800-63B section 5.1.1.2.

Length is enforced by the request contracts (12 to 1024 characters). Composition rules such as
"one digit and one symbol" are deliberately absent: they push people toward predictable
decoration. Instead a new password is refused when it is predictable (common, a keyboard walk,
a sequence or a repeated pattern), contains account identifiers, or equals the current one.

The embedded list is a compact screen of the most frequent base words, not a breach corpus.
Matching strips digits, symbols and common leetspeak so decorated variants of a base word
("P@ssw0rd2026!") are refused too.
"""

from __future__ import annotations

import re

from orderfit.api.errors import ApplicationError

WEAK_MESSAGE = "Choose a password that is harder to guess: avoid common words, patterns and your email address."
REUSED_MESSAGE = "Choose a password you are not using now."

_LEET = str.maketrans({"0": "o", "1": "l", "3": "e", "4": "a", "5": "s", "7": "t", "8": "b", "@": "a", "$": "s", "!": "i"})

# Base words after normalisation (lowercase, leetspeak undone, non-letters removed).
_COMMON_BASES = frozenset(
    """password passw0rd passwd passphrase letmein welcome admin administrator root login master
    qwerty qwertyuiop qwertyui asdfgh asdfghjkl zxcvbn zxcvbnm qazwsx qazwsxedc azerty
    iloveyou monkey dragon football baseball basketball soccer hockey superman batman
    sunshine princess shadow trustno michael jordan jessica ashley charlie freedom whatever
    computer internet secret changeme default sample test testing guest user abc abcdef
    starwars pokemon cheese summer winter spring autumn hello hunter killer
    orderfit orderfitapp bangladesh dhaka""".split()
)
_KEYBOARD_ROWS = ("qwertyuiopasdfghjklzxcvbnm", "1234567890", "azertyuiopqsdfghjklmwxcvbn")
_ALPHABET = "abcdefghijklmnopqrstuvwxyz"
_ALNUM_ORDER = "0123456789" + _ALPHABET


def _letter_views(value: str) -> tuple[str, str]:
    """Letters only, once as typed and once with leetspeak undone ('p@ssw0rd' -> 'password')."""
    folded = value.casefold()
    return re.sub(r"[^a-z]", "", folded), re.sub(r"[^a-z]", "", folded.translate(_LEET))


def _squeezed(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold())


def _is_repeated_pattern(value: str) -> bool:
    """True for strings built from one short unit, e.g. 'aaaaaaaaaaaa' or 'abababababab'."""
    return any(
        len(value) % size == 0 and value == value[:size] * (len(value) // size)
        for size in range(1, min(4, len(value) // 2) + 1)
    )


def _is_run(value: str, order: str) -> bool:
    """True when value is a (reversed) consecutive run of `order`, such as '123456789012'."""
    if len(value) < 8:
        return False
    doubled = order + order
    return value in doubled or value[::-1] in doubled


def _is_common_word(view: str) -> bool:
    for base in _COMMON_BASES:
        if view.replace(base, "") == "":  # the base word, possibly repeated, and nothing else
            return True
        # A longer base word with at most a few characters of decoration on either side.
        if len(base) >= 6 and len(view) - len(base) <= 4 and (view.startswith(base) or view.endswith(base)):
            return True
    return False


def _is_predictable(candidate: str) -> bool:
    squeezed = _squeezed(candidate)
    if _is_repeated_pattern(squeezed):
        return True
    if _is_run(squeezed, _ALNUM_ORDER) or any(_is_run(squeezed, row) for row in _KEYBOARD_ROWS):
        return True
    return any(view and _is_common_word(view) for view in _letter_views(candidate))


def _contains_identifier(candidate: str, email: str) -> bool:
    folded = _squeezed(candidate)
    email_squeezed = _squeezed(email)
    local = _squeezed(email.split("@", 1)[0])
    return (bool(email_squeezed) and email_squeezed in folded) or (len(local) >= 4 and local in folded)


def check_new_password(candidate: str, *, email: str, current: str | None = None) -> None:
    """Raise a 422 ApplicationError when `candidate` must not be accepted as a new password."""
    if current is not None and candidate == current:
        raise ApplicationError(422, "PASSWORD_REUSED", REUSED_MESSAGE)
    if _contains_identifier(candidate, email) or _is_predictable(candidate):
        raise ApplicationError(422, "WEAK_PASSWORD", WEAK_MESSAGE)
