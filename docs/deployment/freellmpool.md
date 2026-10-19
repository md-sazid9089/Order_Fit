# Test OrderFit's AI workflow with FreeLLMPool

This is a synthetic-data testing integration. The default OpenAI Responses provider
remains available separately. FreeLLMPool uses its pinned native library through
`agent/llm.py`; no local proxy, provider signup or OpenAI key is needed for the
explicit keyless route below. Prompts go to that route's upstream service.
Runtime validation rejects live FreeLLMPool with non-loopback origins or S3
storage; hosted use remains on the OpenAI provider.

From `backend/`, install the locked environment:

```powershell
uv sync --frozen --extra dev
```

Run a live smoke check, which does not load `.env`, access a database or change app settings:

```powershell
uv run --frozen python ../scripts/test_freellmpool.py --model ovh/Mistral-Small-3.2-24B-Instruct-2506
```

The smoke check verifies all six expected extracted values against their source
quotes. It also parses a paraphrased buyer-delay request outside the deterministic
fallback grammar. Both must pass with actual response IDs and live provenance.
`--repeat 2` repeats both tasks. Free requests are paced conservatively, so a check
can take more than a minute even though each network call is limited to 30 seconds.

In an explicit local testing environment file, set:

```dotenv
LLM_MODE=live
LLM_PROVIDER=freellmpool
FREELLMPOOL_MODEL=ovh/Mistral-Small-3.2-24B-Instruct-2506
FREELLMPOOL_STATE_DIR=./var/freellmpool
FREELLMPOOL_MIN_INTERVAL_SECONDS=35
```

Keep that file's existing restricted API/worker database URLs, document storage,
session and fingerprint settings. Do not put a migration-owner URL in runtime
configuration. The launcher removes any OpenAI key from free-provider child
environments. No user provider catalog or inherited provider keys are consulted.
For an isolated synthetic test environment, use its distinct database URLs and
storage rather than the main application's data.

Start both processes with that same file, for example:

```powershell
uv run --frozen python -m orderfit.runtime api --env-file .env.freellmpool
uv run --frozen python -m orderfit.runtime worker --env-file .env.freellmpool
```

These are separate long-running processes. Restart both after changing their
settings. In Compose, API and worker now both honor `LLM_MODE`, `LLM_PROVIDER` and
`FREELLMPOOL_MODEL`; the worker is no longer forced off.

In the browser, create a synthetic business/order, upload
[`synthetic_order.txt`](../../data/ai_workflow/synthetic_order.txt), request
extraction and review its quoted candidates. Supply and confirm the remaining
business inputs before evaluation. In the evaluated order's what-if workspace,
try “Explore a case where the buyer pays twelve days late.” The resulting fork
must show live provenance; applying its assumptions still requires explicit
review. Explanations, negotiation drafts and reply parsing retain their existing
template/parser behavior; this integration does not expand their AI roles.

`RATE_LIMIT`, timeout and unavailable-provider outcomes remain possible. They are
visible failures, not successful live-model responses. The 35-second spacing is
advisory per process, not a distributed guarantee; multiple machines/workers can
still share an upstream IP limit. Wait and retry an unsuccessful operation using
the application's existing recovery controls. Never change providers to a paid
route implicitly.

The selected route was measured during integration; its ongoing availability and
general document accuracy are not guaranteed by a synthetic smoke pass. See the
[contract](../contracts/freellmpool-testing.md) for output validation and limits.
