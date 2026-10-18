"""Injection scanner: flags imperative text aimed at the system inside documents
and replies (D-05, D-12). Flags only; never edits the document. Defense in depth:
typed permissions and effect separation remain the real boundary."""

import re

PATTERNS = {
    "OVERRIDE_INSTRUCTIONS": r"ignore (all |any )?(previous|prior|above) (instructions|rules)",
    "ROLE_CLAIM": r"\b(system prompt|you are now|act as (the )?(system|admin))\b",
    "APPROVAL_CLAIM": r"\b(auto[- ]?approve|approved by (the )?owner|skip (the )?(review|approval))\b",
    "EXFILTRATE": r"\b(send|email|post) .{0,40}(password|api key|token|secret)\b",
    "SET_VALUE": r"\b(set|change|update) (the )?(order value|amount|reserve|bank account)\b",
    "OVERRIDE_INSTRUCTIONS_MULTILINGUAL": r"忽略.{0,12}(指令|规则)|পূর্ববর্তী.{0,12}(নির্দেশ|নিয়ম)|पिछले.{0,12}(निर्देश|नियम)",
    "APPROVAL_CLAIM_MULTILINGUAL": r"自动批准|স্বয়ংক্রিয়.{0,8}অনুমোদন|स्वतः.{0,8}अनुमोदन",
}


def scan(text: str) -> list[str]:
    lowered = text.lower()
    return [code for code, pattern in PATTERNS.items() if re.search(pattern, lowered)]
