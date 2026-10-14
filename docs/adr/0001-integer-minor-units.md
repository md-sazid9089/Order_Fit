# 0001: Money as integer minor units

**Decision:** The engine stores money as `int` minor units and rates as integer basis points. `Decimal` is used only at the API boundary. Floats are never used for money.

**Why:** It's exact, fast, and has a single rounding rule (`money.apply_bps`). It removes the rounding errors behind edge case X-04.

**Cost:** The engine has to know each currency's exponent.
