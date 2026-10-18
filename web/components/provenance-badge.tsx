import { describeProvenance } from "@/lib/provenance-model";

const TONES = {
  ai: "border-violet-300 bg-violet-50 text-violet-900",
  replay: "border-sky-300 bg-sky-50 text-sky-900",
  neutral: "border-neutral-300 bg-neutral-50 text-neutral-700",
} as const;

/** F5: the same badge for extraction candidates, forks, clause readings, replies and explanations. */
export function ProvenanceBadge({ kind, model }: { kind: string | null | undefined; model?: string | null }) {
  const info = describeProvenance(kind, model);
  return (
    <span
      data-provenance={kind ?? "template"}
      data-ai={info.ai ? "true" : "false"}
      title={info.title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${TONES[info.tone]}`}
    >
      {info.label}
    </span>
  );
}
