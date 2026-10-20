# Reproducible local hackathon demo

> The current provider-free persisted journey is `./scripts/run-e2e.ps1 -TestPattern "an owner evaluates, approves, commits and compensates"`. It creates and tears down a labeled disposable stack. See [Workflows](workflows.md) for current UI behavior; the dated campaign below remains historical.

17 October 2026. Sandbox-only, synthetic inputs, provider off by default. Final
acceptance status is in [the readiness report](evidence/reports/hackathon_readiness_report.md).
Do not use an existing/shared Neon URL as a substitute for this disposable setup.

## Setup and reset

Use Docker, PowerShell7, Node22 with the locked web packages, uv and Python3.12.
Check free disk/memory before starting. C: currently fails the15% stress gate;
do not run `backend-stress.spec.ts`, load ramps or soak on this machine.

From repository root:

```powershell
./scripts/run-e2e.ps1 -TestPattern '^(?!.*HTTP bursts).*' `
  -EvidenceDirectory 'E:\Order_Fit\var\hackathon-browser' `
  -BrowserReviewGate 'E:\Order_Fit\var\hackathon-review.json'
```

The runner creates unique images/Compose project, loopback web port, restricted
runtime and worker LOGINs, migrated disposable PG17 and private document volume.
It generates private random credentials without printing them. Production web
uses the same-origin proxy. The eight selected browser tests run first. The
reported local URL is then available for a presenter-created synthetic account.
Removing the named gate ends review and tears down only this run's containers,
volumes and image tags. Keep raw browser traces under ignored `var/`: they may
contain synthetic session credentials. Re-run for an empty deterministic reset.

## Short complete workflow

1. Open the runner URL and create a synthetic business account. Show the empty
   persisted pipeline and authenticated Owner role. Avoid enrolling the only
   passkey for a presenter account: MFA has no password-only recovery.
2. Choose New order; set opening cash `10000000` minor BDT units, explicit as-of
   date and coverage365days later, source `Synthetic demo baseline`.
3. Create customer `Synthetic Demo Buyer`, known domain `buyer.test`, order
   reference `DEMO-001`, revenue `5000000`, explicit order/delivery/invoice dates,
   delivery30days after as-of and payment30days from delivery. Default policy
   has no reserve; inspect it instead of assuming a reserve.
4. Save/reload the draft, review inputs and Confirm and evaluate. Show operation
   succeeded, persisted evaluation and actual engine facts. This deliberately
   simple no-cost example has revenue/profit `5000000` minor (`BDT50,000.00`),
   baseline cash `BDT100,000.00`, final cash `BDT150,000.00`. Final numerical
   checks and a richer reserve/financing example are in the reference fixtures;
   no template/AI text is the calculator.
5. Open What-if and negotiation preparation. Explore a typed change in a fork;
   inspect comparison before applying. A fork alone changes no canonical facts
   or approvals. Review exact recipient `purchasing@buyer.test` and terms.
6. Record preparation review, prepare send bundle, reauthenticate and approve
   its exact hash, execute in sandbox. Show completed outbox/action evidence.
   Enter an unconditional synthetic reply; review any changes/reassess through
   the same confirmed-input path. A conditional reply is not exact acceptance.
7. Record the required owner-attested party acceptance for the current exact
   terms. Prepare and separately approve the commit bundle. Execute, inspect
   settlement/baseline projection, then reload. Sandbox effects move no real money
   and send no real communication.
8. Export the decision/audit record and verify its PostgreSQL canonical chain.
   Explain partial-range/empty-range/tail-anchor limits. Demonstrate separately
   approved compensation with inverse references while original history remains.

The existing automated lifecycle also injects a lost draft/execute response and
recovers the original saved identity; use its evidence if repeating every step
would lengthen the presentation. Passkeys, paging, CSP, mobile navigation and
recoverable failed reads have separate browser checks.

## AI and permission demonstration

Label the live stack **AI off / deterministic manual fallback**. Supported text
documents can be uploaded privately; extraction unavailable status must lead to
manual review, with original bytes retained. Recorded unit fixtures demonstrate
evidence/page/quote proposals and guarded failures without paid calls. Current
drafts, explanations and replies use deterministic templates/parsers. Do not call
these live AI or present fixture replay as measured model quality.

Live OpenAI extraction/what-if quality requires separately authorized model,
synthetic corpus, call/token/time budget and provider evidence. Prepare that
evaluation separately; an unknown recording must fail visibly with no live
fallback. The feature's useful distinction is a source-grounded proposal that a
person reviews, followed by independently computed money and exact effect approval.

Demonstrate a tenant-denied read with a second synthetic account and a legitimate
positive control. Demonstrate stale-input/approval refusal and risk constraints
using the saved-order tests. Never disable controls to shorten a demo. Owner
attestation is not independent bank/email/party verification or legal acceptance.

## Recovery and limits

Refresh operation/bundle state after a timeout; retry with its original command
key. Restart only the run-owned API/worker identified by `environment.json`;
recheck `/api/health`, reload and reconcile actions/projection/audit. Process
restart verifies that failure model, not host/storage loss. Stop the runner by
removing its run-specific gate after finishing.

Do not claim production readiness, compliance certification, external provider
retention/KMS controls, long-load capacity, live AI quality, OCR/office formats,
FX/portfolio allocation or real effects. Frontend defects found in this campaign
are recorded for follow-up because frontend modifications are prohibited.
