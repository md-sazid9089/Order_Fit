# ADR 0010: Pure financial engine and bounded complete analysis

Status: accepted and implemented in P2, 2026-10-15.

The application calculator is `engine-0.2.0`. It ports `ref-0.1.0` financial
semantics into `backend/orderfit/engine/`, with strict financial-only models.
`agent/nodes/compute.py` alone calls its public `analyse` entry point in application
code. The engine reads no files, environment, clock, database or provider. Source
text interpretation belongs outside this boundary; review issues enter as typed
blocking facts. Unsupported products, policy fields and day conventions cannot
silently become supported because SQL can store them.

The following deliberate corrections justify a distinct calculator version:

- Determine the required horizon from baseline events, shifted receipts/deposits,
  extended costs, availability/lead time, repayment and scan endpoints before any
  display padding. Reject beyond 1,095 days or the business-date domain. Never
  clip obligations. Regression cases include funding on day 700, repayment on day
  800, deposit lead plus a 540-day scan, and baseline obligations after day 540.
- Count only newly generated financing-scope fees/interest against this strategy's
  financing-cost cap. Existing loan fees still affect baseline cash. An independent
  zero-cap regression failed before this correction and passes afterward.
- An unresolved anchor remains `needs_input` even if alternative interpretations
  happen to recommend the same strategy. VOI is information for review, not authority
  to invent a confirmed fact. Preserve the as-offered comparator when custom grids
  omit zero. Invalid scanned strategies fail the scan rather than proving survival.

All 22 committed reference expected files remain unchanged. Differential tests
compare the complete financial diagnostic projection; named strategies have
separate canonical-parameter checks. Case labels/version/hash and source-injection
heuristics are intentionally outside that comparison. Unsupported diagnostic prose
may differ; reason codes must match. Full typed series and separate inherited/new
breach intervals are additional production output, not rewritten golden data.

`Computation.snapshot_hash` hashes the full confirmed P0 snapshot, including
provenance and analysis configuration, using the established canonical protocol.
`Result.input_hash` hashes normalized engine inputs, including analysis settings.
`Computation.reference_input_hash` retains a narrower reference-style projection:
normalized engine JSON minus sensitivity/review issues/work budget, plus deal ID as
case identity. This normalization-v1 hash is diagnostic compatibility metadata;
it is not a claim of byte identity with legacy fixture input JSON. Neither narrower
hash authorizes an action or replaces snapshot freshness checks.

Admission checks strategy expansion, horizon, output size and conservative daily
work, then shares an actual work counter across sizing, scans, sensitivity and VOI
reruns. Any exhaustion discards the partial catalogue and returns `analysis_limit`.
This is a technical outcome, never a financial decline. Full series cost memory;
the additional 500,000-point admission ceiling intentionally rejects some inputs
whose individual dimension limits would otherwise pass. Benchmarks and the P3
execution requirements are recorded in the [P2 verification record](../../../evidence/reports/p2_engine_verification.md).

No migrations or new financial tables are needed for P2. P3 must adapt these typed
results into the existing evaluation/option/series contracts and persist atomically
using the existing SQL objects and freshness/tenant protections. P2 enables no
evaluation routes, job handlers, provider calls or outgoing effects.

## Calculator version history

The shipped calculator version is **engine-0.2.1** (bumped from engine-0.2.0, which is
the version recorded in the P2 progress notes). The bump recorded the
complete-horizon/analysis-bound corrections made after the first P2 handoff; it is
already shipped and asserted by `tests/engine/test_compute_adapter.py`. Golden expected
files were not rewritten for it. A later hardening makes two previously raw-exception
inputs return typed results without changing any numeric output: an explicit `null`
payment-term anchor yields `needs_input` (`E-MISSING-ANCHOR`), and the horizon now
includes the order-receipt delay for unconfirmed baseline events of an order class, so
inputs near the 1095-day ceiling return `analysis_limit` instead of raising.
