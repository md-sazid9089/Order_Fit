# ADR 0002: The model never calculates, checks constraints or authorizes

Status: proposed; extends [repo ADR 0003](../../../adr/0003-ai-never-types-numbers.md).

## Context

Language models make arithmetic errors, fabricate figures and follow instructions embedded in documents (OWASP LLM01, LLM05, LLM06, LLM09 `[W]`). A wrong figure in a message to a customer or supplier is the most damaging failure `[R: repo ADR 0003]`.

## Decision

1. The Decision Engine computes every monetary figure, date, constraint, ranking and alert. It is a pure library with no I/O, enforced by the existing architecture test `[R]`.
2. The model is a function from untrusted text to typed JSON or to placeholder text. It has no tools and sees no credentials, no Operation Log and no other tenant's data.
3. Extracted values are grounded: the quoted source text must occur in the document and parse to the value; arithmetic cross-checks are recomputed in code; the owner confirms every number.
4. Explanations and drafts are text with **named slots only**: code resolves each slot to a labelled phrase built from the evaluation, so a value cannot be attached to the wrong claim; any digit in any script, any number word (English, Bengali, Hindi), any URL or address marker and any unknown slot make the text unusable; the terms guard checks rates and terms against stored offers; the fallback is a deterministic template. (The first design checked each number for membership in a set of allowed numbers; the independent review showed that it passed swapped figures, sign flips, number words in other scripts and URLs, so the control was inverted.)
5. Approval is a human endpoint bound to the plan hash; there is no model-callable approval.

## Alternatives rejected

Letting the model compute "simple" figures (error-prone, unauditable); a model-based guard (a second unverified model); trusting model confidence scores (not independent validation `[R: strategy PDF section 5]`).

## Consequences

Prompts must be written around slots; the slot list per prompt is enumerated ([03](../03-system-architecture.md) section 6.1); an extraction that is plausible but wrong is caught only by grounding and the owner (stated as a known risk in [05](../05-security-and-evaluation.md)).

## Verification

UT-SLOTS, UT-GROUND, SEC-FRAUD, ADV-01 to ADV-15, UT-BRUTE.
