# Handoff: OrderFit UI/UX audit, fix and release (continue from here)

Written 19 October 2026 at the end of a Claude Code session. Give this whole file to the next agent (Codex or otherwise).

## 1. The assignment

Execute `docs/ui_ux_audit_prompt.md` (untracked in the repo root's `docs/`; read it in full): a full UI/UX audit of `web/`, then fix **every** S0/S1/S2 finding, then prove release readiness with the Phase 9 gates (A–E) and write `RELEASE-READINESS.md`. The requester asked for fully autonomous work with no further questions and the highest design quality ("Apple/Notion-grade": calm, consistent, honest, complete). Read `AGENTS.md`, `web/AGENTS.md` (Next.js 16.4 here differs from training data: read `web/node_modules/next/dist/docs/` before using a convention), `backend/AGENTS.md`, and `PRODUCT.md`.

Non-negotiable product rules: the deterministic engine owns every number (no browser financial arithmetic or derived verdicts); AI only proposes; humans approve; every effect is sandbox-only; never fake a save, delivery or result; never weaken auth, tenant isolation, approvals, idempotency, stale-input checks or audit; never loosen CSP.

## 2. Repository state

- Branch `ui-release-2026-10-19`, created from `main` at `97ec81b`. **14 commits, nothing pushed, nothing merged.** `main` is untouched.
- Commits (oldest → newest): `641adb7` e2e runner fix · `c7980cd` remove fabricated intake/confirm/evaluation screens · `d0e0205` route boundaries · `df4be53` design-system foundations · `817ea39` one h1/page, money input · `fa4c7f1` no assumed owner role · `1b37129` error normalizer · `217d830` engine-only verdicts, overview retry, bounded polling · `4ffbb21` sign-in return path · `d015064` generated contract sync · `819e16a` admin rebuild · `d26c944` honest landing + motion scoping · `20e7804` account access UI · `dff4f57` sign-in/sign-up on shared auth frame. A final commit adds this handoff, `PRODUCT.md` and the audit folder.
- **Commit messages must carry no Co-Authored-By / Claude / AI attribution** (requester's standing preference).
- Untracked user files to leave alone and never commit: `FINTECHATHON_CONTEXT.md`, `docs/ui_ux_audit_prompt.md`, `fintechathon-demo-video/` (contains generated `.tts/tmp` cache).
- `.claude/worktrees/agent-*`: two empty git worktrees left by writer agents that stopped at a rate limit before changing anything. Safe to remove: `git worktree remove .claude/worktrees/<name>` then delete their `worktree-agent-*` branches.
- **Open request from the user, not done:** earlier they said "follow atomic push and push everything to main". It was not executed because "everything" includes generated cache in `fintechathon-demo-video/` and the review/fix work was unfinished. Ask the user (or decide carefully) before pushing; never push the cache. A reasonable path: finish, then open a PR from `ui-release-2026-10-19` or fast-forward `main` only if they confirm.

## 3. Environment (disposable only)

- **Never use `backend/.env`** (points at the shared Neon database). **Never run `scripts/provision_admin.py`**: it loads `backend/.env` with `override=True` and would modify shared data. Record this hazard in the report (INFRA finding).
- Disposable stack used for the live audit: Compose project `orderfit-audit-04bc5ec0`, started by `docs/ui_ux_audit_2026-10-19/harness/start-audit-stack.ps1` (random secrets in `%TEMP%`, LLM off, filesystem storage, API published only on `127.0.0.1:18000`, `ALLOWED_ORIGINS` includes `http://localhost:3001`). State file: `%TEMP%\orderfit-audit-stack.json`. Admin reads were enabled on that API by adding `ADMIN_READS_ENABLED: "true"` to the temp override and recreating `api`.
  - Stop and remove: `powershell -NoProfile -ExecutionPolicy Bypass -File docs/ui_ux_audit_2026-10-19/harness/start-audit-stack.ps1 -Down`
  - Start fresh: same command without `-Down` (~3–5 min build). It does not enable admin reads; edit the generated override if needed.
- `web/.env.development.local` (gitignored, written by this session) points `next dev` at `http://127.0.0.1:18000`. Delete it when the stack is removed. `.claude/launch.json` config `web` runs `npm --prefix web run dev` on port 3001. Restart the dev server after env changes (rewrites are read at startup).
- Synthetic data on that stack: one owner account on the `.test` domain (platform admin flag set directly in the disposable DB with `docker exec orderfit-audit-04bc5ec0-db-1 psql -U orderfit_migrator -d orderfit ...` after verifying the container's compose project label), business "Audit Trading Co", orders AUDIT-1001 (draft) and AUDIT-1002 (evaluated). Create your own synthetic users; don't reuse credentials from transcripts.
- Containers you must not touch (not ours): `orderfit-visible-*`, `orderfit-film-*`, `orderfit-e2e-bdf81496e4-*`, `orderfit-audit-db-x7`, `orderfit-security-audit-*`, stopped `orderfit-api-1`/`orderfit-worker-1`.
- `scripts/run-e2e.ps1` runs the whole Playwright suite on a fresh project and **tears down if any test fails** (the `-BrowserReviewGate` only applies after a pass). Fixed in `641adb7` to work on Windows PowerShell 5.1.
- Tooling gotcha: in the Bash tool, heredocs containing apostrophes sometimes fail to parse; write scripts to a file and run them instead.

## 4. What was found (reports in this folder)

- `findings.json`: first 11 live findings (UX-001..011). Not yet updated with final statuses or the many later findings.
- `static-sweep.md` (98 static findings: 1 S0, 20 S1, 46 S2, 31 S3), `design-census.md` (raw hex 2,279 uses vs 24 token uses, 172 hand-rolled buttons, etc.), `error-surface.md` (code → copy table, client gaps, contract drift), `design-direction.md` (adopted design system), `PROGRESS.md` (ledger; update it as you go).
- Baseline before fixes: typecheck pass; lint 4 errors / 33 warnings repo-wide; unit 115/115; Playwright at HEAD 10 passed, 3 failed (document-upload, order-lifecycle, pagination) because recent commits had replaced the real new-order page with a mock.

## 5. What is fixed and verified

Verified live in the browser against the disposable stack unless noted.

- **Trust (S0):** fabricated "AI document intake", sample files, hard-coded Apex figures, browser profit/margin, `localStorage` pseudo-orders, fake "Audit Verified" confirm, simulated evaluations on failed loads, and an always-on "Feasibility Evaluation Complete / Counter-Offer Recommended" banner are gone. The real new-order page (from `7860863`) is restored; `/deals/new/validate`, `/deals/[id]/confirm`, `/orders`, `/sandbox` redirect.
- **Engine-only numbers:** cash series table uses engine `effective_floor_minor` and breach periods; overview delay cards no longer compute headroom or show an arbitrary progress bar.
- **Admin:** hard-coded personal email that granted "Admin" removed; all pages rebuilt on `/api/v1/admin/*` with capability gating (disabled / unavailable+request id+retry / ready), accurate security page, sign-out in admin mode, retry for the by-design NOWAIT 503.
- **Errors:** `web/lib/error-copy.ts` + `ApiError` (requestId, retryable, retryAfterSeconds, details); no codes in user copy; malformed 2xx detected; idempotency key kept for in-progress/timeout/malformed.
- **Auth:** return path after 401; "session expired" only when a session existed; sign-in/up/forgot/reset/verify on `components/auth/auth-frame.tsx`; account-access UI behind capability flags; invitation history/reissue/revoke/delivery; invited-account registration.
- **Foundations:** tokens exposed to Tailwind in `web/app/globals.css` (primary, card, muted, ring, success/warning/danger/info + soft), focus ring, selection, reduced motion, `.tabular`; primitives in `web/components/system/` (PageHeader, Panel, StatTile, StatusBadge, InlineAlert, EmptyState, ErrorState, MoneyField, OrderJourney); `components/ui/button.tsx` 40px; `components/p7/common.tsx` migrated (PageFrame intro restored); one `<h1>` per page; money typed in currency (`lib/money-input.ts`).
- **Landing:** fake newsletter removed; overclaims corrected; example dashboard labelled; Lenis/GSAP/progress bar only on `/`; dead 3,480-line hero deleted.
- Route boundaries: `web/app/not-found.tsx`, `error.tsx`, `global-error.tsx`.
- Last checks: `npm run typecheck` pass, `npm test` 129/129, eslint clean on all touched files. Contract `--check` passes (134 operations). **Playwright has not been re-run since the fixes**; e2e specs were updated to type major units (`100000.00`, `50000.00`) and select sign-up fields by exact label.

## 6. What remains (do in this order)

1. **Workspace page migration to the design system** (largest remaining design debt; S2):
   - Pipeline `web/app/deals/page.tsx`: KPI tiles → `StatTile` (values wrap at 1280px; "No loaded alerts" set at display size); orders table has `min-w-[760px]` → card list under 768px; four KPI cards fill the first phone screen.
   - Order detail `web/app/deals/[id]/page.tsx`: two `<h1>` ("Order Review & Evaluation" and the reference) — make the reference the only h1 via `PageHeader`; replace `DealsWorkflowStepper` with `OrderJourney`; one primary action, overflow for the other six link-buttons; raw hex → tokens; dense one-line JSX.
   - `components/preparation-workspace.tsx` (negotiate/reply): still uses `DealsWorkflowStepper` and labels like "Confirm Terms Gate", "Step 4: Compute Engine"; then delete `components/deals/deals-workflow-stepper.tsx`.
   - `web/app/deals/sources/page.tsx` (very dense): money fields still "integer minor units" → `MoneyField`; `components/cash/cash-event-actions.tsx` same.
   - `web/app/deals/[id]/documents/page.tsx`: raw enum options (`po`, `customer_order`) → labels (keep submitted values).
   - Risk constraints and financing pages: raw enum text ("independence customer", "base"); empty states without next action.
   - Audit log: "by you (T3)" jargon; Title Case operation names.
   - Shell (`components/layout/auth-shell.tsx`, `app-sidebar.tsx`): raw hex, business switcher truncation on phones, floating ConnectionIndicator overlaps content.
   - Codemod raw hex in workspace components to tokens (see census table for the mapping, e.g. `#E8E6E1`→`border-border`, `#1E2021` text→`text-foreground`, dark `#1E2021` card→`bg-card`); remove `html.dark` `!important` override block in `globals.css` once components use tokens.
2. **Remaining S1s from `static-sweep.md`:** check each is fixed; known still-open: error-as-empty in some lists (e.g. `lib/pipeline-data.ts` turns 404/409 into "Not evaluated"), deal-page operation poll lacks bounded retry, `UNACKNOWLEDGED_WARNINGS` pre-submit gating, passkey panel raw errors, download errors mislabelled (`lib/p7-api.ts:73` maps any 409 to EXPORT_EXPIRED), CSV duplicate-review dead end (`BASELINE_DUPLICATE_REVIEW_REQUIRED`).
3. **Remove unused deps** (`recharts`, `@tsparticles/*` reported unused; Playfair font import in `globals.css` if unused) after grep confirmation; run `npm --prefix web ci`.
4. **Tests to add** (Phase 8 list): Playwright fault-matrix (network down, timeout, 401/403/404/409/422/429/5xx, non-JSON, malformed), list "error is never empty", responsive sweep across 320–2560 (scrollWidth, tap targets), axe sweep light/dark, admin guard (signed-out, non-admin, backend down). Harness helper: `harness/measure-page.js`.
5. **Run everything:** `./scripts/run-e2e.ps1` (fix failures at their cause; never skip or loosen), full live journeys from prompt §3.4 per role (create users for viewer/auditor/commercial lead/risk officer/owner), dark mode, 390px, keyboard-only.
6. **Write deliverables:** `REPORT.md` (scorecard, findings with final status, workflow map, mock register, backend/contract register), `findings.json`/`.csv` updated, `inventory.md`, `coverage.md`, `consistency.md`, `RELEASE-READINESS.md` (all Phase 9 gate commands and results, known limitations, deploy/rollback notes, changelog). Update `docs/backend_implementation_progress.md` / `.agents/skills/orderfit-development-context/SKILL.md` only if material facts changed.
7. **Phase 9 gate** on a fresh disposable stack: `npm --prefix web ci`, typecheck, lint (repo-wide; the 4 pre-existing lint errors are in untouched files — fix them), test, build, web Docker image build, backend `uv run --frozen python -m orderfit.contracts.export --check`, `python docs/architecture/orderfit/fixtures/reference_engine.py --check`, full Playwright via `run-e2e.ps1`, Lighthouse/perf numbers for `/` and the pipeline, CSP spec. Then tear down the stack, delete `web/.env.development.local`, remove empty worktrees, confirm `git status`.

## 7. Backend items found (report; fix only if small and safe)

- `scripts/provision_admin.py` targets `backend/.env` (shared DB) by default — hazard.
- Admin reads lock the session row `FOR UPDATE NOWAIT` (`backend/migrations/sql/0021_admin_reads.sql:44`); concurrent admin reads from one session return retryable 503 by design. UI retries; do not change the lock.
- `ParseResult.error_code` (TOO_MANY_PAGES, ENCRYPTED, …) is not exposed in `DocumentView`, so the UI can only say "failed".
- Validation errors carry no `details.field`, so fields can't be highlighted.
- Dev-only: 55 CSP "inline script" console errors under `next dev`; confirm they are absent in the production build (`web/tests/e2e/security-csp.spec.ts`).
