# Evidence interpretation

Application/migration source: `eef7bea2f7d622dc293f8667a120222666fa0d29`.
No application behavior or financial expected values were changed for this run.

- `backend.xml`: initial full baseline, 540 passed, no failures/errors/skips.
- `bursts.xml`: eight passing probes, but reference-calculator verification was
  running concurrently. Retain as correctness evidence; exclude its latency
  values from the final controlled burst measurements.
- `reference.txt` / `selftest.txt`: 22 reference cases with zero problems;
  independent selftest with zero failures.
- `pilot/`: functional pilot. Windows asyncio timers sometimes woke before the
  scheduled arrival, and low-rate windows ended before their full duration.
  Those timings are invalid for capacity claims. Both tenant inventories and
  audit chains reconciled, and original-key replay after API restart passed.
- `pilot-corrected/`, `pilot-final/`, `pilot-cleanup-fixed/`: HTTP/state checks
  passed, but cleanup assertions incorrectly interpreted nonzero Windows working
  sets as proof of process liveness. Exclude these as clean pilot passes.
- `windows-cleanup-probe.json`: separate old-style termination experiment found
  two terminated Python processes, zero live processes, and two nonzero retained
  working-set counters. This corrected the premature orphan-process diagnosis.
  No application process leak is established by those failed pilot assertions.
- Test utilities now use `GetExitCodeProcess` for Windows liveness and explicitly
  terminate the owned API process tree. The new subprocess regression retains
  its exited `Popen` handle while asserting that the owned processes are dead.
- `pilot-verified/`: corrected scheduler, persisted inventories/audit, restart
  replay and actual process-liveness checks passed. Later raw per-request logging
  and production server limits are additional instrumentation changes.
- `recovery-final.xml`: 23 passing affected recovery/concurrency checks, including
  the 32-way signed passkey challenge race. Use its `STRESS_METRIC` records for
  isolated burst timing; no reference or browser benchmark overlapped this run.
- `browser-console.txt`: seven passing fresh-production-image browser/proxy tests;
  7,459 requests in the separate 60-second HTTP probe, exact expected 200/404/422
  statuses and no 5xx. Private images, containers and volumes were removed.
- `server-configuration.json`: installed Uvicorn CLI was independently checked
  to resolve the runner's environment options to the production settings:
  concurrency 64, keep-alive 5 seconds, graceful shutdown 20 seconds and no proxy
  trust for the loopback experiment. Server and DB capacity refusals are distinct.
- `inherited-setting-presence.json`: database/provider credentials were absent
  from the inherited environment. DB stress fixtures and the browser runner used
  generated disposable targets, not configured application URLs.

Later results are reconciled in `summary.json` and
`../../backend_stress_test_report_2.md`. `backend-final.xml` records542passing
tests. `keepalive-5/` failed with a transport disconnect and reconciled persisted
state; the matched two-second-client `keepalive-2/` control passed. `http-final/`
completed the first2and5req/s60-second stages, then was deliberately interrupted
at the plan's disk gate (Docker C:7.147%free vs15%minimum). Its induced read error
is an abort artifact. All50acknowledged writes and10audit chains reconciled before
fixture cleanup; `cleanup.json` verifies the final DB container absent. The
repeated ramps and two-hour soak were not completed. The user chose the blocked
report, not additional load. `resource-guards-final.xml` records5passing focused
checks after a workspace-local basetemp avoided the first attempt's sandbox ACL
errors; it includes4new disk-policy cases added after the full542-test run.
The initial baseline, affected subsets and final baseline overlap; never sum
their test counts as independent coverage.
