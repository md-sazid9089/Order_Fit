/** One vocabulary for where a piece of AI-assisted output came from (F5). Pure, no React. */

export type ProvenanceKind = "live" | "recorded" | "template" | "typed" | "manual";

export type ProvenanceInfo = {
  /** True when a language model produced (or, for a recording, once produced) the content. */
  ai: boolean;
  /** Short badge text. */
  label: string;
  /** Plain-language explanation shown as the badge title. */
  title: string;
  tone: "ai" | "replay" | "neutral";
};

const KNOWN: ReadonlySet<string> = new Set(["live", "recorded", "template", "typed", "manual"]);

/** Strip the internal source prefix a stored model name carries. */
export function modelLabel(model: string | null | undefined): string | null {
  if (!model) return null;
  const clean = model.replace(/^recorded:/, "").trim();
  return clean ? clean.slice(0, 60) : null;
}

export function describeProvenance(kind: string | null | undefined, model?: string | null): ProvenanceInfo {
  const name = modelLabel(model);
  const suffix = name ? ` · ${name}` : "";
  switch (KNOWN.has(kind ?? "") ? kind : "template") {
    case "live":
      return { ai: true, label: `AI live${suffix}`, tone: "ai", title: "Proposed by a language model for this request. It is a proposal: you confirm every fact." };
    case "recorded":
      return { ai: true, label: `AI recorded${suffix}`, tone: "replay", title: "Replayed from a stored model output, not a new model call. It is a proposal: you confirm every fact." };
    case "typed":
      return { ai: false, label: "Typed by you", tone: "neutral", title: "Entered directly. No language model was used." };
    case "manual":
      return { ai: false, label: "Edited by you", tone: "neutral", title: "Written or revised by a person. No language model was used." };
    default:
      return { ai: false, label: "Template", tone: "neutral", title: "Built from fixed rules and engine results. No language model was used." };
  }
}

/** Script groups whose text needs right-to-left layout. */
const RTL = new Set(["ar", "he", "fa", "ur"]);

export function textDirection(language: string | null | undefined): "rtl" | "ltr" | "auto" {
  if (!language || language === "unknown" || language === "other" || language === "mixed") return "auto";
  return RTL.has(language.split("-")[0]) ? "rtl" : "ltr";
}

/** An HTML lang value for a detected language, or undefined when it is unknown. */
export function htmlLang(language: string | null | undefined): string | undefined {
  return !language || ["unknown", "other", "mixed"].includes(language) ? undefined : language;
}

const NAMES: Record<string, string> = { en: "English", bn: "Bengali", hi: "Hindi", "zh-Hans": "Simplified Chinese" };

/** Reviewer-facing language note. Unsupported languages are flagged, never silently accepted. */
export function languageNote(language: string | null | undefined, script?: string | null): { text: string; supported: boolean } | null {
  if (!language) return null;
  if (NAMES[language]) return { text: NAMES[language] + (script && script !== "Latin" ? ` (${script})` : ""), supported: true };
  return { text: `Language not qualified (${script ?? language}): review every value against the original`, supported: false };
}

export type StanceView = "accept" | "reject" | "partial" | "unclear";

/** Reviewer disagreement line for a reply, or null when there is nothing to reconcile. */
export function stanceDisagreement(model: StanceView | null | undefined, baseline: StanceView | undefined, disagree: boolean | undefined): string | null {
  if (!disagree || !model) return null;
  return `The model reads this reply as "${model}", but the rule-based read is "${baseline ?? "unclear"}". Decide from the original text; neither read records acceptance.`;
}
