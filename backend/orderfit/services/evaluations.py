"""Adapters from deterministic engine results to the frozen P0 result contract."""

from datetime import UTC, datetime
from uuid import UUID, uuid4

from orderfit.agent.nodes.compute import Computation
from orderfit.contracts.financial import ConfirmedInputV1
from orderfit.contracts.workflow import (
    Breach,
    EvaluationResultV1,
    Extension,
    OptionResult,
    ScenarioSummary,
    Series,
    SeriesPoint,
    Strategy,
    Tolerance,
)
from orderfit.engine.models import Candidate, Result


def to_breaches(items):
    return [Breach(start_date=b.start, end_date=b.end, worst_headroom_minor=str(-b.max_gap)) for b in items]


def to_scenario_summary(name, metrics, target_level, resilience):
    return ScenarioSummary(
        scenario=name,
        lowest_balance_minor=str(metrics.lowest_balance),
        lowest_headroom_minor=str(metrics.headroom),
        first_breach_date=metrics.first_violation_date or metrics.first_shortfall_date,
        breaches=to_breaches(metrics.order_caused_breaches),
        inherited_baseline_breaches=to_breaches(metrics.inherited_baseline_breaches),
        hard_feasible=metrics.feasible,
        meets_target=metrics.feasible and resilience >= target_level,
    )


def _tolerance(result: Result, selected: bool, candidate: Candidate) -> Tolerance:
    raw = result.tolerance if selected else None
    if raw is not None:
        return Tolerance(status=raw.status, observed_safe_days=raw.observed_safe_days,
                         first_failure_days=raw.first_failure_days, scan_cap_days=raw.scan_cap_days)
    # The P0 wire contract requires a scan value per option. Until P2 returns per-candidate
    # scans, only an objectively infeasible on-time candidate can be represented truthfully.
    if not candidate.hard_feasible and candidate.scenarios["base"].first_violation_date is not None:
        return Tolerance(status="fails_on_time", observed_safe_days=-1, first_failure_days=0,
                         scan_cap_days=1)
    return Tolerance(status="capped_scan", observed_safe_days=1, first_failure_days=None, scan_cap_days=1)


def to_option_result(candidate: Candidate, target: int, best_profit: int, result: Result) -> OptionResult:
    strategy = candidate.strategy
    key = strategy.id
    scenario_rows = [to_scenario_summary(n, candidate.scenarios[n], target, candidate.resilience) for n in ("base", "downside", "severe")]
    parameters = Strategy(
        kind="decline" if strategy.kind == "decline" else "accept",
        deposit_pct=strategy.deposit_pct,
        extension=Extension(days=strategy.ext_days, surcharge_bps=strategy.ext_surcharge_bps),
        eligible_cost_keys=candidate.eligible_cost_keys,
        offer_id=UUID(strategy.offer_id) if strategy.loan_minor and strategy.offer_id else None,
        draw_minor=str(strategy.loan_minor),
    )
    return OptionResult(
        option_key=key, rank=candidate.rank, parameters=parameters,
        base_incremental_profit_minor=str(candidate.net_profit),
        financing_cost_minor=str(candidate.financing_cost), borrowed_minor=str(strategy.loan_minor),
        profit_given_up_minor=str(max(0, best_profit-candidate.net_profit)), scenarios=scenario_rows,
        tolerance=_tolerance(result, key == result.recommended, candidate),
        hard_feasible=candidate.hard_feasible,
        meets_target=candidate.resilience >= target,
    )


def build_evaluation_dto(snapshot: ConfirmedInputV1, comp: Computation, snapshot_id: UUID,
                         eval_id: UUID | None = None) -> EvaluationResultV1:
    result = comp.result
    if result.decision not in {"accept_as_is", "accept_with_changes", "decline_or_renegotiate"}:
        raise ValueError(f"non-numeric engine outcome: {result.decision}")
    eval_id = eval_id or uuid4()
    target = {"base": 1, "downside": 2, "severe": 3}[snapshot.owner.target_scenario]
    baseline = next((c for c in result.catalogue if c.strategy.kind == "decline"), None)
    if baseline is None:
        raise ValueError("engine omitted baseline candidate")
    ranked_candidates = [c for c in result.catalogue if c.rank is not None]
    best_profit = max((c.net_profit for c in ranked_candidates), default=0)
    as_is = next((c for c in result.catalogue if c.strategy.id == "accept_as_is"), None)
    if as_is is None:
        raise ValueError("engine omitted as-is candidate")
    as_is_result = to_option_result(as_is, target, best_profit, result)
    baseline_rows = [to_scenario_summary(n, baseline.scenarios[n], target, baseline.resilience) for n in ("base", "downside", "severe")]
    options = [to_option_result(c, target, best_profit, result) for c in ranked_candidates]
    recommended = result.recommended if result.decision != "decline_or_renegotiate" else None
    diagnostics = result.diagnostics
    return EvaluationResultV1(
        schema_version="evaluation.v1", id=eval_id, business_id=snapshot.business_id,
        deal_id=snapshot.deal_id, snapshot_id=snapshot_id, input_version=snapshot.input_version,
        financial_revision=snapshot.financial_revision, snapshot_hash=comp.snapshot_hash,
        reference_input_hash=comp.reference_input_hash, calculator_version=result.calculator_version,
        start_date=snapshot.start_date, evaluated_at=datetime.now(UTC), decision=result.decision,
        reason_codes=["F-FEASIBLE" if recommended else "E-NO-FEASIBLE"], baseline=baseline_rows,
        as_is=as_is_result, ranked_candidates=options, recommended_option_key=recommended,
        summary_scope="recommended_base" if recommended else "as_is_base",
        assumptions=snapshot.assumptions, coverage_through=snapshot.coverage_through,
        coverage_gaps=[], voi_questions=[v.get("question", "Review uncertain input") for v in diagnostics.get("voi", [])],
        sensitivity=[], alerts=[], is_stale=False, stale_reasons=[],
        allowed_actions=["view_details", "what_if", "negotiate"],
    )


def extract_series(result: Result, snapshot: ConfirmedInputV1, eval_id: UUID,
                   scenario: str = "base", option_key: str | None = None) -> Series:
    if scenario not in {"base", "downside", "severe"}:
        raise ValueError("unsupported scenario")
    key = option_key or result.recommended or "accept_as_is"
    candidate = next((c for c in result.catalogue if c.strategy.id == key), None)
    if candidate is None:
        raise KeyError("option not found")
    baseline = next((c for c in result.catalogue if c.strategy.kind == "decline"), None)
    if baseline is None:
        raise ValueError("baseline series missing")
    bmap = {p.date: p for p in baseline.series[scenario]}
    points = []
    for p in candidate.series[scenario]:
        b = bmap[p.date]
        points.append(SeriesPoint(date=p.date, baseline_trough_minor=str(b.baseline_trough),
            baseline_close_minor=str(b.baseline_close), candidate_trough_minor=str(p.candidate_trough),
            candidate_close_minor=str(p.candidate_close), reserve_minor=str(p.reserve),
            effective_floor_minor=str(p.effective_floor)))
    return Series(evaluation_id=eval_id, option_key=key, scenario=scenario,
                  currency=snapshot.currency, exponent=2, points=points)
