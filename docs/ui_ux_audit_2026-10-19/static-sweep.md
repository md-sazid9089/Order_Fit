# Static sweep: web/app, web/components, web/lib (2026-10-19)

**Evidence level for every item below: STATIC** (read in code on branch `ui-release-2026-10-19`; nothing was run or reproduced). Where an item depends on runtime configuration or backend behaviour, the condition is stated. Backend claims were checked read-only against `backend/orderfit` and `backend/migrations`.

Scope: `web/app`, `web/components`, `web/lib`. Excluded: `node_modules`, tests, `lib/generated-api.d.ts` (generated), and `components/ui/liquid-sculpture-hero.tsx` except for motion/a11y.

Severity: **S0** trust/loss · **S1** broken / silent / error-as-empty / infinite spinner · **S2** degraded / inconsistent / a11y / responsive · **S3** polish.

## Summary

| # | Class | Confirmed | S0 | S1 | S2 | S3 |
|---|---|---|---|---|---|---|
| 1 | Swallowed failures | 8 | 0 | 4 | 0 | 4 |
| 2 | Error rendered as empty | 11 | 0 | 5 | 4 | 2 |
| 3 | Loading that never ends | 6 | 0 | 3 | 2 | 1 |
| 4 | Raw error leakage | 8 | 0 | 0 | 2 | 6 |
| 5 | Browser math on money/verdicts | 10 | 0 | 2 | 6 | 2 |
| 6 | Fake async / persistence / demo data | 9 | 1 | 3 | 4 | 1 |
| 7 | Accessibility | 13 | 0 | 0 | 9 | 4 |
| 8 | Responsive | 8 | 0 | 0 | 3 | 5 |
| 9 | Admin pages | 11 | 0 | 3 | 5 | 3 |
| 10 | Static claims vs backend | 14 | 0 | 0 | 11 | 3 |
| | **Total** | **98** | **1** | **20** | **46** | **31** |

Each finding is counted once. Related items in other classes are linked with "see".

Most of the code that already follows good patterns is under `components/p7/*`, `components/{audit,cash,customers,payees,financing,users,notifications}` and `components/approval/*`. Those screens gate empty states on `isSuccess`, render `QueryError` with `role="alert"`, and send money through `formatMinor`. The defects cluster in `app/admin/*`, `app/overview`, `app/deals/[id]`, `components/preparation-workspace.tsx`, `components/deals/deal-evaluation-inspector.tsx` and the landing components. The usual fix is to adopt the P7 primitives (`QueryError`, `Alert`, `Loading`, `useCommand`, `useBusinessRevision` in `components/p7/common.tsx`).

---

## 1. Swallowed failures

- **1.1** `app/deals/[id]/page.tsx:108-125` · If a non-UUID reference is used and the `deals?limit=50` lookup fails, the error is swallowed (`catch {}` at 118). The page then says `No saved order matches "<ref>"`. The search also covers only the 50 most recent orders. · Impact: a network or 5xx failure, or an older order, is reported as "order does not exist". · Fix: separate the "not found" and "lookup failed" states, and resolve the reference server-side (look up by `public_ref`) instead of scanning a page. · **S1**
- **1.2** `app/deals/[id]/page.tsx:131,139` · If `/auth/me` fails, the code builds a fabricated session `{ memberships: [{ role: "owner" }] }`. A missing membership also defaults to `"owner"`. · Impact: the UI shows owner-only controls (prepare, edit, export, workflow commands) to a user whose role is unknown. The server still rejects the calls, but the screen misstates what the user may do. · Fix: use `useScope().membership` from `AuthShell`, which already holds the verified session. Never default a role. · **S1**
- **1.3** `components/preparation-workspace.tsx:46-65` · The same pattern: on a session failure, or when `requestedBusiness` is not in the user's memberships, the code calls `setRole("owner")`. · Impact: as 1.2, on the negotiation and approval workspace. · Fix: as 1.2. If no membership exists, show "not a member of this business". · **S1**
- **1.4** `app/deals/[id]/page.tsx:135` · The review fetch uses `.catch(() => null)`, and nothing tells the user it failed. See 3.1 for the resulting endless skeleton. · **S1**
- **1.5** `components/approval/use-bundle-flow.ts:247` · A failed operation read becomes `null`, so execution progress silently disappears. Run state still loads. · Fix: report it through `setError`. · **S3**
- **1.6** `components/layout/app-sidebar.tsx:152-156` · `fetchSession().catch(() => {})`. The role label falls back to "Member"/"Admin". · **S3**
- **1.7** `components/settings/settings-screen.tsx:42,132` · The session refresh after a profile save or a 409 conflict uses `.catch(() => undefined)`, so the header can keep showing the old name or role with no notice. · **S3**
- **1.8** `components/deals/deal-evaluation-inspector.tsx:31-35` · The `navigator.clipboard.writeText` promise is not awaited, so "Copied" shows even when the copy fails. · Fix: follow `components/users/users-screen.tsx:89-91`. · **S3**

The admin-page `catch` blocks that redirect to sign-in are covered in 9.1.

## 2. Error rendered as empty (high severity)

- **2.1** `app/admin/logs/page.tsx:50-55 → 220-224` · `listAudit` failure → `setLogs([])` → "No audit events recorded for this organization in the database yet." · Impact: a backend failure is shown as an empty, clean audit trail. That is a trust problem on an audit screen. · Fix: add a separate `error` state and render `QueryError` before any empty state, or reuse `components/audit/audit-screen.tsx`, which already gates on `isSuccess`. · **S1**
- **2.2** `app/admin/orders/page.tsx:70-73,91-93 → 323-327` and KPI cards at `212-257` · Per-business `.catch(() => null)` → "No purchase orders recorded in the database yet." and "0 Orders" / "0 Evaluated". · Fix: as 2.1. Show which businesses failed. · **S1**
- **2.3** `app/admin/page.tsx:83-106` · Per-business `.catch(() => null)` plus an empty `catch` (102-104). Failed businesses add 0 to users and orders and "none recorded" to the pipeline. · Impact: the dashboard shows confident zeros. · **S1**
- **2.4** `app/admin/users/page.tsx:114-116, 121-132` · A failed `listMembers` is skipped. If nothing was collected, the page **fabricates** a row for the current admin (role `"admin"`, tenant "Platform Administration"), so the table never shows an error or a true empty state. · **S1** (see 6.1)
- **2.5** `app/admin/tenants/page.tsx:179,190` · The rows correctly show "unavailable", but the totals use `?? 0`, so they silently understate. · Fix: show "n/a (k businesses unavailable)". · **S2**
- **2.6** `app/deals/[id]/page.tsx:134` · A failed evaluation fetch becomes `null`. The "Evaluation saved" banner, the decision guide and the inspector all disappear with no error, so the order looks unevaluated. · **S1**
- **2.7** `lib/pipeline-data.ts:9-12,49-52` · `optional()` maps a 404/409 on an evaluation to `null`. The row then reads "Not evaluated / No saved evaluation yet" (`lib/pipeline-model.ts:94`) even though `live_evaluation_id` is set. · Fix: show "Evaluation unavailable" when `live_evaluation_id` is set but the read failed. · **S2**
- **2.8** `app/deals/[id]/documents/page.tsx:36-42 → 172` · If `listFields` fails, `fields` stays `[]` and "Nothing extracted." is shown beside the error alert. · **S2**
- **2.9** `app/deals/sources/page.tsx:87` · "No saved financing offers." is shown when `!offers.length && !isPending`, which includes the error state. `CollectionPages` shows the alert as well. · Fix: gate on `isSuccess`. · **S2**
- **2.10** `components/p7/bank-hold.tsx:30-31` and the select option at about line 66 · When accounts fail to load, the dropdown says "No verified account for this party". The error text is also shown. · **S3**
- **2.11** `app/admin/logs/page.tsx:220-224` and `app/admin/orders/page.tsx:323-327` · When a search or filter removes every row, the message still claims the database holds nothing. · Fix: "No entries match this filter". · **S3**

False positives (error checked before empty): `app/deals/page.tsx:60,157`, `app/overview/page.tsx:184-200`, `components/approval/approval-workflow.tsx:201`, and every P7 list screen.

## 3. Loading that never ends

- **3.1** `app/deals/[id]/page.tsx:340` · The Review checks section renders a `Skeleton` "Loading review…" whenever `review` is null or has no `snapshot_hash` and no findings. With 1.4, a failed review read gives a **permanent skeleton**. A review that legitimately has no snapshot yet does the same. · Fix: separate the states loading / failed (with retry) / not ready ("inputs incomplete"). · **S1**
- **3.2** `app/overview/page.tsx:190-195` · Retry calls `setActiveTimeframe(tf => tf)`. React bails out when state is unchanged, so the effect never re-runs. The error view replaces the whole page, so the timeframe pills are unreachable too. · Impact: a dead end until a manual reload. · Fix: add a `reloadToken` state, as `app/deals/page.tsx:33-36` does. · **S1**
- **3.3** `components/preparation-workspace.tsx:90-101,109` · Polls every 800 ms with no cap or backoff. While `operationId` is set, `disabled = busy || !!operationId` locks **every** control on the workspace. A stuck queued operation (for example, a dead worker) leaves the page frozen. Reloading re-reads `?operationId=` and freezes it again. · Fix: a shared `usePolling({ intervalMs, maxMs, backoff })` that ends in a "still running, check later / stop watching" state. · **S1**
- **3.4** `app/deals/[id]/page.tsx:148-153` · Operation polling every 1.5 s with no cap. "Saved evaluation operation: queued" can sit there indefinitely. · **S2**
- **3.5** `lib/orderfit-api.ts:22-25` · `request()` sets no timeout. A hung API keeps the skeletons on deals, overview, deal detail and AuthShell ("Loading…") until the browser gives up. · Fix: a default `AbortSignal.timeout(…)` in `request()` that maps to `NetworkError` (the timeout UX already exists in `describeError`). · **S2**
- **3.6** `components/approval/use-bundle-flow.ts:264-269` · Polls while a run is active, with no cap. Errors are surfaced. · **S3**

False positives: the admin pages use `finally` (except `app/admin/page.tsx:129-135`, whose `loadData` never throws), and `settle()` in `app/deals/[id]/documents/page.tsx:18-25` is capped at 60 attempts.

## 4. Raw error leakage

- **4.1** `lib/approval-model.ts:75,98,101` · For unmapped codes, `messageForCode` returns `"CODE: message"`, and `describeError` returns `"The saved state changed (CODE)"` or `"CODE: message"`. These feed `describeP7Error`, `QueryError` and the preparation workspace. · Fix: one `userMessage(error)` primitive that never prints the code (log it, or put it behind a "details" disclosure). · **S3**
- **4.2** `app/admin/logs/page.tsx:92-94` with the toast at `155-165` · `Audit export failed. ${e.message}` appears in a toast that carries the **success** icon (`CheckCircle2`). · **S2**
- **4.3** `components/preparation-workspace.tsx:114` · `JSON.parse(typedChanges)` runs on free text. A `SyntaxError` message ("Unexpected token…") is shown through `command()` (106). · Fix: validate the input and show a plain-language field error. · **S2**
- **4.4** `app/deals/[id]/page.tsx:151` · `Evaluation produced no financial result: ${outcome}` and `Evaluation ${status}.` print raw enum values. · **S3**
- **4.5** `components/preparation-workspace.tsx:239-240, 271-272, 278, 294` · Raw `status · subphase`, `op.kind`, `JSON.stringify(fork.changes/outcome)`, the message identity as JSON, and the series as a JSON dump. StoredSeries puts `e.message` inside a `<pre>`. · **S3**
- **4.6** `app/deals/[id]/page.tsx:227, 329-331, 340, 348` · Raw `status.replaceAll("_"," ")`, action names used as button labels ("reopen for review"), the decision enum, and a JSON snapshot dump. The dump is intentional inspection, but it has no human summary. · **S3**
- **4.7** `app/deals/[id]/documents/page.tsx:161-162, 166, 172` · `kind` and `source_role` option labels (`po`, `customer_order`), `parse_status` and `f.status` appear as codes. · **S3**
- **4.8** `app/auth/signin/page.tsx:50`, `app/auth/signup/page.tsx:82`, `components/settings/passkey-panel.tsx:27` · `cause.message` can be a WebAuthn `DOMException` or browser text. · **S3**

False positives: `app/deals/page.tsx:46`, `app/overview/page.tsx:65` and `app/deals/sources/page.tsx:32,38` show `ApiError.message`, which is the server's curated text (`lib/orderfit-api.ts:31-34`), or the generic NetworkError text.

## 5. Browser math on money or verdicts

- **5.1** `components/deals/deal-evaluation-inspector.tsx:640-675` · For every day the browser computes `headroom = candidate_trough − reserve` (`|| "0"` turns missing values into zero) and labels the day **"Breached"**. The engine defines an order-caused breach against `effective_floor = min(reserve, baseline_trough)` (`backend/orderfit/engine/analyse.py:359,369`). It reports inherited baseline shortfalls separately (`analyse.py:365-367`), and `SeriesPoint` carries `effective_floor_minor` (`generated-api.d.ts:203`). · Impact: days that are short only because of the existing baseline show as breaches caused by the order. That can contradict the engine's verdict and push a feasible order towards decline. · Fix: add per-point `order_caused_breach` and `headroom_minor` to the series contract and render them. Never treat a missing value as 0. · **S1** (an S0 candidate: it misstates a financial verdict)
- **5.2** `app/overview/page.tsx:671-674, 697` · Per-delay-scenario headroom (`trough − reserve`) and its sign are computed in the browser. The backend sends only `status` (`backend/orderfit/services/overview.py:145-166`). · Fix: add `headroom_minor` to `OverviewDelayScenario`. · **S2**
- **5.3** `app/overview/page.tsx:231-237` and the legend at `452-463` vs the strokes at `556-558` · The chart clamps negatives to 0 (`Math.max(0, …)`), so a negative net period draws as zero. The legend colours (inflow near-black, outflow grey, net green) do not match the strokes (inflow `#E05D52` red, outflow `#3B82F6` blue). · Impact: the cash chart is misread. · **S2**
- **5.4** `app/overview/page.tsx:726-736` · The progress-bar width is `Number(trough)/Number(2×reserve)`, with no label or explanation. · **S3**
- **5.5** `app/admin/orders/page.tsx:84, 117, 347` · `Number(deal.order_value_minor) || 0` turns a null or unparsable value into **"USD 0.00"** and loses precision above 2^53. It then converts back with `BigInt(Math.trunc(…))`. A currency fallback of `"USD"` applies at line 75. · Fix: keep the string and call `formatMinor` (which prints "amount unavailable"). · **S1**
- **5.6** `app/admin/page.tsx:99,115`, `app/admin/orders/page.tsx:115-119` · The browser sums the pipeline value (BigInt, exact) across at most 100 deals per business, over the admin's own memberships only, and labels it "Total Pipeline Evaluated/Value". · Fix: use backend `/admin/overview` (see 9.3). · **S2**
- **5.7** `lib/pipeline-model.ts:105-115` with `app/deals/page.tsx:78,112` · The browser picks the deal with the lowest balance, then shows *that* deal's headroom as "Above/Below reserve". Another deal with a higher balance but a higher reserve can be below reserve while the badge says "Above reserve". · Fix: select on the lowest headroom, or get the aggregate from the server. · **S2**
- **5.8** `components/preparation-workspace.tsx:245, 271, 308-310` · Money appears as unformatted minor units ("profit 1234500 minor units"). · Fix: a shared `<Money minor currency />` built on `formatMinor`. · **S2**
- **5.9** `app/deals/new/page.tsx:276` and `app/deals/sources/page.tsx:83-87` · Opening cash, amounts, the reserve and principal are entered and echoed as raw "integer minor units", with no formatted preview. · Impact: a 100× entry error is easy to make. · Fix: show `formatMinor(value)` live under each money input. · **S2**
- **5.10** `formatMinor` review (`lib/approval-model.ts:9-16`):
  - Correct today. Handling is string/BigInt-free, so very large values are exact. Negative values give `-USD 1,234.56`. Non-integers and `null` give "amount unavailable".
  - Latent issues: `exponent` defaults to 2 and no caller passes it. That is correct only because the backend allows BDT/USD/EUR/GBP, all with exponent 2 (`backend/orderfit/engine/money.py:34`, `migrations/sql/0004_reference_data.sql:3-4`). `Series.exponent` is ignored. `"-0"` gives `-USD 0.00`. Leading zeros in the input (`"0001234"`) would print `00,012.34` (the backend is not known to emit these, so this is a hypothesis). BDT is grouped Western-style (`1,234,567`) instead of lakh/crore (`12,34,567`).
  - Fix: take the exponent from the payload; normalise `-0` and leading zeros; group by locale per currency. · **S3**

False positives: `app/overview/page.tsx:75` (the currency fallback is never rendered without data), `lib/p7-model.ts:331-335` (`bpsText` is integer-only), `components/landing/order-simulator.tsx:72-168` (labelled illustration), and the `?? 0` percentage fallbacks in `app/overview/page.tsx:104-151` (hidden when the matching warning is present; the backend always sends numbers).

## 6. Fake async, fake persistence, demo data

- **6.1** `app/admin/users/page.tsx:97-101, 108, 532-534` · A **hard-coded personal email address** (PII committed in source) plus an impossible `role === "admin"` check mark users as "Admin" and **replace their real membership role** in the table. "Edit Role" then pre-selects `commercial_lead` (`ROLES` has no `admin`), so "Apply Role" on the current owner, or on that hard-coded user, **demotes them**. The backend blocks only the demotion of the *last* active owner (`LAST_OWNER`, `backend/orderfit/services/membership.py:82-83`). · Impact: a real privilege change from a fake label. · Fix: remove the email check and show `item.role` unchanged. Show platform-admin status only from server data (`/admin/users` returns it). · **S0**
- **6.2** `components/landing/cta-section.tsx:10-15, 35` · The newsletter form shows "Thank you for subscribing! We'll be in touch." with no request. The email address is discarded. · Fix: remove the form or wire a real endpoint. · **S1**
- **6.3** `app/admin/users/page.tsx:221` · The **one-time invitation link** appears only inside a toast that auto-dismisses after 3.5 s (`showToast`, 68-71), with no copy button. The link cannot be retrieved later (`backend/orderfit/services/membership.py:113-117`). · Fix: reuse the persistent link panel in `components/users/users-screen.tsx:102-108`. · **S1**
- **6.4** `app/admin/users/page.tsx:221, 570`, `components/users/users-screen.tsx:94, 107` · Both screens ignore `InvitationView.delivery`. When `invitation_email_enabled` is on, the backend emails the invitation and returns no URL (`membership.py:139-141`). Admin users then sees "Nothing was emailed"; the member screen says the link was lost and tells the owner to **revoke and recreate**. · Impact: (conditional on config) valid emailed invitations get revoked. · **S1**
- **6.5** `components/landing/hero-section.tsx:96-102, 275` · A fictional "Apex Precision Products — **Live** Cash Runway & Order Evaluation", with fixed $ figures and "Safe to Accept Order". Unlike the simulator, it is not labelled as an illustration. · **S2**
- **6.6** `app/admin/tenants/page.tsx:195-204`, `app/admin/users/page.tsx:378-387` · "RLS Active", "Zero cross-tenant leakage" and "Row-level security enforced" are hard-coded cards styled as live telemetry with a green dot. See 10.7. · **S2**
- **6.7** `app/admin/orders/page.tsx:254`, `app/admin/users/page.tsx:349` · `tenantsList.length - 1 || 1` displays "1 Organizations" when there are zero. · **S2**
- **6.8** Workflow-step residue from c7980cd: `components/deals/deals-workflow-stepper.tsx:25-50`, `app/deals/[id]/documents/page.tsx:107-130`, `app/deals/new/page.tsx:206-220`, and "Confirm Terms Gate" in `components/preparation-workspace.tsx:210`. These still advertise "2. Validate" and "3. Confirm". From a saved order, "1. Ingest" and "2. Validate" go to a **blank new-order form** (the validate route redirects to `/deals/new`), and "3. Confirm" redirects to the order page. · Fix: steps that map to real routes (documents → order review → negotiate). · **S2**
- **6.9** `components/landing/order-simulator.tsx:188-193` · "Request a live demo" links to sign-up. · **S3**

Verified fixed by c7980cd: `/deals/new` has no sample loader; `/deals/new/validate` and `/deals/[id]/confirm` are server redirects; `lib/fixture-evaluation.ts` is gone; no `orderfit_deal*` localStorage keys remain. The remaining localStorage use is UI convenience only (`app-sidebar.tsx:93,136`, `connection-indicator.tsx:11,120`), so it is a false positive.

## 7. Accessibility

- **7.1** Inputs whose only label is a placeholder: the admin search boxes `app/admin/logs/page.tsx:171-177`, `orders:264-270`, `tenants:211-217`, `users:394-400`, and the newsletter input `components/landing/cta-section.tsx:42-48`. Sign-in and sign-up (`signin:101-126`, `signup:129-188`) have sr-only labels but the only *visible* label is the placeholder (an S3 aspect). · **S2**
- **7.2** Labels not associated with their controls: `app/admin/users/page.tsx:583, 596, 611, 667, 726` (sibling `<label>`, no `htmlFor`/`id`); `components/deals/deal-evaluation-inspector.tsx:583, 600`; the "Tenant:" span at `app/admin/logs/page.tsx:181-182`. Filter selects with no label at all: `orders:274`, `users:404, 416, 428`. · **S2**
- **7.3** Icon-only buttons with no accessible name: the toast close buttons (`app/admin/page.tsx:250`, `logs:161`, `orders:205`, `tenants:154`, `users:333`) and the modal close buttons (`users:572, 656, 715`). Back-arrow links and the revoke icon have only a `title` (`engine:37`, `security:49`, `system:61`, `logs:109`, `orders:163`, `tenants:112`, `users:282, 541-548`, `app/deals/[id]/page.tsx:182-188`, `app/deals/new/page.tsx:185-191`, `preparation-workspace.tsx:174-180`), which is an S3 aspect. · **S2**
- **7.4** Not keyboard-operable: the delay-scenario cards are `<div onClick>` (`app/overview/page.tsx:677-685`). The connection status bubble opens only on `onPointerUp` (`components/layout/connection-indicator.tsx:169-176`), so Enter and Space do nothing. The SVG `<g onClick>` at `overview:566` has keyboard alternatives in the axis buttons (an S3 aspect). · **S2**
- **7.5** `outline-none` with no focus-visible replacement: `app/auth/signin/page.tsx:61, 69, 72, 131, 140, 151, 158`; `signup:92, 100, 103, 194, 244, 251`; `forgot-password:10, 18, 21, 45`; the business switcher `components/layout/auth-shell.tsx:168`; the range slider `components/landing/order-simulator.tsx:39`. The admin inputs and selects (`logs:176, 188`; `orders:269, 277`; `tenants:216`; `users:399, 407, 419, 431, 590, 600, 615, 671, 736`) and `app/deals/page.tsx:147` show focus only as a 1px border colour change. · **S2**
- **7.6** Status shown by icon or colour alone: the KPI change badges show `Math.abs(val)` with an unlabelled up/down icon (`app/overview/page.tsx:100-154`); the chart series differ only by colour and the legend is wrong (see 5.3); the connection bubble is a colour dot with a `title` (an S3 aspect). · **S2**
- **7.7** Heading structure: two `h1`s on `app/admin/page.tsx:206, 240` and on `app/deals/[id]/page.tsx:190, 226`; the admin modals jump to `h3` (`users:569, 653, 712`). · **S3**
- **7.8** The admin modals (`app/admin/users/page.tsx:564-645, 648-704, 707-759`) have no `role="dialog"`, no `aria-modal`, no labelling, no focus move or trap, no Escape, and no focus return. · Fix: use `components/ui/dialog.tsx` (Radix), which handles all of this. · **S2**
- **7.9** The admin toasts (`page:244`, `logs:155`, `orders:199`, `tenants:148`, `users:327`) are not in a live region, and failures carry a success icon. · Fix: use the `Toaster` (sonner) already mounted in `components/providers.tsx`, with a success/error variant. · **S2**
- **7.10** Motion: `components/ui/scroll-reveal.tsx:70-79` (framer `whileInView`) ignores `prefers-reduced-motion`. The CSS animations (marquee, ping, spin) are covered by the global rule in `app/globals.css:250-257`, and the liquid sculpture honours reduced motion (and is unused). · **S3**
- **7.11** Tab semantics: `app/deals/page.tsx:139-143` has `role=tab` without a tabpanel, `aria-controls` or arrow keys. The overview toggles (`473-488`, `639-662`) and the inspector tabs (`deal-evaluation-inspector.tsx:96-147`) have no `aria-pressed` or `aria-selected`. · **S3**
- **7.12** The cash-flow SVG (`app/overview/page.tsx:519-588`) has no `role="img"`, title or description, and no data table. Only "Net" for the selected period is exposed as text. · **S2**
- **7.13** There is no skip link (`app/layout.tsx:49-53`). Every authenticated page puts a sidebar of about 12 links before `<main>`. · **S3**

## 8. Responsive (320-390 px)

- **8.1** `components/layout/app-sidebar.tsx:389` · The mobile nav trigger is `fixed top-3 left-3 z-30` and sits above the admin headers (`z-20`). Those headers lack the left offset AuthShell applies (`auth-shell.tsx:164`, `pl-10`), so the trigger covers each admin page's back link and title. · **S2**
- **8.2** The admin headers are a fixed `h-16` with long, untruncated titles plus a breadcrumb and buttons, e.g. "Database User Credentials & Membership Roles" (`users:294-296`), and the titles at `orders:175`, `logs:121`, `tenants:124` and `security:61-63`. Expect wrapping and overflow at 320-390 px. · **S2**
- **8.3** `components/deals/deal-evaluation-inspector.tsx:635-680` · A 12-column grid ledger fits four monospace currency strings (e.g. `BDT 12,345,678.00`) into 3/12-width columns with no horizontal scroll. Expect clipping or overlap at 320 px. · **S2**
- **8.4** `app/overview/page.tsx:592-614` · The axis buttons use `repeat(timeline.length, 1fr)`. At 1y the labels are truncated to a few pixels. · **S3**
- **8.5** Tables rely on horizontal scroll only, with no stacked layout: `app/deals/page.tsx:151-152` (`min-w-[760px]`) and all the admin tables. This is acceptable but heavy on phones. · **S3**
- **8.6** `app/admin/users/page.tsx:594` · Two selects side by side (`grid-cols-2`) in the modal at 320 px. · **S3**
- **8.7** `overflow-x-hidden` on the auth page roots (`signin:58`, `signup:89`, `forgot-password:7`) hides any overflow instead of fixing it. · **S3**
- **8.8** Tables with no overflow wrapper: the clause readings table `components/preparation-workspace.tsx:308-310` and the commitment projections `components/approval/bundle-review.tsx:19`. · **S3**

False positives: the hero blob `w-[1000px]` is inside `overflow-hidden` (`hero-section.tsx:13`); the landing tables have `overflow-x-auto` and a hint; `h-screen` in the sidebar is desktop-only; the auth pages use `100dvh`.

## 9. Admin pages

- **9.1** A catch-all redirect to `/auth/signin` on **any** error: `app/admin/engine/page.tsx:20-21`, `security:23-24`, `system:41-42`, `page.tsx:119-120`, `logs:57-58`, `orders:98-99`, `tenants:82-83`, `users:135-136`. In `page.tsx`, `logs`, `orders`, `tenants` and `users` the `try` wraps the whole load, so a network error, a 5xx, `CSRF_REJECTED` or a client exception all send a **server-verified admin** to sign-in. A real 401 is already handled once by `SESSION_EXPIRED_EVENT` (`components/providers.tsx:267-279`). · Fix: drop these client guards, since `app/admin/layout.tsx:19-49` is authoritative, and render errors in place. · **S1**
- **9.2** Duplication. `app/admin/layout.tsx` only guards and returns `<>{children}</>`. Each of the 8 pages repeats the outer shell `div`, `<AppSidebar variant="admin">`, a sticky `h-16` header with a back link and breadcrumb, `ThemeToggle`, a toast implementation, and a client `getSession()` admin check. · Fix: move an `AdminShell` (sidebar, header slot, breadcrumb, sign-out, toasts) into `admin/layout.tsx`, and have pages render only content. · **S2**
- **9.3** Wrong data source. Every "platform" or "cross-tenant" figure is built from the admin's **own memberships** through tenant endpoints (with `limit=100`). The backend exposes `/api/v1/admin/{capabilities,overview,users,tenants,orders,system}` (`backend/orderfit/api/routes/admin.py:21-55`), and these are typed in `lib/generated-api.d.ts:341-346`. `/admin/logs` returns 503 by design (`admin.py:49-50`). `components/admin/capabilities-screen.tsx` exists but is unused. · Impact: the console misstates platform state as "Total Database Users", "Total Database Orders" and the like. · **S1**
- **9.4** `app/admin/users/page.tsx:179, 200, 219` · `financial_revision` is re-read with `getBusiness()` **at click time**. That defeats the stale-input guard documented in `components/p7/common.tsx:161-166`. · Fix: use `useBusinessRevision`. · **S1**
- **9.5** The admin shell has **no sign-out**: `AppSidebar` renders it only when `onSignOut` is passed (`app-sidebar.tsx:360`), and no admin page passes it. · **S2**
- **9.6** `app/admin/layout.tsx:31-39` uses `UnavailableNotice`, whose eyebrow reads "**Not available in this release**" (`components/unavailable-notice.tsx:11`), for a transient session-verification outage. · **S2**
- **9.7** CSV exports build cells by string interpolation with no quote escaping or formula guard (`orders:132-148`, `users:232-249`). Names containing `"` break rows, and values starting with `=`, `+`, `-` or `@` run as formulas in spreadsheets. · Fix: a shared `csvCell()`. · **S2**
- **9.8** `app/admin/orders/page.tsx:87, 133, 311, 365` · `start_date` is labelled "Date" in the table and `Created_At` in the CSV. · **S3**
- **9.9** `app/admin/page.tsx:92-94`, `tenants:190` · User totals add memberships per business, so a person in two businesses counts twice. · **S3**
- **9.10** `app/admin/page.tsx:129-135` · "Verify DB Health" re-runs the whole load and always toasts "Readiness probe re-run", even when the probe failed. · **S2**
- **9.11** Dead admin and landing code: `components/admin/capabilities-screen.tsx`, `components/layout/admin-sidebar.tsx`, `lib/platform-admin.ts` (always `true`), and `components/ui/liquid-sculpture-hero.tsx` (3,480 lines, never imported). Only `users/page.tsx` has dark-mode classes, although every admin page renders a `ThemeToggle`. · **S3**

## 10. Static claims vs backend

| Claim (where) | Verdict | Backend evidence | Sev |
|---|---|---|---|
| T0 "PDF & **OCR** text parsing" (`app/admin/security/page.tsx:31`) | **Inaccurate**: no OCR; scanned PDFs get `ocr_required` | `services/documents.py:144-160` | S2 |
| T0 "Autonomous (Zero-Trust Sandbox)… prompt injection filtering" (`:31`) | Partial: extraction only *proposes* (human confirms); the injection scan is a signal, not a filter | `agent/guards/injection.py:1-3` | S3 |
| T1 "Pure arithmetic, linear delay scan 0..90d" (`:32`) | Accurate | `engine/tolerance.py:12-15`, `engine/analyse.py:242` | |
| T2 "Commercial Lead Review" (`:33`) | Accurate (T2 confirms figures, cannot approve sends) | `migrations/sql/0004_reference_data.sql:5-12` | |
| T3 "Step-Up Auth (**SHA-256 Code**)… requires permission code" (`:34`) | **Inaccurate**: step-up is password re-authentication bound to the SHA-256 *bundle hash*; there is no code | `services/identity.py:423-431`, `contracts/resources.py:246-251` | S2 |
| T3 "Dispatching binding commercial requests to counterparty" (`:34`) | **Overclaim**: execution writes sandbox outbox records only | `components/approval/approval-workflow.tsx` copy; `STAGE_TEXT` | S2 |
| T4 "**Owner / Admin MFA**" (`:35`) | **Inaccurate**: commits are approved by owner/risk_officer (T3) with password step-up; step-up is *refused* when MFA is enforced; the T4 superadmin is a platform role, not an approver | `identity.py:428-429`, `0004_reference_data.sql:13-15`, `0010_p6_approval.sql:58` | S2 |
| T4 "append-only cryptographic ledger" (`:35`) | Partial: `operation_log` is SHA-256 hash-chained; the commitment itself writes baseline projections | `0002_integrity_and_audit.sql:344-396` | |
| Admin overview cards (`app/admin/page.tsx:140-185`): "assign admin… roles", "Cross-tenant… feasibility rankings, risk holds", "connection pool, cluster node telemetry, worker queues, schema migrations", "SHA-256 step-up", "Cluster audit log" | **Inaccurate/partial**: admin cannot be assigned (`ROLES` excludes it); data comes from own memberships; the system page itself disclaims node metrics (`app/admin/system/page.tsx:93-96`); the backend admin log read is 503 | `api/routes/admin.py:49-55` | S2 |
| "Isolated tenant databases" (`app/admin/page.tsx:281`), "Isolated PostgreSQL schemas" (`tenants:170`), "PostgreSQL Isolated Business Namespaces" (`tenants:125`), "Across tenant databases" (`orders:221`) | **Inaccurate**: one database and shared schema with RLS policies plus service-layer scoping; the architecture doc says isolation "no longer depends on Row-Level Security" | `migrations/sql/0003_security.sql` (policies), `docs/architecture/orderfit/05-security-and-evaluation.md:5` | S2 |
| "RLS Active / Zero cross-tenant leakage" (see 6.6) | Static badge: RLS policies exist, but the badge is not probed and "zero leakage" is unverifiable | as above | (6.6) |
| Role change "recorded immutably in the audit log… immediately" (`users:682`) | Accurate | `services/membership.py:85, 97` (`append_audit`) | |
| Admin system: "schema verification… not provided" (`system:93-96`) | Understated: backend `/admin/system` returns `schema_current`, `storage_writable` and `worker_active` | `services/admin.py:107-120` | S3 |
| "The workflow pauses (**LangGraph interrupt**)" (`components/landing/workflow-section.tsx:21`) | **Inaccurate**: no LangGraph dependency or usage | `backend/pyproject.toml` (none) | S2 |
| "Tested against **15** adversarial injection test cases" (`architecture-security.tsx:137`) | **Unverified**: `tests/agent/test_injection.py` has 5 parametrized cases; REQ-13 *plans* 10+5 | `docs/architecture/orderfit/01-requirements-scenario-edge-cases.md:67` | S2 |
| Counter-offer "re-computes headroom **automatically**" / "re-plans automatically" (`faq-section.tsx:45`, `competitive-matrix.tsx:59`) | **Inaccurate**: reply candidates need human review → apply → confirm → evaluate; "up to 3 rounds" is accurate | `contracts/financial.py:192`; `preparation-workspace.tsx:260` | S2 |
| "automatically sizes a deposit or extension to keep cash positive **regardless of payment delays**" (`faq-section.tsx:25`) | **Overclaim**: the engine ranks candidates within a policy space and may decline | `engine/analyse.py` | S2 |
| "Exhaustive 90-day delay scan" (`competitive-matrix.tsx:26`, `faq-section.tsx:25`) | Accurate | `engine/tolerance.py:12-15` | |
| "Every decision, prompt, extracted quote, and approval… SHA-256 hash chaining" (`architecture-security.tsx:35`) | Partial: the hash chain is verified; coverage of "every prompt" was not verified | `0002_integrity_and_audit.sql:362-396` | |
| "LMs extract **all** payment terms, deliverables, and penalty clauses" (`workflow-section.tsx:12`) | Unverified / likely overclaim | `agent/prompts/extract_order*.md` | S3 |
| "Password recovery isn't available yet" (`app/auth/forgot-password/page.tsx:37-41`) | **Possibly stale**: `/auth/password-reset/{request,confirm}` exist behind an account-access capability | `api/routes/account_access.py:30-104` | S2 |
| "Nothing is emailed" for invitations (see 6.4) | Conditionally inaccurate | `services/membership.py:139-141` | (6.4) |
| Overview "payment delays (0 to 60 days)" (`app/overview/page.tsx:634`) | Accurate | `services/overview.py:145` | |
| "Execution is sandbox-only; real rails need separate authorization" (FAQ, sign-in disclaimer) | Accurate as far as checked (account email via Resend is not a payment or negotiation rail) | `services/resend.py`, `workflow/execution.py` | |

---

## False positives (do not re-check)

- `lib/orderfit-api.ts:93` `writes = next.catch(() => undefined)`: keeps the write queue alive; the caller still receives the rejection through `next`.
- The `sessionStorage`/`localStorage` `catch { }` blocks in `lib/orderfit-api.ts:46-75,128`, `auth-shell.tsx:22-23,102`, `session-reset.ts:18`, `connection-indicator.tsx:13,121` and `app-sidebar.tsx:97,137`: storage-disabled fallbacks.
- `app/api/health/route.ts:13,27,31` and `connection-indicator.tsx:51`: a failed probe maps to "unreachable" or "unknown", which is the intended semantics.
- `lib/pipeline-data.ts:43`: `stopped = true; throw` re-throws.
- `lib/p7-model.ts:155,223`: validation helpers that return false.
- `app/admin/system/page.tsx:23-27`: has `finally`; a probe failure is shown as unreachable.
- `app/deals/page.tsx`, `app/overview/page.tsx` (apart from 3.2) and every `components/p7`-pattern screen: the error is checked before empty.
- `app/deals/page.tsx:104`: "Set the cash baseline" → `/deals/new` does show the baseline form when none exists.
- `app/error.tsx:64`: `retry` is the correct Next 16 prop (`node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md:218-261`).
- `AuthShell` 401 spinner: `expiryRedirect` redirects every non-public path (`lib/session-expiry.ts:11-13`).
- Marquee, ping and spin animations: covered by the global reduced-motion rule (`app/globals.css:250-257`).
- `components/landing/order-simulator.tsx`: browser arithmetic on clearly labelled illustration figures.
- The landing tables (`competitive-matrix.tsx:127`, `architecture-security.tsx:160`) have `overflow-x-auto` and a scroll hint.
- `app/overview/page.tsx:921` uses the primary currency for `currency_balances`, which is correct today because the backend emits a single primary-currency balance (`services/overview.py:209-219`).
- The Radix-based `components/ui/dialog.tsx` and `components/ui/sheet.tsx` handle focus trap and return; the mobile sidebar uses `Sheet`.
