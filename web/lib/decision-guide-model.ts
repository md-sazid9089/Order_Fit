export type DecisionGuideFinding = {
  code: string;
  message: string;
};

export type DecisionGuideInput = {
  is_stale: boolean;
  stale_reasons: readonly string[];
  decision: "accept_as_is" | "accept_with_changes" | "decline_or_renegotiate";
  recommended_option_key: string | null;
  alerts: readonly DecisionGuideFinding[];
  coverage_gaps: readonly DecisionGuideFinding[];
  voi_questions: readonly string[];
};

export type DecisionGuide = {
  headline: string;
  detail: string;
  next_step: string;
  stale_reasons: string[];
  alerts: DecisionGuideFinding[];
  coverage_gaps: DecisionGuideFinding[];
  questions: string[];
};

function uniqueText(values: readonly string[], limit = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (normalized && !seen.has(normalized) && result.length < limit) {
      seen.add(normalized);
      result.push(normalized);
    }
  }
  return result;
}

function uniqueFindings(values: readonly DecisionGuideFinding[], limit = 5): DecisionGuideFinding[] {
  const seen = new Set<string>();
  const result: DecisionGuideFinding[] = [];
  for (const finding of values) {
    const code = finding.code.trim();
    const message = finding.message.trim();
    const key = `${code}\n${message}`;
    if (message && !seen.has(key) && result.length < limit) {
      seen.add(key);
      result.push({ code, message });
    }
  }
  return result;
}

export function buildDecisionGuide(input: DecisionGuideInput): DecisionGuide {
  const alerts = uniqueFindings(input.alerts);
  const coverage_gaps = uniqueFindings(input.coverage_gaps);
  const questions = uniqueText(input.voi_questions);
  const stale_reasons = uniqueText(input.stale_reasons);

  if (input.is_stale) {
    return {
      headline: "Re-evaluate before relying on this assessment",
      detail: "The saved evaluation no longer represents the current confirmed inputs and sources.",
      next_step: "Review the updated inputs and evidence, then confirm and evaluate again.",
      stale_reasons,
      alerts,
      coverage_gaps,
      questions,
    };
  }

  const verdict = input.decision === "accept_as_is"
    ? {
        headline: "The current evaluation accepts the offered terms",
        detail: "This is the deterministic engine's as-offered decision for the confirmed inputs.",
      }
    : input.decision === "accept_with_changes"
      ? {
          headline: "The evaluation recommends changed terms",
          detail: input.recommended_option_key
            ? `The deterministic engine selected evaluated option ${input.recommended_option_key}.`
            : "The deterministic engine selected an evaluated option with changed terms.",
        }
      : {
          headline: "No evaluated option is recommended",
          detail: "The deterministic engine did not find an evaluated option that meets the current decision rules.",
        };

  const next_step = coverage_gaps.length
    ? "Resolve or explicitly review the listed coverage gaps before relying on the result."
    : questions.length
      ? "Confirm answers to the highest-value questions, then re-evaluate the order."
      : alerts.length
        ? "Review the listed risk checks before preparing any terms or messages."
        : "Open negotiation preparation to explore a separate, reviewable what-if.";

  return { ...verdict, next_step, stale_reasons, alerts, coverage_gaps, questions };
}
