# AI capability status

Reviewed against the current checkout on 18 October 2026. This records what is
implemented in code, what is available to users, and what still needs provider
acceptance. It does not treat a route or a historical plan as proof that a live
model has been accepted.

| Capability | Current implementation | Availability and evidence |
| --- | --- | --- |
| Source-document fact proposals | `agent/llm.py` provides bounded extraction; `workflow/extraction.py` persists candidates for human review with quote, source and conflict checks. | `off`, recorded and bounded `live` modes exist. Live OpenAI quality acceptance is open; missing recordings never fall through to a provider. |
| Natural-language what-if proposals | `agent/llm.py` converts bounded language intent into a proposed fork. The production engine calculates the fork. | Deterministic fallback covers explicit supported requests; recorded/live modes are bounded. A person must still apply, review, confirm and evaluate the fork. |
| Financial evaluation and recommendations | The deterministic engine is the only source of calculations, feasibility and recommendation. | Implemented and persisted. A model cannot supply a figure, alter confirmed inputs or approve a decision. |
| Reply reading, clause readings, slot explanations, multilingual review (C2-C6) | Typed reply terms/conditions/stance, clause hypotheses tested on isolated engine forks, slot-only model wording of an explanation, language/script provenance and optional glosses. See `AI_WORKFLOW_PLAN.md`. | Off by default; recorded/live when configured. Verified only on recorded synthetic cases (`evaluation.md`); live OpenAI quality is open. Every AI output carries a provenance badge. |
| Explanations and exact message preparation | Engine-backed explanations, exact-term templates and constrained reply parsing are implemented in P5. | Available without a provider key. These are deterministic templates/parsers, not conversational generative drafting. |
| Risk and missing-information assistance | Evaluation already returns alerts, coverage gaps and value-of-information questions. The order page now presents them in a Decision guide with a route to the bounded what-if workspace. | Implemented in the current UI. The guide is read-only and displays existing evaluation facts only. |
| Choosing recipients, sending messages, approvals, payments or lending | Intentionally excluded from AI authority. | Human review and exact sandbox approval remain required; real external adapters are not in scope. |

## What this adds to the workflow

The review assistant now helps a user move from an evaluation to the next
useful step: understand the current decision, inspect risk or evidence gaps,
answer the highest-value open questions, or run a separate bounded what-if.
It does not make a financial calculation, change an order, or initiate an
action.

## Open acceptance work

The live provider path still needs an approved synthetic benchmark, adversarial
quality review, and explicit provider configuration before it can be described
as a verified live AI capability. Current evidence is recorded in
`docs/ai_assisted_website_review_2026-10-17.md` and
`docs/backend_implementation_progress.md`.
