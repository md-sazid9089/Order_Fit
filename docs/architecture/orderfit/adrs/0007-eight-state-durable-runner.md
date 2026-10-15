# ADR 0007: Retain eight deal states and use a durable PostgreSQL runner

Status: accepted contract in P0, 2026-10-15. Implementation starts in P1.

The current `0001_core_schema` revision installs eight states and guards whose
behavior cannot be changed by inserting conceptual state names. Keep `ingesting`,
`awaiting_confirm`, `computing`, `awaiting_approval`, `awaiting_reply`, `committed`,
`closed`, `failed`. `contracts.protocol.STATE_EDGES` freezes the existing edges plus
the required P1 `computing -> awaiting_confirm` edge. Terminal deals never reopen.

Use `operation.kind/status/subphase` for extraction, drafting, blocked results,
holds, partial dispatch and compensation. PostgreSQL jobs are admitted with
idempotency and state changes atomically, claimed with a 60-second lease,
heartbeated every 15 seconds, and published using a fencing token. Maximum three
attempts; provider SDK retries count toward the same budget. Work and provider
calls happen outside transactions. A scoped queue-claim function returns only job
IDs and authorized scope. Recheck the actor's membership before work/publication.

The API and worker use the same package in separate processes. Polling is the
initial transport. No process-local background job or checkpoint-framework setup
is an acceptable durability substitute. Remove unused LangGraph dependencies;
leave historical schema/data intact until a forward migration can safely revoke
unused CREATE grants. Existing graph/checkpoint functions remain clearly unused
stubs until replaced; they must not be enabled accidentally.

This keeps transactions and recovery in one system, at the cost of implementing
leases, claim indexes, fencing and operational metrics ourselves. A second queue
or orchestration framework would add operational cost without resolving financial
freshness or exact approval semantics. ADR 0006's optional framework experiment
is not adopted. No learned decision layer is scheduled.

P1 acceptance: V02/V03/V04/V09/V10/V12, including competing claims, expired lease,
stale fencing, restart, membership revocation and no pooled tenant-context leak.
P0 tests establish the state/DTO contract only, not those runtime properties.
