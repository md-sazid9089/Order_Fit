"""Aggregate text ceiling for automatic extraction, independent of page layout."""

from collections.abc import Iterable

MAX_EXTRACTION_CHARS = 100_000


def extraction_within_budget(texts: Iterable[str]) -> bool:
    total = 0
    for text in texts:
        total += len(text)
        if total > MAX_EXTRACTION_CHARS:
            return False
    return True
