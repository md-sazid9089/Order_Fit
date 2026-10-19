import type { ExecutionRun } from "@/lib/generated-api";
import type { Operation } from "@/lib/orderfit-api";
import { actionState, runCounts, messageForCode } from "@/lib/approval-model";
import { when } from "./ui";

const EFFECT: Record<string, string> = { outbox: "sandbox outbox record", ledger: "sandbox ledger entry", lender_simulation: "simulated lender acceptance", inverse: "inverse sandbox effect" };

/** Persisted execution state only: the operation, the run and each action exactly as the server recorded them. */
export function ExecutionStatus({ run, operation, currency }: { run: ExecutionRun | null; operation: Operation | null; currency: string }) {
  void currency;
  const failure = operation?.result?.kind === "failed" ? operation.result.error : null;
  const blocked = operation?.result?.kind === "blocked" ? operation.result : null;
  const counts = run ? runCounts(run.actions) : null;
  return <div className="space-y-2 text-sm">
    {operation && <p>Operation {operation.status} · {operation.subphase}{operation.cancellation_requested ? " · cancellation requested" : ""}</p>}
    {failure && <p role="alert" className="rounded bg-danger-soft p-2">{failure.message} ({failure.code}){failure.retryable ? " This can be retried." : ""}</p>}
    {blocked && <p role="alert" className="rounded bg-danger-soft p-2">Execution was blocked: {blocked.outcome}. {blocked.findings.map(f => f.message).join(" ")}</p>}
    {run && counts && <>
      <p><strong>Run {run.status}</strong> · {run.run_kind} · started {when(run.started_at)} · finished {when(run.finished_at)}</p>
      <p>{counts.completed} completed · {counts.pending} pending · {counts.failed} failed of {run.actions.length}</p>
      {run.reconciliation_required && <p role="alert" className="rounded bg-warning-soft p-2">Reconciliation required: some effects completed and others did not. Resume the run if the approval is still valid, or compensate the completed actions.</p>}
      <ul className="space-y-1">{run.actions.map(a => <li key={a.id} className="rounded border p-2"><span className="font-medium">{a.kind} {a.item_key}</span> · {actionState(a)} ({a.status}){a.executed_at ? ` · ${when(a.executed_at)}` : ""}{a.effect && <span className="block text-xs">{EFFECT[a.effect.effect_kind] ?? a.effect.effect_kind} · payload {a.effect.payload_hash}</span>}{a.failure && <span className="block text-xs text-danger">{messageForCode(a.failure.code, a.failure.message)}</span>}</li>)}</ul>
      {run.settlement && <p className="rounded bg-success-soft p-2">Settled ({run.settlement.settlement_kind}): {run.settlement.projected_events} projected cash events · business financial revision {run.settlement.revision_before} to {run.settlement.revision_after} · {when(run.settlement.settled_at)}</p>}
    </>}
  </div>;
}
