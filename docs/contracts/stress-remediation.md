# Worker readiness and collection continuation

Applies to remediation of the [16 October audit](../backend_stress_test_report_2026-10-16.md).
Money, deterministic calculations, financial versions and sandbox approval semantics are unchanged.

## Worker capacity

`GET /health` remains process liveness. `GET /ready` returns 200 only when the
API database login is restricted, schema is current, storage works **and** at
least one worker heartbeat has not expired. Otherwise it returns 503. Responses
remain private/no-store and reveal no worker IDs, logins, tenant IDs or driver text.

```json
{"status":"ready","database":true,"schema_current":true,"storage":true,"worker":true,"backlog_seconds":0}
```

`worker` describes **global capacity**, not a particular replica, job lease,
handler capability, throughput guarantee or completion deadline. It does not
prove a provider is available. `backlog_seconds` is the nonnegative age of the
oldest claimable job; zero means no aged claimable job, never proof of a worker.
It is null when the schema/database check cannot obtain the aggregate. A live
worker and a large backlog may coexist. Backlog does not determine the HTTP status.

New forward revision `0016_worker_presence` executes SQL component
`0017_worker_presence.sql`, following applied `0015_session_authority` without
editing it. Global `worker_presence` has FORCE RLS and no runtime table grants.
Only the migration-owner policy can touch rows through the two narrow definer
helpers. PUBLIC cannot execute them; `orderfit_app` can read the single capacity
boolean, and only `orderfit_worker` can publish/delete heartbeat evidence. The
API role cannot set a timestamp/expiry, write a table row or call the publisher.
Existing worker/login restrictions and tenant policies stay in force.

Each production worker creates a random process UUID at startup; publication must
succeed before it enters the claim loop. Every ten seconds an independent thread
publishes using a dedicated pool of **one** connection. Job work uses its existing
five-connection pool. Publication holds no job/business/session lock and has a
3-second statement timeout, 1-second lock timeout and 5-second connect timeout.
The database supplies all times and a fixed 60-second expiry. Long computation or
provider work runs outside these transactions and cannot starve this reserved pool.
Transient publication failure retries at the next interval; expiry fails closed.

SIGTERM/SIGINT prevents another claim, permits the in-flight fenced job to finish,
then stops/joins the publisher and removes this process UUID. SIGKILL/crash needs
no cleanup: the last committed heartbeat expires within 60 seconds (a poll can add
its observation interval). Restart uses another UUID; another replica's live row
keeps capacity available. Publishing also prunes rows expired for over a day.
No new environment setting, owner/admin privilege, RLS bypass or queue system is
introduced. Reserve one extra DB connection per worker when sizing deployment
connection budgets; do not raise the job pool to conceal contention.

## Collections

Eight formerly truncated HTTP collections now return an accurate `next_cursor`:

| Collection | Descending position | Enabled consumers |
|---|---|---|
| `/customers` | created_at, UUID | new order, customer history selector, pipeline labels |
| `/payees` | created_at, UUID | sources/lenders, bank accounts, preparation party selector |
| `/financing-offers` | created_at, UUID | sources/policy eligibility, financing screen |
| `/constraints` | version, UUID | new/edit order, default risk policy, sources, pipeline reserve |
| `/cash-events` | event_date, BIGINT ID | sources, cash-flow event editor |
| `/deals` | created_at, UUID | bounded pipeline pages |
| `/deals/{id}/evaluations` | created_at, UUID | API/history clients; current UI reads live evaluation by ID |
| `/deals/{id}/documents` | uploaded_at, UUID | private document workspace |

Page shape stays `{items: [...], next_cursor: string|null}`. Limit defaults to 50,
maximum 100; each query fetches limit+1. HTTP continuations reuse the existing HMAC
codec and bind user, business, resource/sort version, and filters (deal ID and
`default_only` where applicable). A token is a position, never authority. Each
request resolves the current session/membership and applies RLS again. Malformed,
foreign, resource/filter-mismatched tokens return 422 `INVALID_CURSOR`.

`offset` remains a deliberate legacy starting-position option. HTTP always
returns **signed keyset** continuation, including after an offset start. Sending
both a nonzero offset and cursor is rejected. Repository-only legacy callers
without an identity/codec get an explicitly numeric next offset; those tokens are
not accepted as HTTP cursors. The pipeline retains its bounded 20-row previous/
next offset UI, using `next_cursor` only for accurate end detection. It can shift
under concurrent inserts; clients needing stable forward traversal should follow
the cursor. The API does not promise a database snapshot across HTTP requests.

The unique tie-breaker prevents equal timestamps from losing rows. Newly inserted
rows ahead of a cursor appear on refresh; archived/history rows remain listed and
are labelled or excluded from new-selection options. Date edits can move cash
events across a previously traversed boundary: refresh when editing concurrently.
There is no cursor expiry beyond HMAC key/scope changes; auth is checked each time.
`/constraints?default_only=true` retrieves the actual default even if many newer
non-default versions exist; it never assumes the first general page is default.

`useCollection` and `CollectionPages` fetch one bounded page per user action,
display loaded/partial/loading/empty/error/retry states, preserve loaded rows on a
continuation failure and deduplicate by ID. Tenant paths form the cache key;
existing logout/business-switch cache reset remains required. No fetch-all loop
or first-page limit increase is used. Missing pipeline labels are fetched only
for distinct customer IDs on its current bounded order page. Known selected
policies stay visibly selected while older policy choices are loaded.

Existing signed members/notifications/invoices/accounts/audit collections retain
their contracts. Preparation messages/acceptances/actions already expose explicit
offset continuation; preparation state has `has_more` and its existing history UI.
Fields are a current per-field review projection, not a historical page. CSV import
returns the bounded submitted batch, not a truncated collection. Neither is
silently converted to a collection cursor here.

## Database capacity

Sustained contention reproduced pool checkout starvation at the old 30-second
wait. Pool size stays five, overflow stays zero; checkout now waits at most three
seconds. Authenticated service transactions map checkout timeout to typed
503 `DATABASE_CAPACITY`; HTTP marks it retryable. No financial rejection or new
idempotency identity is created. Retry a command with its original key, and read
the same operation after an unknown response. Actual lock/statement failures keep
the existing central SQLSTATE translation.
