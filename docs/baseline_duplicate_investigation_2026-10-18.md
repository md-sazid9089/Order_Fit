# Baseline-event duplicate investigation

Follow-up: backend remediation is now implemented in the checkout. See the
[backend/database handoff](baseline_duplicates_backend_database_handoff.md) and
[frontend handoff](baseline_duplicates_frontend_handoff.md). The characterization
probe was replaced by `backend/tests/db/test_baseline_duplicates.py`; the findings,
command and JUnit evidence below describe the **pre-fix** investigation snapshot.
No Neon migration has been performed.

Investigated 18 October 2026 against checkout `7461aa6` (clean before investigation). No application behavior or schema was changed. Added executable characterization probes and their JUnit evidence.

## Finding

**Confirmed: separate commands can persist the same baseline obligation multiple times, and all copies affect cash calculations.** Treat this as a high-priority financial-input integrity defect. It can overstate receipts or overstate payments; the direction and timing determine the resulting affordability error. This investigation does not establish that a particular shared account contains duplicates or that a particular production verdict was affected.

The missing contract is business-obligation identity/detection across writes. Existing idempotency protects the identity of one command, and revision checks protect freshness. Neither establishes whether another command describes an already recorded obligation.

## Fresh reproduction evidence

Ran `backend/tests/db/test_baseline_duplicate_investigation.py` using authenticated HTTP requests and restricted runtime roles against disposable PostgreSQL 17, migrated to `0021_admin_reads`. The fixture creates and removes its own labeled container and never consumes application database URLs. Final result: **3 passed, 3 deprecation warnings, 12.03 seconds**. Passing here means the defect was reproduced, not fixed. Ruff passed for the added probe module.

| Probe | Observed result |
|---|---|
| Replay identical POST with same idempotency key and payload | Same record and response returned; no second record |
| Repeat POST under new key but old financial revision | HTTP 409 `STALE_FINANCIAL_REVISION` |
| Repeat identical event under new key with fresh revision | HTTP 200; different event ID; identical event contents |
| Edit a distinct event to match an existing event | HTTP 200; duplicate persists |
| Three manual payments of 125,000 minor units | Cash-flow closing balance reduced by 375,000 |
| Two matching rows inside one CSV | Parser retains one event and reports one duplicate key |
| Preview and confirm that same stored CSV again at the latest revision | Another event inserted under a different ID |
| Manually add an event using the same invoice reference as the imported rows | HTTP 200; a third live event persists |
| Confirmed-input and engine check of matching baseline invoices with distinct event/obligation IDs | Accepted; no duplicate block or duplicate warning; both amounts counted by the daily sweep |

The fixture additionally ran its original and forward-schema 296-assertion SQL suites and existing audit/optimistic-lock concurrency checks successfully. Those checks are fixture preconditions; a dedicated simultaneous duplicate-submission race was **not** tested.

JUnit evidence: [baseline_duplicate_investigation_2026-10-18.xml](baseline_duplicate_investigation_2026-10-18.xml).

Reproduce from `backend/`:

```powershell
.venv\Scripts\python.exe -m pytest tests/db/test_baseline_duplicate_investigation.py -q -s --basetemp 'D:\Kam 2\baseline-duplicate-probe-final' -o cache_dir='D:\Kam 2\baseline-duplicate-pytest-cache'
```

Docker access is required. The initial sandbox denied Docker access; the actual successful run used approved elevated execution. The investigation did not use shared PostgreSQL/Neon data, live model calls or an application browser session.

## Root causes and affected paths

1. **Manual create and edit have no duplicate-obligation lookup.** `backend/orderfit/store/repositories.py:1164` locks the business and checks the expected financial revision, then unconditionally inserts. `update_event` at line 1213 similarly checks revisions and updates without checking other events. Thus two writers starting at the same revision should conflict, but a subsequent intentional submission or retry rebuilt with a fresh revision can insert again. The latter is reproduced.
2. **The database permits matching content.** `backend/migrations/sql/0001_core_schema.sql:371` defines an identity primary key, checks and tenant-aware foreign keys, with ordinary date indexes. Inspection of later migrations found no business-obligation uniqueness constraint for manual baseline rows. The `invoice_ref` comment mentioning duplicate checks does not make that column unique.
3. **The source form cannot identify an existing obligation.** `web/app/deals/sources/page.tsx:46` posts `invoice_ref`, `customer_id` and `payee_id` as null. It has no duplicate warning. A successful save resets the form, but re-entering the same values creates a new command. `web/lib/orderfit-api.ts:55` preserves a pending command key for uncertain outcomes and clears it after success; that mechanism correctly handles retries but does not deduplicate later successful commands. No browser double-click defect was established.
4. **CSV deduplication is scoped to one parse.** `backend/orderfit/services/documents.py:403` creates an empty `seen` set for each file. Its key is date, amount, direction, kind and invoice reference. It never compares with the persisted ledger. `backend/orderfit/store/document_repository.py:287` prevents confirming one preview twice; a new preview has a different identity and can insert the same events again. Document-upload hash deduplication does not prevent this: the probe reused the same document ID.
5. **Downstream guards compare generated identities rather than matching financial meaning.** Review construction in `backend/orderfit/store/repositories.py:2020` uses each cash-event row ID and falls back to `obl-{id}` for its obligation ID. Duplicate rows consequently look distinct to `ConfirmedInputV1.complete` in `backend/orderfit/contracts/financial.py:350`. Engine validation checks duplicate event identities and baseline-versus-order invoice overlap; its possible-duplicate warning also compares order costs against baseline, not baseline against baseline. `backend/orderfit/engine/timeline.py:17` sums all included events.

## Architectural assessment and recommended repair

Do not apply a blanket unique index on date/amount/kind or invoice reference. Two legitimate payments can share those values; an invoice can have installments, counterparties can reuse invoice numbers, and voided/corrected records need explicit treatment. Silently discarding matching financial records can understate obligations. The CSV parser already collapses rows whose descriptions or certainty differ if their narrower key matches; inspect that policy during remediation too.

Recommended direction:

- Define a stable source-obligation/event identity where authoritative source identity exists. Enforce repeat-source prevention at the persistence boundary with tenant scope and a forward migration. Reconcile existing records before adding constraints; never delete financial history automatically. A row number alone is not stable across revised files, so specify source version and correction semantics explicitly.
- For manual entries without authoritative identity, detect likely matches on the server across the full live ledger, including edits and imports. Return the matching IDs and a reviewable conflict/warning. Allow an explicitly recorded distinct-obligation explanation where the business confirms both are real. Expose useful invoice/counterparty fields in the form without assuming those fields alone uniquely identify an obligation.
- Apply one policy to create, update and import confirmation, inside the existing business-lock transaction. Keep idempotency and financial revision protection. Do not rely on browser filtering or deduplicate only the rendered list: both leave persisted calculations wrong. Define treatment of committed projections and voided entries.
- Surface unresolved baseline-to-baseline matches during review before publishing another analysis. Do not silently drop them inside the deterministic calculator.
- For existing suspect rows, present candidates for human reconciliation; use audited void/correction paths and invalidate affected results. Never infer that matching amount/date proves a duplicate.

An initial narrower repair could warn on likely duplicates and require reviewed resolution while preventing repeat confirmation of the same authoritative source event. A complete obligation model supports more reliable cross-channel reconciliation but costs schema, migration and UI work. The policy must cover legitimate repeated payments and installment identities before hard uniqueness is introduced.

Repair acceptance should cover manual create/edit, same and overlapping CSV imports, manual/import overlap, source revisions, case/whitespace handling for references, legitimate equal-value payments, installments, void/recreate, tenant isolation, committed projections, simultaneous submissions, lost responses and downstream recalculation. Convert the characterization probes into desired rejection/review assertions when implementing that policy.

## Limits

No shared-data duplicate audit, browser interaction, hosted reproduction, full application suite or end-to-end verdict-change test was performed. Financial impact is established by the persisted cash-flow API and a direct confirmed-input/engine sweep probe. Production code and schema remain unchanged; this report completes the requested investigation rather than claiming remediation.
