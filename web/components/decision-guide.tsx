import Link from "next/link";

import { buildDecisionGuide } from "@/lib/decision-guide-model";
import type { Evaluation } from "@/lib/orderfit-api";

export function DecisionGuide({ evaluation, businessId, dealId }: { evaluation: Evaluation; businessId: string; dealId: string }) {
  const guide = buildDecisionGuide(evaluation);
  const negotiationHref = `/deals/${dealId}/negotiate?businessId=${businessId}`;

  return (
    <section className="space-y-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] p-5" aria-labelledby="decision-guide-title">
      <div>
        <h2 id="decision-guide-title" className="text-base font-semibold text-[#1E2021] dark:text-white">Decision guide</h2>
      </div>
      <div>
        <h3 className="font-medium text-sm text-[#1E2021] dark:text-white">{guide.headline}</h3>
        <p className="mt-1 text-xs text-[#737373] dark:text-neutral-400">{guide.detail}</p>
      </div>
      {guide.stale_reasons.length > 0 && <div>
        <h3 className="font-medium text-xs text-[#1E2021] dark:text-white">Why this result is stale</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#737373] dark:text-neutral-400">
          {guide.stale_reasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      </div>}
      {guide.alerts.length > 0 && <GuideFindingList title="Risk checks to review" findings={guide.alerts} />}
      {guide.coverage_gaps.length > 0 && <GuideFindingList title="Coverage gaps" findings={guide.coverage_gaps} />}
      {guide.questions.length > 0 && <div>
        <h3 className="font-medium text-xs text-[#1E2021] dark:text-white">Clarify before relying on this assessment</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#737373] dark:text-neutral-400">
          {guide.questions.map(question => <li key={question}>{question}</li>)}
        </ul>
      </div>}
      <div className="border-t border-[#E8E6E1] dark:border-[#2C302F] pt-3">
        <p className="text-xs text-[#737373] dark:text-neutral-400">{guide.next_step}</p>
        {!evaluation.is_stale && (
          <Link
            className="mt-3 inline-block rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] px-3.5 py-1.5 text-xs font-semibold text-[#1E2021] dark:text-white hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] transition-colors"
            href={negotiationHref}
          >
            Explore a safe what-if
          </Link>
        )}
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
