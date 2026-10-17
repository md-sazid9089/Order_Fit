# Hackathon risk, fallback and claim-to-evidence matrix

Campaign: 17 October 2026, starting `ebaa8f9`. T=task completion40%,
S=security/compliance30%, I=innovation/interaction30%. No official score is inferred.
`pending` means no campaign pass yet; historical claims are explicitly labeled.
Each final row must name its test, target, result and practical limitation.

| Risk/requirement | Priority/rubric | Method and expected result | Target/artifact | Actual status/limitation |
|---|---|---|---|---|
| Clean/forward migration, authoritative schema | P0 S/T | Original296 SQL checks, preserved old rows, supported branch upgrades, actual sole0019 head | Disposable labeled PG17; `tests/db/conftest.py` | Focused reviewer fixture passed; full final pending |
| Tenant/actor isolation and runtime privileges | P0 S | Actual restricted LOGIN positive/negative controls; no context empty; commit/rollback/reuse clears context; no cross-tenant writes/data | DB suite/security reviewer | Focused group42passed; final pending |
| Exact approvals, role/session/recipient freshness | P0 S | Wrong bundle/kind/account, revoked role/session, stale/expired evidence deny and leave no effect; legitimate send/commit succeeds | DB approval/execution + browser lifecycle | pending final |
| Correct money/rounding/loan fees/profit/trough/reserve | P0 T/S | 22 reference goldens plus independent edges, half-up and no-double-counting assertions | Pure engine/adapter tests/reference selftest | A focused61passed; reference run pending |
| Zero final receipt publication/projection | P1 T/I | Full deposit, rounding/concession zero; positive actual movements only; unchanged profit/series; durable publication and settlement | A1 new pure/DB regressions | reproduced; repair pending |
| Aggregate output bounds | P2 T/S | Reject scenario-expanded output beyond frozen HTTP money range before live evaluation; never clip | A2 financial bounds regressions | reproduced; repair pending |
| Sunk inventory extension eligibility | P2 T/I | Only incremental deferrable costs move; legitimate complete extension accepted | A3 fork/reply regressions | reproduced; repair pending |
| Auth/password/passkeys/CSRF/session expiry | P0 S | Origin/CSRF and challenge replay/origin/RP/cross-session checks; correct password+verified passkey positive controls | DB auth/passkeys + existing browser checks | B focused42passed; final pending |
| Invitation/role/last owner/account evidence | P1 S | Owner controls, matching invitation identities, last-owner guard, append-only verification and change invalidation | P7 DB/browser sources | pending final; email ownership not independently verified |
| Upload command identity | P2 T/S | Same key/body replays original; differing bytes/actor/path conflicts, concurrent retry one source/audit | B1 new API/DB regression | under reproduction |
| Private original bytes/download integrity | P1 T/S | Authorized original bytes match immutable hash; tamper/missing storage returns safe failure without bytes | B2 storage/API regression | under reproduction; hosted S3 separate |
| Source parsing/MIME/size/path/parser isolation | P1 S/I | Supported PDF/text/CSV/JSON; malformed/oversized/unsupported explicit; preserved bytes; bounded subprocess/resources | Pure/P4/security DB suite | pending final; OCR/DOCX/XLSX unsupported |
| Quote/page/negative grounding/conflicts | P1 T/I | Wrong quotes/pages/signs/currency not marked grounded; valid supported examples pass | C2 AI corpus/regressions | reproduced; repair pending |
| Conditional reply exact acceptance | P1 T/S | Prefix/suffix/later negation/conditions deny; exact unconditional positive; no acceptance row on denial | C1 pure + persisted DB regression | reproduced; repair pending |
| Aggregate AI input/output limits | P2 S/I | No provider invocation over100k chars; clear manual path; excessive returned candidates normalize invalid | C3/C4 focused tests | reproduced; repair pending |
| AI off/recorded/no unknown live fallback | P1 S/I | Zero network; fixture miss unavailable; refusal/timeout/rate-limit/incomplete/invalid output manual recovery | P4/P5/agent suite | C initial69passed; final pending |
| Live AI field accuracy/language quality | P1 I | Authorized synthetic corpus through configured model, provenance, field/evidence accuracy | External provider | blocked: no target/budget authorized; recordings do not prove quality |
| Atomic mutation/audit and publication | P0 S/T | Failure injection rolls back partial state; old live evaluation superseded atomically; denied evidence separately durable | DB P3/P6/stress-remediation | pending final |
| Idempotency/concurrent duplicate/lost response | P0 S/T | Same identity after pending/success/failure; payload/actor/path conflict; one run/effect/projection | DB + lifecycle browser | pending final; expiry/retention governed by contract |
| Worker leases/fencing/restart/absence | P1 T/S | Expired claimant cannot publish; interrupted work recovers same identity; no-worker ready503 | Worker/process/security tests + local stack | pending final |
| Commitment serialization/compensation | P0 T/S | One unresolved business commitment; baseline event attribution/dedupe; approved inverse links preserve original history | P6 DB/browser lifecycle | pending final |
| Notifications/paging/exports/history/audit | P1 S/T | Per-user reads, bounded continuation, formula-safe CSV, exact PG canonical audit bytes | P7/pagination/audit suites | pending final; tail anchoring/provider retention separate |
| Browser critical journey, refresh/navigation | P1 T/I | Real signup→baseline→order→confirm/evaluate→prepare→approve/send→reply→commit→reload→compensate | Fresh production proxy/API/worker/PG17/private storage | running initial8test selection; final pending |
| All reachable route/mobile/loading/error states | P1 I | Existing15route sweep at1280/390px; held-read loading, CSRF/read retry, keyboard/CSP | Existing browser suite | pending final; frontend repair prohibited |
| 20-order related-read performance | P2 I/T | Three controlled150ms samples,40related reads, ≤4customer/≤20overall; all labels/results appear | Existing pipeline browser fixture | pending; client scheduling only, no backend capacity claim |
| Dependency/container/build/proxy guards | P1 S/T | Locked installs, Ruff,112contract ops, sole head, audit, nonroot private services, actual running readiness | Local build/audits | uv97packages/Ruff/contracts/head pass; npm0vulns; pip-audit0known; final build pending |
| Long load/spike/stress/soak/large tenant | P1 T/S | Resource preflight, abort gates, persisted reconciliation | Would require isolated supported storage resources | blocked: C free<15%; no capacity/leak-free claim |
| Backup/restore encryption/quarantine | P1 S/T | Wrong-key/tamper rejection, original bytes/audit restored, copied auth quarantined | Existing local DB restore tests | pending full suite; provider/KMS/retention historical only |
| Hosted deployed acceptance | P1 S/T | Joint deployed source/schema/images/network/TLS/roles/storage/provider | External target | untested this campaign; existing Neon drill remains historical |

## Failure contracts

| Failure | Expected visible/durable behavior | Verification/remaining boundary |
|---|---|---|
| Lost response/browser navigation | Retain command identity, refresh persisted operation, no fabricated rejection | Lifecycle browser plus DB replay tests; exhaustive browser timing permutations untested |
| API unavailable/session expired | Technical error/retry or signin, no successful financial transition; caches scoped to session/business | Existing mobile/recovery/unit tests; frontend issues recorded only |
| DB checkout/lock/transient conflict | Bounded typed retryable capacity/conflict; no partial mutation; original key on retry | Existing runtime/lock/atomicity tests; prolonged saturation blocked |
| Worker absent/lease lost/killed | Ready503 on absent heartbeat; same operation resumes, stale fence cannot publish | Existing process tests + stack restart; host/storage-loss durability not proved |
| Missing/tampered storage | No bytes from corrupt source, sanitized unavailable result; preserve metadata/evidence | B2/P4 storage tests; hosted outage separate |
| AI off/refused/incomplete/invalid/timeout/rate limit | Explicit unavailable/provenance, useful deterministic/manual path, no canonical edit | Provider-free test matrix; live quality separate |
| Missing/conflicting/unsupported financial facts | Needs-input/review; no invented dates/money/numeric verdict | Contract/source/engine tests; unsupported formats remain disabled |
| Stale/revoked/expired approval/account change | Refuse remaining effects; immutable completed history retained, approved compensation separate | P6 security/execution tests; no real effects exist |

## Evidence classification

Fresh results must carry final source manifest, test command and local environment.
Initial focused passes precede repairs and cannot certify the final integrated
application. Historical reports establish where to investigate; inference from
source is not runtime proof. Unavailable external and frontend repair gates stay
visible even if all available local tests pass. No exhaustive race/security claim
or coverage percentage is asserted.
