# Reference baselines on the core fixtures (generated)

Written by `baselines.py`. These describe the fixtures, which the team wrote; they are not evidence about real owners.

| Case | Engine | B0 profit-only | B1 fixed rule | B4 greedy ladder |
|---|---|---|---|---|
| OF-01 | `accept_as_is` (L3, feasible, meets target) | `accept_as_is` (L3, feasible, meets target) | `accept_as_is` (L3, feasible, meets target) | `accept_as_is` (L3, feasible, meets target) |
| OF-02 | `dep40` (L2, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep35` (L1, feasible, below target) |
| OF-03 | `decline` (L3, feasible, meets target) | `decline` (L3, feasible, meets target) | `accept_as_is` (L2, feasible, meets target) | `accept_as_is` (L2, feasible, meets target) |
| OF-04 | `dep20` (L1, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep20` (L1, feasible, meets target) |
| OF-05 | `ext30` (L1, feasible, below target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `ext30` (L1, feasible, below target) |
| OF-06 | `decline` (L3, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `fin:BANK_WC@90000000` (L1, feasible, meets target) |
| OF-07A | `fin:BANK_WC@130000000` (L1, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep35` (L1, feasible, meets target) |
| OF-07B | `dep40` (L2, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep35` (L1, feasible, below target) |
| OF-09 | `decline` (L3, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `decline` (L3, feasible, meets target) |
| OF-10 | `dep20` (L1, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep20` (L1, feasible, meets target) |
| OF-11 | `fin:BANK_WC@70000000` (L1, feasible, below target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `fin:BANK_WC@70000000` (L1, feasible, below target) |
| OF-12 | `dep30` (L1, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep30` (L1, feasible, meets target) |
| OF-13 | `dep50` (L2, feasible, meets target) | `accept_as_is` (L0, BREACHES reserve, below target) | `decline` (L3, feasible, meets target) | `dep50` (L2, feasible, meets target) |
| OF-15 | `accept_as_is` (L2, feasible, meets target) | `accept_as_is` (L2, feasible, meets target) | `accept_as_is` (L2, feasible, meets target) | `accept_as_is` (L2, feasible, meets target) |

Analysable core fixtures: 14 (the others are blocked, ask, or unsupported by design).

| Baseline | breaches the reserve in the base case | breaks any hard constraint (reserve, minimum profit, cost cap) | feasible but below the owner's target while the engine's plan meets it | same plan as the engine | declines where the engine finds a feasible plan |
|---|---:|---:|---:|---:|---:|
| B0 | 11 | 11 | 0 | 3 | 0 |
| B1 | 0 | 1 | 0 | 4 | 9 |
| B4 | 0 | 2 | 2 | 9 | 0 |
