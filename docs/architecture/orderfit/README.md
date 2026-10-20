# Architecture and financial reference

Start with the current implementation sections in the following guides. OrderFit
uses a modular monolith, a separate durable worker, one pure financial engine,
bounded AI proposals, human approval, and sandbox-only commercial execution.

| Document | Responsibility |
|---|---|
| [System architecture](03-system-architecture.md) | Runtime, authority, and AI boundaries |
| [Financial semantics](04-decision-engine-and-data-contracts.md) | Production conventions and historical reference examples |
| [Requirements and edge cases](01-requirements-scenario-edge-cases.md) | Requirement/test traceability |
| [Threat model](05-security-and-evaluation.md) | Detailed design controls and evaluation registry |
| [Current security guide](../../security/README.md) | Enforced controls and open operational gates |
| [Reference fixtures](fixtures/README.md) | Synthetic oracle, cases, expected outputs, and limitations |

## Decisions

The accepted [ADRs in this directory](adrs/) record architecture, financial/AI
separation, persistence, failure handling, durable states, exact bundles, runtime
roles, and engine bounds. ADRs 0007–0010 resolve later implementation choices.
The [earlier ADR namespace](../../adr/) is retained with supersession notes;
matching numbers in the two directories identify different decisions.

## Historical evidence

The original design was prepared on 14 October 2026 from the initial scaffold
(design-session starting commit `723f4e7`). Original examples and rationale remain
explicitly historical in the detailed guides. Old entities, providers, scope,
deadlines, and “not built” statements do not describe the current checkout.

- [Financial/source reconciliation and errata](_work/reconciliation.md)
- [Adversarial review](_work/reviewer-output.md) and [accepted dispositions](_work/review-log.md)
- [Image-only edge-case source transcription](_work/edgecase-transcription.md)
- [Market research](_work/research-market.md), [technical research](_work/research-technical.md),
  and [competitive summary](02-competitive-research.md)
- [Competition requirements and historical submission plan](06-roadmap-and-submission-plan.md)
- [Original discussion sources](../../discussion/)

These retain unique rationale and provenance. They are not current installation
instructions, live-provider evaluation, user validation, or submission evidence.
