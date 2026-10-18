"""Offline-first quality evaluation for OrderFit's proposal-only AI boundaries.

The harness never loads .env.  Recorded mode therefore exercises the same public
functions as production without a network call; fallback output is useful telemetry,
but is deliberately never counted as a model pass.  Recordings prove the replay path,
not live-model quality.
"""
import argparse
import asyncio
import hashlib
import json
import statistics
import sys
import time
from pathlib import Path
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from orderfit.agent import llm  # noqa: E402
from orderfit.agent.llm import LLMSettings, extract, propose_intent, read_reply  # noqa: E402
from orderfit.agent.nodes.compute import compute, evaluate_forks, outcome_of  # noqa: E402
from orderfit.contracts.financial import ConfirmedInputV1  # noqa: E402
from orderfit.contracts.language import LanguageRequest, SourceExcerpt  # noqa: E402
from orderfit.services import clauses, explanations  # noqa: E402
from orderfit.services.documents import quote_supports  # noqa: E402
from orderfit.services.evaluations import build_evaluation_dto  # noqa: E402
from orderfit.services.language import detect  # noqa: E402
from orderfit.services.preparation import (  # noqa: E402
    bank_change,
    deterministic_intent,
    merge_reply,
    reply_candidates,
)

CASES = ROOT / "data" / "ai_workflow" / "cases" / "cases.json"
RECORDINGS = ROOT / "data" / "ai_workflow" / "recordings"
SUPPORTED_LANGUAGES = ("en", "bn", "hi", "zh-Hans")


def _digest(case_id):
    return hashlib.sha256(f"ai-eval:{case_id}".encode()).hexdigest()


def _changes(changes):
    return [change.model_dump(mode="json") for change in changes]


def _doc_id(case):
    return uuid5(NAMESPACE_URL, case["id"])


def _recording_name(case):
    prefix = {"extract": "extract_order.v1", "whatif": "whatif.v1", "reply": "reply.v1",
              "clause": "clause.v1", "explain": "explain.v1"}[case["task"]]
    return f"{prefix}__{_digest(case['id'])}.json"


def write_recordings(cases, directory=RECORDINGS):
    """Regenerate recordings for cases that carry a synthetic ``recorded`` model output."""
    written = 0
    for case in cases:
        spec = case.get("recorded")
        if not spec:
            continue
        model = spec.get("model", "synthetic-recording")
        if case["task"] == "extract":
            body = {"model": model, "candidates": [
                {"document_id": str(_doc_id(case)), "page": 1, "gloss_en": None, **c} for c in spec["candidates"]]}
        elif case["task"] == "whatif":
            body = {"model": model, "intent": spec["intent"]}
        elif case["task"] == "clause":
            body = {"model": model, "readings": {"readings": spec["readings"]}}
        elif case["task"] == "explain":
            body = {"model": model, "explanation": {"sentences": spec["sentences"]}}
        else:
            body = {"model": model, "reading": spec["reading"]}
        (directory / _recording_name(case)).write_text(
            json.dumps(body, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        written += 1
    return written


def _effective_status(candidate, page_text):
    """Mirror workflow/extraction.py: grounding can only downgrade a status."""
    support = quote_supports(candidate.field, candidate.normalized_value, candidate.exact_quote, page_text)
    if support == "quote_mismatch" and candidate.status != "missing":
        return None, support  # dropped, never stored as evidence
    return ("ambiguous" if support == "ambiguous" else candidate.status), support


def _grade_extract(case, result):
    if result.kind != "parsed":
        return False, {"reason": getattr(result, "code", "unavailable")}
    values, statuses, dropped = {}, {}, []
    for candidate in result.proposal.candidates:
        status, support = _effective_status(candidate, case["text"])
        if status is None:
            dropped.append(candidate.field)
            continue
        statuses.setdefault(candidate.field, []).append(status)
        if status == "extracted" and support == "ok":
            values[candidate.field] = candidate.normalized_value
    expected = case.get("expected", {})
    passed = all(values.get(field) == value for field, value in expected.items())
    passed &= all(set(statuses.get(field, ["missing"])) <= {"ambiguous", "missing"} for field in case.get("ambiguous_fields", []))
    passed &= all(statuses.get(field) and set(statuses[field]) == {"conflicting"} for field in case.get("conflicting_fields", []))
    passed &= all(field not in values for field in case.get("absent_fields", []))
    gloss_ok = all(c.gloss_en is None or c.gloss_en for c in result.proposal.candidates)
    return passed and gloss_ok, {"values": values, "statuses": statuses, "dropped": dropped,
                                 "guard_findings": [f.code for f in result.guard_findings]}


async def _extract_case(case, settings):
    digest = _digest(case["id"])
    source = SourceExcerpt(document_id=_doc_id(case), content_hash=digest,
                           source_role=case.get("source_role", "customer_order"), page=1, text=case["text"])
    request = LanguageRequest(task="extract", input_schema_version="extract-input.v1", input_hash=digest,
                              prompt_version="extract_order.v1", sources=[source], allowed_fact_ids=[], user_instruction=None)
    output = (await extract(request, settings)).result
    passed, detail = _grade_extract(case, output)
    detail["language"] = detect(case["text"])[0]
    model = output.kind == "parsed" and output.model.startswith(("recorded:", "freellmpool:", "gpt-"))
    return dict(passed=passed, model_pass=bool(model and passed), kind=output.kind,
                code=getattr(output, "code", None), detail=detail, unsafe=False,
                tokens=(getattr(output, "input_tokens", None), getattr(output, "output_tokens", None)))


async def _whatif_case(case, settings):
    output = await propose_intent(case["instruction"], _digest(case["id"]), settings)
    expected = case["expected_changes"]
    got = _changes(output.changes)
    baseline = _changes(deterministic_intent(case["instruction"]))
    safe = got == expected and (output.clarification is not None) == case.get("expected_clarification", False)
    modelled = output.provenance in {"recorded", "live"} and output.code is None
    # A non-empty change set that differs from the label is an unsafe proposal.
    return dict(passed=safe, model_pass=modelled and safe, kind=output.provenance, code=output.code,
                detail={"changes": got, "baseline_changes": baseline, "baseline_pass": baseline == expected,
                        "clarification": output.clarification},
                unsafe=bool(got) and got != expected, tokens=(None, None))


async def _reply_case(case, settings):
    body = case["body"]
    baseline, injection = reply_candidates(body)
    reading = await read_reply(body, _digest(case["id"]), settings)
    merged, stance, disagreement = merge_reply(body, baseline, reading)
    values = {c.field: c.value for c in merged}
    expected_fields = case.get("expected_fields", {})
    passed = values == expected_fields
    passed &= bank_change(body) == case.get("bank_change", False) and injection == case.get("injection", False)
    if "expected_conditions" in case:
        passed &= reading.conditions == case["expected_conditions"]
    if "expected_unsupported" in case:
        passed &= reading.unsupported_clauses == case["expected_unsupported"]
    if "expected_stance" in case:
        passed &= reading.stance == case["expected_stance"]
    if "expected_language" in case:
        passed &= detect(body)[0] == case["expected_language"]
    # An unsupported or mixed language raises a review hold that model output cannot clear.
    passed &= (not detect(body)[2]) == case.get("language_hold", False)
    # Acceptance the label does not expect, or a hold the baseline raised that vanished.
    unsafe = ("acceptance" in values and "acceptance" not in expected_fields) or (
        bank_change(body) and not case.get("bank_change", False))
    modelled = reading.provenance in {"recorded", "live"} and reading.code is None
    return dict(passed=passed, model_pass=modelled and passed, kind=reading.provenance, code=reading.code,
                detail={"values": values, "conditions": reading.conditions,
                        "unsupported": reading.unsupported_clauses, "stance": reading.stance,
                        "baseline_stance": stance, "disagreement": disagreement, "injection": injection,
                        "language": detect(body)[0], "language_hold": not detect(body)[2]},
                unsafe=unsafe, tokens=(None, None))


def _example_snapshot():
    from tests.contracts.examples import snapshot
    return ConfirmedInputV1.model_validate(snapshot())


async def _clause_case(case, settings):
    proposal = await llm.read_clause(case["clause_text"], _digest(case["id"]), settings)
    got = [[r.payment_basis, r.payment_days] for r in proposal.readings]
    passed = got == case["expected_readings"]
    detail = {"readings": got}
    unsafe = False
    if "expected_decision_changes" in case:
        snapshot = _example_snapshot()
        pairs = clauses.forks_for(snapshot, proposal.readings)
        outcomes = iter(evaluate_forks([fork for _, fork in pairs if fork is not None]))
        aligned = [next(outcomes) if fork is not None else None for _, fork in pairs]
        assessment = clauses.assemble(
            id=_doc_id(case), deal_id=_doc_id(case), evaluation_id=_doc_id(case), clause_text=case["clause_text"],
            baseline=outcome_of(compute(snapshot).result), pairs=pairs, outcomes=aligned, provenance=proposal.provenance)
        passed &= assessment.decision_changes == case["expected_decision_changes"]
        # A question may exist only when the engine decision changed.
        unsafe = (assessment.question is not None) != assessment.decision_changes
        detail["decision_changes"] = assessment.decision_changes
    modelled = proposal.provenance in {"recorded", "live"} and proposal.code is None
    return dict(passed=passed, model_pass=modelled and passed, kind=proposal.provenance, code=proposal.code,
                detail=detail, unsafe=unsafe, tokens=(None, None))


async def _explain_case(case, settings):
    snapshot = _example_snapshot()
    evaluation = build_evaluation_dto(snapshot, compute(snapshot), _doc_id(case))
    option = next(o for o in evaluation.ranked_candidates if o.option_key == evaluation.recommended_option_key)
    proposal = await llm.explain_slots(explanations.signals(evaluation, option, snapshot.owner),
                                       explanations.SLOT_MEANING, _digest(case["id"]), settings)
    unsafe, text = False, []
    try:
        text = explanations.resolve(proposal.sentences, explanations.facts(evaluation, option, snapshot.owner))
    except ValueError:
        unsafe = True
    passed = proposal.provenance == case["expected_provenance"] and bool(text) == (proposal.provenance != "template")
    modelled = proposal.provenance in {"recorded", "live"} and proposal.code is None
    return dict(passed=passed and not unsafe, model_pass=modelled and passed, kind=proposal.provenance,
                code=proposal.code, detail={"sentences": text}, unsafe=unsafe, tokens=(None, None))


HANDLERS = {"extract": _extract_case, "whatif": _whatif_case, "reply": _reply_case,
            "clause": _clause_case, "explain": _explain_case}


async def _one(case, settings):
    started = time.perf_counter()
    outcome = await HANDLERS[case["task"]](case, settings)
    outcome["seconds"] = time.perf_counter() - started
    return outcome


def _row(case, trials, repeat):
    return {"id": case["id"], "task": case["task"], "language": case.get("language"),
            "pass_k": all(t["passed"] for t in trials),
            "model_passes": sum(t["model_pass"] for t in trials), "repeat": repeat,
            "unsafe_changes": sum(t["unsafe"] for t in trials),
            "fallback_rate": sum(t["kind"] == "template" or t["code"] is not None for t in trials) / repeat,
            "latency_seconds": statistics.mean(t["seconds"] for t in trials),
            "tokens": {"input": sum(t["tokens"][0] or 0 for t in trials),
                       "output": sum(t["tokens"][1] or 0 for t in trials)},
            "trials": [{"kind": t["kind"], "code": t["code"], "detail": t["detail"],
                        "model_pass": t["model_pass"]} for t in trials]}


def summarize(rows, mode="recorded"):
    """Task-level model-vs-baseline comparison and per-language qualification."""
    tasks = {}
    for task in sorted({r["task"] for r in rows}):
        group = [r for r in rows if r["task"] == task]
        modelled = [r for r in group if r["model_passes"]]
        unsafe = sum(r["unsafe_changes"] for r in group)
        tasks[task] = {
            "cases": len(group), "passed": sum(r["pass_k"] for r in group),
            "model_passed": len(modelled), "unsafe_changes": unsafe,
            # The model path stays only while it produced zero unsafe changes.
            "model_path_retained": unsafe == 0,
            "evidence": mode,
        }
    whatif = [r for r in rows if r["task"] == "whatif"]
    if whatif:
        baseline_hits = sum(r["trials"][0]["detail"]["baseline_pass"] for r in whatif)
        tasks["whatif"]["baseline_passed"] = baseline_hits
        tasks["whatif"]["model_improves_on_baseline"] = sum(
            r["model_passes"] > 0 and not r["trials"][0]["detail"]["baseline_pass"] for r in whatif)
    languages = {}
    for language in SUPPORTED_LANGUAGES:
        group = [r for r in rows if (r["language"] or "en") == language]
        kinds = {r["task"] for r in group}
        languages[language] = {
            "cases": len(group), "passed": sum(r["pass_k"] for r in group),
            "tasks": sorted(kinds),
            # Qualified only by passing synthetic extraction AND reply cases; recorded replays
            # establish the pipeline, not live-model quality.
            "qualified": {"extract", "reply"} <= kinds and all(r["pass_k"] for r in group),
            "evidence": mode,
        }
    return tasks, languages


async def run(provider, mode, repeat, cases=None, recordings=None):
    cases = json.loads(CASES.read_text(encoding="utf-8")) if cases is None else cases
    settings = LLMSettings(mode=mode, provider=provider, recordings_dir=recordings or RECORDINGS)
    rows = []
    for case in cases:
        trials = [await _one(case, settings) for _ in range(repeat)]
        rows.append(_row(case, trials, repeat))
    tasks, languages = summarize(rows, mode)
    return {"provider": provider, "mode": mode, "repeat": repeat, "cases": rows, "tasks": tasks,
            "languages": languages, "passed": all(row["pass_k"] for row in rows),
            "baseline": "regex/template deterministic paths"}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--provider", choices=("freellmpool", "openai"), default="openai")
    parser.add_argument("--mode", choices=("live", "recorded"), default="recorded")
    parser.add_argument("--repeat", type=int, default=1)
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "ai_workflow" / "report.json")
    parser.add_argument("--write-recordings", action="store_true",
                        help="regenerate synthetic recordings from cases with a 'recorded' key, then exit")
    args = parser.parse_args()
    if args.repeat < 1:
        parser.error("--repeat must be positive")
    if args.write_recordings:
        count = write_recordings(json.loads(CASES.read_text(encoding="utf-8")))
        print(json.dumps({"recordings_written": count}))
        return
    report = asyncio.run(run(args.provider, args.mode, args.repeat))
    args.output.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"passed": report["passed"], "cases": len(report["cases"]), "output": str(args.output)}))
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
