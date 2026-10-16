"use client";

import { useState } from "react";
import type { ActionView, ExecutionRun } from "@/lib/generated-api";
import { reasonValid, reversibleActions } from "@/lib/approval-model";
import { button, field } from "./ui";

/** Selects completed, not-yet-reversed actions of one original run. The server still verifies every id. */
export function CompensationForm({ runs, actions, busy, prepare }: { runs: ExecutionRun[]; actions: ActionView[]; busy: boolean; prepare: (runId: string, actionIds: string[], reason: string) => void }) {
  const eligible = runs.filter(r => r.run_kind !== "compensate" && (r.status === "succeeded" || r.status === "partial"));
  const [runId, setRunId] = useState(""); const [selected, setSelected] = useState<string[]>([]); const [reason, setReason] = useState("");
  const options = reversibleActions(actions.filter(a => a.run_id === runId));
  if (!eligible.length) return <p className="text-sm">No completed run has actions that can be reversed.</p>;
  return <div className="space-y-2">
    <label className="block text-sm">Original run<select className={field} value={runId} onChange={e => { setRunId(e.target.value); setSelected([]); }}><option value="">Choose a run</option>{eligible.map(r => <option key={r.id} value={r.id}>{r.run_kind} · {r.status} · {r.id}</option>)}</select></label>
    {runId && !options.length && <p className="text-sm">Every completed action in this run is already reversed.</p>}
    {options.map(a => <label key={a.id} className="block text-sm"><input type="checkbox" checked={selected.includes(a.id)} onChange={e => setSelected(e.target.checked ? [...selected, a.id] : selected.filter(id => id !== a.id))} /> {a.kind} {a.item_key} ({a.status})</label>)}
    <label className="block text-sm">Reason (10+ characters)<input className={field} value={reason} onChange={e => setReason(e.target.value)} /></label>
    <button className={button} disabled={busy || !runId || !selected.length || !reasonValid(reason)} onClick={() => prepare(runId, selected, reason)}>Prepare compensation bundle</button>
  </div>;
}
