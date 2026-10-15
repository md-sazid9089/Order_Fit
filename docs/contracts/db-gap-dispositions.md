# Database gap dispositions — P0 contract decisions

These are accepted requirements, not executed migrations/services. Existing
`0001_core_schema` and its SQL components remain unchanged. Read the plan's full
gap descriptions alongside this disposition register.

| Gap | Disposition | Phase | Required evidence |
|---|---|---|---|
| DB-01 | Verified session, scoped transactions, non-owner login; reuse business/app_user/membership; explicit separate URL injection | P1 (P0 config) | V03 actual login/no-context/pool/owner-admin negative tests |
| DB-02 | Both env files untracked, local bytes preserved; credential-bearing URLs confirmed, historical credentials require owner rotation | P0 tracking complete; rotation external | No tracked secret files; hashes compared before/after; rotation unverified |
| DB-03 | Keep deal.version; add input_version, snapshots, coarse business financial_revision | P1/P3 | V09 workflow-only vs financial updates |
| DB-04 | Child-write invalidation triggers, source/account/offer revisions, business->deal->related lock order | P1/P3/P6 | V09 direct runtime writes and confirmation/publication races |
| DB-05 | Full dated cash_event query, past-event opening reconciliation and bounded complete horizon; filtered view not sole source | P2/P3 | V06 >540-day baseline/late funding/scan |
| DB-06 | Retain eight deal states; operation subphases for expanded workflow | P1 | V02/V10 legal transitions/guard consistency |
| DB-07 | Add computing->awaiting_confirm; blocked result stays operation/review outcome | P1/P3 | V09/V10 no fabricated numeric evaluation |
| DB-08 | Separate transition UPDATE then input UPDATE in same transaction | P3 | V09 combined frozen edit fails, sequence succeeds, rollback preserves |
| DB-09 | Immutable existing approval plus bundle/run/revocation; current session/role/revision/time checks | P6 | V11 revoked/expired/stale/actor-revoked |
| DB-10 | Full subject/body/channel/recipient manifest and strengthened send guards | P6 | V11 altered metadata and stale/expired send blocked |
| DB-11 | Kind-specific exact manifest/run membership; server canonical payload | P6 | V11 extra/wrong-kind action and cancellation rejected |
| DB-12 | Same-deal/source composite constraints and verified actor binding | P1 foundation/P6 execution | V03 cross-deal message/document tests |
| DB-13 | Unique execution_run per bundle/run-item, durable business commit gate | P6 | V13 partial/retry/double-click/concurrent commitments |
| DB-14 | Add auth_session, step_up_grant, operation, party_acceptance; no second user system | P1 auth/jobs, P5/P6 rest | V04/V10/V11 durable sessions/leases/exact terms |
| DB-15 | Self-only global profile/password, membership revocation, last-owner protection | P1/P7 | V04 shared-user takeover/last owner |
| DB-16 | New password accounts explicitly MFA false; existing true fail closed | P1 | V04 unsupported MFA not bypassed |
| DB-17 | Recipient-specific notification rows + event dedupe/read-own | P7 | V03 one member cannot mark another's notification read |
| DB-18 | Immutable parse/candidate history; extracted_field remains projection; add source_role | P4 (storage P1) | V07 conflicting quotes/retries preserved |
| DB-19 | Forward CHECK for six priorities; ordered uniqueness already in typed DTO | P1/P2 | V01/V05 invalid duplicates and supported rankings |
| DB-20 | Unsupported active policies rejected; SQL defaults informational. Target and absolute cost cap supported | P2/P3 | V01/V05 hard vs soft and activation rejection |
| DB-21 | Positive-grid complete flat term loans; explicit fee timing; confirmed effective max bounded by stored limit/availability; no acceptance inferred | P2/P3 | V01/V05/V06 APR/zero-min/closed/expired/bounds |
| DB-22 | Explicit tolerance status/cap; migrate legacy null meaning before storage | P1/P2 | V05/V06 capped scan cannot mean nonpayment survival |
| DB-23 | Numeric verdict mapping and recommended/as-is base summary; blocked has no fake evaluation | P2/P3 | V05/V09 atomic parent/options/deferred FK/live uniqueness |
| DB-24 | Existing operation_log_canonical bytes; export range/head/predecessor and anchoring limits | P1 append/P7 export | V14 altered/missing/reordered/empty/partial/tail limitation |
| DB-25 | Preserve tenant-global idempotency PK; actor/method/path/body hash; permanent execution dedupe | P1/P6 | V12 concurrent reservation/different scope/lost response |
| DB-26 | Strict whatif_run union, source snapshot/config revisions; explicit stale-checked apply | P5 | V09 fork isolation/stale apply |
| DB-27 | Curated SQLSTATE errors; rollback before replay; 23505 alone is not success | P1 | V12 safe errors/unrelated unique violation |
| DB-28 | Disposable PG17 clean/from-0001 upgrade, original suites and runtime LOGIN concurrency | P1/P8 | V02/V03/V10; historical 296 pass only reported |
| DB-29 | No checkpoint setup, dependencies removed; forward revoke unused CREATE after deployed-object check | P1 | V02 preserve data, runtime cannot create checkpoint objects |
| DB-30 | Parameterized explicit-as-of history; current_date view only labeled current context | P7 | V06 history reproducible across wall-clock dates |

Contract-derived foundation additions: versions on mutable business/payee/account/
customer/offer/cash-event resources, opening balance/coverage evidence, document
source role, typed strategy/scenario settings, pre-business auth idempotency and
CSRF challenge. Extend existing objects or narrow auth infrastructure, not parallel
financial/identity systems. New tenant tables require composite scope FKs, FORCE
RLS, explicit write grants, indexes and immutable guards; default SELECT is not
enough. P1 inspects populated rows, backfills safely and reproduces applicable gaps
on an isolated database. No configured/shared DB destructive tests, privileged
runtime fallback, or autogenerate/create_all.
