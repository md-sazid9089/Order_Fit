# OrderFit

Helps a small business decide whether it can afford to accept an order, and how
to make it safe. The AI reads documents and writes messages; a deterministic
engine does every calculation; the owner approves every outgoing action.

## Layout

| Path | What |
|---|---|
| `backend/orderfit/engine/` | Pure-Python decision engine. No AI, no I/O. |
| `backend/orderfit/domain.py` | Shared contracts for agent, API and store. |
| `backend/orderfit/agent/` | LangGraph workflow, the single AI wrapper, guards, prompts. |
| `backend/orderfit/api/` | FastAPI routes. Thin. |
| `backend/orderfit/store/` | SQLite (MVP), documents by hash, append-only audit. |
| `web/` | Next.js screens. Display only. |
| `data/` | Demo business, financing catalogue, test cases. |

## Quick start

```bash
# backend
cd backend
python -m venv .venv && . .venv/Scripts/activate   # Windows; use bin/activate elsewhere
pip install -e ".[dev]"
cp .env.example .env
pytest                                             # engine + agent + architecture
uvicorn orderfit.api.main:app --reload

# web
cd web
npm install
cp .env.example .env.local
npm run dev
```

## Docs

- [engine.md](engine.md): algorithms, money rules, adding test cases
- [agent.md](agent.md): workflow, pause points, guards
- [adr/](adr/): decisions and why
- Competition: [technical.md](technical.md), [security-assessment.md](security-assessment.md), [evaluation.md](evaluation.md)
