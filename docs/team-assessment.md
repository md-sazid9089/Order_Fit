# Team assessment

_Last updated 14 Oct 2026. Fill in the fields marked `TODO`._

## Team

| Name | Role | Owns | Contact |
|---|---|---|---|
| Md Sazid ([@md-sazid9089](https://github.com/md-sazid9089)) | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO |
| TODO | TODO | TODO | TODO |

## Ownership by area

| Area | Path | Owner | Reviewer |
|---|---|---|---|
| Decision engine | `backend/orderfit/engine/` | TODO | TODO |
| Agent workflow and prompts | `backend/orderfit/agent/` | TODO | TODO |
| Guards (security) | `backend/orderfit/agent/guards/` | TODO | TODO |
| API and storage | `backend/orderfit/api/`, `backend/orderfit/store/` | TODO | TODO |
| Frontend | `frontend/` | TODO | TODO |
| Infrastructure and CI | `docker-compose.yml`, `.github/` | TODO | TODO |
| Docs and evaluation | `docs/` | TODO | TODO |

## Skills

Rate each person 1 (new to it) to 5 (expert).

| Skill | TODO | TODO | TODO |
|---|---|---|---|
| Python, FastAPI | | | |
| LLM apps, LangGraph | | | |
| Financial modelling | | | |
| Security, prompt injection | | | |
| TypeScript, Next.js | | | |
| Postgres, Docker | | | |

## Strengths

- Clear architecture agreed early: the AI reads and writes, the engine calculates, and the
  owner approves. Layer boundaries are checked automatically by tests.
- Key decisions are written down as ADRs before code is written.
- CI and Docker were set up from the start, so integration problems show up early.
- TODO: team-specific strengths.

## Gaps and how we cover them

| Gap | Effect | Plan |
|---|---|---|
| TODO | | |
| TODO | | |

## Working agreements

- Work on branches; merge to `main` through a pull request with one review.
- CI must pass before merging.
- Changes that can alter an engine result bump `ENGINE_VERSION`.
- Significant design decisions get an ADR in `docs/adr/`.
- Progress is recorded in [checkpoint.md](checkpoint.md) at each checkpoint.
- TODO: meeting cadence and communication channel.

## Self-assessment

Score 1 to 5 at each checkpoint.

| Criterion | Score | Notes |
|---|---|---|
| Progress against plan | | |
| Code quality and tests | | |
| Collaboration | | |
| Security and safety | | |
| Documentation | | |
