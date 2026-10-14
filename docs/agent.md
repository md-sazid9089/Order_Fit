# Agent

```
ingest → extract → validate → [confirm] → compute → explain → draft → [approve] → send
                                  ↑                                                  │
                                  └──────── validate ← read_reply ← (reply) ─────────┘   max 3 rounds
```

- Pause points: `[confirm]`, `[approve]` (LangGraph interrupts).
- AI calls go through `agent/llm.py` only. Engine calls go through `nodes/compute.py` only.
- Guards: numbers, terms, injection, fraud. Guards report; they never rewrite text.
