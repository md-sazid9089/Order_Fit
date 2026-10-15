# ADR 0008: Immutable input snapshots and exact sandbox action bundles

Status: accepted contract in P0, 2026-10-15. Persistence P1/P3, effects P6.

Keep row `deal.version`, financial `deal.input_version`, coarse business
`financial_revision`, and source revisions distinct. Relevant child writes must
invalidate through database triggers as well as services. A workflow/round update
must not pretend financial inputs changed. Lock business, deal, then related rows
in deterministic order. Frozen-state input edits use a transition UPDATE followed
by a separate input UPDATE in the same transaction, respecting the OLD-state guard.

Review builds a complete typed candidate. Confirmation locks/rebuilds/checks its
hash and all revisions, then inserts immutable `input_snapshot` and existing T2
`approval(action=confirm_figures)` evidence. A missing field, unsupported product,
conflicting source or stale input produces a typed review/job outcome; it cannot
be stored as a zero-valued numeric evaluation. All calculations enter through
`agent/nodes/compute.py`; the engine remains pure. Supersede the previous live
evaluation before inserting its replacement and options in one transaction.

Canonicalization is `orderfit.contracts.protocol.canonical_bytes`: typed JSON with
all fields/nulls, sorted object keys, ordered arrays, compact separators, UTF-8,
no Unicode normalization/newline, UTC Z timestamps, lowercase UUID/hash strings,
money/BIGINT strings, strict integer configuration and no floats. SHA-256 hashes
those exact bytes. Manifest arrays are ordered by immutable server-assigned item
key at creation; the stored array then defines execution order and is never
silently re-sorted by hashing. Golden files freeze bytes and hashes. Database
audit canonicalization remains PostgreSQL's separate `operation_log_canonical`.

Hash complete inputs including sensitivity/provenance/configuration; retain the
reference hash separately. An action bundle additionally binds business/deal,
snapshot/revisions, evaluation/option/calculator, canonical strategy, exact
message subject/body/channel/recipient, payee/account verification versions,
amounts/dates, acceptance requirements, expiry and sandbox mode. Any edit creates
a new immutable bundle; old approval evidence remains intact but unusable.

T3 approval consumes a single-use session-bound five-minute password step-up grant.
Password re-entry is not MFA. Expiry is at most 24 hours and no later than offer or
acceptance expiry. Date-only offer expiry includes that calendar day's final
instant in the business IANA timezone (convert next local midnight to UTC as the
exclusive boundary). Check real server time, not financial as-of.

Send approval authorizes only message items; commit approval authorizes only its
exact message/ledger/lender items; compensation authorizes explicit inverse items
referencing original actions. No generic override route. P6 forward-migrates the
single-message approval CHECKs/FKs/guards for batches without weakening legacy
rows. One run per admitted bundle, one action per run/item, and a durable business
commit gate prevent duplicate/extra actions and two simultaneous cash commitments.
Successful sandbox effect, outcome and audit commit together. Completed commitment
projections update existing baseline events exactly once before releasing the gate.
Partial runs retain the gate and recover the same run. Compensation preserves the
committed deal/history and uses its own current authorization, not an impossible
requirement to make the original projected-baseline snapshot fresh again.

The coarse revision causes extra refreshes but makes correctness easier to prove.
Hashes provide exact-content evidence, never authority. V01/V09/V11/V12/V13/V14
remain the implementation gates; P0 only tests the executable contract predicates.
