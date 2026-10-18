# Baseline duplicate prevention: frontend integration handoff

Prepared 18 October 2026. Backend changes are in the checkout; **frontend implementation and browser acceptance are still required**. The database owner must apply the forward migration before this backend is deployed. **No Neon migration was initiated.** See the [backend/database handoff](baseline_duplicates_backend_database_handoff.md) for schema and release ownership.

## Current Docker deployment blocker

19 October read-only verification found Docker's Neon database at
`0020_ai_workflow`, while the backend requires `0022_baseline_duplicates`.
The database owner must apply `0021_admin_reads` and `0022_baseline_duplicates`
before the new API/worker can start. API and worker crash loops were stopped;
web remains unavailable pending that migration. No Neon migration was executed.
See the backend/database handoff before frontend runtime testing.

## User-visible contract

Saving a matching baseline event now stops for review. Show the matching saved entries and let an authorized user either correct/cancel the proposed entry, void/correct an actual duplicate through the existing audited controls, or explain that both entries are genuine distinct obligations. Do not automatically acknowledge matches, hide duplicate rows in the list, or discard an event from cash calculations.

Only owners and risk officers (`manage_finance`) may record duplicate reviews. Read access follows existing business membership. HTTP 409 on a duplicate is a review requirement; it does **not** mean that reloading alone will fix the problem.

## Types and affected UI

`docs/contracts/frontend-api.d.ts` and `docs/contracts/openapi.json` contain the new contracts. Sync the browser declaration at `web/lib/generated-api.d.ts` using the normal contract exporter once the frontend work is ready. The backend-only export used for this task intentionally did not change browser sources.

Primary integration points:

- `web/app/deals/sources/page.tsx`: add baseline-event matching review, preserve the proposed form values on conflict, and distinguish duplicate conflicts from stale-version conflicts. The existing generic “Reload this page” suffix for every 409 is insufficient here.
- `web/components/cash/cash-event-actions.tsx` and the cash-flow baseline screen: support edit conflicts and reconciliation of existing pairs.
- Existing CSV preview/confirmation UI: show blocking parser errors, collect saved-event and source-row reviews, and submit one atomic confirmation.
- Order review/confirmation UI: display blocking `BASELINE_DUPLICATE_UNRESOLVED` findings and navigate using `related_event_ids`; do not parse IDs out of message text or use ordinary warning acknowledgment to bypass a blocking finding.
- `web/lib/orderfit-api.ts` / shared error types and presentation: retain structured `error.details`, including `matching_event_ids`, `source_row` and `matching_source_rows`. IDs are decimal **strings**, not JavaScript numbers.

Expose invoice reference and known customer/payee selection where useful, without requiring invented identifiers. The server treats missing counterparties conservatively. Matching is server-owned and covers the whole persisted effective baseline; never implement acceptance by checking only the loaded page.

## Create and edit flow

Existing routes remain:

- `POST /api/v1/businesses/{business_id}/cash-events`
- `PATCH /api/v1/businesses/{business_id}/cash-events/{event_id}`

Their existing request fields are unchanged; both accept optional `duplicate_review`:

Both routes return HTTP 200 on success. The generated create status is aligned with the mounted endpoint as part of this repair.

```json
{
  "matching_event_ids": ["9007199254740993"],
  "reason": "Two separate rent obligations verified against the lease schedules."
}
```

This object is the **value of `duplicate_review`** alongside `event` and the existing version fields. The reason must have at least 12 characters after trimming and at most 2,000 characters. The matching-ID set must equal the current server matches. A checkbox without an explanation is insufficient. Do not send empty reviews on ordinary unmatched saves.

On a match the server returns HTTP 409:

```json
{
  "error": {
    "code": "BASELINE_DUPLICATE_REVIEW_REQUIRED",
    "message": "Review matching baseline entries. Void a duplicate or confirm distinct obligations with a reason.",
    "details": {
      "field": "duplicate_review",
      "matching_event_ids": ["9007199254740993"],
      "source_row": null,
      "matching_source_rows": []
    },
    "retryable": false
  }
}
```

The actual envelope also contains `request_id` and the existing nullable version-detail fields. Keep the proposed payload in memory, present the match, and submit the revised payload only after an explicit user decision. Clear/revalidate the collected review when the user changes proposed financial fields or business scope. Keep expected versions current; if another writer changes the baseline, refresh candidates and review again. Do not blindly rebuild a new command after an uncertain response.

## Inspect and reconcile saved events

`GET /api/v1/businesses/{business_id}/cash-events/{event_id}/duplicates` returns:

- `event_id`, current `version`, and `financial_revision`;
- `event`, a typed summary of the selected saved entry;
- `matching_events`, summaries of its **unresolved** matches.

For a proposed create that has not been saved, fetch each conflict ID through this GET route and display its `event` summary; the proposed entry itself has no stored ID.

Each summary includes `id`, `version`, `event_date`, `amount_minor`, `direction`, `kind`, `description`, `invoice_ref`, customer/payee IDs and `deal_id`. Committed projections are included and may have generated kinds, so these summaries are distinct from editable `CashEventInput`. Existing projection immutability still applies; do not offer direct edit/void on a committed projection.

To confirm distinct obligations already saved, use:

`POST /api/v1/businesses/{business_id}/cash-events/{event_id}/duplicate-review`

```json
{
  "expected_version": 1,
  "expected_financial_revision": 12,
  "duplicate_review": {
    "matching_event_ids": ["9007199254740993"],
    "reason": "Independent obligations verified against both source invoices."
  }
}
```

The response has the same shape as GET, with the fresh financial revision and no resolved matches. Reviews bind both saved row versions; subsequent edits can make the same pair require review again. Refresh profile, candidate lists, cash-flow and affected order review after mutations. This endpoint uses the usual CSRF and idempotency protections.

## CSV flow

- Preview repeated-key rows now produces blocking `CSV-POSSIBLE-DUPLICATE` errors. Do not enable Confirm while preview errors exist. Correct the file or enter genuinely distinct identical-key obligations through reviewed manual entry. `duplicate_keys` is diagnostic, not permission to silently discard rows.
- Same-file-row reimport returns HTTP 409 `BASELINE_SOURCE_ALREADY_IMPORTED`, including the existing event ID and source row when recoverable. For legacy confirmed history whose cash-row attribution was edited away, the matching-ID list can be empty; explain that the source was previously confirmed and direct the user to source/audit reconciliation. There is no force-import override. Claims survive voiding.
- Other CSV conflicts return `BASELINE_DUPLICATE_REVIEW_REQUIRED`. `details.source_row` identifies the proposed physical CSV record, `matching_event_ids` identifies saved matches, and `matching_source_rows` identifies earlier rows **inside this preview**. No event is saved on conflict. Retain previously collected reviews while the user resolves the remaining rows, but discard/revalidate them when the preview or financial revision changes.
- `CSVConfirm` accepts `duplicate_reviews`, keyed by `row_number`. A row can affirm both saved matches and earlier rows in the same file. References must be unique earlier rows, never itself or later rows. Do not substitute temporary/fabricated database IDs.

Example addition to the existing confirmation body (`preview_id`, `preview_hash`, `expected_financial_revision`):

```json
{
  "duplicate_reviews": [
    {
      "row_number": 3,
      "matching_source_rows": [2],
      "duplicate_review": {
        "matching_event_ids": ["9007199254740993"],
        "reason": "These are separately documented installments of the same invoice."
      }
    }
  ]
}
```

If only an earlier CSV row matches, `matching_event_ids` is `[]`. If only saved entries match, `matching_source_rows` can be omitted or `[]`. Preview events retain `evidence.quote='row N'`; row numbers refer to CSV records including the header, not array indexes or lines inside quoted multiline cells.

## Error handling and verification gates

| Code | Required response |
|---|---|
| `BASELINE_DUPLICATE_REVIEW_REQUIRED` | Preserve input; show current matches; collect an explicit correction or distinct-obligation reason |
| `BASELINE_SOURCE_ALREADY_IMPORTED` | Open the saved event; do not offer force import |
| `STALE_FINANCIAL_REVISION` / `STALE_VERSION` | Refresh current versions/candidates and obtain review of any changed matches |
| `TOO_MANY_DUPLICATE_MATCHES` | Require baseline reconciliation; never silently review only the first page |
| `UNEXPECTED_DUPLICATE_REVIEW` / `UNKNOWN_CSV_REVIEW_ROW` | Rebuild reviews against the current proposed data/preview |
| `PREVIEW_HAS_ERRORS` / `PREVIEW_HAS_DUPLICATES` | Correct/repreview the source before confirming |
| `BASELINE_DUPLICATE_UNRESOLVED` finding | Block order confirmation until audited correction/void or saved-pair review clears it |

Verify manual duplicate create and edit, legitimate equal payments, stale candidates, lost-response replay under the same key/payload, a full source reimport, overlapping files, same-file installments, voided source reimport, legacy-pair reconciliation, role restrictions and business switching. Confirm that rejected commands change neither event count nor cash balance, and that reviewed distinct entries are both counted. Run frontend lint/typecheck/tests and browser E2E after implementation. No frontend/browser pass is claimed by this backend task.
