"""Dependency-free, conservative source-language detection for review metadata."""

import unicodedata
from typing import Literal

Language = Literal["en", "bn", "hi", "zh-Hans", "other", "unknown"]


def detect(text: str) -> tuple[Language, str, bool]:
    """Return language, dominant Unicode script, and whether it is in the initial set.

    Mixed scripts and short/low-signal text deliberately remain unknown: this is a
    review guard, never a translation or model-routing decision.
    """
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
    total = sum(counts.values())
    if total < 4:
        return "unknown", "unknown", False
    script, count = max(counts.items(), key=lambda item: item[1])
    if count / total < 0.80 or sum(value > 0 for value in counts.values()) > 1:
        return "unknown", "mixed", False
    mapping = {"Latin": "en", "Bengali": "bn", "Devanagari": "hi", "Han": "zh-Hans"}
    language = mapping.get(script, "other")
    return language, script, language in {"en", "bn", "hi", "zh-Hans"}
