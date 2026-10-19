# UI/UX audit, fix and release ledger — OrderFit

Last updated: 19 October 2026, during Phase 8 (fix batches).

## Current state

- Work branch: `ui-release-2026-10-19`, created from `97ec81b`. `main` untouched. Nothing pushed.
- Untracked user files left in place: `FINTECHATHON_CONTEXT.md`, `docs/ui_ux_audit_prompt.md`, `fintechathon-demo-video/` (contains generated `.tts/tmp` cache; not product content). `PRODUCT.md` is new (Impeccable context, inferred facts labelled).
- Local-only, gitignored: `web/.env.development.local` points `next dev` at the audit API (`http://127.0.0.1:18000`). Delete with the stack.
- Live stack: `orderfit-audit-04bc5ec0` (disposable Compose project from `harness/start-audit-stack.ps1`), web on a random port, API published on 127.0.0.1:18000 only, `ALLOWED_ORIGINS` includes `http://localhost:3001` for `next dev`. Tear down: `powershell -File docs/ui_ux_audit_2026-10-19/harness/start-audit-stack.ps1 -Down`.
- Synthetic data: owner `owner.audit@example.test` (password only in this session; not stored), business "Audit Trading Co", orders AUDIT-1001 (ingesting) and AUDIT-1002 (evaluated, awaiting approval).
- Not mine, do not touch: containers `orderfit-visible-*`, `orderfit-film-*`, `orderfit-e2e-bdf81496e4-*`, `orderfit-audit-db-x7`, `orderfit-security-audit-*`; git worktrees under `.claude/worktrees/agent-*` were created by this session's writer agents, which stopped at the account rate limit before making changes (no commits beyond the branch tip).

## Commits on the work branch (oldest first)

| Commit | Summary |
|---|---|
| 641adb7 | e2e runner: Docker stderr no longer aborts Windows PowerShell 5.1 |
| c7980cd | Remove fabricated intake/validate/confirm/evaluation screens; restore real new-order page; /orders,/sandbox redirect |
| d0e0205 | Branded not-found, error and global-error boundaries (Next 16 `retry`) |
| df4be53 | Design-system foundations: tokens exposed to Tailwind, semantic tones, focus/selection/reduced-motion, primitives, money input |
| 817ea39 | One h1 per page; quiet list status; typed money on new/edit order; e2e specs enter major units |
| fa4c7f1 | Never assume owner role; failed secondary reads are shown with retry |
| 1b37129 | Error normalizer: copy table, request id, Retry-After, no leaked codes, malformed 2xx, key retention |
| 217d830 | Engine-only verdicts in cash series and overview; working overview retry; bounded polling |
| 4ffbb21 | Sign-in returns to the page; "expired" only when a session existed |

## Checks last run (this session)

- `npm run typecheck`: pass. `npm test`: 126/126 pass (baseline was 115). `eslint` on touched files: clean (repo baseline had 4 errors / 33 warnings in untouched files; not yet re-run repo-wide).
- Live (dev server on :3001 against the audit API): sign-up, baseline, new order with typed amounts (75,000.50 → 7500050), confirm and evaluate (worker succeeded), series table shows engine floor/status, fake PO-8841 → honest not-found, /orders → /deals, sign-out → sign-in?return → back to the order.
- Baseline Playwright at HEAD `97ec81b` + runner fix: 10 passed, 3 failed (document-upload, order-lifecycle, pagination) because the mock new-order page replaced the real one; restored in c7980cd, not yet re-run.

## Reports written

`findings.json` (initial live findings UX-001..011), `static-sweep.md` (98 static findings), `design-census.md`, `error-surface.md`, `design-direction.md`. REPORT.md, consistency.md, inventory.md and coverage.md are still to be written.

## Next steps (in order)

1. Admin area rebuild on `/api/v1/admin/*` with capability gating; remove hard-coded personal email (S0) and fabricated rows; accurate security copy.
2. Landing: remove fake newsletter success, correct overclaims (LangGraph, OCR, test counts, "re-plans automatically"), label the illustrative dashboard, scope Lenis/GSAP to the landing page, remove dead hero file.
3. Account access: sync `web/lib/generated-api.d.ts` from backend export; forgot/reset/verify/invitation UI behind capability flags.
4. Workspace page migration: pipeline (mobile cards, KPI tiles), order detail (one primary action, overflow actions, journey), sources/cash-flow/payees/settings/users/audit/financing/risk/customers/documents/negotiate; raw hex → tokens; developer copy ("integer minor units", raw enums).
5. Tests: fault-matrix, responsive and axe Playwright specs; then the full Phase 9 gate on a fresh stack; REPORT.md and RELEASE-READINESS.md.

## Continuation batch — 19 October 2026

Resumed at be85c2b on ui-release-2026-10-19, no tracked user changes. Read handoff, assignment, scoped instructions and product. Graph project is OrderFit; initial query under Order_Fit failed, corrected query returned insufficient nodes; direct reads used for named files.

Disposable harness first built successfully but failed binding occupied port 18000; removed only that new project (5ec8dbb4). Restarted successfully as orderfit-audit-a16e1bc8, web localhost:51274, API loopback:18071. Shared backend/.env and provision_admin.py never used. Existing service on 18000 untouched.

In progress, not release accepted: pipeline PageHeader/StatTile and mobile cards; saved evaluation read failures now reject instead of masquerading as unevaluated; order detail one h1, OrderJourney, collapsed secondary actions, warning acknowledgment gate, 120-second poll ceiling. Preparation/documents now use OrderJourney; retired legacy stepper. Sources and cash corrections use exact currency input; documents label enums and suppress extracted-empty on errors. Migrated named workspace/layout colors to semantic tokens. Connection status moved into normal-flow accessible footer. Download error envelopes preserved and bounded. Removed proven-unimported recharts and tsparticles packages; added axe browser checker.

Executed checks: typecheck passed after migration; unit suite passed 130/130 including new saved-evaluation failure regression. Production web image rebuilt successfully against disposable API. Browser opened live signup; synthetic owner creation started. Full width/theme checks, complete E2E and Phase 9 remain pending. These changes are not yet marked verified or committed.

First fresh-stack suite (orderfit-e2e-dd4e3a7ee4): 11 passed, 6 failed. Failures exposed the existing non-admin redirect regression, auth placeholder contrast 2.875 (<4.5), OrderJourney min-content overflow at 320/390, and the document test's now-obsolete raw enum label. Product fixes retain authoritative admin denial and session, return to pipeline with a permission explanation, restore full placeholder contrast, and wrap journey steps. Document assertion now checks the same source role/status in readable copy; no assertion removed. Fault-matrix and error-never-empty tests passed. CSP, passkeys, pagination and controlled pipeline performance passed; pipeline median 1775ms with 150ms injected latency. Failed stack removed by runner. A focused rerun is in progress on the interactive disposable production stack.

The generic JSON transport must preserve valid JSON null (existing regression test); malformed *collection* shapes are rejected at their owning loaders instead of changing the generic nullable contract. Removed global dark !important overrides after semantic migration. CSV duplicate confirmations now collect row-bound explicit reasons and preserve reviews; manual cash create and saved-pair reconciliation UI added. No backend schema, financial formulas or security policies changed.

Transport batch acceptance: 131/131 unit tests pass, typecheck passes, repository lint exits 0. Real-browser injected pipeline failures (offline, timed-out connection, 403/404/409/422/429/500/502/503, HTML error, malformed collection, 401 redirect) and supporting-list error-never-empty checks pass. Saved-evaluation 404/409/503 regression and export-integrity/request-reference regression pass. Valid nullable JSON transport contract preserved. Commit this transport slice independently; full application release acceptance remains pending.

Live role sweep now passes actual invitations/acceptance, verified memberships and API member-list denial for viewer, auditor, commercial lead and risk officer, each visiting eleven routes at 390px in light/dark. Empty workspace 320–2560 + axe sweep passes twelve routes in both themes. Populated document workflow passes its width/theme/axe checks. Populated evaluation found decision-guide sky surfaces; source fix queued in the current production rebuild. Local npm ci restored successfully after stopping only the identified OrderFit next-dev server. No test assertions were dropped or skipped; source-role and back-link selectors follow the new human-readable labels.
