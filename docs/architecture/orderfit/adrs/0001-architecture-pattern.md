# ADR 0001: Architecture pattern: fixed workflow over a deterministic engine

Status: proposed (this design sprint, 2026-10-14). Supersedes the topology described in the earlier strategy and system-design PDFs.

## Context

The competition asks for an agent that completes real tasks in a simulated environment, scored 40% task completion, 30% security and compliance, 30% innovation and interaction `[W]`. The repository has three overlapping topologies: four "agents" over six deterministic services (strategy PDF), one ten-node graph (system design), and a "structured decision model" next to an extraction model (proposal) `[R]`. The team is 5 students (stated by the user) with six days left; the code is stubs `[R]`.

## Decision

Option B: one fixed workflow with typed tools, an explicit state machine, a deterministic Decision Engine, four narrow language-model jobs (extraction, explanation, drafting, reply reading), a Permission Gate, and a simulated sandbox executor with a hash-chained log. No multi-agent orchestration. Details: [03](../03-system-architecture.md) sections 1 and 4.

## Alternatives rejected

- A (engine with a model only at the edges, nothing executes): fails the gate "yields sandbox execution evidence" (deliverable 6).
- C (bounded tool-using agent): passes the gates but raises the excessive-agency and injection surface and makes the recorded demo order fragile; scores 3.70 against B's 4.00 at the published weights, and loses by at most 0.05 in the worst weight shift tested.
- D (multi-agent): fails the buildable-by-freeze gate; more calls, more failure points, harder audit.

## Consequences

The model has no tools; autonomy is bounded by the transition table; the planner is deterministic. Risk: judges may read it as automation rather than an agent; mitigation is the clarification and negotiation loops and the tier gate in the demo. Delegating planning to a model is possible later behind the same gate (interface `NextActionProposer`, default policy table).

## What would change this

The organizers confirming that execution evidence is optional (A becomes viable but loses on interaction); a recorded-trace experiment where a model chooses the next tool correctly in at least 95% of 100 traces with zero out-of-tier attempts (C ties B at the 45/20/35 weighting).
