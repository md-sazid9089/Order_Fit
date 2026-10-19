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
