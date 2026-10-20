"""Persisted extraction review and isolated what-if through the actual free adapter."""

import pytest

pytest.skip("FreeLLMPool is retired; this historical integration suite is not supported",
            allow_module_level=True)

# ruff: noqa: E402
import json
import os
import re
from datetime import date, timedelta
from pathlib import Path
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient
from freellmpool.client import HTTPResult

from orderfit.agent.llm import LLMSettings
from orderfit.api.main import create_app
from orderfit.workflow.extraction import Runtime
from orderfit.workflow.operations import Operations
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.test_p4_documents import PO_TEXT, Session, make_deal, operation, upload, versions

MODEL = "ovh/Mistral-Small-3.2-24B-Instruct-2506"


def exercise_workflow(postgres, accounts, config, *, live=False):
    """Shared assertions for fake upstream CI and an explicitly selected live run."""
    account = accounts[0]
    app = create_app(config, postgres["database"])
    ops = Operations(postgres["worker"])
    with TestClient(app) as client:
        # Startup creates the document adapter; the provider is only used by the worker.
        runtime = Runtime(llm=LLMSettings(mode="live", provider="freellmpool", model=MODEL,
                                         free_state_dir=Path(config.document_dir).parent / "free-quota",
                                         free_min_interval_seconds=35 if live else 0), documents=app.state.documents)
        client.cookies.set("orderfit_session", account.token)
        client.cookies.set("orderfit_csrf", account.csrf)
        session = Session(client, account, f"/api/v1/businesses/{account.business_id}")
        deal = make_deal(session)
        doc = upload(session, deal["id"], "synthetic-po.txt", PO_TEXT.encode(), "text/plain", "po", "customer_order").json()
        accepted = session.write("POST", f"/deals/{deal['id']}/documents/{doc['id']}/extract",
                                 versions(session, deal["id"])).json()
        assert run_once(ops, "free-workflow-extract", DEFAULT_HANDLERS, runtime)
        extracted = operation(session, accepted)
        assert extracted["status"] == "succeeded" and extracted["result"]["kind"] == "completed", extracted
        fields = {f["field"]: f for f in session.read(f"/deals/{deal['id']}/fields")["items"]}
        selected = fields["order_value_minor"]
        assert selected["status"] == "extracted" and selected["value"] == "35000000"
        assert fields["payment_days"]["value"] == "30"
        candidate = selected["candidates"][0]
        session.write("POST", f"/deals/{deal['id']}/fields/resolve", dict(
            **versions(session, deal["id"]), field_id=selected["field_id"],
            selected_candidate_id=selected["candidate_id"], resolution="confirmed",
            evidence=dict(document_id=doc["id"], content_hash=doc["content_hash"],
                          candidate_id=selected["candidate_id"], confirmed_field_id=None,
                          source_role="customer_order", page=1, quote=candidate["source_quote"],
                          manual_attestation=None, override_reason=None))).json()
        assert next(f for f in session.read(f"/deals/{deal['id']}/fields")["items"]
                    if f["field"] == "order_value_minor")["status"] == "confirmed"
        # Continue this same sourced order; the owner supplies the dates absent from the PO.
        day = date(2026, 10, 15)
        deal = session.write("PATCH", f"/deals/{deal['id']}", dict(
            **versions(session, deal["id"]), inputs=dict(
                opening_cash_minor="50000000", reserve_minor="10000000",
                order_value_minor=selected["value"], order_date=str(day),
                invoice_date=str(day + timedelta(days=45)), delivery_date=str(day + timedelta(days=45)),
                payment_basis="delivery", payment_days=int(fields["payment_days"]["value"]),
                customer_id=deal["inputs"]["customer_id"], constraints_id=deal["inputs"]["constraints_id"], costs=[]))).json()
        review = session.read(f"/deals/{deal['id']}/review")
        assert review["candidate_snapshot"] is not None, review["findings"]
        confirmation = session.write("POST", f"/deals/{deal['id']}/confirm", dict(
            **versions(session, deal["id"]), snapshot_hash=review["snapshot_hash"],
            confirmed_field_ids=review["required_field_ids"],
            acknowledged_warning_codes=[f["code"] for f in review["findings"] if not f["blocking"]])).json()
        job = session.write("POST", f"/deals/{deal['id']}/evaluations", dict(
            **versions(session, deal["id"]), snapshot_id=confirmation["snapshot_id"])).json()
        assert run_once(ops, "free-workflow-evaluate", DEFAULT_HANDLERS, runtime)
        assert operation(session, job)["result"]["kind"] == "completed"
        before = session.read(f"/deals/{deal['id']}")
        fork_job = session.write("POST", f"/deals/{deal['id']}/whatifs", dict(
            **versions(session, deal["id"]), source_snapshot_id=confirmation["snapshot_id"],
            instruction="Explore a case where the buyer pays twelve days late.")).json()
        assert run_once(ops, "free-workflow-whatif", DEFAULT_HANDLERS, runtime)
        finished = operation(session, fork_job)
        assert finished["status"] == "succeeded" and finished["result"]["kind"] == "completed", finished
        fork = client.get(finished["result_url"]).json()
        assert fork["provenance"] == "live" and fork["language_code"] is None, fork
        assert fork["language_model"].startswith("freellmpool:ovh/")
        assert fork["language_response_id"]
        assert fork["changes"] == [{"kind": "customer_delay_days", "value": 12}]
        assert not fork["canonical_changed"] and fork["series"]
        assert session.read(f"/deals/{deal['id']}") == before
        return {"extraction_operation_id": accepted["operation_id"], "whatif_operation_id": fork_job["operation_id"],
                "model": fork["language_model"], "response_id": fork["language_response_id"],
                "whatif_provenance": fork["provenance"], "series_count": len(fork["series"])}


def test_free_adapter_persists_reviewed_extraction_and_live_fork(postgres, accounts, config, monkeypatch):
    async def upstream(url, headers, body, timeout):
        content = body["messages"][-1]["content"]
        if "<document" in content:
            doc_id = re.search(r'<document id="([^"]+)"', content)[1]
            data = {"candidates": [dict(field=f, normalized_value=v, status="extracted", document_id=doc_id,
                                        page=1, exact_quote=q) for f, v, q in [
                ("order_value_minor", "35000000", "Total order value: BDT 350,000.00"),
                ("payment_days", "30", "Payment within 30 days of delivery.")]]}
        else:
            data = {"changes": [{"kind": "customer_delay_days", "value": 12}]}
        return HTTPResult(200, {"id": "synthetic-wire-id", "choices": [{"finish_reason": "stop",
                           "message": {"role": "assistant", "content": json.dumps(data)}}]}, "synthetic")
    monkeypatch.setattr("orderfit.agent.llm._free_post_once", AsyncMock(side_effect=upstream))
    exercise_workflow(postgres, accounts, config)


@pytest.mark.live
def test_live_free_adapter_persists_review_and_fork(postgres, accounts, config):
    if os.environ.get("ORDERFIT_LIVE_FREELLMPOOL") != "1":
        pytest.skip("Set ORDERFIT_LIVE_FREELLMPOOL=1 for synthetic external calls")
    print(json.dumps(exercise_workflow(postgres, accounts, config, live=True)))
