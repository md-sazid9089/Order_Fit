# OrderFit app reliability — 17 October 2026

Scope: user-requested hands-on testing and repairs, starting from clean `main`
at `8a9d1c2`. All test accounts, financial inputs and effects are synthetic.
This is local sandbox evidence, not live model or hosted release acceptance.
Stakes are high for financial correctness and authorization; effects in this
test environment are sandbox-only.

## Reproduced defects and repairs

1. **Uncertain server failures discarded write identity.** The browser transport
   released its persisted command key for every HTTP error. A gateway 502 can
   arrive after the underlying write commits, so a repeated action received a
   different identity. A failing transport regression demonstrated different keys
   before the repair. Retain keys for HTTP 5xx, as already done for lost network
   responses; definitive 4xx rejections still release them. Exact retries remain
   bound to the same method, path and payload digest across reload. No automatic
   retries, new permissions or financial formulas were introduced.
2. **Empty error bodies obscured recovery.** JSON `null` produced a TypeError;
   non-JSON gateway errors displayed only `Request failed (500)`, reproduced on
   sign-in while the API was unavailable. Null error bodies now use the normal
   API-error path. Unstructured 5xx responses explain temporary service
   unavailability and suggest repeating the same action. Structured server
   messages, status and error codes remain available.
3. **Runner assertion was stale.** A frontend test still expected space-separated
   command arguments after the PowerShell runner adopted an argument array.
   Check both the actual array and its use in the npm invocation; keep the
   existing private-image, private-output and cleanup assertions.

## Failure map and catching checks

| Failure | Catch and evidence boundary |
|---|---|
| Invalid/unsupported document or conflicting facts | Bounded parsing, strict candidate contracts, exact source-quote checks and authenticated field review; focused P4 tests are provider-free. |
| Hallucinated terms, numbers or injected document instructions | Evidence guards, typed language output, engine fact slots and one deterministic calculation boundary. No live-model quality claim follows from guard tests. |
| Wrong tenant, recipient, stale revision or malformed command | Server session/RLS, version checks, immutable exact bundles and HTTP negative tests. Client display is not approval authority. |
| Lost response or proxy failure after commit | Persist the exact command key; transport tests cover 500/502/503/504 and reload. Browser lifecycle now injects 502 after draft admission and checks the same key and draft ID on retry. |
| Worker failure, provider timeout or bounded retry exhaustion | Durable operations, fencing, worker readiness and explicit unavailable/manual-input outcomes. Technical errors must not become financial rejection. |
| Accidental or repeated effects | Separate human review and session-bound approval for exact sandbox bundles; browser journey checks send, reply, exact acceptance, commit, reload and compensation. |
| Silent UI failure or inaccessible recovery | Real-proxy browser tests, failed-read recovery, CSP, focus/contrast, mobile navigation and unit checks. These checks do not cover every screen. |
| Runaway model/job work | Existing bounded provider time/output/concurrency/attempt settings and durable job policies; no new agent loop or live fallback. |

## Evals, human gates and rollout

Invest first in authorization, source fidelity, integer financial semantics,
idempotency and recovery. Gate extracted-input confirmation, exact outgoing
content, party acceptance, commitment and compensation with the existing human
controls. Routine reads, parsing and proposed candidates can run without extra
approval. Real email/payment/lender execution remains outside this sandbox scope.

For a future separately configured live-provider evaluation, score representative
and difficult source cases: correct money/units/dates, ambiguous date basis,
conflicting documents, missing values, unsupported formats, injection attempts,
refusal, truncation, invalid schema, rate limit and timeout. Measure exact field
accuracy, supported-quote rate, ambiguity/abstention, latency and bounded cost.
Require zero unauthorized effects and zero unsupported candidates promoted to
confirmed inputs; benchmark model quality independently before setting its
quality threshold. Guard/recorded tests alone are not extraction-quality evals.

Roll out through synthetic sandbox testing, then shadow proposals with human
review, then limited reviewed workloads. Expand only after measured quality and
recovery evidence. Monitor unavailable/stale operations, exhausted attempts,
approval denials and duplicate-effect invariants without logging private source
text or secrets. Hosted storage/roles, provider quality and restore acceptance
remain the previously documented release gates.

## Environment and verification

Initially neither the app nor Docker engine was reachable. Started the frontend
and inspected its real unavailable sign-in state. Docker Desktop crashed on two
stale Unix-socket directories; stopped the crashed Desktop processes, moved those
runtime directories to uniquely named local backups and restarted Desktop.
No factory reset, volume purge, application secret edit or shared migration ran.
Then used the repository runner's fresh disposable PG17 database, restricted
API/worker logins, private image tags and synthetic users. Browser account creation
and the authenticated pipeline were also inspected directly through the in-app
browser.

Compose's worker remains configured with LLM off on its isolated
network. Live AI was not enabled or sent documents during this work.

Executed checks:

- Backend provider-free suite: `uv run --frozen python -m pytest tests
  --ignore=tests/db --ignore=tests/e2e -q --tb=short -p no:cacheprovider`:
  **366 passed**, one Starlette/httpx deprecation warning, 255.81 seconds.
  This command does not establish the separate DB regression suite.
- Frontend `npm test`: **100 passed**; `npm run typecheck`: passed.
- Frontend lint: **zero errors, 68 existing warnings**. Backend Ruff and generated
  contract check: passed, 112 operations.
- Initial built-stack browser suite: **7 passed in 1.9 minutes** before the new
  proxy-failure scenario. A second run had **6 passed, 1 failed** because the new
  test incorrectly expected creation status 201; the actual route contract is
  explicitly 200. A third run had **6 passed, 1 failed** on an ambiguous alert
  locator (the form error and Next's route announcer). Scoped the assertion to
  main content without weakening the expected error, ID or command-key checks.
- Final fresh-image run: **7 passed in 1.8 minutes**. The order lifecycle passed
  in 26.1 seconds, including the new post-save 502, same-key/same-draft recovery,
  evaluation, exact approvals, send, reviewed replies, commit, reload and inverse
  compensation. Passkeys, continuation, CSP, focus/contrast, mobile/CSRF recovery
  and tenant HTTP checks also passed. Its sustained synthetic probe completed
  7,462 requests in 60.05 seconds with no 5xx; this is local observational data,
  not a production capacity guarantee. Final API and web production image builds
  passed. The runner removed its own containers, volumes and private image tags.
  Evidence: `C:/Users/moham/AppData/Local/Temp/orderfit-e2e-a640bcc789-results/`.

No full backend DB-suite, live-provider, hosted or restore pass
is claimed by combining these results.
