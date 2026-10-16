"use client";

import { useCallback, useEffect, useState } from "react";
import type { ActionView, ExecutionRun, OptionResult, PreparedMessage } from "@/lib/generated-api";
import type { Deal, Evaluation } from "@/lib/orderfit-api";
import { listActions, getRun, prepareBundle, prepareCompensation } from "@/lib/approval-api";
import { buildCompensation, buildPrepareBundle } from "@/lib/approval-model";
import { BundleFlowPanel } from "./bundle-flow-panel";
import { CompensationForm } from "./compensation-form";
import { useBundleFlow } from "./use-bundle-flow";
import { button, panel } from "./ui";

type Props = { businessId: string; deal: Deal; evaluation: Evaluation | null; option: OptionResult | undefined; messages: readonly PreparedMessage[]; canPrepare: boolean; onChanged: () => Promise<unknown> };

/** Send, commit and compensation bundles for one order, each backed by the persisted P6 operations. */
export function ApprovalWorkflow({ businessId, deal, evaluation, option, messages, canPrepare, onChanged }: Props) {
  const send = useBundleFlow({ businessId, kind: "send_message", deal, onChanged });
  const commit = useBundleFlow({ businessId, kind: "commit_plan", deal, onChanged });
  const comp = useBundleFlow({ businessId, kind: "compensate", deal, onChanged });
  const [excluded, setExcluded] = useState<string[]>([]);
  const [actions, setActions] = useState<ActionView[]>([]); const [runs, setRuns] = useState<ExecutionRun[]>([]); const [historyError, setHistoryError] = useState("");
  const eligible = option && evaluation ? messages.filter(m => m.reviewed && !m.is_stale && !m.blockers.length && m.identity.evaluation_id === evaluation.id && m.identity.option.option_key === option.option_key) : [];
  const chosen = eligible.filter(m => !excluded.includes(m.identity.message_id));
  const optionReady = !!evaluation && !evaluation.is_stale && !!option && option.hard_feasible && option.parameters.kind === "accept" && canPrepare;

  const loadHistory = useCallback(async () => {
    try {
      const all = await listActions(businessId, deal.id);
      const ids = [...new Set(all.map(a => a.run_id).filter((id): id is string => !!id))];
      setRuns(await Promise.all(ids.map(id => getRun(businessId, id)))); setActions(all); setHistoryError("");
    } catch (e) { setHistoryError(e instanceof Error ? e.message : "Could not load execution history."); }
  }, [businessId, deal.id]);
  useEffect(() => { queueMicrotask(() => { void loadHistory(); }); }, [loadHistory, deal.version, send.run?.status, commit.run?.status, comp.run?.status]);

  const currency = deal.currency;
  const flowFor = (kind: string) => (kind === "commit_plan" ? commit : kind === "compensate" ? comp : send);
  return <div className="space-y-5">
    <section className={panel}><h2 className="text-lg font-semibold">Approval and sandbox execution</h2>
      <p>Order status: <strong>{deal.status}</strong> · negotiation round <strong>{deal.negotiation_round ?? 0}</strong> (each fully executed approved outgoing batch counts once; replies never count).</p>
      <p className="text-sm">Business-affecting steps need a password re-check bound to the exact bundle. Execution only writes sandbox records.</p></section>
    <BundleFlowPanel title="1. Send bundle" intro="Bundle reviewed messages, approve the exact recipients and wording, then execute to record sandbox outbox messages." flow={send} currency={currency}>
      <div className="space-y-2"><p className="text-sm">Reviewed, current messages for the selected option: {eligible.length}.</p>
        {eligible.map(m => <label key={m.identity.message_id} className="block text-sm"><input type="checkbox" checked={!excluded.includes(m.identity.message_id)} onChange={e => setExcluded(e.target.checked ? excluded.filter(id => id !== m.identity.message_id) : [...excluded, m.identity.message_id])} /> {m.identity.party_role} · {m.identity.recipient} · {m.identity.subject}</label>)}
        <button className={button} disabled={send.busy || !optionReady || !chosen.length} onClick={() => void send.prepare(() => prepareBundle(businessId, deal.id, buildPrepareBundle(deal, evaluation!.id, option!.option_key, option!.parameters, "send_message", chosen.map(m => m.identity.message_id))))}>Prepare send bundle</button>
        {!optionReady && <p className="text-xs">Needs a current evaluation, a hard-feasible accept option and a preparing role.</p>}</div>
    </BundleFlowPanel>
    <BundleFlowPanel title="2. Commit bundle" intro="Separate from sending. Commits the chosen plan only after exact party acceptances exist, projecting the engine-derived cash events into your baseline." flow={commit} currency={currency}>
      <button className={button} disabled={commit.busy || !optionReady} onClick={() => void commit.prepare(() => prepareBundle(businessId, deal.id, buildPrepareBundle(deal, evaluation!.id, option!.option_key, option!.parameters, "commit_plan", [])))}>Prepare commit bundle</button>
      {deal.status === "committed" && <p role="status" className="rounded bg-green-50 p-2 text-sm">This order is committed. {commit.run?.settlement ? `The baseline now holds ${commit.run.settlement.projected_events} projected events (revision ${commit.run.settlement.revision_before} to ${commit.run.settlement.revision_after}). Receipts stay expected, not received.` : "Open the commit bundle below to see the settlement summary."}</p>}
    </BundleFlowPanel>
    <BundleFlowPanel title="3. Compensation" intro="Reverse completed sandbox actions through a separate approved bundle. Audit history is kept and original actions stay visible." flow={comp} currency={currency}>
      <CompensationForm runs={runs} actions={actions} busy={comp.busy || !canPrepare} prepare={(runId, ids, reason) => void comp.prepare(() => prepareCompensation(businessId, deal.id, buildCompensation(deal, runId, ids, reason)))} />
    </BundleFlowPanel>
    <section className={panel}><h2 className="text-lg font-semibold">Execution history</h2>{historyError && <p role="alert" className="text-sm">{historyError}</p>}{!runs.length && !historyError && <p className="text-sm">No execution runs yet.</p>}
      {runs.map(r => <p key={r.id} className="text-sm">{r.run_kind} · {r.status}{r.reconciliation_required ? " · reconciliation required" : ""} · {r.actions.length} actions{r.settlement ? ` · settled ${r.settlement.projected_events} events` : ""} <button className={button} onClick={() => flowFor(r.run_kind).attach(r.bundle_id)}>Open bundle</button></p>)}
      <button className={button} onClick={() => void loadHistory()}>Refresh history</button></section>
  </div>;
}
