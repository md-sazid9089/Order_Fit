# Engine

## Rules
- Money is `int` minor units; exponent per currency (`money.CURRENCY_EXPONENT`). Rates are integer basis points.
- Same-day events: outflows before inflows.
- Delay tolerance: linear scan d = 0..180, stop at the first failure. `-1` = fails on time.
- Loans are sized to meet the target tolerance, within catalogue min/max/step.
- Ranking: meets target → cost → borrowed → option id. Below target → tolerance.
- Any change that can alter a Result bumps `ENGINE_VERSION`.

## Adding a test case
The maintained financial oracle and executable cases are in
[`architecture/orderfit/fixtures/`](architecture/orderfit/fixtures/README.md).
Run `python docs/architecture/orderfit/fixtures/reference_engine.py --check` and
`python docs/architecture/orderfit/fixtures/selftest.py` from the repository root.
The backend engine has its own focused unit and PostgreSQL acceptance tests; it
does not load `data/test_cases.json` or `backend/tests/engine/test_catalogue.py`.
