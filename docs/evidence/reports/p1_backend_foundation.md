# P1 runtime foundation

P1 enables only identity, capabilities and operation polling/cancellation HTTP
routes. The target contract catalogue still describes future phases. There is no
financial calculation, document upload/parser, OpenAI call or execution handler in
the running P1 API. Worker jobs with no registered handler fail visibly with
`CAPABILITY_UNAVAILABLE`; they never produce a fabricated financial result.

## Identity and database boundary

API processes receive a restricted LOGIN inheriting `orderfit_app`; workers use
a distinct LOGIN inheriting `orderfit_worker`. Neither receives the direct URL.
Startup verifies PostgreSQL privileges, ownership and the exact Alembic revision.
The migrator-only `python -m orderfit.store.provision` command creates both logins
from explicit environment variables and refuses existing roles. Provision once;
rotate existing credentials through a separately reviewed administrator procedure.
The README and Compose setup profile show the startup sequence.

The API authenticates opaque cookies against hashed, durable sessions. Passwords
use Argon2id. Cookies are HttpOnly/SameSite=Lax and Secure by default; development
must explicitly disable Secure on loopback HTTP. Mutation requests require the
permitted Origin, signed matching CSRF cookie/header and an idempotency key.
`GET /api/v1/auth/csrf` renews the CSRF challenge, including after its 30-minute
cookie expires, and refuses explicit cross-site requests. Sessions have an
eight-hour absolute and thirty-minute idle lifetime. Existing MFA-enforced users
fail closed; password step-up/MFA are not enabled in P1.

Memberships returned by `/auth/me` are the available business selections. A
business UUID in a path only selects a scope: each transaction rechecks current
membership and permission. It never supplies actor identity. Locks follow
business -> deal -> related row order; transaction-local GUCs clear at commit and
rollback. RLS protects selected tenant scope, with no-context reads returning no
tenant rows. The database login is a trusted application credential, never an
end-user SQL interface: PostgreSQL custom GUCs alone do not authenticate arbitrary
SQL submitted by someone who possesses that credential.

Signup/signin reserve keyed request digests and store only resulting identity and
session IDs. Raw tokens/passwords never enter the replay cache. Replay with the
original valid cookie recovers the session view; a lost cookie requires explicit
sign-in with a fresh key (`AUTH_SESSION_RECOVERY_REQUIRED`). Signout/password
change revoke sessions; reusing a revoked cookie returns 401. These two security
mutations do not replay a response through an invalidated session. Business
operation commands preserve exact original operation/response identity.

## Persistence and recovery

Revision `0002_backend_foundation` extends the original tables and policies; the
four SQL components of revision 0001 are unchanged. Coarse financial revisions
deliberately invalidate more work than an optimized dependency graph. Customer,
invoice, payee/account, offer, cash event, document and reviewed-field writes bump
the business revision; deal-scoped children also bump the deal input revision.
PO references remain editable metadata. Direct revision assignments cannot make
changed financial inputs appear unchanged. Old frozen-state rules still require
a separate state transition before changing financial fields.

Snapshots are immutable, hash-checked, tenant/deal linked and bound to current
revisions and the confirmer. P3 still must construct them from the reviewed,
complete input pipeline; P1 does not expose a confirmation route. Legacy
evaluation/tolerance evidence is preserved unchanged. A NULL legacy tolerance
status remains unclassified (`legacy_unknown` at the future read adapter).

Operation admission, idempotency, computing-state transition and PostgreSQL audit
append commit together. Claiming uses short transactions, bounded attempts,
leases and fresh fencing tokens; work runs outside the transaction. Publication
rechecks current authorization and both revisions. A stale worker cannot publish
or heartbeat after reclamation. Cancellation is cooperative at a publication
boundary. Stale/blocked evaluation operations return to awaiting confirmation;
technical failure uses failed state rather than a numerical verdict. P3 must
extend the fenced publication transaction to persist real evaluations/options
and their resulting workflow transition atomically before enabling its handler.

Queue helpers are restricted to workers, global auth data is inaccessible to
ordinary table queries, and tenant successes use the existing PostgreSQL audit
chain. Denial events persist in a separate bounded security record after rollback.
There is no competing Python audit hash format.

Private storage accepts generated UUID scope only, hashes actual streamed bytes,
limits size, fsyncs before atomic publication and refuses replacement. It assumes
a private application-owned filesystem root; it is not an authorized download or
parser service. P4 must add scoped metadata/downloads, MIME/parser checks and
orphan-file reconciliation across filesystem/database failures.

## Reproducing local acceptance

From `backend/`, with Docker available:

```text
uv sync --frozen --extra dev
uv run --frozen ruff check .
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen pytest -q
```

The DB fixture creates a uniquely named, labeled PG17 container, loopback port,
random secrets and real API/worker LOGINs. It verifies the target, upgrades both
empty and populated 0001 databases, compares every historical column/row, runs
the original SQL/concurrency suites on both revisions, and removes only its
verified disposable container. It never consumes configured application URLs.
The original schema test's three exact structural inventories are revision-aware;
all behavior assertions are preserved. A killed worker-process test expires its
lease explicitly and restarts the CLI against the same persisted operation.

Hosted PostgreSQL/poolers, browser integration, provider quality, backup/restore
and a full running Compose deployment require their own later-phase acceptance.
