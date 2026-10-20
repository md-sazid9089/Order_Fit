# OrderFit test cases

This catalog exposes the repository's existing 22 synthetic reference cases for
reviewers. It adds no new scenario inputs or expected financial outcomes. The
case JSON files and golden outputs remain authoritative in
[`fixtures/cases/`](architecture/orderfit/fixtures/cases/) and
[`fixtures/expected/`](architecture/orderfit/fixtures/expected/).

Run the checked-in cases from the repository root:

```sh
python docs/architecture/orderfit/fixtures/reference_engine.py --check
python docs/architecture/orderfit/fixtures/selftest.py
```

On 20 October 2026, the reference check matched **all 22 cases** (`problems=0`);
the independent calculation, boundary, validation, and injection self-tests
reported **0 failures**. These are synthetic reference-engine checks, not
independent proof of real-world decision quality or a substitute for API,
database, browser, provider, or hosted acceptance.

| Case | Scenario covered | Checked expected result |
|---|---|---|
| OF-01 | Feasible order with adequate cash | `accept_as_is` |
| OF-02 | Profitable order with a liquidity gap; compare profit and downside resilience | `accept_with_changes`, `dep40`; the higher-profit loan fails the downside target |
| OF-03 | Large customer inflow but costs exceed order profit | `decline_or_renegotiate`; `E-UNPROFITABLE-AFTER-COSTS` |
| OF-04 | Customer deposit versus financing trade-off | `accept_with_changes`, `dep20`; close-call flag |
| OF-05 | Supplier extension makes the order feasible | `accept_with_changes`, `ext30`; fragile-best flag |
| OF-06 | Cash-feasible loan falls below the owner's minimum profit | `decline_or_renegotiate`; `E-UNPROFITABLE-AFTER-COSTS` |
| OF-07A | Profit-first owner priorities | `accept_with_changes`, `fin:BANK_WC@130000000`; close-call flag |
| OF-07B | Downside and customer-independence priorities | `accept_with_changes`, `dep40` |
| OF-08 | Purchase-order, quote, and line-item totals conflict | `blocked_data_conflict`; two `E-DATA-CONFLICT` findings |
| OF-09 | No strategy funds costs before the delayed receipt | `decline_or_renegotiate`; `E-NO-FEASIBLE` |
| OF-10 | Prompt-injection text embedded in otherwise valid documents | Same decision and ranking as the clean twin; injection flags are raised |
| OF-11 | Only a fragile feasible plan remains | `accept_with_changes`, `fin:BANK_WC@70000000`; fragile-best flag |
| OF-12 | Business is already below its reserve before the order | `accept_with_changes`, `dep30`; `E-PRE-EXISTING-BREACH` |
| OF-13 | Payroll and customer receipt occur on the same date | `accept_with_changes`, `dep50`; same-day outflow ordering is checked |
| OF-14 | “Net 45” lacks an invoice-versus-delivery anchor | `needs_input`; `E-MISSING-ANCHOR` because the interpretation changes the result |
| OF-15 | Anchor twin with similar profit but sufficient cash | `accept_as_is` |
| OF-16 | USD cost has no supported FX rate | `unsupported_escalate`; `E-UNSUPPORTED-MULTICCY` |
| OF-17 | Order cost repeats an existing baseline invoice | `blocked_data_conflict`; `E-DUPLICATE-OBLIGATION` |
| RINA | Historical USD financing regression | `accept_with_changes`; deposit plus the Rina loan |
| PX-01 | Historical proposal worked-example regression | `accept_with_changes`, `dep50` |
| DEMO-ASK | Missing payment anchor where the answer flips | `needs_input`; asks instead of guessing |
| DEMO-REPLY | Customer caps the deposit at 30% | `accept_with_changes`, `fin:BANK_WC@130000000`; fragile-best flag |

Important edge checks also run in `selftest.py`: half-up rounding, below-half
rounding, same-day outflow-before-inflow, exact reserve boundary, one unit below
reserve, deterministic tie-breaking, dates before `as_of`, non-positive
quantities, unsupported tax/calendar/currency inputs, non-monotone deferred
receivable advances, and injection/slot-rendering validation.

For application-level checks, use the [development verification commands](development.md#verification).
They exercise persistence, authorization, recovery, the API contract, and browser
workflows separately from these reference cases.
