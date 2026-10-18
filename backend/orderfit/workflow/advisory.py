"""Durable C3/C5 jobs (operation kind ``explain``): provider work outside short transactions.

Both tasks only produce advisory evidence tied to a stored evaluation: slot-resolved
explanation text, or clause hypotheses evaluated on isolated forks. Neither changes a
confirmed input, an engine figure or an approval. An unavailable or invalid model result is
reported as a non-blocking finding and the deterministic template stays authoritative.
"""

import asyncio
import hashlib
import json

from pydantic import TypeAdapter
from sqlalchemy import text

from orderfit.agent import llm
from orderfit.agent.llm import LLMSettings
from orderfit.agent.nodes.compute import evaluate_forks
from orderfit.api.errors import ApplicationError
from orderfit.contracts.advisory import AdvisoryExplainRequest, ClauseRequest
from orderfit.contracts.preparation import Explanation
from orderfit.contracts.workflow import BlockedResult, CompletedResult, Finding, OperationResult
from orderfit.services import clauses, explanations
from orderfit.store.preparation_repository import (
    current_evaluation,
    locked,
    one,
    option_for,
    save_advisory,
)
from orderfit.store.repositories import append_audit

PROMPT_VERSION = "advisory.v1"


def _prompt_hash(*names) -> str:
    digest = hashlib.sha256()
    for name in names:
        digest.update((llm.PROMPTS / name).read_bytes())
    return digest.hexdigest()


def input_hash(**parts) -> str:
    return hashlib.sha256(json.dumps(parts, sort_keys=True, default=str).encode()).hexdigest()


def _notice(code, message, outcome="needs_input"):
    # Non-blocking: an unavailable model is not a financial or workflow failure.
    return BlockedResult(kind="blocked", outcome=outcome, findings=[
        Finding(code=code, field=None, message=message, blocking=False, resolution="provide_evidence")])


def explanation_digest(source, option, snapshot) -> str:
    """Identity of one explanation request; also the recording key in recorded mode."""
    return input_hash(task="explanation", evaluation=source.id, option=option.option_key,
                      signals=explanations.signals(source, option, snapshot.owner),
                      prompt=_prompt_hash("explain.md", "explain.system.md"))


def clause_digest(source, clause_text) -> str:
    return input_hash(task="clause", evaluation=source.id, clause=clause_text,
                      prompt=_prompt_hash("clause.md", "clause.system.md"))


def validate_admission(c, scope, command):
    """Runs atomically with operation admission; never runs a provider."""
    params = command.parameters or {}
    if params.get("task") == "explanation":
        data = AdvisoryExplainRequest.model_validate(params)
        result, _ = current_evaluation(c, scope.business_id, command.deal_id, data.evaluation_id)
        option_for(result, data.option_key, require_feasible=False)
    elif params.get("task") == "clause":
        data = ClauseRequest.model_validate(params)
        current_evaluation(c, scope.business_id, command.deal_id, data.evaluation_id)
    else:
        raise ApplicationError(422, "UNSUPPORTED_ADVISORY_TASK")


def run_advisory(operations, claim, job, runtime=None):
    from orderfit.workflow.worker import bounded_compute

    settings = runtime.llm if runtime else LLMSettings()
    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        params = one(c, "SELECT parameters FROM operation WHERE id=:id", id=claim["id"])["parameters"]
        task = params.get("task")
        if task == "explanation":
            data = AdvisoryExplainRequest.model_validate(params)
        elif task == "clause":
            data = ClauseRequest.model_validate(params)
        else:
            raise ApplicationError(422, "UNSUPPORTED_ADVISORY_TASK")
        source, snapshot = current_evaluation(c, scope.business_id, job.deal_id, data.evaluation_id)
        option = option_for(source, data.option_key, require_feasible=False) if task == "explanation" else None

    payload, kind, option_key, outcome = None, None, None, None
    if task == "explanation":
        kind, option_key = "explanation", data.option_key
        context = explanations.signals(source, option, snapshot.owner)
        digest = explanation_digest(source, option, snapshot)
        proposal = asyncio.run(llm.explain_slots(context, explanations.SLOT_MEANING, digest, settings))
        if proposal.provenance == "template":
            outcome = _notice("AI-EXPLANATION-UNAVAILABLE",
                              f"AI explanation unavailable ({proposal.code}); the template explanation stays in use.")
        else:
            resolved = explanations.resolve(proposal.sentences,
                                            explanations.facts(source, option, snapshot.owner))
            payload = Explanation(
                evaluation_id=source.id, option_key=data.option_key,
                sentences=[*resolved, *explanations.CAVEATS],
                fact_ids=explanations.fact_ids(data.option_key, proposal.sentences),
                provenance=proposal.provenance, model=proposal.model, response_id=proposal.response_id,
                is_stale=False,
            )
    else:
        kind = "clause_assessment"
        digest = clause_digest(source, data.clause_text)
        proposal = asyncio.run(llm.read_clause(data.clause_text, digest, settings))
        pairs = clauses.forks_for(snapshot, proposal.readings)
        outcomes = iter(evaluate_forks([snapshot, *[fork for _, fork in pairs if fork is not None]],
                                       run=bounded_compute))
        baseline = next(outcomes)
        aligned = [next(outcomes) if fork is not None else None for _, fork in pairs]
        payload = clauses.assemble(
            id=claim["id"], deal_id=job.deal_id, evaluation_id=source.id, clause_text=data.clause_text,
            baseline=baseline, pairs=pairs, outcomes=aligned, provenance=proposal.provenance,
            code=proposal.code, model=proposal.model, response_id=proposal.response_id, input_hash=digest,
        )

    with operations.database.job(claim["id"], claim["lease_token"]) as (c, scope):
        d, revision = locked(c, scope, job.deal_id)
        if (d["input_version"], revision) != (job.input_version, job.financial_revision):
            result = _notice("STALE-INPUT-VERSION", "Inputs changed. Refresh before continuing.", "stale")
        elif payload is None:
            result = outcome
        else:
            save_advisory(c, scope, kind=kind, deal_id=job.deal_id, evaluation_id=source.id,
                          option_key=option_key, operation_id=claim["id"],
                          payload=payload.model_dump_json())
            result = CompletedResult(
                kind="completed", resource_id=claim["id"],
                resource_url=(f"/api/v1/businesses/{scope.business_id}/evaluations/{source.id}/explanation"
                              f"?option_key={option_key}" if kind == "explanation" else
                              f"/api/v1/businesses/{scope.business_id}/clause-assessments/{claim['id']}"),
            )
        op = one(c, "SELECT cancellation_requested FROM operation WHERE id=:id", id=claim["id"])
        if op["cancellation_requested"]:
            raise ApplicationError(409, "OPERATION_CANCELLED")
        append_audit(c, scope, "publish_advisory", deal_id=job.deal_id,
                     payload={"operation_id": str(claim["id"]), "task": task})
        finished = c.execute(
            text("SELECT operation_finish(:id,:t,CAST(:r AS jsonb),false)"),
            dict(id=claim["id"], t=claim["lease_token"],
                 r=TypeAdapter(OperationResult).dump_json(result).decode()),
        ).scalar_one()
        if not finished:
            raise ApplicationError(409, "LEASE_LOST")
    return result
