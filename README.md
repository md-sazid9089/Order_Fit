<div align="center">

# OrderFit

**Can my business afford to take this order, and how do I make it safe?**

An order decision assistant for small businesses. The AI reads documents and drafts messages,
a deterministic engine does every calculation, and the owner approves every outgoing action.

[![tests](https://github.com/md-sazid9089/Order_Fit/actions/workflows/tests.yml/badge.svg)](https://github.com/md-sazid9089/Order_Fit/actions/workflows/tests.yml)
![Python](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115%2B-009688?logo=fastapi&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-15-000000?logo=nextdotjs&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-agent-1C3C3C)

[Features](#features) ·
[Architecture](#architecture) ·
[Getting started](#getting-started) ·
[Configuration](#configuration) ·
[Testing](#testing) ·
[Documentation](#documentation)

</div>

---

> [!NOTE]
> OrderFit is an early-stage MVP under active development. Interfaces and storage may change
> without notice.

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Project structure](#project-structure)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Run with Docker](#run-with-docker)
  - [Run locally](#run-locally)
- [Configuration](#configuration)
- [Testing](#testing)
- [Scripts](#scripts)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Overview

A small business receives an order. Accepting it means buying materials up front and waiting
weeks to be paid, and a late payment can leave the business unable to cover its other bills.
OrderFit takes the customer order and the supplier quote, works out the cash position day by
day, stress-tests it against late payment, and proposes ways to make the order safe, such as
asking for a deposit, changing payment terms, or taking short-term financing.

Three rules shape the design:

1. **The AI never produces a number.** Every figure comes from the engine. AI text uses
   placeholders, and a guard blocks any figure that doesn't match an engine value
   ([ADR 0003](docs/adr/0003-ai-never-types-numbers.md)).
2. **The engine is pure and deterministic.** It has no AI and no I/O. The same inputs always
   give the same result, and money is held as integer minor units
   ([ADR 0001](docs/adr/0001-integer-minor-units.md)).
3. **A human approves every outgoing action.** The workflow pauses for the owner to confirm the
   extracted figures and again to approve each message before it is sent.

## Features

- **Document ingestion**: reads customer orders and supplier quotes and extracts the terms.
- **Cash-flow timeline**: day-by-day cash position for the life of the order.
- **Delay tolerance**: how many days late the customer can pay before the business runs out of
  cash ([ADR 0002](docs/adr/0002-linear-delay-scan.md)).
- **Ranked options**: deposits, term changes and financing from a catalogue, sized to meet a
  target tolerance and ranked by cost.
- **Stress testing**: shows how each option holds up under adverse scenarios.
- **Negotiation drafts**: writes messages to customers and suppliers. Replies are read back,
  re-validated and re-confirmed before anything is recomputed
  ([ADR 0004](docs/adr/0004-replies-revalidated.md)).
- **Safety guards**: number, terms, prompt-injection and fraud checks (for example, changed bank
  details or a mismatched sender domain). Guards report problems; they never rewrite text.
- **Audit trail**: append-only log of every decision and action. Documents are stored by hash.

## Architecture

```mermaid
flowchart LR
    U[Owner] <--> W[Web<br/>Next.js]
    W <--> A[API<br/>FastAPI]
    A --> G[Agent<br/>LangGraph]
    G -->|all AI calls| L[llm.py]
    G -->|all calculations| E[Engine<br/>pure Python]
    G --> S[(Store<br/>DB, documents, audit)]
```

The agent workflow pauses at two points, `[confirm]` and `[approve]`, using LangGraph interrupts:

```
ingest → extract → validate → [confirm] → compute → explain → draft → [approve] → send
                                  ↑                                                  │
                                  └──────── validate ← read_reply ← (reply) ─────────┘   max 3 rounds
```

Layer boundaries are enforced by [tests/test_architecture.py](backend/tests/test_architecture.py):
AI calls go only through `agent/llm.py`, and engine calls go only through `agent/nodes/compute.py`.

## Tech stack

| Layer    | Technology |
|----------|------------|
| Backend  | Python 3.12, FastAPI, Pydantic v2, Uvicorn |
| Agent    | LangGraph with checkpointing |
| Storage  | PostgreSQL 17 (psycopg 3), SQLAlchemy 2, Alembic |
| Frontend | Next.js 15, React 19, TypeScript |
| Tooling  | pytest, Ruff, GitHub Actions, Docker Compose |

## Project structure

```
.
├── backend/
│   ├── orderfit/
│   │   ├── engine/      # Decision engine. Pure Python, no AI, no I/O.
│   │   ├── agent/       # LangGraph workflow, nodes, guards, prompts, single AI wrapper
│   │   ├── api/         # FastAPI routes (thin)
│   │   ├── store/       # Database, documents by hash, append-only audit
│   │   ├── domain.py    # Shared contracts for agent, API and store
│   │   └── config.py    # Settings from environment
│   └── tests/           # architecture, engine, agent, e2e
├── web/                 # Next.js screens (display only)
├── data/                # Demo business, financing catalogue, test cases
├── scripts/             # Demo seeding, PDF generation, baseline evaluation
├── docs/                # Design notes and ADRs
└── docker-compose.yml
```

## Getting started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2, **or**
- Python 3.12+ and Node.js 22+
- An API key for the AI provider (only needed once the agent makes AI calls)

### Run with Docker

```bash
git clone https://github.com/md-sazid9089/Order_Fit.git
cd Order_Fit
cp backend/.env.example backend/.env   # optional until the agent needs AI_API_KEY
docker compose up --build
```

| Service | URL |
|---------|-----|
| Web     | http://localhost:3000 |
| Postgres | localhost:5432 (bound to 127.0.0.1) |
| API     | http://localhost:8000 |
| API docs (OpenAPI) | http://localhost:8000/docs |
| Health check | http://localhost:8000/health |

Startup order: `db` becomes healthy → `migrate` runs `alembic upgrade head` and exits →
`api` → `web`.

To stop the services, run `docker compose down`. Data is kept; add `-v` to also delete the
`pg-data` and `documents` volumes.

If a port is already taken on your machine, copy `.env.example` to `.env` at the repo root and
change `WEB_PORT`, `API_PORT` or `DB_PORT`.

> [!TIP]
> Deals, workflow checkpoints and the audit log live in Postgres (`pg-data` volume). Uploaded
> documents live in the `documents` volume. `data/` is mounted read-only at `/app/data`.
> `NEXT_PUBLIC_API_URL` is baked into the web image at build time, so rebuild `web` after
> changing it.

### Run locally

**Backend**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env
docker compose up -d db          # Postgres only (run from the repo root)
alembic upgrade head
uvicorn orderfit.api.main:app --reload
```

**Frontend** (in a second terminal)

```bash
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Configuration

### Database (Neon)

The shared database is Postgres on [Neon](https://neon.tech). Local Docker Postgres remains
the offline default.

- `DATABASE_URL`: the **pooled** endpoint (host contains `-pooler`), with the scheme changed to
  `postgresql+psycopg://`. The app and the LangGraph checkpointer use it.
- `DATABASE_URL_DIRECT`: the same URL without `-pooler`. Alembic uses it, because schema
  changes should not go through the transaction-mode pooler.
- Keep `?sslmode=require&channel_binding=require`.

Put both in `backend/.env` for local runs. Put both in the repo-root `.env` to point
`docker compose` at Neon instead of the local `db` service. Both files are gitignored.


Backend settings are read from `backend/.env`. See [backend/.env.example](backend/.env.example).

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_API_KEY` | *(empty)* | API key for the AI provider |
| `AI_MODEL` | *(empty)* | Model identifier |
| `AI_TEMPERATURE` | `0` | Sampling temperature |
| `DATABASE_URL` | `postgresql+psycopg://orderfit:orderfit@localhost:5432/orderfit` | SQLAlchemy URL. Docker Compose points it at the `db` service |
| `DATABASE_URL_DIRECT` | *(empty)* | Non-pooled URL used by Alembic. Set it on Neon (same host without `-pooler`) |
| `DOCUMENT_DIR` | `./var/documents` | Where uploaded documents are stored |
| `CORS_ORIGINS` | `["http://localhost:3000"]` | Allowed browser origins (JSON list) |
| `TARGET_TOLERANCE_DAYS` | `15` | Late-payment days an option must survive to count as safe |

Frontend settings are read from `web/.env.local`:

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Browser-facing API URL |

> [!WARNING]
> Never commit `.env` files. They are listed in `.gitignore`.

## Testing

```bash
cd backend
pytest                    # architecture, engine and agent tests (AI is faked)
ruff check .              # lint
pytest -m e2e             # calls the real AI model; needs AI_API_KEY and costs money
```

```bash
cd web
npm run typecheck
npm run build
```

CI runs lint, the backend tests, the web type check and build, and a Docker build on every push
and pull request. See [.github/workflows/tests.yml](.github/workflows/tests.yml).

To add an engine test case, add an entry to [data/test_cases.json](data/test_cases.json).
[tests/engine/test_catalogue.py](backend/tests/engine/test_catalogue.py) picks it up
automatically.

## Scripts

| Script | Purpose |
|--------|---------|
| [scripts/seed_demo.py](scripts/seed_demo.py) | Load the demo business into the database as `demo-rina` |
| [scripts/make_demo_pdfs.py](scripts/make_demo_pdfs.py) | Generate demo order and quote PDFs, including adversarial variants |
| [scripts/run_baseline.py](scripts/run_baseline.py) | Run the core cases through a plain AI model for comparison |

To regenerate the frontend API types from a running backend, run `npm run gen:types` in `web/`.

## Documentation

| Document | Contents |
|----------|----------|
| [docs/engine.md](docs/engine.md) | Algorithms, money rules, ranking, adding test cases |
| [docs/agent.md](docs/agent.md) | Workflow, pause points, guards |
| [docs/adr/](docs/adr/) | Architecture decision records |
| [docs/technical.md](docs/technical.md) | Technical write-up |
| [docs/security-assessment.md](docs/security-assessment.md) | Threat model and mitigations |
| [docs/evaluation.md](docs/evaluation.md) | Evaluation against a plain-AI baseline |

## Contributing

1. Create a branch from `main`.
2. Keep the layer rules: no AI or I/O in `engine/`, AI calls only through `agent/llm.py`, and
   engine calls only through `agent/nodes/compute.py`.
3. Any change that can alter an engine result must bump `ENGINE_VERSION`.
4. Run `ruff check .` and `pytest` before opening a pull request.
5. Record significant design decisions as a new ADR in `docs/adr/`.
