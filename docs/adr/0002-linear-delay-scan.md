# 0002: Linear scan for delay tolerance

> Historical record. [Current architecture](../architecture/orderfit/03-system-architecture.md)
> and [later ADRs](../architecture/orderfit/adrs/) supersede framework, fallback,
> timing, and numeric-verification assumptions below.

**Decision:** Scan d = 0..180 and stop at the first failure. Never use binary search.

**Why:** Pass/fail is not monotone in the delay. A later inflow can make d=26 pass after d=21 failed. Binary search would report a tolerance the plan doesn't have.

**Cost:** At most 31 × 181 timeline runs per analysis, which is under a second in pure Python.
