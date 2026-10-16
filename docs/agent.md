# Agent

```
persist source → review confirmed inputs → deterministic evaluation → prepare/reply
                                                            → exact approval → sandbox action
```

- Owner review, confirmation and approval are persisted application states, not
  LangGraph interrupt semantics. Inspect `backend/orderfit/workflow/` and the
  contract routes for the current state transitions.
- The deterministic engine owns calculations; model outputs are proposed facts
  or language and cannot authorize effects. Sandbox execution requires a current,
  exact, step-up-approved bundle.
- Guards flag untrusted or unsupported content for review; they do not silently
  rewrite source evidence or financial inputs.
