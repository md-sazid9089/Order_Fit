# Order workflow

OrderFit assesses an order against the business's dated cash baseline. It compares
revised terms and records human-approved sandbox actions. Model output is a proposal;
the deterministic engine owns every financial result.

## Enter and review an order

1. Sign in and select an authorized business. Platform administrator status does
   not confer membership or financial action authority.
2. Configure the dated opening balance, coverage, obligations, owner policy, and
   supported financing offers. Missing dates or coverage remain review issues.
3. Create an order at `/deals/new`. Save the customer, draft, and input revision
   through the API. Continue using the saved order UUID.
4. Attach original documents on the saved order's Documents page. Supported
   extraction proposes quoted candidates. Resolve missing/conflicting values or
   enter manual evidence; OCR is not supported.
5. Review the saved inputs and warnings. **Confirm and evaluate** persists the
   confirmation snapshot before admitting the durable evaluation operation.

Standalone legacy validation/confirmation links redirect to the saved workflow.
A browser timer, local draft, or unavailable API cannot create a financial verdict.
The UI shows failed reads explicitly and offers retry; it never substitutes a demo result.

## Inspect and revise

The order displays a stored engine result, complete cash series, scenario coverage,
alerts, and input freshness. Technical failure is not a financial rejection.
Missing evaluations and stale results remain explicit. Reloading the operation link
recovers its server state.

What-if runs are separate forks. Applying a proposal requires review and current
versions, then the same confirmation/calculation pipeline. Replies never silently
change canonical inputs. Currency, integer minor units, dates, and source provenance
must survive every boundary without browser or model recalculation.

## Approve sandbox actions

Preparation creates exact draft revisions and review evidence, not authority to send.
A person separately reviews an immutable bundle and completes session-bound step-up.
Approval binds inputs, terms, recipient/account evidence, content, expiry, and sandbox
mode. Changing any approved item requires a new bundle and approval.

Dispatch, commitment, and compensation have distinct approvals. Commitment requires
the necessary exact-term party acceptances. A bank-change hold requires verified
account/evidence review; generic overrides cannot clear safety constraints.

Durable execution preserves its operation/run identity across lost responses and
retries. Partial completion remains visible. Completed commitments project into the
baseline once; compensation adds inverse evidence without erasing the original history.
No commercial email, payment, bank, or lender adapter performs real-world effects.

## Audit and access

Business audit history and exports require current tenant authorization. Verify exact
canonical bytes and sequence links, and retain partial-range/anchoring limitations.
The database-owned chain is tamper-evident, not proof against a privileged operator
rewriting its tail. Admin global logs and platform mutations remain unavailable.

See [contracts](contracts/README.md), [security](security/README.md), and the
[manual acceptance guide](manual_stress_testing_guide.md) for detailed cases.

## Roles and scope

Navigation is a convenience; the API independently checks every request.

| Role | Read orders | Prepare/review inputs, forks, drafts, replies | Manage cash/offers/policy/payees | Audit | Approve sandbox effects | Memberships |
|---|---|---|---|---|---|---|
| Viewer | Yes | No | No | No | No | No |
| Auditor | Yes | No | No | Yes | No | No |
| Commercial lead | Yes | Yes | No | No | No | No |
| Risk officer | Yes | Yes | Yes | Yes | Yes | No |
| Owner | Yes | Yes | Yes | Yes | Yes | Yes |

A selected business must match a current membership. Switching business clears its
query/UI state; unknown-outcome command keys remain bound to the original business
path/body for recovery. Sign-out, sign-in, expiry, and password changes clear session
state. Retired browser financial drafts are removed rather than reused as evidence.

## Source and supporting screens

| Surface | Contract and meaning |
|---|---|
| `/`, `/auth/signup`, `/auth/signin` | Landing simulator is illustrative. Sessions use HttpOnly cookies, never JSON/localStorage credentials. |
| `/auth/invitations/accept` | Explicit one-time invitation handling after sign-in; tokens are not carried through sign-in or stored persistently. |
| `/deals/sources`, `/cash-flow` | Explicit dated opening cash and in/out events; corrections/voids preserve history. |
| `/risk-constraints` | Immutable policy versions; existing orders retain their pinned policy until explicitly revised. |
| `/financing` | Recorded offer terms are not lender availability, approval, or contact. |
| `/payees` | Masked account display. Recorded human verification is not bank confirmation. |
| `/deals/customers` | Customer identity, known domains, and bounded continuation. |
| `/useraccess`, `/settings` | Owner membership/invitation management and authorized user/business settings. `/users` redirects to `/useraccess`. |
| `/orders`, `/sandbox` | Redirect to the saved-order pipeline; they do not execute anything. |
| `/admin/*` | Server-verified platform identity plus backend read capability. No implied business-detail authorization; logs/mutations remain unavailable. |

Document upload supports text-layer PDF, TXT, CSV, and JSON up to 25 MiB.
Scanned/no-text PDFs and DOCX/XLSX require manual review. Originals remain private;
quotes/pages accompany candidate values. CSV uses preview and explicit confirmation,
including duplicate/error review; preview alone writes no canonical cash events.
Conflicting, missing, unsupported, injection-like, and unavailable-model outcomes
remain review states. Original source content is untrusted.

Preparation compares saved options and engine-backed explanations. Typed forks cover
supported deposit, customer/receivables delay, cost overrun, supplier extension, and
recorded financing changes. Language input can only propose a bounded fork; it cannot
invent an offer, party, recipient, or approval. Conditional replies are not exact
acceptance. Bank-change resolution requires an owner/risk officer, the exact reply,
verified account, and written evidence. Unsupported terms/figures block message review.

## Acceptance requirements

Use a disposable stack and synthetic data. The browser runner stores traces outside
the repository by default; traces can contain synthetic credentials and must not be
committed. Do not run load/stress/soak campaigns on a host below their 15% free-disk gate.

| Area | Required checks |
|---|---|
| Durable journey | Signup, business setup, saved order, review, confirmation, evaluation, and refresh at each boundary; exact result/version/coverage/decision guide. |
| Exploration and replies | Fork isolation; explicit apply/reconfirm; rejected fabricated terms; reviewed replies; exact acceptances; strict bank-change holds. |
| Effects and recovery | Review, bundle, reauthentication, approval, dispatch, separately approved commitment; reload one projection; compensation retains original history. Lost responses recover the same identity. |
| Authorization and freshness | Each role via direct URL and API; foreign business; no membership; role revocation; expired session; changed inputs, recipient, or approval; no stale/unauthorized action. |
| Input safety | Malformed/oversized/no-text/unsupported/conflicting/injected documents; invalid money/date/percentage/delay; no automatic confirmation, partial write, or private cross-tenant bytes. |
| Frontend behavior | Signed-out, empty, populated, denied and no-business states; 390px/1280px; light/dark; keyboard, focus, labels, error announcements, long text, and loading layout. |
| Read/command failures | Slow/5xx/offline reads, CSRF expiry, pagination, and lost writes; honest retry and preserved scoped command identity; no synthetic verdict or sensitive draft persistence. |
| Financial display | Exact minor units/currency across result, comparison, export, and tooltip; no browser float-derived authoritative result. |
| Navigation | Correct business scope, saved UUID, and back navigation; legacy routes do not create another confirmation pipeline. |

These are acceptance requirements, not a claim that every combination was exercised
in one run. See [Development](development.md#verification) for executable checks.
Account mail and live-model quality have independent rollout/evaluation gates;
provider-off workflows must remain useful. Hosted acceptance is separate from a local pass.

## Defect reports

Treat tenant/role/approval bypass, incorrect financial results, duplicate/real effects,
or lost immutable evidence as P0. A blocked primary journey, misleading stale/failed
state, unrecoverable approval, or accessibility barrier is P1. Supporting presentation
issues with a safe workaround are P2.

Report route, role, business scope, preconditions, expected/actual behavior, safe
request/operation IDs, refresh/retry outcome, and sanitized screenshot/trace evidence.
Never include cookies, credentials, full account numbers, or private financial documents.
