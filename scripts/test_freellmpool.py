"""Retired FreeLLMPool smoke-test entry point; use the OpenAI AI evaluator instead."""

if __name__ == "__main__":
    raise SystemExit("FreeLLMPool was removed. Use scripts/ai_eval.py --mode live with OpenAI settings.")

import argparse
import asyncio
import hashlib
import json
import tempfile
import time
from pathlib import Path
from uuid import uuid4

from orderfit.agent.llm import LLMSettings, extract, propose_intent
from orderfit.contracts.language import LanguageRequest, SourceExcerpt
from orderfit.services.documents import quote_supports

SOURCE = """Synthetic purchase order PO-AI-TEST.
Order value: BDT 1,000.00.
Order date: 2026-11-02.
Invoice date: 2026-12-14.
Delivery date: 2026-12-14.
Payment is due 30 calendar days after invoice.
"""


async def check(model, repeat, timeout):
    success = True
    with tempfile.TemporaryDirectory(prefix="orderfit-free-smoke-") as directory:
        settings = LLMSettings(mode="live", provider="freellmpool", model=model,
                               timeout_seconds=timeout, free_state_dir=Path(directory))
        digest = hashlib.sha256(SOURCE.encode()).hexdigest()
        request = LanguageRequest(task="extract", input_schema_version="extract-input.v1",
                                  input_hash=digest, prompt_version="extract_order.v1",
                                  sources=[SourceExcerpt(document_id=uuid4(), content_hash=digest,
                                                         source_role="customer_order", page=1, text=SOURCE)],
                                  allowed_fact_ids=[], user_instruction=None)
        for run in range(1, repeat + 1):
            start = time.monotonic()
            result = (await extract(request, settings)).result
            grounded = {}
            if result.kind == "parsed":
                for candidate in result.proposal.candidates:
                    if candidate.status == "extracted" and quote_supports(
                        candidate.field, candidate.normalized_value, candidate.exact_quote, SOURCE
                    ) == "ok":
                        grounded[candidate.field] = candidate.normalized_value
            expected = {"order_value_minor": "100000", "payment_days": "30", "payment_basis": "invoice",
                        "order_date": "2026-11-02", "invoice_date": "2026-12-14", "delivery_date": "2026-12-14"}
            passed = result.kind == "parsed" and all(grounded.get(k) == v for k, v in expected.items())
            success &= passed
            print(json.dumps({"run": run, "task": "extraction", "passed": passed, "kind": result.kind,
                              "code": getattr(result, "code", None), "model": getattr(result, "model", None),
                              "response_id": getattr(result, "response_id", None), "grounded_fields": grounded,
                              "seconds": round(time.monotonic() - start, 2)}), flush=True)
            start = time.monotonic()
            # This sentence is deliberately outside the deterministic fallback grammar.
            instruction = "Explore a case where the buyer pays twelve days late."
            intent = await propose_intent(instruction, hashlib.sha256(instruction.encode()).hexdigest(), settings)
            changes = [c.model_dump(mode="json") for c in intent.changes]
            passed = intent.provenance == "live" and intent.code is None and changes == [
                {"kind": "customer_delay_days", "value": 12}]
            success &= passed
            print(json.dumps({"run": run, "task": "whatif", "passed": passed, "provenance": intent.provenance,
                              "code": intent.code, "changes": changes, "model": intent.model,
                              "response_id": intent.response_id,
                              "seconds": round(time.monotonic() - start, 2)}), flush=True)
    return success


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", required=True, help="Explicit keyless provider/model")
    parser.add_argument("--repeat", type=int, choices=range(1, 6), default=1)
    parser.add_argument("--timeout", type=int, choices=range(1, 31), default=30)
    args = parser.parse_args()
    raise SystemExit(0 if asyncio.run(check(args.model, args.repeat, args.timeout)) else 1)


if __name__ == "__main__":
    main()
