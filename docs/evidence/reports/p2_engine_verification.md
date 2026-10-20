# P2 engine contract and verification

The public calculator consumes strict `EngineInput` and returns `Result` at
`backend/orderfit/engine/analyse.py`. Application callers use
`agent/nodes/compute.py` with a complete `ConfirmedInputV1`. This adapter converts
wire money strings and calendar dates, maps explicit policies/offers/scenarios,
and keeps provenance hashes. It does not query SQL or calculate financial figures.
Existing contract exports remain unchanged; this internal result is not yet a
persisted/HTTP `EvaluationResultV1`.

The full catalogue includes canonical strategy parameters, hard failures, ranking,
incremental profit, financing cost, eligible shifted cost keys, generated dated
events, and three complete daily series. Each scenario includes trough, close,
reserve, same-date baseline floor, funding gaps and separate inherited-baseline
versus order-caused breach intervals. Dominated candidates remain available with
no rank. Rich versioned JSON diagnostics retain reference reasons, alerts,
shortlist/ranking comparisons, VOI and sensitivity. A finite successful tolerance
scan reports `capped_scan`; no nonpayment-survival proof is implemented or implied.

## Numerical and admission rules

Money uses integer minor units; supported currencies BDT/USD/EUR/GBP have exponent
2. Basis points use half-up rounding and split residuals go to the final piece.
The calculator uses explicit calendar dates and same-day outflows before inflows.
Hard feasibility requires base cash not worsen the same-scenario baseline below
reserve on each date, strict profit above the pinned minimum, and the absolute
financing cap. The requested resilience scenario is a soft ranking target.

Supported levers are deposit concessions, eligible supplier extensions and dated
fixed-term loans with explicit flat-term interest/fees and positive min+n*step
grids. No FX, APR conversion, factoring, revolving credit, staged delivery,
delivery deferral, concentration, minimum-tolerance or percentage-cost-cap policy
is activated. Unknown event classes, fields, enums and invalid sensitivity bounds
fail strict validation. Missing anchors/conflicting facts return explicit review
outcomes. Nonincremental costs are excluded from incremental profit and are not
silently added again as new obligations.

Admission ceilings are 2,000 total input events, 20 offers, 200 draw points/offer,
10,000 expanded deposit/extension/loan combinations, 540 scan days, 1,095 horizon
days, 500,000 retained scenario/day points and at most 100,000,000 work units.
The work ceiling can be reduced per input; dimension ceilings define the supported
engine version. Combined maxima are not promised to pass admission. Expanded
monetary totals must fit BIGINT. The conservative estimate accounts for sizing,
three scenarios, shortlist scans, deposit diagnostics and sensitivity/VOI variants.
A shared actual counter also covers nested reruns. Either rejection returns
`analysis_limit`, no recommendation and no partial catalogue. Invalid input shape
raises validation errors for the application adapter to translate in P3.

## Evidence and reproduction

Run from `backend/`, using the locked Python 3.12 environment:

```powershell
uv run --frozen ruff check .
uv run --frozen pytest -q -s --tb=short -x
uv run --frozen python -m orderfit.contracts.export --check
uv run --frozen python ../docs/architecture/orderfit/fixtures/reference_engine.py --check
uv run --frozen python ../docs/architecture/orderfit/fixtures/selftest.py
uv run --frozen python -m tests.engine.benchmark_engine
```

The DB fixture creates and verifies a labeled disposable loopback PostgreSQL 17
container; it never consumes configured application/Neon URLs. Docker access is
required for those tests. Engine/contract tests require no database or API key.
The reference adapter only translates synthetic legacy fixtures; it is separate
from the confirmed-input application adapter. Differential tests cover all 22
goldens, plus 25 named strategies, without changing expected files. Independent
checks exercise arithmetic, daily floors, eligibility, fees, strict hard policies,
soft targets, deterministic hashes, late funding/repayment, large scans, admission,
nonmonotone scan behavior and exhaustion without partial publication.

### Performance

Measurements are local Windows/Python 3.12 single-process runs, not hosted service
latency guarantees. The repeatable benchmark includes OF-02, a 50-deposit by
200-choice (including no loan) grid at the 10,000-combination ceiling, and the same
grid with 900 baseline events close to the conservative work-admission ceiling.
The latter two retain 51 candidates and 111,996 scenario/day points. Failed loan
sizes are evaluated but need not appear as feasible catalogue options.

Final CPU/memory measurements are recorded in the progress file. Earlier wall-time
runs measured OF-02 at 15.509s, the combination-boundary case at 13.389s and the
900-event case at 34.762s; a repeat under test contention measured 17.266s,
16.924s and 40.163s. Work was deterministic: 8,093,975 / 7,530,568 / 16,704,863
units respectively. These are stress-envelope samples, not proof of a universal
maximum time or memory across all admissible value distributions.

P3 must run computation outside DB transactions in a bounded subprocess, preserve
leases/fencing, and map timeout/memory/work exhaustion to an incomplete technical
outcome. Start deployment sizing from measured CPU/memory, then validate the actual
worker/container budget before enabling it. Do not advertise a universal timeout
guarantee from these local samples. No P3 execution handler is enabled here.

P2 does not establish hosted business workflow, browser, live OpenAI, backup/restore
or deployment acceptance. Existing Neon setup is preserved and was not contacted
for this pure-engine phase. See ADR 0010 for versioned semantic corrections and
hash boundaries; see the progress record for the final gate verdict.
