# P5 preparation contract

P5 prepares evidence only. All dispatch eligibility is false. No approval, step-up,
execution, payment or commitment route is enabled. Preparation review is not T3
approval. P6 must build its exact immutable action manifest from fresh reviewed
preparation, reauthorize and obtain separate send/commit approval.

All routes use verified sessions, transaction-local tenant scope, current prepare
permission and tenant-global idempotency keys on writes. Financial apply/reply
review additionally require current deal row/input/business versions. Collections
are bounded to 50 per kind with offset/has_more; immutable IDs remain readable.
Money is integer minor-unit text; system times UTC; UUIDs are resource IDs.
Unknown fields and duplicate change kinds fail validation. Missing/cross-tenant
resources return 404; stale versions, reviewed replies, immutable revisions and
changed idempotency payloads return 409. Unavailable AI is recorded, never success.

Fork admission queues a durable operation from a confirmed snapshot and current
evaluation. Worker computes outside transactions through bounded_compute ->
agent/nodes/compute.py. It stores the source result, fork snapshot, full comparison
and daily series in existing whatif_run. Publication rechecks original revisions
and fencing; no canonical status/input/evaluation/approval changes occur. Typed
patches are merged by kind with previously applied exploration settings.

Supported patch semantics:

- deposit_pct restricts the candidate deposit grid; it does not assert acceptance.
- supplier_extension selects an existing extension day and the complete set of
  eligible costs. Partial subsets are rejected because the engine has no subset
  strategy contract; no surcharge is invented.
- financing restricts an existing approved offer grid to one valid draw, preserving
  all original source evidence. It does not create or approve an offer.
- customer_delay_days/ar_delay_days/cost_overrun_bps set the downside stress and
  raise severe to at least that stress. They are analysis assumptions, not legal
  payment terms or actual cash receipts.

Explicit fork apply stores only these typed exploration settings on deal, bumps
input version, supersedes the live result and returns to awaiting_confirm. Review
rebuilds original sources then reapplies settings. Confirmation and evaluation
use the existing P3 pipeline. Old settings are revalidated against changed sources.

Draft creation is a durable template job for an actual evaluated feasible option.
Party is selected explicitly by the human: customer must match the order; supplier
must own eligible shifted obligations; lender must match the selected offer.
Recipient is human-entered and compared to that party's stored known domains.
Unknown domains remain blocked for review. AI/reply content never chooses a party
or address. Any party/content/channel/option edit creates a new immutable message
and preparation identity. Old revisions remain visible but cannot be reviewed or
attested again. Hash includes exact subject/body/recipient, party version,
evaluation/snapshot/hash/revisions, full option, commercial terms hash, expiry,
revision ancestry, actor/time and sandbox mode. Exact review stores that hash.

Editing uses a closed sentence grammar: immutable server-rendered term/fact lines
plus optional/reorderable approved courtesy sentences. This deliberately limits
free prose to make unsupported written-number claims and altered term roles
unrepresentable. Removing/changing a mandatory term or inserting arbitrary prose
is rejected with UNSUPPORTED_MESSAGE_CONTENT; numbers are guarded separately.
Explanation uses engine fact IDs and deterministic qualifiers, not model numbers.
Templates identify currency/minor units, scenario and finite scan limits.

Replies preserve original text and ask identity in negotiation_message. Candidates
are immutable and quote-grounded; contradictory candidates are retained. Explicit
review selects candidate IDs once, requires reason/current versions, and applies
only supported terms: customer payment days/revenue/deposit grid, supplier extension
on that party's eligible obligations, or a lender draw on the same supported offer.
Supplier subsets and new offer prices/fees require manual source review; a party
cannot edit another party's terms. Bank/account/beneficiary language creates a durable fraud blocker
at intake, before any provider work. Generic flag resolution cannot clear it.
Reply parsing never changes inputs; human apply returns to P3 confirmation.

Acceptance is an owner-recorded attestation bound to exact preparation/terms,
party, expiry and optional same-party reply. It is never proof of cash receipt or
independently authenticated agreement. Supersession is append-only, same party and
deal. Acceptance must be refreshed after changed financial terms or preparation.
No acceptance substitutes for P6 approval. Provider off/missing/refused/invalid/
timeout/rate-limit uses useful deterministic parsing/templates; recorded mode
never falls through to live. Provider provenance is retained with saved results.

Preparation history returns compact comparison summaries; full snapshots, catalogues
and series load only on explicit inspection. Historical messages remain readable if
a party is archived, with stale status. Preparation expiry is no later than the
selected offer's inclusive final day in the business timezone or 24 hours.
