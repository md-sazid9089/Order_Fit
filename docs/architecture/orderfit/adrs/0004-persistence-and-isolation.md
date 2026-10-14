# ADR 0004: Persistence and tenant isolation

Status: proposed; confirms [repo ADR 0005](../../../adr/0005-postgres-from-day-one.md) and corrects the system-design statement that the MVP uses SQLite.

## Context

Approvals, idempotency keys, input versions and the audit log need transactions and constraints; the repository already provides Postgres in Compose and optionally Neon `[R]`. The judges must reproduce the run, possibly offline. The repository's tenancy is a constant `current_business_id()` `[R]`.

## Decision

1. Relational storage in PostgreSQL 17; local Docker is the default (works offline); Neon is optional (pooled endpoint for the app, direct for migrations `[R]`).
2. Every table carries `business_id`. **Mandatory:** every query is scoped by it in application code, the application connects as a role that does not own the tables (DML only; migrations use a separate role), and an AUTH-TENANT test with two seeded tenants. **Hardening (IF-TIME):** Row-Level Security with `FORCE ROW LEVEL SECURITY` fed by `SET LOCAL app.business_id` per transaction (RLS does not apply to table owners or superusers, which is why the role separation matters).
3. Real sessions and roles (owner, viewer); another tenant's id returns 404.
4. Money columns are `bigint` minor units plus a currency code; dates are `date`; evaluations store `jsonb` next to typed columns.
5. The Operation Log is append-only by trigger (UPDATE, DELETE and TRUNCATE rejected) and hash-chained **per tenant** (`prev_hash` within `business_id`, inserts under a per-tenant advisory lock, no foreign key to the deal so deleting a deal does not conflict); the chain head is exported with the evidence.
6. Documents are content-addressed under `documents/<business_id>/<sha256>`; deletion removes content and leaves a tombstone.

## Alternatives rejected

SQLite (no Row-Level Security, weaker concurrency and constraints, would have to be replaced before any pilot); a document database (guarantees move into application code); relying on application-only scoping (one missed filter leaks a tenant).

## Consequences

One container more than SQLite; tests that touch the store need Postgres (CI already provides it `[R]`); the trigger can be dropped by a database owner, which the hash chain reveals only against an exported head. The pooled Neon endpoint's compatibility with `SET LOCAL` per transaction is to be tested `[?]`.

## Verification

AUTH-TENANT, AUTH-RLS (if built), AUTH-ROLE (if built), SEC-LOG-APPEND, SEC-LOG-CHAIN, E2E-FRESH.
