import type { BundleView } from "@/lib/generated-api";
import { STALE_TEXT, KIND_LABEL, describeItem, formatMinor } from "@/lib/approval-model";
import { sandboxBanner, when } from "./ui";

/** Read-only rendering of the exact immutable manifest the approver is deciding on. */
export function BundleReview({ view, currency }: { view: BundleView; currency: string }) {
  const m = view.manifest;
  return <div className="space-y-3 text-sm">
    <p className="rounded bg-amber-50 p-2 font-medium" role="note">{sandboxBanner}</p>
    <p><strong>{KIND_LABEL[m.kind]}</strong> · option {m.option_key} · created {when(m.created_at)} · <strong>expires {when(m.expires_at)}</strong></p>
    <p>Strategy: {m.strategy.kind === "accept" ? "accept the order" : "decline"} · deposit {m.strategy.deposit_pct}% · financing draw {formatMinor(m.strategy.draw_minor, currency)}{m.strategy.offer_id ? ` · offer ${m.strategy.offer_id}` : " · no financing"}</p>
    <p>Bound to financial revision {m.financial_revision}, input version {m.input_version}, calculator {m.calculator_version}.</p>
    <code className="block break-all text-xs">Bundle hash {view.bundle_hash}</code>
    {!!view.stale_reasons?.length && <ul role="alert" className="space-y-1 rounded bg-red-50 p-3">{view.stale_reasons.map(r => <li key={r}>{STALE_TEXT[r] ?? `Blocked: ${r}`}</li>)}</ul>}
    {!!m.required_acceptances.length && <div><h4 className="font-semibold">Required party acceptances</h4><ul className="list-disc pl-5">{m.required_acceptances.map(a => <li key={`${a.party_id}${a.terms_hash}`}>{a.party_role} {a.party_id} · {a.acceptance_id ? `accepted (evidence ${a.acceptance_id})` : "NOT yet recorded"}<code className="block break-all text-xs">terms {a.terms_hash}</code></li>)}</ul></div>}
    <div><h4 className="font-semibold">Items ({m.items.length})</h4><ol className="space-y-3">{m.items.map(item => <li key={item.key} className="rounded border p-3">
      {item.kind === "message" ? <><p className="font-medium">To: {item.recipient} · {item.channel}</p><p>Subject: {item.subject}</p><pre className="mt-1 whitespace-pre-wrap rounded bg-neutral-50 p-2 text-xs">{item.body}</pre><code className="block break-all text-xs">terms {item.terms_hash}</code></>
        : <><p className="font-medium">{describeItem(item, currency).title}</p><p>{describeItem(item, currency).detail}</p></>}
      {item.kind === "commitment" && <details><summary>Projected cash events ({item.projections.length})</summary><table className="w-full text-left text-xs"><thead><tr><th>Date</th><th>Kind</th><th>Direction</th><th>Amount</th><th>Certainty</th></tr></thead><tbody>{item.projections.map(p => <tr key={p.event_key}><td>{p.event_date}</td><td>{p.kind}</td><td>{p.direction}</td><td>{formatMinor(p.amount_minor, currency)}</td><td>{p.certainty}</td></tr>)}</tbody></table></details>}
    </li>)}</ol></div>
  </div>;
}
