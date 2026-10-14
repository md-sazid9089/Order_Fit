# fixtures: reference calculation and synthetic cases

Design-sprint artefacts, **not application code**. Python standard library only (tested with Python 3.12). Everything here is synthetic. Amounts, names, dates and financing terms are illustrative.

| File | Purpose |
|---|---|
| `reference_engine.py` | Reference calculation: timeline, counterfactual, headroom, strategy enumeration, loan sizing for three scenarios, stress scenarios (customer, deposit, other customers, cost overrun), ranking, escalation, value of information, alerts A1/A2/A6, assumption sensitivity, slot renderer. Defines the semantics in `../04-decision-engine-and-data-contracts.md` and is the starting code of the production engine. |
| `build_cases.py` | Generates `cases/*.json` deterministically. |
| `cases/*.json` | 18 core fixture files `OF-01`..`OF-17` (OF-07 has variants A and B), two regression reproductions `RINA` and `PX-01`, and two scripted-demo variants `DEMO-ASK` and `DEMO-REPLY` derived from OF-02 (22 files). Each has an `intent` block (the expected decision class written as a human label) next to the inputs. |
| `expected/*.json` | Outputs of the reference engine (every number in the design documents comes from here or from `worked_example.md` and `baselines.md`). |
| `selftest.py` | Rounding, same-day ordering, second-implementation cross-check, delay-scan monotonicity (MVP levers monotone; the deferred receivable-advance shape not), validators, slot renderer, injection scan. |
| `baselines.py` -> `baselines.md` | Baselines B0 (profit-only), B1 (fixed rule) and B4 (greedy ladder) on the core fixtures. |
| `render_worked_example.py` -> `worked_example.md` | Renders the worked example tables from `expected/`. |

Run (from this folder; plain `python`, not `python -I`, so the local import works):

```bash
python build_cases.py
python reference_engine.py          # writes expected/*.json and checks each case's intent (several minutes: brute-force cross-check and sensitivity runs)
python reference_engine.py --check  # fails if expected/ is stale
python selftest.py
python baselines.py
python render_worked_example.py
python reference_engine.py --fast   # iteration only: skips the cross-check and the sensitivity runs, writes expected_fast/ (never evidence)
```

## Honest limits

- The `intent` labels pin the narrative of each case. After the independent review the corrected stress semantics (the deposit and the other customers are delayed too, costs can overrun) changed the anchor's outcome; the anchor's opening balance (2,000,000 to 2,150,000, because the old value put a base-case trough exactly on the reserve) and the deposit concession (a flat step to 50 bps per 10 points of deposit, so larger asks cost more) were then changed and the `intent` labels updated to the new outputs. So agreement between `intent` and output is a consistency check, not independent evidence.
- `bruteforce_series` is a second implementation of the balance-series calculation that every analysis cross-checks. It re-sums the same events that `build_events` produced, so it checks the sweep, not the event semantics (concessions, loan dates, certainty). The event semantics are checked by the two historical reproductions (`RINA`, `PX-01`, whose inputs were partly reconstructed or fitted to the printed results) and, before submission, by a teammate hand-computing two cases.
- Deferred, known-issue levers kept in the code but in no core fixture: staged delivery, deferring the start, the receivable-advance financing shape.
- No timing figure is claimed for these scripts.
