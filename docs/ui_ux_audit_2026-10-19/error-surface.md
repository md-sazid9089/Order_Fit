# OrderFit error surface audit (backend codes → frontend copy)

- Date: 2026-10-19 · Branch `ui-release-2026-10-19` @ `d0e0205` (working tree as found)
- Evidence level: **STATIC**. Read source only. No servers run, no requests sent, no tests run. Where a runtime outcome is inferred from code (not observed), the text says "static inference".
- Scope: `backend/orderfit/**` (error raising), `web/app`, `web/components`, `web/lib` (error display), `web/lib/generated-api.d.ts` vs `docs/contracts/frontend-api.d.ts` / `docs/contracts/openapi.json`.

---

## 0. How an error reaches the screen

### 0.1 Backend producers

| Producer | Location | Envelope | `retryable` | Headers |
|---|---|---|---|---|
| `ApplicationError(status, code, message="The request could not be completed.")` | `backend/orderfit/api/errors.py:17` | `{"error":{code,message,request_id,details,retryable}}` | `status in {429,503}` (errors.py:122) | `Retry-After: 60` on **every** 429 (errors.py:126) |
| `RequestValidationError` | errors.py:100 | `INVALID_INPUT` 422, message "Check the request fields.", `details` **empty** (no `field`) | false | — |
| Starlette `HTTPException` (router 404/405/other) | errors.py:103-106 | `NOT_FOUND` / `METHOD_NOT_ALLOWED` / `REQUEST_REJECTED` | per status | — |
| `DBAPIError` → `sql_error_contract(SQLSTATE)` | errors.py:107, `contracts/protocol.py:149-173` | curated code, message "The database could not complete this request." | per status | — |
| Anything else | errors.py:110 | `DEPENDENCY_UNAVAILABLE` 503 | true | — |
| ASGI body-limit middleware `_error(...)` | `api/main.py:44-66, 186-226` | same shape, **retryable set explicitly** | 408 → true, 413 → false, 429 → true, 503 → true | `Retry-After: 5` (UPLOAD_CAPACITY), `Connection: close` (408) |

Important facts for UI copy:

- **About 85% of raise sites pass no message**, so the server message is the generic default "The request could not be completed." Any screen that shows `error.message` verbatim shows that sentence, which tells the user nothing.
- Retry-After is a fixed 60 s for all handler 429s (AUTH_RATE_LIMIT, AUTH_CAPACITY, OPERATION_CAPACITY, PARSER_CAPACITY). The real throttle window is not reflected.
- CORS (`main.py:314-319`) sets no `expose_headers`. In a cross-origin deployment (`NEXT_PUBLIC_API_URL` set), the browser hides `Retry-After`. The default same-origin Next rewrite (`web/next.config.ts:50-51`) does not have this problem.
- `retryable: true` is also sent for 503 codes that are **configuration states, not transient**: `ACCOUNT_EMAIL_UNAVAILABLE`, `MFA_NOT_CONFIGURED`, `ADMIN_DATA_UNSUPPORTED`, `EXPORT_INTEGRITY_FAILURE`, `DOCUMENT_INTEGRITY_FAILURE`. Retrying cannot fix them.

### 0.2 Frontend handlers (legend used in the table)

| Tag | Function | What the user sees |
|---|---|---|
| **P7** | `describeP7Error` (`web/lib/p7-model.ts:97`) | If the code is in `P7_MESSAGES` (p7-model.ts:52-92), that copy. Otherwise falls through to **APR**. |
| **APR** | `describeError` (`web/lib/approval-model.ts:89`) | Order of checks: NetworkError/Abort → "The connection was lost, so the outcome is unknown…". 401 other than INVALID_CREDENTIALS → "Your session expired…". Code in `MESSAGES` (approval-model.ts:20-73) → that copy. **G403**: "Your role is not permitted to do this." **G409**: "The saved state changed (`CODE`). Reloaded the latest; review it before trying again." (shows the raw code). **G429**: "Too many attempts. Wait a moment before trying again." **G503**: "The service is temporarily unavailable. Retry shortly." **RAWC** (any other status): `` `${code}: ${message}` ``, e.g. "NOT_FOUND: The request could not be completed." |
| **MFC** | `messageForCode(code, message)` (approval-model.ts:75) | The APR map copy if known, otherwise **RAWC** `CODE: message`. No status fallbacks at all (a 403/409/503 is shown as `CODE: …`). |
| **RAW** | `e.message` | The server message verbatim (usually "The request could not be completed."). For non-JSON bodies, the client-made fallback "Request failed (NNN)" or "The service is temporarily unavailable. Retry the same action when it recovers." |
| **SIGNIN** | `app/auth/signin/page.tsx:47-51` | **Any** 401 → "Invalid email or password.", else RAW |

Screen groups:

- **S-P7**: screens built on `useCommand` / `QueryError` (`components/p7/common.tsx:89-124`). These are Settings, Users/user access, Payees, Customers, Financing, Risk constraints, Cash flow, Cash-event actions, Audit log, Notification bell, Archive actions and Admin capabilities. The same handler is also used by `/deals/[id]` (`explain()` at page.tsx:60), `/deals/sources` (`run()` at page.tsx:40), `/deals/[id]/documents` (`run()` at page.tsx:53), accept-invitation, bank-hold and the `/admin/users` toasts.
- **S-APR**: the bundle approval/execution panels (`use-bundle-flow.ts:48-52`, approval-controls, approval-workflow, bundle-flow-panel). These are mounted inside the preparation workspace on `/deals/[id]/negotiate` and `/deals/[id]/reply`.
- **S-PREP**: preparation-workspace commands (`components/preparation-workspace.tsx:106`, MFC). Execution action failures use the same handler (`components/approval/execution-status.tsx:22`, MFC). Run-level failures show "message (CODE)" (execution-status.tsx:16).
- **S-RAW**: signup (`signup/page.tsx:82`), `/deals/new` (page.tsx:99,128,174), pipeline `/deals` (page.tsx:46), `/overview` (page.tsx:65), `/deals/[id]` input save (page.tsx:154), auth-shell sign-out (auth-shell.tsx:105), passkey panel (passkey-panel.tsx:27), `/admin/logs` toast (logs/page.tsx:93), every `CollectionPages` list (`components/collection-pages.tsx:34`), preparation-workspace loads (lines 62, 78, 82, 98, 271, 294), the evaluation-inspector series (deal-evaluation-inspector.tsx:524) and approval history (approval-workflow.tsx:31).

---

## (a) Code table

Columns: **Code** · **HTTP** · **Retryable** (envelope) · **Origin** (backend file:line; paths relative to `backend/orderfit/`) · **Current UI handling → screens** · **Recommended user-facing copy**.

Copy principle used: say what happened, what it means for the user's data, and the next step. Never show internal codes, "bundle hash", "revision", "lease" or "minor units".

### a.1 Sign-in, session, security

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| INVALID_CREDENTIALS | 401 | no | services/identity.py:208 (signin), :339 (password change), :431 (step-up); services/account_access.py:89; services/passkeys.py:50 | Excluded from session-expiry (`orderfit-api.ts:18`). Shown differently in 4 places. SIGNIN "Invalid email or password." P7 (settings password) "The current password was not accepted. Your password was not changed." APR (step-up) "The password was not accepted. Nothing was approved." RAW passkey panel "Verification failed." | Sign-in: "That email and password don't match. Check both and try again." Password change: "Your current password wasn't accepted, so nothing changed." Approval: "That password wasn't accepted, so nothing was approved." Passkey: "That password wasn't accepted, so no passkey was added." |
| AUTH_SESSION_RECOVERY_REQUIRED | 401 | no | services/identity.py:243 | SIGNIN shows **"Invalid email or password."** This is wrong because the credentials were valid. | "We couldn't finish signing you in. Please sign in again." |
| INVALID_SESSION | 401 | no | api/deps.py:22; store/db.py:187; services/admin.py:50 | Global `SESSION_EXPIRED_EVENT` → redirect to `/auth/signin?reason=session-expired` (providers.tsx:51-56). There the notice is "Your session expired, so you were signed out…". No redirect on public pages (accept-invitation shows a signed-out state). | "Your session has ended. Sign in again to continue. Nothing was changed." |
| SESSION_REAUTH_REQUIRED | 403 | no | store/db.py:235 ("Your role changed. Sign in again to continue.") | Treated as expiry (`isSessionExpired`). Redirect with the **"session expired"** notice, so the role-change reason is lost. Before the redirect, APR shows G403 "Your role is not permitted to do this." | "Your access to this business changed. Sign in again to see what you can do now." |
| REAUTHENTICATION_REQUIRED | 403 | no | contracts/protocol.py:170 (SQLSTATE AC403) | **Not** treated as expiry. G403 "Your role is not permitted to do this.", and RAW screens show "The database could not complete this request." | Same as SESSION_REAUTH_REQUIRED. |
| SESSION_CHANGED | 409 | no | services/identity.py:352 | P7 "Your session changed while the password was being updated, so nothing was changed. Sign in again and retry." (Settings) | "Your password wasn't changed because you were signed in again somewhere else at the same time. Sign in and try again." |
| CSRF_REJECTED | 403 | no | services/identity.py:101,114,312,318; api/routes/identity.py:127 | Each write first fetches `/auth/csrf`, so this should be rare. APR/P7 "The request could not be verified. Reload the page and try again." RAW screens (signin/signup/deals/new) "The request could not be completed." `/auth/me` auto-recovers only through `fetchSession` (session-store.ts:35-40). Direct `get("/auth/me")` callers do not. | "This page was open too long to send that safely. Reload the page and try again. Nothing was saved." |
| AUTH_RATE_LIMIT | 429 | yes (Retry-After 60) | services/identity.py:146; services/account_access.py:48,133,174; services/account_mail.py:71 | SIGNIN/signup RAW "Try signing in later." (the signup page also says "signing in"). P7/APR "Too many attempts. Wait a moment before trying again." Retry-After is ignored. | "Too many attempts. Wait about a minute, then try again." (use Retry-After for the number) |
| AUTH_CAPACITY | 429 | yes | services/identity.py:41 | SIGNIN RAW "Too many verification requests. Try again shortly." Otherwise G429. | "Sign-in is busy right now. Wait a few seconds and try again." |
| MFA_REQUIRED | 409 | no | services/identity.py:215 | Handled: sign-in switches to the passkey flow (signin/page.tsx:41). | (no copy needed; optional status line "Confirm with your passkey to finish signing in.") |
| MFA_CHALLENGE_INVALID | 403 | no | services/passkeys.py:82,111,123 | RAW "Start a new passkey verification." (signin, passkey panel) | "That passkey check expired. Start again." |
| MFA_VERIFICATION_FAILED | 403 | no | services/passkeys.py:102 | RAW "Passkey verification failed." | "Your passkey couldn't be confirmed. Try again, or use a different passkey." |
| MFA_REAUTH_REQUIRED | 403 | no | services/passkeys.py:59 | RAW "Sign in again before managing passkeys." There is no link and no redirect. | "For your security, sign in again before changing passkeys." + Sign in link |
| MFA_NOT_CONFIGURED | 503 | **yes** (misleading) | services/passkeys.py:35 | RAW "Passkey setup is unavailable." | "Passkeys aren't available in this workspace." |
| STEP_UP_INVALID | 403 | no | services/bundles.py:413 | APR "Re-authentication is missing, expired or was already used. Enter your password again." The grant is cleared (use-bundle-flow.ts:90). | "Your password check has expired. Enter your password again to approve." |
| STEP_UP_UNAVAILABLE | 403 | no | services/identity.py:429 | APR "Password re-authentication is not available for this account." | "This account can't confirm approvals with a password. Ask another approver." |
| WEAK_PASSWORD | 422 | no | services/password_policy.py:96 (WEAK_MESSAGE) | Signup RAW (the server text is good). Settings P7 → **RAWC "WEAK_PASSWORD: Choose a password that is harder to guess…"** | "Choose a harder-to-guess password. Avoid common words, simple patterns and your email address." |
| PASSWORD_REUSED | 422 | no | services/password_policy.py:94 | Settings RAWC "PASSWORD_REUSED: Choose a password you are not using now." | "Your new password must be different from your current one." |
| ACCOUNT_EXISTS | 409 | no | services/accounts.py:93 (payee bank account); services/account_access.py:186 (invitation register, NO UI) | P7 "That account is already recorded for this payee." If invitation registration is built, this copy will be wrong there, because one code has two meanings. | Payee: "This bank account is already saved for this payee." Register: "An account with this email already exists. Sign in, then open the invitation link again." |
| UNIQUE_CONFLICT | 409 | no | contracts/protocol.py:161 (SQLSTATE 23505) | Static inference: a duplicate-email **signup** fails inside `owner_provision` (migration INSERT into `app_user`) with 23505, so the signup page shows RAW **"The database could not complete this request."** Elsewhere: G409 "The saved state changed (UNIQUE_CONFLICT)…" | Signup: "An account with this email may already exist. Sign in instead, or use a different email." Other: "That would duplicate something already saved. Check the existing entry." |
| ACCOUNT_EMAIL_UNAVAILABLE | 503 | **yes** (misleading) | services/account_mail.py:31; api/routes/account_access.py:111 | **NONE**: no UI calls account-access routes. | "Email-based account help isn't available in this workspace. Ask your administrator." |
| VERIFICATION_LINK_INVALID / RECOVERY_LINK_INVALID | 400 | no | services/account_access.py:165-166 | **NONE** (no UI). | "This link can't be used. It may have expired or already been used. Request a new one." |
| INVITATION_UNAVAILABLE | 404 | no | services/identity.py:397; services/account_access.py:186 | P7 "This invitation is invalid or has expired." accept-invitation re-checks memberships on 404 (accept-invitation.tsx:43-54). | "This invitation can't be used. It may have expired or been withdrawn. Ask the sender for a new one." |
| INVALID_WEBHOOK | 400 | no | services/resend.py:103 | Server-to-server only; NONE expected. | n/a |

### a.2 Authorization, routing, request shape

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| FORBIDDEN | 403 | no | api/deps.py:48; services/admin.py:52; store/db.py:232; store/repositories.py:196; services/exports.py:255; SQL 42501 (protocol.py:164) | P7/APR G403 "Your role is not permitted to do this." RAW screens "The request could not be completed." `/deals/[id]` **fabricates an owner session if `/auth/me` fails** (page.tsx:131), so buttons can appear that the server will refuse. | "Your role doesn't allow this. Ask an owner if you need access." |
| ROLE_ASSIGNMENT_FORBIDDEN | 403 | no | contracts/protocol.py:158 (OF009) | G403 "Your role is not permitted to do this." (Users) | "You can't give someone that role. Ask an owner to make this change." |
| NOT_FOUND | 404 | no | 71 sites (e.g. store/db.py:219,230; store/repositories.py:256…; services/execution.py:40); framework 404 errors.py:105 | P7 "That record was not found in this business." APR → **RAWC "NOT_FOUND: The request could not be completed."** `pipeline-data.ts:11` silently turns 404/409 into `null`. Document download: "The stored file was not found." | "We couldn't find that item. It may have been removed, or it belongs to a different business." |
| METHOD_NOT_ALLOWED | 405 | no | api/errors.py:105 | RAWC (developer error) | "Something went wrong on our side. Reload the page and try again." |
| REQUEST_REJECTED | other 4xx | no | api/errors.py:105 | RAWC | Same as above |
| INVALID_INPUT | 422 | no | api/errors.py:101 (validation); api/routes/documents.py:86; api/routes/notifications.py:63; services/pagination.py:88; SQL 22xxx / 23514 (protocol.py:163,171); client-made in web/lib/p7-api.ts:37 (status 0) | P7 "Check the fields: one of them was not accepted." APR RAWC "INVALID_INPUT: Check the request fields." RAW "Check the request fields." `details.field` is never populated for validation errors, so no field can be highlighted. | "Some details weren't accepted. Check the highlighted fields and try again." (needs `details.field` from the server) |
| INVALID_REFERENCE | 422 | no | contracts/protocol.py:162 (23503) | RAWC | "Something this refers to no longer exists. Reload and choose again." |
| MUTATION_QUERY_UNSUPPORTED | 400 | no | api/deps.py:29 | RAWC (client always sends a clean URL; developer error) | Generic "Something went wrong…" |
| INVALID_IDEMPOTENCY_KEY | 422 | no | api/deps.py:32; services/identity.py:224; store/repositories.py:136 | RAWC (client always sends one; developer error) | Generic |
| INVALID_CURSOR | 422 | no | services/pagination.py:60,65; store/collection_page.py:18,32; store/document_repository.py:134; services/invoices.py:66; services/admin.py:69 | P7 "The list changed. Reloading from the first page." **But** `CollectionPages` shows RAW "Restart the listing from the first page.", and its Retry calls `fetchNextPage()` with the **same bad cursor**, so the user loops. useCommand's refresh only invalidates `business-profile`, not the list. | "This list changed while you were paging. Showing it again from the start." (and actually reset the query) |
| REQUEST_TOO_LARGE | 413 | no | api/main.py:61 (any body over 1 MiB JSON / 26 MiB upload); api/routes/documents.py:91; api/routes/account_access.py:116; services/resend.py:91 | P7 "That file is too large to upload." This text is also shown for oversized JSON writes (e.g. a long message body) that are not files. | Files: "That file is larger than 25 MB. Upload a smaller file." Other: "That's more text than OrderFit can save at once. Shorten it and try again." |
| REQUEST_TIMEOUT | 408 | **yes** | api/main.py:65 | RAWC "REQUEST_TIMEOUT: The request body was not received in time." The idempotency key is released (status < 500). | "The upload took too long to arrive. Check your connection and try again." |

### a.3 Capacity and dependency

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| DEPENDENCY_UNAVAILABLE | 503 | yes | api/errors.py:110 (catch-all); contracts/protocol.py:173 (unmapped SQLSTATE incl. OA401/403/422 outside admin); api/routes/documents.py:140,143,197; api/main.py:201 | APR/P7 G503 "The service is temporarily unavailable. Retry shortly." RAW "The service is temporarily unavailable." The key is retained (good). | "OrderFit couldn't reach a service it needs. Your last action may or may not have been saved. Wait a minute, then reload to check before trying again." |
| DATABASE_CAPACITY | 503 | yes | store/db.py:198 | G503 / RAW "The database is busy. Retry shortly." | "OrderFit is busy right now. Wait a few seconds and try again." |
| SERVICE_NOT_STARTED | 503 | yes | api/deps.py:11 | G503 / RAW "The request could not be completed." | "OrderFit is still starting. Try again in a minute." |
| OPERATION_CAPACITY | 429 | yes (Retry-After 60) | store/admission.py:18 | G429 **"Too many attempts…"** (wrong framing; the user did nothing wrong). S-PREP RAWC. | "Several tasks are already running for this business. Wait for one to finish, then try again." |
| UPLOAD_CAPACITY | 429 | yes (Retry-After **5**) | api/main.py:213 | Not in P7 → G429 "Too many attempts. Wait a moment…" (documents page) | "Other uploads are still in progress. Wait a few seconds and try again." |
| PARSER_CAPACITY | 429 | yes | api/routes/documents.py:121 | P7 "Document processing is busy. Try again shortly." (good) | "Document reading is busy. Your file wasn't stored. Try again in a few seconds." |
| ADMIN_DATA_UNSUPPORTED / ADMIN_TELEMETRY_UNAVAILABLE | 503 | yes | services/admin.py:21,54; store/admin_repository.py:61 | **NONE**: admin UI never calls `/api/v1/admin/*` | "This admin view can't be shown right now." |
| *(non-JSON 5xx, e.g. proxy HTML 500/502/504)* | 5xx | — | Next rewrite / reverse proxy | Client code `REQUEST_FAILED`; message "The service is temporarily unavailable. Retry the same action when it recovers." describeError only special-cases 503, so the user sees **"REQUEST_FAILED: The service is temporarily unavailable…"** and `lostResponse` is false (but a write may have committed). | Same as DEPENDENCY_UNAVAILABLE. |
| *(NetworkError)* | — | — | web/lib/orderfit-api.ts:8,25 | APR/P7 "The connection was lost, so the outcome is unknown. Try the same action again: it reuses the same request key and cannot run twice." RAW screens "The network request did not complete." | "You seem to be offline. We don't know whether your last action was saved. Reconnect, then try again; it won't be applied twice." |

### a.4 Concurrency, versions, idempotency, workflow

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| STALE_VERSION | 409 | no | 15 sites: services/accounts.py:110; services/identity.py:375; services/membership.py:74,151,181,197; store/repositories.py:175,308,607,776,1025,1245,1324,1655,1896 | P7 "This record changed since you loaded it. The latest version was reloaded; review it and try again." The "was reloaded" claim is **false** on `/deals/[id]` (explain() reloads nothing) and contradicted on `/deals/sources` (it appends "Reload this page to get the current versions…"). APR G409 shows the code. `/deals/[id]` input save shows RAW "The request could not be completed. Another edit was saved. Reload before editing again." | "Someone else changed this while you were working. We've loaded the latest version. Check it, then make your change again." (only claim reload when one happened) |
| STALE_INPUT_VERSION | 409 | no | services/bundles.py:70; store/document_repository.py:72; store/preparation_repository.py:59; store/repositories.py:180,1657,2342; workflow/operations.py:110 | Not in P7, so the APR copy is used everywhere: "The order inputs changed after this bundle was prepared. Confirm and evaluate again." This copy is **wrong outside approvals** (documents extract/resolve, deal confirm). | "The order details changed since you opened this page. Review the latest details, then try again." |
| STALE_FINANCIAL_REVISION | 409 | no | 23 sites, e.g. services/accounts.py:69; services/invoices.py:77; services/membership.py:46,199; store/repositories.py:178,310,452,…,2330; store/document_repository.py:74,295,305 | **Two different copies.** P7 "The business changed while you were working. The latest version was reloaded…" APR "Business cash or commitments changed after this bundle was prepared. Re-evaluate, then prepare a new bundle." S-PREP uses the APR copy even for non-bundle commands. | Generic: "Your business's cash or commitments changed while you were working. Check the latest figures and try again." Approvals: "Cash or commitments changed after this approval package was prepared. Re-run the evaluation, then prepare a new package." |
| STALE_PREPARATION | 409 | no | services/bundles.py:83; store/preparation_repository.py:303,572 | APR/MFC "A message changed after review. Review the current revision." | "This message changed after it was reviewed. Review the current version." |
| STALE_BUNDLE | 409 | no | services/bundles.py:389 | APR "This bundle no longer matches current data. Prepare a new bundle." | "This approval package is out of date. Prepare a new one from the latest evaluation." |
| STALE_EVALUATION | 409 | no | store/preparation_repository.py:70 | APR G409 "(STALE_EVALUATION)". MFC RAWC. | "A newer evaluation replaced this one. Open the latest evaluation and continue from there." |
| STALE_SNAPSHOT / SNAPSHOT_HASH_MISMATCH | 409 | no | workflow/operations.py:126; store/repositories.py:2345 | G409 / RAW on `/deals/[id]` confirm | "The details you confirmed changed before the engine ran. Review and confirm them again." |
| STALE_ACCOUNT_REFERENCE / STALE_LENDER_REFERENCE | 409 | no | store/repositories.py:926,922 | G409 with code | "A payee account or lender you selected changed. Choose it again." |
| STALE_OR_BLOCKED_FORK | 409 | no | store/preparation_repository.py:507 | MFC RAWC | "This what-if is out of date or blocked. Run a new what-if from the current order." |
| FROZEN_OR_STALE_INPUT | 409 | no | contracts/protocol.py:152 (OF003) | G409 / RAW "The database could not complete this request." | "This order changed or is locked for a decision. Reload to see its current state." |
| IDEMPOTENCY_CONFLICT | 409 | no | store/repositories.py:128,158; store/account_access_repository.py:37 | G409 with code. The key is released. | "This request was already sent with different details. Reload to see what was saved." |
| OPERATION_IN_PROGRESS | 409 | no | store/repositories.py:130,160 | G409 with code. The client **releases the key** (status < 500), so the next click sends a new key. Static inference: this can start a duplicate operation if the version guards don't catch it. | "This is still being processed. Wait a moment; the page will update when it finishes." (keep the key) |
| OPERATION_STATE_CONFLICT | 409 | no | workflow/operations.py:232 (cancel) | NONE (cancel endpoint has no UI) | "This task has already finished, so it can't be cancelled." |
| OPERATION_CANCELLED, LEASE_LOST, LEASE_OR_AUTHORIZATION_LOST, RUN_INCOMPLETE, RUN_OPERATION_MISMATCH | 409 | no | workflow/advisory.py:147,156; workflow/preparation.py:286,303; workflow/execution.py:89,98,117,384; store/db.py:257 | Worker-side. They reach the UI only as `Operation.result.error` / run failure. `/deals/[id]` shows the RAW `result.error.message`. execution-status shows "message (CODE)". | "This task stopped before finishing. Nothing after the last completed step was applied. Reload and start it again." |
| ILLEGAL_TRANSITION | 409 | no | contracts/protocol.py:150 (OF001) | G409 / RAW | "This order can't move to that step from where it is now. Reload to see its current status." |
| WORKFLOW_ENTRY_CONFLICT | 409 | no | contracts/protocol.py:157 (OF008) | G409 "(WORKFLOW_ENTRY_CONFLICT)" / RAW "The database could not complete this request." | "Another change to this order happened at the same moment. Reload and try again." |
| ROUND_MISMATCH | 409 | no | contracts/protocol.py:153 (OF004) | G409 with code / MFC RAWC | "This negotiation moved to a new round. Reload to work on the current round." |
| APPROVAL_CONFLICT / MESSAGE_APPROVAL_CONFLICT / EXECUTION_APPROVAL_CONFLICT | 409 | no | contracts/protocol.py:154-156 (OF005-OF007) | APR G409 with code | "This approval no longer matches what's saved. Reload and review it again." |
| IMMUTABLE_HISTORY | 409 | no | contracts/protocol.py:159-160 (OF010, 23000) | G409 / RAW "The database could not complete this request." | "Recorded history can't be edited. Add a correction instead." |
| UNRESOLVED_BLOCKERS | 409 | no | services/bundles.py:307, 388; protocol.py:151 (OF002) | APR "Blocking findings are unresolved on this order. Resolve them before anything is approved or run." | "Some checks on this order still need attention. Resolve them before approving or sending anything." |

### a.5 Orders, baseline, cash events, documents

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| BASELINE_NOT_CONFIGURED | 409 | no | store/repositories.py:287,1370 | Special-cased: `/deals/new` (page.tsx:83), `/deals/sources` (page.tsx:36) and Cash flow (cash-flow-screen.tsx:24) show setup. P7 "No opening cash balance is recorded yet, so there is nothing to project." | "Add your opening cash balance first. OrderFit needs it to project your cash." |
| DEAL_COMPUTING | 409 | no | store/repositories.py:1662 | G409 / `/deals/[id]` P7→G409 "The saved state changed (DEAL_COMPUTING)…" | "The engine is still working on this order. Wait for it to finish." |
| DEAL_STATE_CONFLICT | 409 | no | store/repositories.py:1829 | APR "The order is not in a state that allows this action." | "This order isn't at a step where that's possible. Reload to see its current status." |
| DEAL_TERMINAL | 409 | no | store/repositories.py:1660,1858 | G409 with code | "This order is closed, so it can't be changed." |
| EVALUATION_REQUIRED | 409 | no | services/exports.py:111 | `/deals/[id]` decision export → G409 "The saved state changed (EVALUATION_REQUIRED)…" | "Run an evaluation before exporting the decision record." |
| EVALUATION_SERIES_NOT_FOUND / CONSTRAINTS_NOT_FOUND / COST_NOT_FOUND | 404 | no | store/repositories.py:2493,1973,1751 | P7: RAWC. Inspector: RAW. | "That data isn't available for this order. Reload and try again." |
| COST_EVIDENCE_MISSING | 409 | no | store/repositories.py:1514 (has message) | G409 shows the code, not the server's helpful message | "Add evidence for each saved cost before continuing." |
| DUPLICATE_COST_IDENTITY | 422 | no | store/repositories.py:1687 | RAW / RAWC | "Two cost lines describe the same item. Merge or remove one." |
| EXISTING_INVENTORY_NOT_INCREMENTAL / NONINCREMENTAL_REASON_REQUIRED | 422 | no | store/repositories.py:1142,1140 | RAW / RAWC | "Costs for stock you already own need a short reason explaining why they count for this order." |
| UNSUPPORTED_DEAL_CASH_EVENT / IMMUTABLE_EVENT_SCOPE | 422 | no | store/repositories.py:1138,1248 | RAWC | "That cash entry can't be changed this way. Void it and add a new one." |
| UNACKNOWLEDGED_WARNINGS | 422 | no | store/repositories.py:2352 (has message) | `/deals/[id]` confirm: P7 → RAWC "UNACKNOWLEDGED_WARNINGS: Acknowledge all review warnings…" | "Tick each warning to confirm you've read it, then confirm again." |
| BASELINE_DUPLICATE_REVIEW_REQUIRED | 409 | no | store/baseline_duplicates.py:57,147 (message + `details.matching_event_ids` / `matching_source_rows`) | **Dead end.** `/deals/sources` shows G409 "The saved state changed (BASELINE_DUPLICATE_REVIEW_REQUIRED)… Reload this page…". `details` are dropped by the client, the UI never sends `duplicate_review`, and the duplicates/duplicate-review routes have NO UI. The CSV confirm (`documents-api.ts:18`) cannot send row reviews either. | "This looks like a cash entry you've already recorded. Compare them, then either void the duplicate or confirm both are separate." (with the matching entries listed) |
| BASELINE_SOURCE_ALREADY_IMPORTED | 409 | no | store/baseline_duplicates.py:104 | G409 with code | "This row was already imported. Edit or void the existing entry instead." |
| TOO_MANY_DUPLICATE_MATCHES | 409 | no | store/baseline_duplicates.py:48,134 | G409 with code | "Too many similar entries already exist. Tidy up your cash entries before adding more like this." |
| UNEXPECTED_DUPLICATE_REVIEW | 422 | no | store/baseline_duplicates.py:62,152; store/repositories.py:1185,1255 | RAWC | "There's nothing to compare this entry with any more. Save it again." |
| NOT_A_CSV_DOCUMENT / PREVIEW_HAS_ERRORS / PREVIEW_HAS_DUPLICATES / UNKNOWN_CSV_REVIEW_ROW | 422 | no | store/document_repository.py:272,307,309,327 | Documents page P7 → RAWC (PREVIEW_HAS_DUPLICATES has good server text but gets a code prefix) | "Fix the rows marked in the preview before importing." / "This file isn't a CSV." |
| PREVIEW_HASH_MISMATCH / PREVIEW_ALREADY_CONFIRMED | 409 | no | store/document_repository.py:303,318 | P7 → G409. Page adds "The order and extracted values were reloaded…" | "This preview changed or was already imported. Reload to see what was saved." |
| CANDIDATE_REQUIRED / CANDIDATE_HAS_NO_VALUE / OVERRIDE_REASON_REQUIRED / USE_OVERRIDE_FOR_DIFFERENT_CANDIDATE | 422 | no | store/document_repository.py:228,238,241,243 | Documents page RAWC | "Pick a value from the document, or enter your own value with a short reason." |
| EMPTY_DOCUMENT | 422 | no | api/routes/documents.py:89 | P7 (good) | keep |
| UNSUPPORTED_MEDIA_TYPE | 415 | no | api/routes/documents.py:95; services/documents.py:56,60,65 | P7 (good) | keep |
| MIME_MISMATCH / KIND_MIME_MISMATCH | 422 | no | api/routes/documents.py:95,97; services/documents.py:76 | P7 (good) | keep |
| UNSUPPORTED_EXTENSION | — | — | **Not a backend code.** The backend checks bytes, not file extensions. The nearest codes are UNSUPPORTED_MEDIA_TYPE / MIME_MISMATCH. | n/a | n/a |
| PARSER_LIMIT, TOO_MANY_PAGES, ENCRYPTED, PAGE_TOO_LARGE, EMPTY_TEXT, MALFORMED, PARSER_UNAVAILABLE | (stored, not HTTP) | — | services/documents.py:92-150 (`ParseResult.error_code`) | **Not exposed.** `DocumentView` (contract and web copy) has `parse_status` but no error code, so the UI shows only "failed". | TOO_MANY_PAGES: "This PDF has more than 50 pages. Split it and upload the part you need." ENCRYPTED: "This PDF is password-protected. Upload an unlocked copy." PARSER_LIMIT: "This file took too long to read. Try a smaller or simpler file." EMPTY_TEXT / ocr_required: "No readable text was found. Scanned images aren't supported yet." |
| DOCUMENT_INTEGRITY_FAILURE | 503 | **yes** (misleading) | api/routes/documents.py:213 | Download uses raw `fetch` (documents-api.ts:32-34), so this becomes `DOWNLOAD_FAILED`. P7 then shows **"The export was created but could not be downloaded…"**, which is about exports, not documents. | "This stored file failed its safety check, so it wasn't downloaded. Upload the original again." |
| DEPENDENCY_UNAVAILABLE (documents) | 503 | yes | api/routes/documents.py:140,143,197 | G503 | see a.3 |

### a.6 Customers, payees, bank verification, members

| Code | HTTP | Retry | Origin | Current UI handling → screens | Recommended copy |
|---|---|---|---|---|---|
| CUSTOMER_ARCHIVED | 409 | no | services/invoices.py:31 | P7 (good) | keep |
| DUPLICATE_INVOICE_REF | 422 (batch) / 409 (stored) | no | services/invoices.py:81,84 | P7 "An invoice reference is duplicated…" (one copy for both) | keep |
| PAYEE_ARCHIVED | 409 | no | services/accounts.py:61 | P7 (good) | keep |
| INVALID_ACCOUNT_NUMBER | 422 | no | services/accounts.py:40 | P7 (good) | keep |
| ACCOUNT_NOT_PENDING / ACCOUNT_REVOKED | 409 | no | services/accounts.py:117,136 | P7 (good) | keep |
| ACCOUNT_NOT_VERIFIED / ACCOUNT_PARTY_MISMATCH / NOT_A_BANK_CHANGE_REPLY / BANK_VERIFICATION_REQUIRED | 409 | no | store/repositories.py:206,204,202,194 | P7 (bank-hold). The copy uses "hold", "party" and "written evidence", which is acceptable. | Optional: replace "party" with "supplier or customer" |
| BANK_VERIFICATION_NOT_APPLICABLE | 422 | no | store/repositories.py:1911 | P7 | keep |
| LAST_OWNER | 409 | no | services/membership.py:83,95 | P7 (good) | keep |
| ALREADY_MEMBER / MEMBERSHIP_REVOKED / INVITATION_CLOSED | 409 | no | services/membership.py:123,72,153,183 | P7 (good) | keep |
| INVITATION_PENDING | 409 | no | services/membership.py:127 | P7 says "**the API has no invitation listing**…". That is now false: `GET /invitations` and `/reissue` exist in the backend but not in the web contract. | "An invitation is already open for this email. Resend or withdraw it from the invitations list." |
| AUDIT_RANGE_TOO_LARGE / INVALID_AUDIT_RANGE | 413 / 422 | no | services/exports.py:53,33 | P7 (good) | keep |
| CASH_EXPORT_TOO_LARGE / DECISION_EXPORT_TOO_LARGE | 413 | no | services/exports.py:228,231,126 | P7 (good) | keep |
| EXPORT_EXPIRED | 409 | no | services/exports.py:147,258 | P7 "This export expired. Create a new one." `p7-api.ts:73` maps **any** 409 download to EXPORT_EXPIRED. | keep |
| EXPORT_INTEGRITY_FAILURE | 503 | **yes** (misleading) | services/exports.py:150,261 | Raw-fetch download → DOWNLOAD_FAILED: "The export was created but could not be downloaded. Try again; your role may not permit this export." Neither sentence is true here. | "This export failed its safety check and wasn't downloaded. Create a new export." |

### a.7 Preparation, negotiation, replies (S-PREP uses MFC, so unmapped codes show as `CODE: The request could not be completed.`)

| Code | HTTP | Retry | Origin | Current UI | Recommended copy |
|---|---|---|---|---|---|
| NEGOTIATION_ROUND_LIMIT | 409 | no | services/bundles.py:309; services/execution.py:64; store/preparation_repository.py:295 | APR/MFC "The negotiation round limit from your policy has been reached. No further outgoing batch can be approved." | "You've reached the number of negotiation rounds your policy allows. No more messages can be sent for this order." |
| OFFER_EXPIRED | 409 | no | services/bundles.py:261; store/preparation_repository.py:325 | APR "A financing offer in this bundle has expired." | "A financing offer used here has expired. Update the offer or choose another option." |
| REPLY_NOT_EXACT_ACCEPTANCE | 409 | no | store/preparation_repository.py:736 | APR (long, quotes an internal phrase) | "This reply doesn't clearly accept the proposed terms, so it can't be recorded as an acceptance." |
| INPUT_REVIEW_REQUIRED | 409 | no | store/preparation_repository.py:511,600,644 | MFC RAWC | "Some order details still need confirming. Review them first." |
| INVALID_FORK_INPUTS | 422 | no | store/preparation_repository.py:515; workflow/preparation.py:65 | MFC RAWC | "That what-if change can't be applied to this order. Try a different change." |
| INVALID_FINANCING_GRID / UNSUPPORTED_EXTENSION_SUBSET / UNSUPPORTED_EXTENSION_TERMS | 422 | no | services/preparation.py:62,46,51 | MFC RAWC | "These payment-term options aren't supported. Choose from the listed extensions." |
| UNSUPPORTED_MESSAGE_CONTENT | 422 | no | services/preparation.py:172 | MFC RAWC | "This message contains content that can't be sent. Remove links or attachments and try again." *(verify the actual rule before shipping)* |
| OPTION_NOT_FOUND / OPTION_NOT_FEASIBLE | 404 / 409 | no | store/preparation_repository.py:93,95 | MFC RAWC | "That option isn't available for this evaluation. Pick another option." |
| PARTY_NOT_IN_PLAN / PARTY_ARCHIVED / PARTY_ARCHIVED_OR_CHANGED | 404 / 409 | no | store/preparation_repository.py:102-111,124,133 | MFC RAWC | "That customer or supplier isn't part of this plan any more. Reload and choose again." |
| PREPARATION_STATE_CONFLICT / PREPARATION_REVIEW_BLOCKED | 409 | no | store/preparation_repository.py:61,397 | MFC RAWC | "This message can't be reviewed right now because something it depends on changed. Reload first." |
| REPLY_ALREADY_REVIEWED | 409 | no | store/preparation_repository.py:559 | MFC RAWC | "This reply was already reviewed." |
| INVALID_CANDIDATE_SELECTION / CONFLICTING_REPLY_TERMS / INVALID_REPLY_TERMS / REPLY_PARTY_TERM_MISMATCH / REPLY_REQUIRES_TYPED_REVIEW / RECORD_ACCEPTANCE_SEPARATELY | 422 | no | store/preparation_repository.py:564,566,648,584,580,582 | MFC RAWC | "The terms you selected from this reply don't fit together. Review the highlighted terms." |
| REPLY_REQUIRES_SOURCE_REVIEW / ACCEPTANCE_REQUIRES_CURRENT_REVIEW / INVALID_ACCEPTANCE_SUPERSESSION | 409 | no | store/preparation_repository.py:570,711,698,748 | MFC RAWC | "Review the reply against the original message before recording it." |
| INVALID_ACCEPTANCE_EXPIRY | 422 | no | store/preparation_repository.py:701 | MFC RAWC | "Choose a valid-until date in the future." |
| UNSUPPORTED_ADVISORY_TASK | 422 | no | workflow/advisory.py:76,91 | Operation result RAW | "The assistant can't help with that here." |

### a.8 Approval packages and sandbox execution (S-APR)

| Code | HTTP | Retry | Origin | Current UI (APR copy unless noted) | Recommended copy |
|---|---|---|---|---|---|
| SUPPLIER_PARTY_UNRESOLVED | 409 | no | services/bundles.py:201 | **G409 with code** (no map) | "Choose which supplier this payment goes to before preparing the package." |
| STRATEGY_MISMATCH | 409 | no | services/bundles.py:305 | **G409 with code** | "The selected option no longer matches the order's plan. Reload and choose the option again." |
| BUNDLE_STATE_CONFLICT | 409 | no | services/bundles.py:301 | G409 with code | "This package already has a newer state. Reload to continue." |
| BUNDLE_ID_MISMATCH | 422 | no | services/bundles.py:394 | RAWC | Generic |
| BUNDLE_EXPIRED | 409 | no | services/bundles.py:324,388 | "The bundle expired. Prepare a new bundle from the current evaluation." | "This approval package expired. Prepare a new one from the latest evaluation." |
| BUNDLE_HASH_MISMATCH | 409 | no | services/bundles.py:399; services/execution.py:103; services/identity.py:424 | "The bundle changed since you reviewed it. Reload and review the exact content again." | "This package changed after you reviewed it. Review it again before approving." |
| BUNDLE_ALREADY_DECIDED / BUNDLE_UNAVAILABLE | 409 | no | services/bundles.py:415; services/identity.py:422 | mapped | "Someone already approved or rejected this package." / "This package can no longer be approved." |
| REQUIRED_ACCEPTANCE_MISSING / REQUIRED_ACCEPTANCE_STALE | 409 | no | services/bundles.py:212,215 | mapped | "Record the other side's acceptance of these exact terms first." |
| PAYEE_ACCOUNT_UNVERIFIED | 409 | no | services/bundles.py:241 | mapped | "A payee's bank account isn't verified yet. Verify it on the Payees page." |
| PAYEE_UNAVAILABLE / PAYEE_ACCOUNT_CHANGE_PENDING | 409 | no | services/bundles.py:235,238 | **G409 with code** | "A payee's bank details are changing and must be verified before anything is paid." |
| COMMIT_PROJECTION_UNAVAILABLE / COMMIT_PROJECTION_MISMATCH | 409 | no | services/bundles.py:226,118; services/execution.py:83 | mapped | "This evaluation can't be committed as it stands. Re-run the evaluation and prepare again." |
| COMMIT_GATE_HELD | 409 | no | services/execution.py:85 | mapped | "Another commitment for this business hasn't finished. Finish or reverse it before committing this order." |
| PREPARATION_REVIEW_REQUIRED / MESSAGE_NOT_DISPATCHABLE / MESSAGE_OPTION_MISMATCH / DUPLICATE_PARTY_MESSAGE | 409 / 422 | no | services/bundles.py:85,88,81,91 | mapped | keep (replace "bundled" with "added to the package") |
| APPROVAL_NOT_REVOCABLE / APPROVAL_ALREADY_REVOKED | 409 | no | services/bundles.py:463,465 | mapped | keep |
| APPROVAL_REVOKED / APPROVAL_REJECTED / APPROVAL_EXPIRED / APPROVER_NOT_CURRENT | 409 | no | services/execution.py:31-41 (from SQL `p6_approval_unusable_reason`, migrations/sql/0016_session_authority.sql); `REVOKED`/`REJECTED` are mapped to `APPROVAL_*` | mapped (the APR map also keeps the raw `REVOKED`/`REJECTED` keys) | keep |
| RUN_UNRESOLVED / RUN_TERMINAL / RUN_APPROVAL_MISMATCH | 409 | no | services/execution.py:147,122,115; workflow/execution.py:130 | mapped ("partial" jargon in RUN_UNRESOLVED) | "A previous attempt only partly finished. Resume it, or reverse what it did, before trying again." |
| ACTION_NOT_COMPLETED / ACTION_ALREADY_REVERSED / COMPENSATION_STATE_CONFLICT / DUPLICATE_ACTION | 409 / 422 | no | services/execution.py:93,95,234,236,225,220 | mapped | keep (rename "compensated" → "reversed") |

### a.9 Overview (`GET /overview`)

| Code | HTTP | Retry | Origin | Current UI | Recommended copy |
|---|---|---|---|---|---|
| OVERVIEW_CURRENCY_UNSUPPORTED | 422 | no | services/overview.py:86 | `/overview` RAW "Only the business currency is available; FX conversion is unsupported." | "Figures are shown in your business currency only." (and disable other currencies in the picker) |
| OVERVIEW_HORIZON_UNSUPPORTED | 422 | no | services/overview.py:132 | RAW "Complete delayed projection exceeds the supported 540-day horizon." | "Some payments are too far in the future to chart here. Shorten the date range or review distant entries." |
| OVERVIEW_MONEY_BOUND | 422 | no | services/overview.py:31 | RAW "Aggregate exceeds supported monetary bounds." | "Some totals are too large to display. Check for an amount entered with extra zeros." |

Overview **data warnings** (`data_warnings`, not errors; emitted at services/overview.py:93-192):

| Warning | Shown on `/overview`? |
|---|---|
| BASELINE_NOT_CONFIGURED, BASELINE_COVERAGE_INCOMPLETE, PAST_EVENTS_REQUIRE_RECONCILIATION, VOLUME_CHANGE_UNDEFINED_FROM_ZERO, BALANCE/PENDING/HEADROOM_HISTORY_UNAVAILABLE, VERDICT_DISTRIBUTION_EXCLUDES_DECLINED_AND_UNCLASSIFIED, NEGATIVE_BALANCE_NOT_REPRESENTABLE_IN_CURRENCY_ALLOCATION | yes (page.tsx:101-906) |
| **SINGLE_CURRENCY_BASELINE_ONLY, SPLIT_MILESTONES_UNSUPPORTED, RECENT_STATUS_REQUIRES_REVIEW, RECENT_SETTLEMENTS_ARE_EVALUATIONS, PROJECTIONS_ARE_SANDBOX** | **no**. Notably, PROJECTIONS_ARE_SANDBOX and RECENT_SETTLEMENTS_ARE_EVALUATIONS are always emitted, and they are the honesty disclaimers. |

### a.10 Inconsistency summary

| Code | Copy A | Copy B | Where |
|---|---|---|---|
| INVALID_CREDENTIALS | "Invalid email or password." | "The current password was not accepted…" / "The password was not accepted. Nothing was approved." / "Verification failed." | signin / settings / approvals / passkey panel |
| STALE_FINANCIAL_REVISION | "The business changed while you were working. The latest version was reloaded…" | "Business cash or commitments changed after this bundle was prepared…" | P7 screens / approvals and preparation |
| STALE_VERSION | "…The latest version was reloaded…" | "…Reload this page to get the current versions…" (appended on `/deals/sources`), "The request could not be completed. Another edit was saved…" (`/deals/[id]` save) | P7 / sources / deal page |
| NOT_FOUND | "That record was not found in this business." | "NOT_FOUND: The request could not be completed." | P7 / APR+MFC |
| AUTH_RATE_LIMIT | "Try signing in later." (also shown on signup) | "Too many attempts. Wait a moment…" | auth pages / app |
| All 429s | One copy, "Too many attempts…", for user throttles **and** for system capacity (UPLOAD_CAPACITY, OPERATION_CAPACITY) | — | everywhere |
| DOWNLOAD_FAILED | Export wording used for **document** downloads | — | documents page |
| ACCOUNT_EXISTS | "already recorded for this payee" | (will also mean "email already registered" for invitation registration) | P7 |
| 409 fallback | "The saved state changed (`CODE`)…" shows a raw code to users | — | APR |
| 4xx fallback | `CODE: The request could not be completed.` | — | APR/MFC |

**Codes with no specific mapping anywhere** (users see G409-with-code, RAWC, or a generic RAW sentence): UNIQUE_CONFLICT, WORKFLOW_ENTRY_CONFLICT, ROUND_MISMATCH, IMMUTABLE_HISTORY, ILLEGAL_TRANSITION, FROZEN_OR_STALE_INPUT, APPROVAL/MESSAGE/EXECUTION_APPROVAL_CONFLICT, ROLE_ASSIGNMENT_FORBIDDEN, REAUTHENTICATION_REQUIRED, AUTH_SESSION_RECOVERY_REQUIRED, WEAK_PASSWORD (settings), PASSWORD_REUSED, SUPPLIER_PARTY_UNRESOLVED, STRATEGY_MISMATCH, PAYEE_UNAVAILABLE, PAYEE_ACCOUNT_CHANGE_PENDING, BUNDLE_STATE_CONFLICT, STALE_EVALUATION, STALE_SNAPSHOT, SNAPSHOT_HASH_MISMATCH, IDEMPOTENCY_CONFLICT, OPERATION_IN_PROGRESS, OPERATION_CAPACITY, UPLOAD_CAPACITY, DATABASE_CAPACITY, SERVICE_NOT_STARTED, REQUEST_TIMEOUT, EVALUATION_REQUIRED, DEAL_COMPUTING, DEAL_TERMINAL, COST_EVIDENCE_MISSING, UNACKNOWLEDGED_WARNINGS, all BASELINE_DUPLICATE_* / CSV preview codes, all field-resolution codes, every preparation/reply code in a.7 except the three mapped ones, the OVERVIEW_* codes, MFA_* codes, and the account-access codes (no UI).

---

## (b) Client layer analysis (`web/lib/orderfit-api.ts`)

### b.1 What the error objects carry

- `ApiError(message, code, status)` (orderfit-api.ts:7). **Only** these three fields.
  - `request_id`: **dropped**. Never shown, never logged. Support cannot correlate a user report with the backend log line (errors.py:72 logs it for 5xx).
  - `retryable`: **dropped**. The UI decides retry wording from the status code instead.
  - `details`: **dropped**, although the `Envelope` type at line 6 declares `details.current_version`. This loses `field` (form highlighting), `matching_event_ids` / `source_row` / `matching_source_rows` (duplicate review), and `expected_*` / `current_*` versions.
  - `Retry-After`: **not read** anywhere in `web/` (and not CORS-exposed cross-origin).
- `NetworkError` (orderfit-api.ts:10). It has a fixed message and no cause. AbortError/TimeoutError are re-thrown as-is (line 25). There is **no default request timeout**: a hung request spins until the browser gives up, unless the caller passes a signal (only overview and the pipeline do).
- Ad-hoc `ApiError`s with **status 0** (p7-api.ts:37 INVALID_INPUT, p7-api.ts:69 INVALID_EXPORT_LINK, documents-api.ts:30 INVALID_DOCUMENT_LINK) are client-side validation failures that look like server errors.
- Raw-fetch downloads (documents-api.ts:32-34, p7-api.ts:71-73) **do not parse the error body**. They synthesize `UNAUTHENTICATED` / `NOT_FOUND` / `DOWNLOAD_FAILED` / `EXPORT_EXPIRED` from the status alone, which loses DOCUMENT_INTEGRITY_FAILURE, EXPORT_INTEGRITY_FAILURE, FORBIDDEN and SESSION_REAUTH_REQUIRED (403 is not routed to sign-in on downloads). `UNAUTHENTICATED` is in no message map, so if a toast renders before the redirect it reads "UNAUTHENTICATED: Could not download…".

### b.2 Non-JSON, empty and proxy bodies

- `await response.json().catch(() => ({}))` (line 26).
  - **Error + non-JSON** (HTML 502 from a proxy, Next rewrite failure, plain-text 500): `code = "REQUEST_FAILED"`. The message is "The service is temporarily unavailable. Retry the same action when it recovers." for ≥500, or "Request failed (NNN)" otherwise. `describeError` only special-cases **503**, so a 500/502/504 renders as **"REQUEST_FAILED: The service is temporarily unavailable…"** with `lostResponse: false`, even though a write may have committed. The idempotency key is kept for ≥500 (correct).
  - **Success + non-JSON/empty** (204, or a misrouted 200 HTML page when `NEXT_PUBLIC_API_URL` / the rewrite points at the wrong host): returns `{}` cast to `T`. **This is a silent false success.** Callers then read `undefined` fields (e.g. `op.id`). Static inference: a misconfigured proxy can make a write look successful.
- 401 with a non-JSON body → code REQUEST_FAILED. `isSessionExpired` is still true, so the redirect works.

### b.3 401: INVALID_SESSION vs INVALID_CREDENTIALS

- `isSessionExpired(status, code)` = `(401 && code !== "INVALID_CREDENTIALS") || (403 && code === "SESSION_REAUTH_REQUIRED")` (orderfit-api.ts:17-19). On true, it fires `orderfit:session-expired`. `SessionExpiryHandler` (components/providers.tsx:47-58) resets caches and redirects to `/auth/signin?reason=session-expired`, except on `/`, `/auth`, `/auth/*`.
- Gaps:
  1. `AUTH_SESSION_RECOVERY_REQUIRED` (401) on sign-in is shown as "Invalid email or password." (signin/page.tsx:47 treats **any** 401 as bad credentials).
  2. `REAUTHENTICATION_REQUIRED` (403, SQL AC403) and `MFA_REAUTH_REQUIRED` (403) do not trigger the sign-in path. The user gets "Your role is not permitted" or a raw sentence.
  3. `SESSION_REAUTH_REQUIRED` is redirected with the generic "session expired" notice. The server's reason ("Your role changed") is discarded. There is no `reason=role-changed` notice.
  4. `/deals/[id]` swallows a failed `/auth/me` and **substitutes `{role: "owner"}`** (page.tsx:131). The UI then offers owner actions that the server will refuse with 403.
  5. INVALID_CREDENTIALS from the passkey-enroll options call (password confirm) is correctly excluded from expiry, but it is shown raw as "Verification failed.".

### b.4 CSRF_REJECTED recovery

- Prevention: every `mutate`/`mutateUpload` goes through one serialized queue (`enqueue`, line 89). Each write first calls `GET /auth/csrf` and sends the returned token as `X-CSRF-Token` (lines 79-80). Stale tokens are therefore unlikely within one tab.
- Recovery: only `fetchSession()` (session-store.ts:35-40) retries `/auth/me` once after refreshing `/auth/csrf`. Direct `get("/auth/me")` callers (`/deals/[id]` page.tsx:131, preparation-workspace.tsx:46, p7-api.ts:13 `getSession`) do **not** recover. A write rejected with CSRF_REJECTED is **not** retried. The key is released (status 403 < 500), and the user is told "Reload the page and try again" (APR) or "The request could not be completed." (RAW screens).
- `GET /auth/csrf` itself can return CSRF_REJECTED when the Origin is not allowed or the request is cross-site (routes/identity.py:123-127). That is a deployment misconfiguration, which the user sees as an unexplained failure on every write.

### b.5 Idempotency-key retention

- Non-auth writes: the key is stored in `sessionStorage` under `orderfit.pending:<sha256(scope, method, path, body)>`, where `scope` is a per-tab random UUID (lines 59-72). Upload digests include a SHA-256 of the file (lines 110-118).
- **Released** (deleted) on success, or on `ApiError` with status < 500 (line 85). **Kept** on NetworkError, Abort/Timeout, any non-ApiError, and any ≥500. Retrying the identical body reuses the key (correct for lost responses).
- Auth writes (`/auth/*` except `/auth/invitations/accept`) are never persisted and get a fresh key per attempt. `clearPendingCommands()` runs after signup/signin/signout/passkey login (line 82).
- Risks:
  1. **409 OPERATION_IN_PROGRESS releases the key.** The server says the same command is still running, but the next click sends a new key. Static inference: this can enqueue a duplicate operation if no version guard catches it.
  2. **408 REQUEST_TIMEOUT and 429 also release the key.** That is harmless (nothing was committed).
  3. Changing any byte of the body (e.g. the user edits a field after a lost response) produces a new digest and a new key. The orphaned key stays in sessionStorage until sign-out. This is by design, but the user is told "it reuses the same request key and cannot run twice". That is only true when the body is unchanged.
  4. A queued write's CSRF fetch failure (NetworkError) is indistinguishable from the write failing, which is fine because the key is retained.

---

## (c) Contract drift: `web/lib/generated-api.d.ts` vs `docs/contracts/frontend-api.d.ts`

- `docs/contracts/frontend-api.d.ts` and `docs/contracts/openapi.json` agree: identical schema-name sets, 134 operations. The web copy (last touched in `8a4e8b8`) predates the account-access export in `ff23df4`.
- Schemas in the backend export but **missing from web**: 8. Web has no extra schemas. Two shared types differ. Nine operations are missing.

| Type / operation | Drift | Web consumers affected |
|---|---|---|
| `SessionView.email_verified` | web: literal `false`; backend: `boolean` | `components/settings/settings-screen.tsx:62` hard-codes "verified" / "**not supported yet**" (the backend now supports verification). Every `Session` consumer: app/admin/{layout,logs,orders,users}, app/auth/{signin,signup}, app/deals/[id]/page.tsx, components/auth/accept-invitation.tsx, components/layout/{auth-shell,authenticated-page,scope}, components/p7/common.tsx, components/preparation-workspace.tsx, components/settings/settings-screen.tsx, lib/{auth-server,orderfit-api,p7-api,p7-model,passkeys,session-store,use-session}.ts |
| `SessionView.password_recovery_eligible` | backend only (`boolean`) | Same consumers. No "forgot password" eligibility logic; `app/auth/forgot-password/page.tsx:40` states "This release has no email-based password reset". |
| `InvitationView.delivery: MailDelivery` | backend only | `lib/p7-api.ts:23-24`, `lib/p7-model.ts` (`invitationLink`, `upsertInvitation`, `invitationState`), `components/users/users-screen.tsx:86`, `app/admin/users/page.tsx:220`. The UI cannot show email delivery status (queued/delivered/bounced) and still relies on copy-the-link. |
| `MailDelivery` | missing in web | as above |
| `Page_InvitationView_` + op `invitations` (GET `/businesses/{id}/invitations`) | missing in web | users-screen / P7 INVITATION_PENDING copy ("the API has no invitation listing") |
| op `invitation_reissue` (POST `/invitations/{id}/reissue`) | missing in web | users-screen |
| `AccountAccessCapabilities` + op `account_access_capabilities` (GET `/auth/account-access`) | missing in web | none (no capability probe; forgot-password page is static text) |
| `VerificationRequest`, `TokenConfirm` + ops `email_verification_request` / `email_verification_confirm` | missing in web | none |
| `PasswordResetRequest`, `PasswordResetConfirm` + ops `password_reset_request` / `password_reset_confirm` | missing in web | `app/auth/forgot-password/page.tsx` (static) |
| `InvitationRegister` + op `invitation_register` (POST `/auth/invitations/register`) | missing in web | `components/auth/accept-invitation.tsx` (only supports an already-signed-in user; a new invitee must self-sign-up, which creates a separate business) |
| op `resend_webhook` | missing in web (server-to-server; expected) | none |
| Hand-written `DocumentView` (`web/lib/documents-api.ts:5`) | widens `source_role` and `mime_type` to `string`; neither side has a parse-error code | documents page cannot explain why parsing `failed` |
| `ErrorEnvelope` / `SafeError` / `ErrorDetail` | identical in both copies, but the runtime client ignores them (uses its own `Envelope`, orderfit-api.ts:6) | all |

---

## (d) Backend capability without UI, and UI calls without backend

### d.1 Registered backend routes with NO frontend caller (static grep of `web/app`, `web/components`, `web/lib`)

| Route | Backend | Note |
|---|---|---|
| GET `/api/v1/auth/account-access` | routes/account_access.py:30 | capability probe |
| POST `/auth/email-verification/request`, `/confirm` | account_access.py:40,54 | Settings says "not supported yet" |
| POST `/auth/password-reset/request`, `/confirm` | account_access.py:67,79 | forgot-password page is static |
| POST `/auth/invitations/register` | account_access.py:93 | new-invitee registration |
| POST `/webhooks/resend` | account_access.py:105 | server-to-server (expected) |
| GET `/admin/capabilities`, `/admin/overview`, `/admin/users`, `/admin/tenants`, `/admin/orders`, `/admin/logs`, `/admin/system` | routes/admin.py:21-54 | `/admin/*` pages exist but enumerate only the caller's own memberships via tenant routes. `lib/platform-admin.ts:1-3` returns `true` unconditionally. |
| GET `/businesses/{b}/invitations`; POST `/invitations/{i}/reissue` | routes/members.py:49,56 | not in web contract |
| GET `/cash-events/{e}/duplicates`; POST `/cash-events/{e}/duplicate-review` | routes/business.py:49,56 | needed to resolve BASELINE_DUPLICATE_REVIEW_REQUIRED (dead end) |
| GET `/constraints/{id}` | business.py:135 | list is used instead |
| PATCH `/customers/{id}`, `/payees/{id}`, `/financing-offers/{id}` | business.py:301,389,477 | create/archive only; no edit UI |
| GET `/deals/{d}/evaluations` (history list) | deals.py:241 | only the live evaluation is shown |
| GET `/deals/{d}/documents/{doc}` | documents.py:173 | list is used |
| POST `/operations/{o}/cancel` | routes/identity.py:252 | no cancel for long-running operations |
| GET `/messages/{m}`, GET `/deals/{d}/messages`, GET `/replies/{r}`, GET `/deals/{d}/acceptances`, GET `/clause-assessments/{a}` | preparation.py:190,199,257,296,429 | preparation state endpoint is used instead; clause-assessment results are not re-readable |
| GET `/ready` | main.py:344 | used **indirectly** through the Next route `web/app/api/health/route.ts:20` (OK) |

Unregistered stub routers: `api/routes/actions.py` and `api/routes/stream.py` declare `prefix="/deals"` with no handlers and are not included in `main.py:324-337`. That is dead code.

### d.2 Frontend calls with no backend endpoint

None found. Every literal and templated path in `web/` matches a registered route and method, including `deals/{id}/{close|hold|reopen-for-review}` (page.tsx:322-327). Every requested `limit` is at most 100 (the backend `le=100`). Caveats:

- `/deals/[id]` builds the command path from a fixed allow-list (`reopen_for_review`, `hold`, `close`), so it is safe.
- The `/admin/*` UI pages exist with no corresponding backend use (see d.1). This is the reverse case: a UI that implies platform-wide data it does not fetch.
