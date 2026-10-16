"use client";

import { useState } from "react";
import { canResumeRun, reasonValid, type Stage } from "@/lib/approval-model";
import type { ApprovalView, ExecutionRun } from "@/lib/generated-api";
import { button, field, primary, when } from "./ui";
import type { Grant } from "./use-bundle-flow";

type Props = { stage: Stage; allowed: readonly string[]; approval: ApprovalView | null; run: ExecutionRun | null; grant: Grant | null; busy: boolean; approve: (password: string) => void; reject: () => void; revoke: (reason: string) => void; execute: () => void };

/** Step-up approval, rejection, revocation, execution and resume. Buttons reflect server `allowed_actions`, not local guesses. */
export function ApprovalControls({ stage, allowed, approval, run, grant, busy, approve, reject, revoke, execute }: Props) {
  const [password, setPassword] = useState(""); const [reason, setReason] = useState("");
  const submit = () => { const typed = password; setPassword(""); approve(typed); }; // The secret leaves component state at once.
  const canDecide = allowed.includes("approve");
  return <div className="space-y-3">
    {stage === "awaiting_decision" && canDecide && <form className="space-y-2 rounded border p-3" onSubmit={e => { e.preventDefault(); submit(); }} autoComplete="off">
      <p className="text-sm">Approving needs your password again, bound to this exact bundle hash. It is sent once, never stored, and the grant expires within five minutes.</p>
      {grant ? <p className="text-sm">Re-authenticated for this bundle until {when(grant.expiresAt)}. The approval has not been recorded yet; retry below.</p>
        : <label className="block text-sm">Password<input className={field} type="password" name="stepup-password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></label>}
      <div className="flex gap-2"><button type="submit" className={primary} disabled={busy || (!grant && !password)}>{grant ? "Retry recording approval" : "Re-authenticate and approve this exact bundle"}</button><button type="button" className={button} disabled={busy} onClick={reject}>Reject (no password needed)</button></div>
    </form>}
    {stage === "awaiting_decision" && !canDecide && <p className="text-sm">Only an owner or risk officer can approve or reject.</p>}
    {approval && <p className="text-sm">Approval {approval.decision}{approval.revoked_at ? ` and revoked ${when(approval.revoked_at)}` : ""} · expires {when(approval.expires_at)}{approval.is_stale ? " · no longer usable" : ""}</p>}
    {stage === "approved" && allowed.includes("execute") && <button className={primary} disabled={busy} onClick={execute}>Execute in sandbox</button>}
    {canResumeRun(run, approval) && <button className={primary} disabled={busy} onClick={execute}>Resume partial run (same approval, same run)</button>}
    {approval && !approval.revoked_at && approval.decision === "approved" && (stage === "approved" || stage === "run_partial") && <details><summary>Revoke approval</summary><p className="text-sm">Revocation stops pending effects. It cannot undo effects that already completed.</p><label className="block text-sm">Reason (10+ characters)<input className={field} value={reason} onChange={e => setReason(e.target.value)} /></label><button className={button} disabled={busy || !reasonValid(reason)} onClick={() => { revoke(reason); setReason(""); }}>Revoke approval</button></details>}
  </div>;
}
