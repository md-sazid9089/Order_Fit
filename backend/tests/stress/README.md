# Plan-2 HTTP experiment

This opt-in runner provisions the repository's labeled disposable PostgreSQL 17
fixture and starts a private loopback API process. It refuses inherited database
or provider credentials and accepts no external target. Run from `backend/` with
locked dev dependencies and Docker access:

```powershell
uv run --frozen python -m tests.stress.run_plan2 --output ../docs/backend-stress-2/<run-id>/http --stage-seconds 60 --soak-seconds 7200
```

The output directory must not already exist. The runner seeds 100 deals in each
of two synthetic businesses, performs three arrival-rate ramps at 2–80 attempts/s,
stops increasing load at the first local latency/backpressure threshold, and then
runs a two-hour mixed soak at 60% of the lowest repeated passing candidate rate.
This is a local candidate envelope, not certified hosted capacity. An explicit
`--soak-rate 2` selects a modest idle/churn diagnostic instead. A 60-second ramp
stage is shorter than the plan's five-minute measurement window; use
`--stage-seconds 300` for that window. Neither mode adds the plan's two-minute
warm-up or certifies all its independent workload classes and replica variants.
Use `--businesses 10` for ten businesses with independent sessions.
Before starting Docker, it records free space for its output, temporary storage
and detected local Docker storage paths. Any required volume below the plan's
15% free-space minimum blocks provisioning. Remote Docker storage needs its own
operator verification; a client-host disk check cannot certify a remote daemon.

Requests cover reads, distinct deal writes, original-key replays, deliberate
foreign-tenant reads and invalid limits. There are no provider calls or job
admissions in this runner; existing pytest suites exercise those independently.
Each stage records actual offered/started/completed/dropped requests, generator
lag, status/error counts, per-route latency and sampled API-process-tree Windows
working sets (or resident bytes on Linux). Timing includes the HTTP client.
`requests.jsonl` retains each request's route label, status/code, response size,
latency and tenant index so percentile and count summaries can be independently
recomputed. It contains no request bodies, URLs, cookies or tokens.
Database/worker/container memory is not included in those API memory samples.
The private Uvicorn CLI receives the production entry point's 64-connection,
5-second keep-alive and 20-second graceful-shutdown settings through its supported
`UVICORN_*` environment options. Plain server-capacity 503s are counted separately
from typed application database-capacity 503s; either ends rate escalation.
The client defaults to a 2-second idle-connection expiry, below the server's
5-second expiry. `--client-keep-alive 5` deliberately exercises the equal-timeout
boundary; ten users at 2 total requests/second reuse each user's connection every
5 seconds. Equal-timeout runs exposed a `ReadError` and a `RemoteProtocolError`
at that boundary. Failed runs remain failures and reconcile stored intents before
teardown; the runner does not hide transport errors with automatic retries.

Unexpected responses and tenant/replay invariant failures stop the experiment.
After load, restricted tenant reads verify every created ID and audit chain;
unscoped reads must see zero deals. Restarting the API must replay each original
seed write without creating another identity. The fixture tears down only its
own labeled database container, including on failure. Metrics contain no cookies,
tokens, documents, credential-bearing URLs or raw response bodies.
On abort, direct same-intent tenant reads recover any write whose response was
lost and verify its public reference against the original intent. The original
transport/invariant failure still fails the run; no replacement-key write is sent.

Run a small functional pilot first (`--stage-seconds 5 --soak-seconds 0
--seed-deals 2 --rates 2 80 --repetitions 1`) and classify its measurements as
harness validation. Do not run
performance experiments alongside engine/browser builds or another load test.
