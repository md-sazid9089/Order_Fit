# Workflow alignment with the initial implementation plan

Reviewed on 18 October 2026 against the current `main` checkout, the initial
backend implementation plan, current code/contracts, the implementation
progress record, and the QA/frontend handoff.

The initial plan is explicitly a historical implementation handoff for commit
`a0608e6`. Its stated product workflow and safety invariants remain the intended
contract. Its old repository paths, file-presence claims and preparation-time
acceptance status do not describe the current tree.

## Verdict

The shipped business workflow matches the initial plan's required sequence:

1. authenticated, tenant-scoped business selection;
2. manual or supported-document input with evidence review;
3. immutable confirmation and a durable deterministic evaluation;
4. persisted result, explanation, gaps and risk review;
5. isolated what-if exploration;
6. exact reviewed negotiation/reply handling;
7. separate step-up approval for sandbox actions;
8. required acceptance and separate commitment approval;
9. sandbox settlement, compensation and reconciliation; and
10. decision/audit export with refresh and recovery support.

The current Decision guide is compatible with the plan. It presents stored
engine facts, alerts, coverage gaps and clarification questions; it does not
create a second calculation, approval or authority path.

## Step-by-step mapping

| Initial-plan requirement | Current workflow | Alignment |
| --- | --- | --- |
| Sign in, select an authorized business, load settings/baseline/payees/offers | Cookie session, membership-backed business selector, role-aware navigation, source/finance/payee pages | Aligned |
| Saved manual or source-document draft; review missing/conflicting facts | New order, document upload/extraction, candidate quote/page review, CSV preview/confirm and manual fallback | Aligned; OCR/DOCX/XLSX remain intentionally deferred |
| Confirm immutable snapshot; calculate through durable operation | Review findings, explicit confirmation, saved operation polling, sole deterministic compute boundary | Aligned |
| Show baseline, strategies, stress, assumptions, gaps and sensitivity | Persisted evaluation plus exact-result inspection, series, explanations and Decision guide | Aligned; QA should ensure every field remains understandable rather than relying on raw JSON alone |
| Typed/natural-language what-if as a separate fork | Typed changes and bounded language intent; deterministic fallback; explicit later apply/review/re-evaluation | Aligned |
| Exact draft, reauthentication and approved sandbox dispatch | Exact templates/drafts, current review, bundle hash, session-bound step-up and sandbox execution | Aligned |
| Reply review, recompute, invalidate stale approvals | Persisted reply review and same confirmed-input pipeline | Aligned |
| Exact acceptance, separately approved commitment and reconciliation | Required acceptance evidence, distinct commit bundle, commitment gate, engine-derived baseline projection and compensation | Aligned |
| Refresh/restart/export/audit | Durable operation recovery, exports and audit chain; disposable browser lifecycle evidence records reload/recovery | Aligned locally |

## Deliberate deviations and open gates

| Topic | Current state | Plan relationship and required follow-up |
| --- | --- | --- |
| Frontend path | Current application is `web/`, while the historical plan names `frontend/`. | Reconciled in the plan's own current-state warning. Use `web/` only. |
| AI drafting and live quality | Extraction and what-if provider boundaries exist; drafts/explanations/reply parsing are deterministic templates/parsers. Live provider quality is unaccepted. | Consistent with the plan's explicit off/recorded/live boundary and quality gate. Do not market template behavior as verified live AI. |
| P4 documents | Supported text PDF/TXT/CSV/JSON, guarded extraction and human review are integrated. | Plan scope is met locally; independent adversarial/live-model acceptance remains open. |
| P8 hosted operation | Local/disposable readiness and browser evidence exist; provider, storage, restore and hosted acceptance remain open. | Still an open plan gate. Local success must not be reported as hosted acceptance. |
| Platform administration | `/admin/*` layout is deliberately hard-disabled; the app does not expose a cross-tenant console. | This remains outside the plan's business-scoped workflow. Keep disabled unless a new contract, authorization model and verification scope are approved. |
| Legacy routes | `/orders` and `/sandbox` return an honest unavailable notice; `/users` redirects to `/useraccess`. | Consistent with the rule that enabled UI must do persisted work or say why it is unavailable. |
| Real external effects | No real email, payment, bank or lender adapter exists. | Deliberately deferred; sandbox-only behavior matches the plan. |

## Documentation reconciliation completed in this review

The QA handoff now states that `/admin/*` is disabled rather than describing it
as an active platform-admin surface. The development-context handoff now reflects
the later recorded browser evidence for the full sandbox lifecycle and 15-route
desktop/mobile sweep. Neither documentation correction changes application
behavior or closes the remaining P4/P8 external gates.

## Recommended next work

1. Have QA execute the fresh disposable-stack journey in
   `docs/workflows.md`, including every role and stale/retry
   boundary. Treat failures in the core order-to-commit path as P0/P1.
2. Keep platform administration disabled. If it becomes a product requirement,
   write and approve its cross-tenant authorization, audit, data-retention and
   operational contracts before enabling the existing screens.
3. Run a separately authorized synthetic live-model evaluation before enabling
   or claiming live AI quality. Include adversarial document and prompt-injection
   cases with provenance and manual-recovery checks.
4. Complete P8 hosted acceptance with the intended storage, database pooling,
   worker, backup/restore and provider controls. Do not reuse a shared database
   for destructive acceptance tests.
