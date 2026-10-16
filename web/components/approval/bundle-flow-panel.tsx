"use client";

import type { ReactNode } from "react";
import { STAGE_TEXT } from "@/lib/approval-model";
import { ApprovalControls } from "./approval-controls";
import { BundleReview } from "./bundle-review";
import { ExecutionStatus } from "./execution-status";
import type { useBundleFlow } from "./use-bundle-flow";
import { button, panel } from "./ui";

/** Shared body of the send, commit and compensation panels: prepare area, immutable review, decision, execution. */
export function BundleFlowPanel({ title, intro, flow, currency, children }: { title: string; intro: string; flow: ReturnType<typeof useBundleFlow>; currency: string; children?: ReactNode }) {
  const { view, stage, approval, run, operation, grant, busy, loading, error } = flow;
  return <section className={panel}>
    <h2 className="text-lg font-semibold">{title}</h2><p className="text-sm">{intro}</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm">{error}</p>}
    {children}
    {loading && !view && <p role="status" className="text-sm">Loading the saved bundle…</p>}
    {flow.bundleId && !view && !loading && <button className={button} onClick={() => void flow.reload()}>Retry loading the saved bundle</button>}
    {view && <>
      <p role="status" className="font-medium">{STAGE_TEXT[stage]}{flow.polling ? " Refreshing from the server…" : ""}</p>
      <BundleReview view={view} currency={currency} />
      <ApprovalControls stage={stage} allowed={view.allowed_actions} approval={approval} run={run} grant={grant} busy={busy} approve={p => void flow.approve(p)} reject={() => void flow.reject()} revoke={r => void flow.revoke(r)} execute={() => void flow.execute()} />
      <ExecutionStatus run={run} operation={operation} currency={currency} />
      <button className={button} disabled={busy} onClick={() => void flow.reload()}>Refresh bundle state</button>
    </>}
  </section>;
}
