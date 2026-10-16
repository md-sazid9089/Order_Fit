// Pure helpers for the Deals Pipeline dashboard: classify saved orders into tabs and summarise live evaluations.
// No network, storage or React. Money stays a decimal string of minor units and is compared as BigInt.
import type { DealView, EvaluationResultV1 } from "./generated-api";

export type PipelineTab = "all" | "action" | "recommended" | "closed";
export type Tone = "ok" | "warn" | "bad" | "neutral";
export type Verdict = { label: string; tone: Tone; action: string; text: string };

export const PIPELINE_TABS: readonly { key: PipelineTab; label: string }[] = [
  { key: "all", label: "All Orders" }, { key: "action", label: "Needs Action" },
  { key: "recommended", label: "Recommended" }, { key: "closed", label: "Closed / Infeasible" },
];

const blocking = (d: DealView) => d.findings.some(f => f.blocking);

/** Which tab a saved order belongs to. A stale or blocked order always needs a person before anything else. */
export function tabOf(deal: DealView, evaluation?: EvaluationResultV1 | null): Exclude<PipelineTab, "all"> {
  if (deal.status === "closed" || deal.status === "committed" || deal.status === "failed") return "closed";
  if (deal.is_stale || evaluation?.is_stale || blocking(deal) || deal.status === "computing" || deal.status === "ingesting" || deal.status === "awaiting_confirm" || deal.status === "awaiting_reply") return "action";
  if (evaluation?.decision === "decline_or_renegotiate") return "closed";
  return "recommended";
}

/** Plain-language verdict and primary action for a row, from saved state only. */
export function verdictOf(deal: DealView, evaluation?: EvaluationResultV1 | null): Verdict {
  const first = deal.findings.find(f => f.blocking)?.message;
  if (deal.status === "failed") return { label: "Computation failed", tone: "bad", action: "Open", text: "The saved evaluation operation failed. This is a technical result, not a financial rejection." };
  if (deal.status === "closed" || deal.status === "committed") return { label: deal.status === "closed" ? "Closed" : "Committed", tone: "neutral", action: "View", text: "This order is finished; the saved record is kept for audit." };
  if (deal.status === "ingesting" || deal.status === "awaiting_confirm") return { label: "Clarification Needed", tone: "warn", action: "Confirm Terms", text: first ?? "Inputs are saved but not confirmed yet. Review and confirm them to run the engine." };
  if (deal.status === "computing") return { label: "Computing", tone: "neutral", action: "View", text: "The engine is running on the saved inputs." };
  if (deal.is_stale || evaluation?.is_stale) return { label: "Re-evaluate", tone: "warn", action: "Re-evaluate", text: "Business cash or inputs changed after the last evaluation, so its verdict can no longer be relied on." };
  if (first) return { label: "Review required", tone: "warn", action: "Review", text: first };
  if (!evaluation) return { label: "Not evaluated", tone: "neutral", action: "Continue", text: first ?? "No saved evaluation yet." };
  const base = evaluation.as_is.scenarios.find(s => s.scenario === "base");
  const breach = base?.first_breach_date ? ` First reserve breach: ${base.first_breach_date}.` : "";
  if (evaluation.decision === "accept_as_is") return { label: "Feasible As Offered", tone: "ok", action: "Review Plan", text: "The offered terms meet the engine's configured hard constraints against the baseline. Existing baseline shortfalls may remain; review scenario headroom." };
  if (evaluation.decision === "accept_with_changes") return { label: "Changes Recommended", tone: "warn", action: "Review Plan", text: `The engine recommends revised terms. Review cash headroom, profitability and scenario limits.${breach}` };
  return { label: "No feasible plan", tone: "bad", action: "Review Offer", text: `No supported option satisfies every configured hard constraint. Review the recorded cash, profit and financing limits.${breach}` };
}

export type Kpis = { openingCash: string | null; openingDate: string | null; reserve: string | null; trough: string | null; headroom: string | null; troughDeal: string | null };

/** Worst lowest-balance among the live evaluations' recommended (or as-offered) base scenario, with its headroom. */
export function worstTrough(evals: readonly { deal: DealView; evaluation: EvaluationResultV1 }[]): Pick<Kpis, "trough" | "headroom" | "troughDeal"> {
  let worst: { balance: bigint; headroom: string; ref: string; raw: string } | null = null;
  for (const { deal, evaluation } of evals) {
    if (deal.is_stale || evaluation.is_stale || deal.status === "computing" || deal.status === "closed" || deal.status === "failed") continue;
    const chosen = evaluation.recommended_option_key ? [evaluation.as_is, ...evaluation.ranked_candidates].find(o => o.option_key === evaluation.recommended_option_key) ?? evaluation.as_is : evaluation.as_is;
    const s = chosen.scenarios.find(x => x.scenario === "base");
    if (!s || !/^-?\d+$/.test(s.lowest_balance_minor)) continue;
    const balance = BigInt(s.lowest_balance_minor);
    if (!worst || balance < worst.balance) worst = { balance, headroom: s.lowest_headroom_minor, ref: deal.public_ref, raw: s.lowest_balance_minor };
  }
  return worst ? { trough: worst.raw, headroom: worst.headroom, troughDeal: worst.ref } : { trough: null, headroom: null, troughDeal: null };
}
