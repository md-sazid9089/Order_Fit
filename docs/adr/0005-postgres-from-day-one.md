# 0005: Postgres from day one

> Historical record. [Current architecture](../architecture/orderfit/03-system-architecture.md)
> and [later ADRs](../architecture/orderfit/adrs/) supersede framework, fallback,
> timing, and numeric-verification assumptions below.

**Decision:** Use Postgres in the MVP, not SQLite. Deals, results, LangGraph checkpoints and the audit log all live in one database. psycopg 3 is the only driver. The schema changes only through Alembic migrations.

**Why:**
- The MVP runs on the same database as the pilot, so there's no migration later.
- The append-only audit log is enforced by a database trigger rather than by convention.
- More than one API process can write concurrently.
- LangGraph's Postgres checkpointer gives us restart-resume in the same transactional store.

**Cost:** One more container locally. Tests that touch the store need a running database (CI provides one as a service).

**Hosting:** Neon (Postgres 18). The app connects through the pooled endpoint; Alembic connects through the direct endpoint (`DATABASE_URL_DIRECT`). Local Docker Postgres stays available for offline development.
