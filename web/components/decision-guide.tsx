import Link from "next/link";

import { buildDecisionGuide } from "@/lib/decision-guide-model";
import type { Evaluation } from "@/lib/orderfit-api";

export function DecisionGuide({ evaluation, businessId, dealId }: { evaluation: Evaluation; businessId: string; dealId: string }) {
  const guide = buildDecisionGuide(evaluation);
  const negotiationHref = `/deals/${dealId}/negotiate?businessId=${businessId}`;

  return (
    <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50 p-4" aria-labelledby="decision-guide-title">
      <div>
        <h2 id="decision-guide-title" className="text-lg font-semibold">Decision guide</h2>
        <p className="mt-1 text-sm text-neutral-700">Organized from the current deterministic evaluation. It does not alter inputs, calculations, approvals, or actions.</p>
      </div>
      <div>
        <h3 className="font-medium">{guide.headline}</h3>
        <p className="mt-1 text-sm text-neutral-700">{guide.detail}</p>
      </div>
      {guide.stale_reasons.length > 0 && <div>
        <h3 className="font-medium">Why this result is stale</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {guide.stale_reasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      </div>}
      {guide.alerts.length > 0 && <GuideFindingList title="Risk checks to review" findings={guide.alerts} />}
      {guide.coverage_gaps.length > 0 && <GuideFindingList title="Coverage gaps" findings={guide.coverage_gaps} />}
      {guide.questions.length > 0 && <div>
        <h3 className="font-medium">Clarify before relying on this assessment</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
          {guide.questions.map(question => <li key={question}>{question}</li>)}
        </ul>
      </div>}
      <div className="border-t border-sky-200 pt-3">
        <p className="text-sm text-neutral-700">{guide.next_step}</p>
        {!evaluation.is_stale && <Link className="mt-3 inline-block rounded-lg border border-sky-300 bg-white px-3 py-2 text-sm underline" href={negotiationHref}>Explore a safe what-if</Link>}
      </div>
    </section>
  );
}

function GuideFindingList({ title, findings }: { title: string; findings: ReturnType<typeof buildDecisionGuide>["alerts"] }) {
  return <div>
    <h3 className="font-medium">{title}</h3>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-neutral-700">
      {findings.map(finding => <li key={`${finding.code}:${finding.message}`}>{finding.message}</li>)}
    </ul>
  </div>;
}
