"""Dependency-free, conservative source-language detection for review metadata."""

import unicodedata
from typing import Literal

Language = Literal["en", "bn", "hi", "zh-Hans", "other", "unknown"]
SUPPORTED = {"en", "bn", "hi", "zh-Hans"}
_MAPPING = {"Latin": "en", "Bengali": "bn", "Devanagari": "hi", "Han": "zh-Hans"}


def _counts(text: str) -> dict[str, int]:
    counts = {"Latin": 0, "Bengali": 0, "Devanagari": 0, "Han": 0, "other": 0}
    for char in text:
        if not char.isalpha():
            continue
        name = unicodedata.name(char, "")
        if "LATIN" in name:
            counts["Latin"] += 1
        elif "BENGALI" in name:
            counts["Bengali"] += 1
        elif "DEVANAGARI" in name:
            counts["Devanagari"] += 1
        elif "CJK UNIFIED IDEOGRAPH" in name:
            counts["Han"] += 1
        else:
            counts["other"] += 1
    return counts


def detect(text: str) -> tuple[Language, str, bool]:
    """Return language, dominant Unicode script, and whether it is in the initial set.

    Mixed scripts and short/low-signal text deliberately remain unknown: this is a
    review guard (used for replies, where a destination or condition may hide in an
    unread language), never a translation or model-routing decision.
    """
    counts = _counts(text)
    total = sum(counts.values())
    if total < 4:
        return "unknown", "unknown", False
    script, count = max(counts.items(), key=lambda item: item[1])
    if count / total < 0.80 or sum(value > 0 for value in counts.values()) > 1:
        return "unknown", "mixed", False
    language = _MAPPING.get(script, "other")
    return language, script, language in SUPPORTED


def detect_page(text: str) -> tuple[Language, str, bool]:
    """Dominant-script detection for document pages and quotes.

    Real business documents mix a native script with Latin tokens (BDT, PO numbers,
    e-mail). A script that holds at least 60% of the letters names the page language;
    otherwise the page is "mixed". Only provenance and review attention use this.
    """
    counts = _counts(text)
    total = sum(counts.values())
    if total < 4:
        return "unknown", "unknown", False
    script, count = max(counts.items(), key=lambda item: item[1])
    if count / total < 0.60:
        return "unknown", "mixed", False
    language = _MAPPING.get(script, "other")
    return language, script, language in SUPPORTED


def quote_needs_language_review(quote: str) -> bool:
    """An unsupported script or a quote with no dominant script is held for a person.

    Short or numeric quotes (low signal) are not held: they carry no language to misread.
    """
    language, script, _supported = detect_page(quote)
    return language == "other" or script == "mixed"
