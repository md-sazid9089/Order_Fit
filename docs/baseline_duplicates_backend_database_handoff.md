# Baseline duplicate prevention: backend and database handoff

Prepared 18 October 2026. Share this report with the backend owner **and the database owner**. The companion [frontend handoff](baseline_duplicates_frontend_handoff.md) describes the consumer work. The [original investigation](baseline_duplicate_investigation_2026-10-18.md) records the pre-fix behavior.

## Deployment status and ownership

### 19 October Docker startup diagnosis (live read-only verification)

The configured Docker API and worker point to the same Neon endpoint/database;
the configured direct migration URL also targets that database. A read-only
container check found deployed revision **`0020_ai_workflow`**, while the rebuilt
image requires **`0022_baseline_duplicates`**. Both API and worker were restarting
with `Database schema is not current`; web remained unstarted because API health
never became ready. This is a migration/deployment mismatch, not a build failure.

The database owner must therefore review/apply **both** `0021_admin_reads` and
`0022_baseline_duplicates`, in graph order. In addition to the baseline migration
steps below, follow `docs/deployment/admin-reads.md` for the administrative-read
role/grant migration. Leave `ADMIN_READS_ENABLED=false` unless separately enabled
by the authorized operator. Do not stamp the database to the new revision.

The Neon overlay correctly keeps migrations behind the explicit `setup` profile;
ordinary `docker compose up --build` does not migrate this database. No Neon
migration or data change was performed during diagnosis. Failing API/worker
containers were stopped to end their restart loops, and `orderfit-api:local` was
rebuilt. The failure-only startup diagnostic now reports required and deployed
revisions without connection secrets; its eight focused tests and actual
container-to-Neon read-only mismatch check pass. Startup remains **BLOCKED** until
the database owner applies the pending revisions.

After the authorized migration and runtime-role checks, recreate the services:

```powershell
docker compose up -d api worker web
docker compose ps
curl.exe --fail http://localhost:3000/api/health
```

Backend implementation and a forward migration are supplied in the checkout. During the original implementation, **no Neon connection, migration, data cleanup or deployment was performed**; all migration/write verification used labeled disposable PostgreSQL containers. The subsequent 19 October diagnosis above connected to Neon for read-only schema verification only. The database owner must inspect the actual Neon revision, backup/restore readiness, existing financial data and active execution runs before applying anything.

Required runtime schema: `0022_baseline_duplicates`, directly after `0021_admin_reads`. Both API and worker use `store/db.py:SCHEMA_REVISION`; restarting this backend against an older schema fails the existing schema-current guard. Coordinate database, API, worker and frontend releases. Do not point local test fixtures at Neon.

## Implemented behavior

- Manual baseline create and edit check the entire live effective baseline under the existing business lock. The effective baseline includes committed projections, excludes voided events and excludes ordinary hypothetical order costs.
- Potential matches share direction and kind, have compatible counterparties (unknown IDs are treated conservatively), and either share date/amount or share a nonempty normalized invoice reference. Invoice normalization trims/collapses whitespace and lowercases. Different known counterparties do not match. Description and certainty differences cannot suppress the check.
- An unreviewed match returns HTTP 409 `BASELINE_DUPLICATE_REVIEW_REQUIRED` with safe matching event IDs. No event is saved. An authorized finance manager can instead affirm that the entries describe distinct obligations with the exact matching-ID set and an explanation. This is explicit review, not silent deduplication.
- Reviews persist as immutable event-pair/version records with actor, timestamp and reason. A later event edit invalidates the old pair review. Each new review increments the business financial revision, making old financial snapshots stale. Existing idempotency and expected-version checks remain mandatory.
- Existing unresolved baseline pairs block canonical order review/confirmation with `BASELINE_DUPLICATE_UNRESOLVED`; `related_event_ids` carries both IDs. The calculator continues counting legitimate reviewed entries independently. No financial formulas or expected financial results were rewritten.
- CSV confirmation reserves immutable source identity `(business_id, SHA-256 of original file bytes, physical CSV record number)`. Repreviewing/reuploading those same bytes cannot import the source row twice, including after the original event is voided. Immutable prior CSV confirmation also blocks legacy reimports whose old event attribution was removed by an edit; in that case the conflict may have no recoverable cash-event ID. Revised files are different source versions and must pass the financial-match review policy.
- CSV confirmation preflights saved-ledger and earlier-in-file matches before creating events. Intra-file reviews use source row numbers, avoiding references to IDs from rolled-back inserts. One conflict rolls back the whole confirmation, all events, all reviews and all source claims.
- The parser still identifies repeated date/amount/direction/kind/raw-invoice keys within a file, but now emits blocking `CSV-POSSIBLE-DUPLICATE` errors instead of silently allowing a reduced file to be confirmed. Old previews with `duplicate_keys` but no errors are also rejected. Correct the file; use reviewed manual entries for truly distinct rows that have an identical parser key. Installments with different dates/amounts can be reviewed in one batch using earlier source row numbers.

This is a deterministic candidate policy, not proof of semantic identity. Changed classifications/dates/amounts with no shared invoice can evade heuristics; the exact-source constraint remains authoritative only for the same immutable artifact version. An upstream business-obligation identifier would support stronger reconciliation across revised sources. Do not describe this patch as universal fuzzy duplicate detection.

## Implementation map

| Area | Files |
|---|---|
| Single matching/review/source policy | `backend/orderfit/store/baseline_duplicates.py` |
| Manual create/edit, reconciliation endpoints, canonical review gate | `backend/orderfit/store/repositories.py`, `backend/orderfit/api/routes/business.py` |
| CSV preflight, atomic confirmation and claims | `backend/orderfit/store/document_repository.py` |
| Blocking repeated-row parsing | `backend/orderfit/services/documents.py` |
| DTOs and safe structured conflicts | `backend/orderfit/contracts/resources.py`, `workflow.py`, `backend/orderfit/api/errors.py` |
| Endpoint catalogue and schema requirement | `backend/orderfit/contracts/catalogue.py`, `backend/orderfit/api/routes/identity.py`, `backend/orderfit/store/db.py` |
| Forward migration | `backend/migrations/versions/0022_baseline_duplicates.py`, `backend/migrations/sql/0022_baseline_duplicates.sql` |
| Regressions | `backend/tests/db/test_baseline_duplicates.py`, existing CSV/schema/migration/collection assertions |

Backend contract artifacts in `docs/contracts/` are regenerated. The browser declaration and UI are intentionally left for the frontend owner; see the companion report. The earlier characterization probe module was replaced by rejection/review regressions; the historical investigation and JUnit evidence remain pre-fix records.

## Database owner's migration work — not executed on Neon

1. Identify the intended Neon branch and its actual Alembic graph using the migration-owner connection. If it is not at `0021_admin_reads`, reconcile its migration graph with the backend owner first; do not stamp a revision or replay component SQL independently.
2. Prepare and verify a recoverable backup/branch. Rehearse this exact revision on an isolated copy with representative import history and runtime roles. Inspect active execution runs and commitment gates. Drain/settle or safely pause unresolved work before the coordinated cutover; quiesce old API finance writes and worker admission before migrating. Do not leave the old backend serving writes against the new schema, and do not clear durable gates manually.
3. Review the SQL: two new tables have tenant-aware foreign keys, FORCE RLS, explicit read/insert grants, no app update/delete grants and immutability triggers. Source claims have a tenant/file/row primary key; reviewed pairs have a tenant/IDs/versions primary key. Two candidate lookup indexes are added to `cash_event`, and one source-history index to `csv_preview`. No broad amount/date/invoice unique index is added.
4. Check existing CSV provenance and repeated imports. The backfill only attributes cash rows to **confirmed** CSV previews using document identity and `source_quote='row N'`. For an already repeated source it reserves the earliest cash-event ID but preserves every financial record. It does not fabricate distinct-obligation reviews. Backfill does not infer missing identity from similar amounts. The runtime additionally checks immutable confirmed-preview history when an original cash-row linkage cannot be recovered. Legacy manual/source records without confirmed CSV history remain subject to candidate review.
5. Assess lock time, backfill/index cost and available resources on the actual branch. Index creation and backfill run transactionally through Alembic; no hosted timing guarantee is established by the disposable tests. Schedule the release accordingly.
6. Apply the **Alembic revision** through the normal authorized migration process. The cutover invalidates financial snapshots once per business with live baseline/projection data, using the existing nested revision semantics, and writes a `baseline_duplicate_policy_cutover` audit event. Cash-event amounts, dates, versions and historical evaluations are preserved. No automatic merge, void or deletion occurs.
7. Deploy/restart matching API and workers, verify restricted runtime roles and readiness at `0022_baseline_duplicates`, then coordinate frontend rollout. Existing financial results may require review/reconfirmation/recalculation because of the intentional revision bump. Human-review genuine suspected duplicates using audited correction/void or explicit distinct-obligation review.
8. Verify same-key replay, repeat-source rejection, manual duplicate rejection, legitimate reviewed entries, tenant isolation and stale-result rejection on the intended hosted environment before declaring deployment accepted.

Do not run a down migration: it intentionally raises and requires a reviewed forward repair. Do not roll the application back to a schema-incompatible version without an agreed recovery plan. This task has not applied these steps to Neon.

After the database owner has explicitly selected and verified the intended branch's migration-owner `DATABASE_URL_DIRECT`, the corresponding commands from `backend/` are:

```powershell
.venv\Scripts\python.exe -m alembic current
.venv\Scripts\python.exe -m alembic heads
.venv\Scripts\python.exe -m alembic upgrade 0022_baseline_duplicates
.venv\Scripts\python.exe -m alembic current
```

These are deployment instructions for the database owner, **not commands executed against Neon during this task**. Keep the migration-owner URL out of API/worker configuration. Verify both new tables have `relrowsecurity=true` and `relforcerowsecurity=true`, their source/pair keys and tenant FKs exist, runtime cannot UPDATE/DELETE their history, and the cutover audit/revision bump occurred for the expected businesses. Rehearse the same checks with actual restricted API/worker logins rather than treating migration-owner success as runtime acceptance.

## Verification evidence

Final focused acceptance: **118 passed, 5 deprecation warnings, 52.42 seconds**, on disposable PostgreSQL 17. This includes manual/CSV/source/legacy-review regressions, real concurrent writes, source primary-key enforcement, immutable history, tenant isolation, viewer read-versus-review permissions, installments, known/unknown counterparties, seeded `0021`-to-`0022` backfill/cutover, original/forward SQL schema checks, existing CSV/document flows, migration graph, contracts and architecture tests. The two older collection/export fixtures now use distinct payment amounts while retaining their pagination/export assertions; they no longer depend on accepting an unreviewed duplicate.

Commands from `backend/`:

```powershell
.venv\Scripts\python.exe -m pytest tests/db/test_baseline_duplicates.py tests/db/test_collection_continuation.py tests/db/test_p7_operations.py::test_cash_export_audit_list_and_downloads_are_authorized tests/db/test_p4_documents.py tests/db/test_migration_merge.py tests/contracts tests/test_p4_pure.py tests/test_architecture.py -q
.venv\Scripts\python.exe -m orderfit.contracts.export --check --backend-only
.venv\Scripts\python.exe -m ruff check orderfit migrations/versions/0022_baseline_duplicates.py tests/db/test_baseline_duplicates.py
```

Broad backend regression: **766 passed, 1 live test deselected, 5 deprecation warnings, 831.80 seconds** on disposable PG17. That run began before the final legacy-confirmation fallback/source-history index and generated create-status alignment were added. The **118-test final focused rerun** above covers the final source-history/migration code; **82 contract tests** passed after the final create-status alignment. No additional whole-suite run is claimed for those final deltas. Ruff, backend-only contract drift checks, report-link checks and Git whitespace checks pass.

Local machine-readable evidence is retained at `D:\Kam 2\baseline-fix-frozen-full.xml` and `D:\Kam 2\baseline-fix-acceptance.xml`; corresponding `.log` files retain console summaries. No paid/live provider acceptance, hosted latency, production duplicate inventory or frontend/browser acceptance is established by these runs.

CSV confirmation remains a bounded, synchronous, row-iterative transaction. The 2,000-row validation ceiling is not a hosted latency or throughput guarantee; measure realistic batches and lock duration during deployment rehearsal. The existing transaction timeouts still fail/roll back an overlong batch. This patch does not introduce a second queue or claim a new import capacity envelope.

## Remaining responsibilities

- **Database teammate:** review/rehearse/apply the migration, check actual Neon data and roles, coordinate the cutover and reconcile legacy financial records. No shared-data inventory was taken here.
- **Backend teammate:** integrate this patch and its generated contracts, preserve the single policy across producers, coordinate workers/API startup, and perform hosted acceptance after the database owner applies the revision.
- **Frontend teammate:** implement the review flows and structured error handling described in the companion report. Existing clients remain able to save unmatched entries but cannot resolve matching entries without the new controls.
