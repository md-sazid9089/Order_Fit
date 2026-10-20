# AI test recordings

The maintained synthetic corpus is `data/ai_workflow/cases/cases.json`, with hashed
task recordings under `data/ai_workflow/recordings/`. Unit tests also construct
temporary refusal, invalid-output, and missing-record cases. An unknown recording
never falls through to a live provider.

See [AI evaluation](../../../../docs/evaluation.md). Authored replay results establish
pipeline/guard behavior, not live model quality. Financial oracle fixtures remain
separate under `docs/architecture/orderfit/fixtures/`.
