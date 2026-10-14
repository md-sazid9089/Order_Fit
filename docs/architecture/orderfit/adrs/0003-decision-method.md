# ADR 0003: Decision method: enumerate, filter by hard constraints, rank lexicographically

Status: proposed; replaces the "delay tolerance then cost" ranking (edge-case R-09, system design) and keeps [repo ADR 0002](../../../adr/0002-linear-delay-scan.md).

## Context

Earlier documents rank by delay tolerance then cost, size loans as "reserve minus lowest balance", index time in day offsets and compare to a trust-ladder target `[R]`. The reference calculation shows each is insufficient: the catalogue's recommended 9,000 loan is beaten by a 10% advance plus a 6,000 loan with the same 26-day tolerance (profit 12,720.00 versus 12,630.00); loan feasibility is not monotone in the amount (fixed repayment dates); and the review showed the recommendation depends on stress parameters that were not stressed (a deposit exempt from delay, other customers never late) `[R: fixtures, review log]`.

## Decision

1. Calendar dates, integer minor units, outflow before inflow, one rounding rule.
2. Hard constraint on every calendar day, relative to the counterfactual baseline: `trough >= min(reserve, baseline_trough)`; a pre-existing breach is reported separately.
3. A small enumerated strategy space (deposit percent on a 5-point grid, supplier extension, offer plus amount, decline); loan amounts enumerated on the offer's grid, smallest feasible for each of base, downside and severe (always feasible in base); dominated sub-plans pruned only if they also keep at least as much cash on the lowest day in every scenario. Stages, deferral and the receivable-advance shape are deferred.
4. Scenarios are user-specified and editable (defaults: downside = customer 15 days late, other customers 5 days late, the deposit late with the customer; severe = 45 days, 15 days and costs 3% higher); no probabilities; every plan reports its headroom; the recommendation ships with a sensitivity table over the assumed parameters; the delay scan is linear (for the MVP levers feasibility is monotone in the delay, so the scan is exact rather than required; it stays linear because it costs at most 91 sweeps and remains correct if a lever whose outflow moves with the receipt is added).
5. Ranking: hard filter (reserve, financing cap in every scenario, minimum profit), then lexicographic: meets-target-resilience (soft), then the owner's ordered priorities, then deterministic tie-breaks. No weights; `profit_given_up_for_resilience` is reported with every recommendation.
6. If a missing input could flip the recommendation, ask; otherwise proceed with a shown assumption (value of information).

## Alternatives rejected

A weighted score (invented weights with no ground truth); an integer-programming solver (no benefit over enumeration for a few dozen strategies; harder to explain); a trust-ladder target (a probability proxy the catalogue itself does not specify); binary search on delay (valid for the MVP levers, so not wrong, but it adds nothing at 91 sweeps and would break silently for a lever whose outflow moves with the receipt).

## Consequences

Explanations are exact ("first differing criterion"); results are reproducible; the enumeration size grows with the grids (45 strategies are enumerated for the anchor). The default priorities, delays and close-call margin are labelled assumptions.

## What would change this

Real owners ranking priorities differently; an enumeration large enough to need pruning beyond dominance; evidence that a learned ranker beats the rule on held-out cases (it would still only reorder verified strategies; [ADR 0006](0006-orchestration-and-learned-layer.md)).
