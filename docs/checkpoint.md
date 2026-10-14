# Checkpoint report

_Status as of 14 Oct 2026. Update this file at each checkpoint._

## Summary

The foundation is in place: repository layout, shared contracts, layer rules enforced by tests,
Postgres with migrations, Docker Compose and CI. The engine, agent nodes, guards and API routes
exist as typed stubs with docstrings and are the next work. No AI provider is wired in yet.

| Area | Status |
|---|---|
| Repository structure and tooling | ✅ Done |
| Shared contracts (`domain.py`, `engine/models.py`) | ✅ Done |
| Architecture tests (layer boundaries) | ✅ Done, passing |
| Database (Postgres on Neon, Alembic migrations) | ✅ Done |
| Docker Compose and CI (lint, tests, typecheck, build) | ✅ Done |
| Decision engine (timeline, tolerance, options, financing, stress, rank) | 🟡 Stubbed |
| Agent workflow and nodes | 🟡 Stubbed |
| Guards (numbers, terms, injection, fraud) | 🟡 Stubbed |
| AI wrapper (`agent/llm.py`) | ⬜ Not started, due 16 Oct |
| API routes (deals, documents, actions, stream) | 🟡 Stubbed |
| Web screens | 🟡 Stubbed |
| Competition docs (technical, security, evaluation) | ⬜ Not started, due 19 Oct |

✅ done · 🟡 scaffolded, logic pending · ⬜ not started

## Done since the last checkpoint

- Folder structure, module layout and shared contracts.
- Architecture tests: `engine/` imports only stdlib and pydantic, only `agent/nodes/compute.py`
  calls the engine, and only `agent/llm.py` may import an AI SDK.
- Docker setup for the API and web, with configurable ports.
- Moved to Postgres from day one, on Neon: pooled endpoint for the app, direct endpoint for
  migrations ([ADR 0005](adr/0005-postgres-from-day-one.md)). LangGraph checkpoint tables are
  excluded from Alembic.
- CI on every push and pull request.

## Decisions made

| ADR | Decision |
|---|---|
| [0001](adr/0001-integer-minor-units.md) | Money as integer minor units, rates as basis points |
| [0002](adr/0002-linear-delay-scan.md) | Linear scan for delay tolerance, never binary search |
| [0003](adr/0003-ai-never-types-numbers.md) | The AI never produces a figure |
| [0004](adr/0004-replies-revalidated.md) | Negotiation replies go back through validate and confirm |
| [0005](adr/0005-postgres-from-day-one.md) | Postgres in the MVP, not SQLite |

## Next checkpoint

| Target | Due |
|---|---|
| Engine implemented and passing `data/test_cases.json` | |
| AI provider chosen, `agent/llm.py` implemented | 16 Oct |
| Agent nodes and guards implemented with faked-AI tests | |
| API routes and web screens wired end to end | |
| Demo flow (Rina order) runs end to end | |
| Technical, security and evaluation write-ups | 19 Oct |

## Risks and blockers

| Risk | Impact | Mitigation |
|---|---|---|
| AI provider not yet chosen | Blocks extract, explain, draft and read_reply | Decide by 16 Oct; nodes are tested against a fake AI meanwhile |
| Engine logic not yet written | Everything downstream depends on it | Engine first; test cases already defined in `data/test_cases.json` |
| Short timeline to 19 Oct | Features may slip | Keep the demo path (one order, one quote) as the priority |

## Test status

```
pytest -q        # 3 passed (architecture tests); engine and agent tests are placeholders
```
