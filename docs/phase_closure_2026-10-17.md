# Remaining phase closure — 17 October 2026

Continuation of [the reconciled audit](orderfit_audit_2026-10-17.md), on `main`
at `eca00c9` plus preserved working-tree changes. Backend security/MFA work remains
owned by the other active task. No shared database migration, restore, secret
change, real outgoing action, commit or push was performed in this continuation.

## What changed

- Extended the real browser lifecycle from negotiation-route navigation through
  exact draft review, password-bound send approval, sandbox outbox execution,
  immutable incoming replies, rejection of non-exact acceptance evidence, a new
  exact acceptance, separate commit approval, persisted settlement after reload,
  and separately approved compensation with inverse effects. Synthetic identities,
  source attestations and passwords only; no approval bypass.
- Added execution-response-loss recovery: admit the real request, discard its
  response, then reload saved bundle state and require exactly one completed
  outbox effect and one negotiation round. Technical uncertainty is not rejection.
- Fixed a reproduced concurrent-test harness race. Compose projects already had
  separate databases, but shared image tags could change between provisioning and
  startup; simultaneous Playwright runs also deleted each other's trace files.
  `scripts/run-e2e.ps1` now uses private per-run API/web image tags and a private
  temporary output directory. Cleanup removes only its own containers, volumes,
  tags and configuration files; browser evidence is retained. Two unit regressions
  protect the runner's isolation and cleanup contract.

## Evidence and limits

- Browser round 1: two passed, four failed at sign-up (503 / undefined-column
  SQLSTATE) while the MFA mapping and migration were being introduced. Not a pass.
- Round 2: five passed; the new lifecycle reached sending but used a synthetic
  reply without the required exact acceptance phrase. Correct server rejection.
- Round 3: **six passed in 2.2 minutes**, including the complete send/reply/accept/
  commit/reload/compensate journey. No financial or authorization rule was changed
  to obtain this result.
- Round 4: five passed, two failed; concurrent runners removed Playwright trace
  files, producing ENOENT during lifecycle teardown and the passkey test. This
  motivated private evidence directories; it is not a clean browser pass.
- Round 5: **seven passed in 2.5 minutes** using private images and private output,
  including the complete lifecycle, lost-response recovery, verified passkey
  enrollment/login, tenant HTTP stress, continuation recovery, CSP, keyboard focus,
  contrast and mobile recovery. This continuation stopped at five browser rounds.
- Fresh engine/agent/architecture suite: **133 passed in 272.48 seconds**. Reference
  calculator: **22 cases, zero problems**; independent selftest: **zero failures**.
  No golden outputs or financial formulas were changed.
- Fresh frontend unit suite: **97 passed**; typecheck passed. Backend Ruff passed;
  generated contracts checked at **112 operations** after the owner's changes.
- Broad backend run started on `0017_platform_authority`: **516 passed, two failed,
  three warnings in 1116.46 seconds**. Failures were the forbidden global-admin
  route assertion and the real-worker subprocess starting after disk advanced to
  `0018_passkey_mfa`. A subprocess can load newer code than its parent fixture.
  This mixed-snapshot run is not certification of the current MFA checkout.
  Fresh current-head targeted rechecks: **18 passed, one deprecation warning in
  144.64 seconds**, including both previously failing cases, admin security and
  signed passkey tests, on another fresh disposable PG17 fixture. Counts must not
  be summed as if they were disjoint full-suite acceptance.

The successful round-3 sustained probe made 3,873 requests in 60.14 seconds:
2,905 HTTP 200, 484 HTTP 404, 484 HTTP 422 and no 5xx; p95 280.80 ms at concurrency
eight. Concurrent CPU-heavy verification makes these local observations unsuitable
for attributing a performance improvement or estimating production capacity.

Final round-5 sustained probe: 2,820 requests /60.20 seconds at concurrency eight;
2,114 HTTP200,353 HTTP404,353 HTTP422, no5xx; p95 **371.87 ms**. Burst p95 values:
reads549.68ms, same-key writes1218.18ms, invalid writes104.06ms. These measurements
were taken under concurrent verification load, not a controlled before/after test.
Final API/web production image builds passed. Private manifest-list digests were
API `sha256:15954a91a3e7caf88687096deb91aa550579e461afea701f994d93a6e5088eac`,
web `sha256:7d300404f0c69c4243f583dc00df9e4cf4972951c7f2c29bc88aa7f3ecc15103`.
The runner removed only its own stack, volumes and private image tags after success;
evidence remains at `C:/Users/moham/AppData/Local/Temp/orderfit-e2e-1cc5fec564-results/`.

## User-authorized main-account and free-provider checks

The user authorized a test account on the main application rather than a disposable
Neon branch. Browser preview of port 3000 showed API unreachable, and synthetic
sign-up returned HTTP 500. Its existing API container explicitly refuses startup
with **“Database schema is not current”**. No successful account creation is claimed.
No shared-schema migration or failure injection was inferred from test-account
authorization. A separate host API's `/health` 200 did not establish readiness or
that the container web proxy was connected to it.

The user requested `freellmpool`. A temporary, credential-free, loopback-only
`ghcr.io/0xzr/freellmpool:0.13.0` gateway was tested through the existing sole
`agent/llm.py` boundary. No application configuration or dependency was changed.
Only synthetic text was sent; no host provider keys or documents were mounted.
Four bounded extraction cases pinned to `pollinations/openai` returned one TIMEOUT
and three PROVIDER_UNAVAILABLE results. One bounded compatibility check pinned to
`llm7/default` returned TIMEOUT. No parsed candidate or model-quality pass resulted.
The temporary gateway container was removed after the probes.

The project's [official README](https://github.com/0xzr/freellmpool/blob/main/README.md)
documents its Responses compatibility; its [privacy FAQ](https://github.com/0xzr/freellmpool/blob/main/FAQ.md)
explains that prompts go to selected upstream providers. Gateway reachability and
model inventory are not proof of structured-output support, free-route availability,
privacy suitability or independently reviewed financial extraction quality. These
checks do not substitute for the plan's OpenAI acceptance gate.

## Phase disposition

| Phase | Current disposition | Remaining acceptance |
|---|---|---|
| P0 contracts | Generated artifacts checked, 112 operations | New MFA/platform contracts remain subject to their owner's final regression evidence |
| P1 identity/operations | Restricted-role journey plus18current-head admin/passkey/worker checks pass on isolated PG17 | No hosted-role claim or fresh all-tests-on-one-frozen-snapshot claim |
| P2 engine | Fresh 133-test subset, 22 reference cases and independent selftest pass | No new financial semantics gap found in this continuation |
| P3 manual journey | Local browser gate exercised | Main application's stale runtime is not repaired by a disposable-stack pass |
| P4 documents/AI | Partial | Independent live extraction quality; hosted private-storage/policy evidence; free probes unavailable |
| P5 preparation/replies | Local exact-message/reply/acceptance journey exercised | Live language-quality scope remains unverified |
| P6 sandbox execution | Full positive browser journey and final response-loss recovery pass | Real sending remains intentionally absent; broad current-snapshot backend certification stays separate |
| P7 supporting operations | Existing capability boundaries preserved | Platform console remains unavailable; final owner security evidence, broad accessibility/scale work remain |
| P8 deployment/handoff | Partial | Hosted Neon/PgBouncer/Render/S3/Vercel checks, joint restore and historical rotation evidence |

No claim that every phase, every screen, live AI or production deployment is
complete. Main-application migration needs a coordinated release decision, not a
test-account workaround. Destructive restore/concurrency/failure tests remain
limited to verified disposable targets. See [external acceptance](deployment/external-acceptance.md).
