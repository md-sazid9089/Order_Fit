"""C5 slot-only explanations: the model writes prose around named slots, never figures.

Facts are resolved from a stored engine result and the owner's confirmed policy. A
model sentence may contain only ``{slot}`` placeholders for numbers and terms; the
number and terms guards (ADR 0002) run before resolution, so a digit, a number word
or a rate/fee word written by a model rejects the whole text and the deterministic
template is used instead.
"""

import re

from orderfit.agent.guards import numbers
from orderfit.contracts.workflow import EvaluationResultV1, OptionResult

PLACEHOLDER = re.compile(r"\{([a-z_]+)\}")
# Loan and price terms exist only as engine facts; prose may not state or imply them.
FORBIDDEN_TERMS = re.compile(
    r"(?:%|\binterest\b|\bapr\b|\bfees?\b|\brates?\b|\bbps\b|\bbasis points?\b|\bpercent(?:age)?\b|"
    r"\bsurcharges?\b|\bdiscounts?\b|\bper cent\b)",
    re.I,
)
MAX_SENTENCES = 6
MAX_SENTENCE_CHARS = 320

SLOT_MEANING = {
    "decision": "overall assessment decision",
    "hard_feasibility": "whether this option passes every hard constraint",
    "target_status": "whether this option meets the owner's target scenario",
    "base_profit": "incremental profit in the base scenario",
    "financing_cost": "total financing cost of this option",
    "borrowed": "amount borrowed under this option",
    "profit_given_up": "profit given up versus the as-offered terms",
    "headroom_base": "lowest cash headroom over the reserve, base scenario",
    "headroom_downside": "lowest cash headroom over the reserve, downside scenario",
    "headroom_severe": "lowest cash headroom over the reserve, severe scenario",
    "tightest_scenario": "scenario with the least cash headroom",
    "delay_tolerance": "customer-delay tolerance result",
    "goal_priorities": "the owner's stated priorities, in order",
    "goal_target_scenario": "the scenario the owner wants to stay safe in",
    "goal_min_profit": "the owner's minimum acceptable order profit",
}
# Fixed caveats are appended after any model text, so a model cannot omit them.
CAVEATS = [
    "A finite delay scan does not establish survival without payment. Figures depend on confirmed source coverage and assumptions.",
    "Inherited baseline breaches and hard feasibility are separate from the ranking target.",
]


def _scenario(option: OptionResult, name: str):
    return next(s for s in option.scenarios if s.scenario == name)


def facts(evaluation: EvaluationResultV1, option: OptionResult, owner) -> dict[str, str]:
    """Resolve every slot from engine/policy values. These strings are the only figures shown."""
    tightest = min(option.scenarios, key=lambda s: int(s.lowest_headroom_minor))
    tolerance = option.tolerance
    priority_labels = {
        "profit": "profit",
        "robustness": "robustness",
        "independence_any": "independence from any single customer",
        "independence_customer": "independence from this customer",
        "simplicity": "simplicity",
        "low_financing_cost": "low financing cost",
    }
    return {
        "decision": evaluation.decision.replace("_", " "),
        "hard_feasibility": "passes all hard constraints" if option.hard_feasible else "fails at least one hard constraint",
        "target_status": "meets" if option.meets_target else "does not meet",
        "base_profit": f"{option.base_incremental_profit_minor} minor units",
        "financing_cost": f"{option.financing_cost_minor} minor units",
        "borrowed": f"{option.borrowed_minor} minor units",
        "profit_given_up": f"{option.profit_given_up_minor} minor units",
        "headroom_base": f"{_scenario(option, 'base').lowest_headroom_minor} minor units",
        "headroom_downside": f"{_scenario(option, 'downside').lowest_headroom_minor} minor units",
        "headroom_severe": f"{_scenario(option, 'severe').lowest_headroom_minor} minor units",
        "tightest_scenario": tightest.scenario,
        "delay_tolerance": (
            f"{tolerance.status.replace('_', ' ')}; observed safe days {tolerance.observed_safe_days}; "
            f"scan cap {tolerance.scan_cap_days} days"
        ),
        "goal_priorities": ", ".join(priority_labels[p] for p in owner.priorities),
        "goal_target_scenario": owner.target_scenario,
        "goal_min_profit": f"{owner.min_order_profit_minor} minor units",
    }


def signals(evaluation: EvaluationResultV1, option: OptionResult, owner) -> dict:
    """Qualitative, number-free context for the model (it never sees a figure)."""
    tightest = min(option.scenarios, key=lambda s: int(s.lowest_headroom_minor))
    return {
        "decision": evaluation.decision,
        "hard_feasible": option.hard_feasible,
        "meets_target": option.meets_target,
        "tightest_scenario": tightest.scenario,
        "scenarios_failing_hard": [s.scenario for s in option.scenarios if not s.hard_feasible],
        "uses_financing": int(option.borrowed_minor) > 0,
        "owner_priorities": list(owner.priorities),
        "owner_target_scenario": owner.target_scenario,
    }


def problems(sentences: list[str], allowed_slots) -> list[str]:
    """Why a model text is unusable. Empty list means every sentence is slot-only and safe."""
    found: list[str] = []
    if not 1 <= len(sentences) <= MAX_SENTENCES:
        found.append("sentence-count")
    for sentence in sentences:
        if not sentence.strip() or len(sentence) > MAX_SENTENCE_CHARS:
            found.append("sentence-length")
            continue
        names = PLACEHOLDER.findall(sentence)
        bare = PLACEHOLDER.sub(" ", sentence)
        if not names:
            found.append("no-slot")  # every sentence must be fact-linked
        if any(name not in allowed_slots for name in names):
            found.append("unknown-slot")
        if "{" in bare or "}" in bare:
            found.append("malformed-placeholder")
        if numbers.check(bare, set()):
            found.append("number")
        if FORBIDDEN_TERMS.search(bare):
            found.append("term")
    for sentence in sentences:
        words = set(re.findall(r"[a-z]+", PLACEHOLDER.sub(" ", sentence.lower())))
        slots = set(PLACEHOLDER.findall(sentence))
        if words & {"resilience", "resilient", "weakness", "exposed", "vulnerable"} and not slots & {
            "headroom_base", "headroom_downside", "headroom_severe"
        }:
            found.append("unsupported-resilience-claim")
        if words & {"tradeoff", "trade", "balances", "balancing"} and not (
            slots & {"base_profit", "profit_given_up"}
            and slots & {"headroom_base", "headroom_downside", "headroom_severe"}
        ):
            found.append("unsupported-tradeoff")
        if words & {"target", "goal"} and not slots & {"goal_target_scenario", "goal_priorities", "target_status"}:
            found.append("unsupported-goal-claim")
        if re.search(r"\bmeets?\s+for\b", sentence, re.I):
            found.append("unclear-target-wording")
    return found


def resolve(sentences: list[str], resolved: dict[str, str]) -> list[str]:
    """Fill placeholders from engine facts, verify no figure appears that is not a fact."""
    text = [PLACEHOLDER.sub(lambda m: resolved[m.group(1)], s).strip() for s in sentences]
    allowed = numbers.allowed_values(list(resolved.values()), [])
    # Resolved facts are engine-backed; this catches a slot value that smuggles another figure.
    if any(numbers.check(line, allowed) for line in text):
        raise ValueError("resolved explanation contains an unsupported figure")
    return text


def fact_ids(option_key: str, sentences: list[str]) -> list[str]:
    used = sorted({name for s in sentences for name in PLACEHOLDER.findall(s)})
    return [f"{option_key}:{name}" for name in used]
