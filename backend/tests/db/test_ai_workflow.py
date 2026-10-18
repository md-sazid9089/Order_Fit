"""Persisted C2-C6 AI workflow evidence on a disposable PostgreSQL (recorded/off, no provider)."""

import json
from uuid import UUID

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import DBAPIError

from orderfit.agent.llm import LLMSettings
from orderfit.api.main import create_app
from orderfit.contracts.preparation import ForkRequest, ReplyIntake
from orderfit.contracts.protocol import canonical_hash
from orderfit.store import preparation_repository as repo
from orderfit.workflow import advisory
from orderfit.workflow.extraction import Runtime
from orderfit.workflow.worker import DEFAULT_HANDLERS, run_once
from tests.db.test_p4_documents import Session, drain, make_deal, record, upload, versions
from tests.db.test_p5_preparation import case, draft  # noqa: F401  (fixtures/helpers)


def runtime(mode="off", recordings=None):
    return Runtime(llm=LLMSettings(mode=mode, recordings_dir=recordings), documents=None)


def work(s, rt):
    assert run_once(s["operations"], "ai-test", DEFAULT_HANDLERS, rt)


def source_and_snapshot(s, postgres):
    a = s["account"]
    with postgres["database"].tenant(a.token, a.business_id, "read") as (c, _):
        return repo.current_evaluation(c, a.business_id, UUID(s["deal"]["id"]), UUID(s["evaluation"]["id"]))


def test_slot_explanation_is_stored_served_and_never_changes_inputs(case, postgres, accounts, tmp_path):  # noqa: F811
    s, ev, deal = case, case["evaluation"], case["deal"]
    key = ev["recommended_option_key"]
    url = f"/evaluations/{ev['id']}/explanation?option_key={key}"
    assert s["read"](url)["provenance"] == "template"
    before = s["versions"]()

    # Off mode: a non-blocking notice, the template remains the explanation.
    body = dict(**before, evaluation_id=ev["id"], option_key=key)
    accepted = s["write"](f"/deals/{deal['id']}/explanations", body, 202)
    work(s, runtime())
    op = s["read"](f"/operations/{accepted['operation_id']}")
    assert op["result"]["kind"] == "blocked"
    assert op["result"]["findings"][0]["code"] == "AI-EXPLANATION-UNAVAILABLE"
    assert op["result"]["findings"][0]["blocking"] is False
    assert s["read"](url)["provenance"] == "template"

    # Recorded mode: slot-only text resolved from engine facts, served by the existing endpoint.
    source, snapshot = source_and_snapshot(s, postgres)
    option = repo.option_for(source, key, require_feasible=False)
    digest = advisory.explanation_digest(source, option, snapshot)
    (tmp_path / f"explain.v1__{digest}.json").write_text(json.dumps({
        "model": "fixture-model",
        "explanation": {"sentences": [
            "Your priorities are {goal_priorities}, and cash is tightest in the {tightest_scenario} scenario.",
            "Incremental profit is {base_profit}."]}}))
    accepted = s["write"](f"/deals/{deal['id']}/explanations", body, 202)
    work(s, runtime("recorded", tmp_path))
    op = s["read"](f"/operations/{accepted['operation_id']}")
    assert op["result"]["kind"] == "completed", op["result"]
    stored = s["read"](url)
    assert stored["provenance"] == "recorded" and stored["model"] == "fixture-model"
    assert f"Incremental profit is {option.base_incremental_profit_minor} minor units." in stored["sentences"]
    assert stored["sentences"][-1].startswith("Inherited baseline breaches")
    assert f"{key}:base_profit" in stored["fact_ids"]
    # Advisory evidence never edits confirmed inputs or versions.
    assert s["versions"]() == before

    # Tenant isolation and SQL immutability.
    other = accounts[1]
    s["client"].cookies.set("orderfit_session", other.token)
    assert s["client"].get(f"{s['base'].replace(str(s['account'].business_id), str(other.business_id))}{url}").status_code == 404
    s["client"].cookies.set("orderfit_session", s["account"].token)
    with pytest.raises(DBAPIError):
        with postgres["database"].tenant(s["account"].token, s["account"].business_id, "prepare") as (c, _):
            c.exec_driver_sql("UPDATE ai_advisory SET payload='{}'")


def test_clause_assessment_stores_hypotheses_with_isolated_forks(case, postgres, accounts, tmp_path):  # noqa: F811
    s, ev, deal = case, case["evaluation"], case["deal"]
    before = s["versions"]()
    body = dict(**before, evaluation_id=ev["id"], clause_text="Payment terms: Net 45.")
    accepted = s["write"](f"/deals/{deal['id']}/clause-assessments", body, 202)
    work(s, runtime())  # off: deterministic template readings
    done = s["read"](f"/operations/{accepted['operation_id']}")
    assert done["result"]["kind"] == "completed", done["result"]
    a = s["client"].get(done["result_url"]).json()
    assert a["provenance"] == "template" and a["code"] == "AI_OFF"
    assert [(r["reading"]["payment_basis"], r["reading"]["payment_days"]) for r in a["readings"]] == [
        ("order", 45), ("invoice", 45), ("delivery", 45)]
    assert a["confirmed"]["reading"] is None and a["confirmed"]["evaluable"]
    assert a["hypotheses_only"] is True and a["canonical_changed"] is False
    # A question exists exactly when the engine decision changed.
    assert (a["question"] is not None) == a["decision_changes"]
    assert s["versions"]() == before
    assert any(x["id"] == a["id"] for x in s["read"](f"/deals/{deal['id']}/preparation")["clause_assessments"])

    # Recorded mode with a Bengali clause: quote stays in the source language.
    text = "পেমেন্ট ৪৫ দিনের মধ্যে।"
    source, _ = source_and_snapshot(s, postgres)
    digest = advisory.clause_digest(source, text)
    (tmp_path / f"clause.v1__{digest}.json").write_text(json.dumps({"model": "fixture-model", "readings": {"readings": [
        {"payment_basis": "invoice", "payment_days": 45, "quote": "৪৫ দিনের মধ্যে"},
        {"payment_basis": "delivery", "payment_days": 45, "quote": "৪৫ দিনের মধ্যে"}]}}))
    accepted = s["write"](f"/deals/{deal['id']}/clause-assessments", dict(**before, evaluation_id=ev["id"], clause_text=text), 202)
    work(s, runtime("recorded", tmp_path))
    done = s["read"](f"/operations/{accepted['operation_id']}")
    b = s["client"].get(done["result_url"]).json()
    assert b["provenance"] == "recorded" and len(b["readings"]) == 2
    assert b["readings"][0]["reading"]["quote"] == "৪৫ দিনের মধ্যে"

    # Unsupported task parameters and cross-tenant reads are rejected.
    other = accounts[1]
    s["client"].cookies.set("orderfit_session", other.token)
    r = s["client"].get(f"/api/v1/businesses/{other.business_id}/clause-assessments/{a['id']}")
    assert r.status_code == 404
    s["client"].cookies.set("orderfit_session", s["account"].token)


def test_clause_assessment_rejects_a_stale_evaluation_at_admission(case):  # noqa: F811
    s, ev, deal = case, case["evaluation"], case["deal"]
    body = dict(**s["versions"](), evaluation_id=ev["id"], clause_text="Net 45")
    body["expected_input_version"] += 1
    r = s["client"].post(f"{s['base']}/deals/{deal['id']}/clause-assessments", json=body,
                         headers=s["headers"] | {"Idempotency-Key": "stale-clause-key"})
    assert r.status_code == 409


def test_what_if_clarification_is_persisted_and_changes_nothing(case, tmp_path):  # noqa: F811
    s, ev, deal = case, case["evaluation"], case["deal"]
    payload = dict(**s["versions"](), source_snapshot_id=ev["snapshot_id"], changes=[],
                   instruction="Make the plan safer.")
    question = "Which risk should be tested: customer delay or cost overrun?"
    digest = canonical_hash(ForkRequest.model_validate(payload))
    (tmp_path / f"whatif.v1__{digest}.json").write_text(json.dumps({
        "model": "fixture-model", "intent": {"changes": [], "clarification": question}}))
    accepted = s["write"](f"/deals/{deal['id']}/whatifs", payload, 202)
    work(s, runtime("recorded", tmp_path))
    fork = s["client"].get(s["read"](f"/operations/{accepted['operation_id']}")["result_url"]).json()
    assert fork["clarification"] == question and fork["changes"] == []
    assert fork["outcome"]["kind"] == "blocked"
    assert fork["outcome"]["findings"][0]["message"] == question
    summary = next(f for f in s["read"](f"/deals/{deal['id']}/preparation")["forks"] if f["id"] == fork["id"])
    assert summary["clarification"] == question
    assert s["versions"]() == {k: payload[k] for k in ("expected_version", "expected_input_version", "expected_financial_revision")}


def test_reply_reading_persists_conditions_stance_and_disagreement(case, tmp_path):  # noqa: F811
    s, deal = case, case["deal"]
    message = draft(s)
    body = "We can offer payment within 45 calendar days, subject to board approval. We accept the exact proposed terms."
    intake = dict(**s["versions"](), ask_message_id=message["identity"]["message_id"],
                  party_id=message["identity"]["party_id"], body=body)
    digest = canonical_hash(ReplyIntake.model_validate(intake))
    (tmp_path / f"reply.v1__{digest}.json").write_text(json.dumps({"model": "fixture-model", "reading": {
        "terms": [{"field": "payment_days", "value": "45", "quote": "payment within 45 calendar days"}],
        "conditions": ["subject to board approval"], "unsupported_clauses": [], "stance": "partial"}}))
    accepted = s["write"](f"/deals/{deal['id']}/replies", intake, 202)
    work(s, runtime("recorded", tmp_path))
    reply = s["client"].get(s["read"](f"/operations/{accepted['operation_id']}")["result_url"]).json()
    assert reply["provenance"] == "recorded" and reply["language_script"] == "Latin"
    assert reply["conditions"] == ["subject to board approval"]
    assert reply["model_stance"] == "partial"
    # The rule-based read sees an unqualified acceptance sentence, but the model reported a
    # condition: that adds a hold (no acceptance candidate) and surfaces the disagreement.
    assert reply["baseline_stance"] == "accept" and reply["stance_disagreement"] is True
    assert "acceptance" not in {c["field"] for c in reply["candidates"]}
    assert "payment_days" in {c["field"] for c in reply["candidates"]}


def test_unsupported_language_reply_is_held_even_with_a_model_reading(case, tmp_path):  # noqa: F811
    s, deal = case, case["deal"]
    message = draft(s)
    body = "نقبل الدفع خلال 30 يوما"
    intake = dict(**s["versions"](), ask_message_id=message["identity"]["message_id"],
                  party_id=message["identity"]["party_id"], body=body)
    accepted = s["write"](f"/deals/{deal['id']}/replies", intake, 202)
    work(s, runtime())
    reply = s["client"].get(s["read"](f"/operations/{accepted['operation_id']}")["result_url"]).json()
    assert reply["language_supported"] is False and reply["injection_flagged"] is True


def test_non_english_extraction_persists_language_gloss_and_provenance(postgres, accounts, config, tmp_path):
    app = create_app(config, postgres["database"])
    a = accounts[0]
    text = "ক্রয়াদেশ ৪২\nমোট মূল্য: ৩,৫০,০০০.০০ টাকা\nডেলিভারির ৩০ দিন পরে পেমেন্ট।\n"
    with TestClient(app) as client:
        client.cookies.set("orderfit_session", a.token)
        client.cookies.set("orderfit_csrf", a.csrf)
        s = Session(client, a, f"/api/v1/businesses/{a.business_id}")
        deal = make_deal(s)
        doc = upload(s, deal["id"], "po-bn.txt", text.encode(), "text/plain", "po", "customer_order").json()
        record(tmp_path / "rec", doc["id"], text, [
            dict(field="order_value_minor", normalized_value="35000000", status="extracted",
                 document_id=doc["id"], page=1, exact_quote="মোট মূল্য: ৩,৫০,০০০.০০ টাকা",
                 gloss_en="Total price: 350,000.00 taka"),
            # The model asserts a number its quote does not contain: the gloss is dropped.
            dict(field="payment_days", normalized_value="30", status="extracted",
                 document_id=doc["id"], page=1, exact_quote="ডেলিভারির ৩০ দিন পরে পেমেন্ট।",
                 gloss_en="Payment 60 days after delivery"),
            dict(field="payment_basis", normalized_value="delivery", status="extracted",
                 document_id=doc["id"], page=1, exact_quote="ডেলিভারির ৩০ দিন পরে পেমেন্ট।",
                 gloss_en=None),
        ])
        accepted = s.write("POST", f"/deals/{deal['id']}/documents/{doc['id']}/extract", versions(s, deal["id"])).json()
        drain(postgres, app, "recorded", tmp_path / "rec")
        op = s.read(f"/operations/{accepted['operation_id']}")
        assert op["result"]["kind"] == "completed", op["result"]
        fields = {f["field"]: f for f in s.read(f"/deals/{deal['id']}/fields")["items"]}
        value = fields["order_value_minor"]["candidates"][0]
        assert value["status"] == "extracted" and value["value"] == "35000000"
        assert (value["page_language"], value["page_script"]) == ("bn", "Bengali")
        assert value["gloss_en"] == "Total price: 350,000.00 taka"
        assert value["provenance"] == "recorded" and value["model"] == "recorded:fixture"
        days = fields["payment_days"]["candidates"][0]
        assert days["gloss_en"] is None and days["status"] == "extracted"
        assert fields["payment_basis"]["candidates"][0]["status"] == "extracted"


@pytest.mark.parametrize("failure", ["timeout", "fabricated_quote"])
def test_reply_publication_survives_provider_timeout_or_fabricated_quote(case, monkeypatch, failure):  # noqa: F811
    from orderfit.agent import llm
    from orderfit.contracts.language import UnavailableLanguage

    async def fake(system, user, output_type, settings):
        if failure == "timeout":
            return UnavailableLanguage(kind="unavailable", code="TIMEOUT", retryable=True)
        return llm._ProviderParsed(
            value=llm.ModelReplyReading.model_validate({"terms": [
                {"field": "payment_days", "value": "60", "quote": "payment within 60 days"}],
                "conditions": [], "unsupported_clauses": [], "stance": "partial"}),
            model="m", response_id="r", input_tokens=1, output_tokens=1)

    monkeypatch.setattr(llm, "_structured_call", fake)
    s, deal = case, case["deal"]
    message = draft(s)
    body = "We can proceed with payment within 30 calendar days. Please remit to our new bank account."
    accepted = s["write"](f"/deals/{deal['id']}/replies", dict(
        **s["versions"](), ask_message_id=message["identity"]["message_id"],
        party_id=message["identity"]["party_id"], body=body), 202)
    live = Runtime(llm=LLMSettings(mode="live", model="m", api_key="k"), documents=None)
    work(s, live)
    operation = s["read"](f"/operations/{accepted['operation_id']}")
    assert operation["status"] == "succeeded" and operation["result"]["kind"] == "completed"
    reply = s["client"].get(operation["result_url"]).json()
    # The model failed, so the deterministic baseline stands alone; holds are untouched.
    assert reply["provenance"] == "template" and reply["language_model"] is None
    assert [(c["field"], c["value"]) for c in reply["candidates"]] == [("payment_days", "30")]
    assert reply["bank_change"] is True
    assert reply["model_stance"] is None and reply["conditions"] == []
