"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { get, type Operation } from "@/lib/orderfit-api";
import { decide, executeBundle, getApproval, getBundle, getRun, revokeApproval, stepUp } from "@/lib/approval-api";
import type { ApprovalView, BundleView, ExecutionRun } from "@/lib/generated-api";
import { ACTIVE_RUN, TERMINAL_OPERATION, bundleStage, buildApproval, buildExecute, buildRevoke, buildStepUp, describeError, type BundleKind, type Versions } from "@/lib/approval-model";

const PARAM: Record<BundleKind, string> = { send_message: "sendBundle", commit_plan: "commitBundle", compensate: "compensationBundle" };
export type Grant = { id: string; expiresAt: string };

function urlParam(name: string, value: string) {
  const url = new URL(window.location.href);
  if (value) url.searchParams.set(name, value); else url.searchParams.delete(name);
  window.history.replaceState(null, "", url);
}

/**
 * One bundle's persisted lifecycle: bundle -> step-up -> approval -> execution operation -> run. The bundle id lives in
 * the address so a reload resumes the same saved bundle; nothing here is a substitute for the server's answer.
 * The password is only ever a function argument: it is sent once and never stored by this hook.
 */
export function useBundleFlow({ businessId, kind, deal, onChanged }: { businessId: string; kind: BundleKind; deal: Versions; onChanged: () => Promise<unknown> }) {
  const [bundleId, setBundleId] = useState("");
  const [view, setView] = useState<BundleView | null>(null); const [approval, setApproval] = useState<ApprovalView | null>(null);
  const [run, setRun] = useState<ExecutionRun | null>(null); const [operation, setOperation] = useState<Operation | null>(null);
  const [operationId, setOperationId] = useState(""); const [grant, setGrant] = useState<Grant | null>(null);
  const [busy, setBusy] = useState(false); const [loading, setLoading] = useState(false); const [error, setError] = useState("");
  const generation = useRef(0); const notified = useRef("");
  const onChangedRef = useRef(onChanged); useEffect(() => { onChangedRef.current = onChanged; }, [onChanged]);
  const dealRef = useRef(deal); useEffect(() => { dealRef.current = deal; }, [deal]);

  const attach = useCallback((id: string) => { setBundleId(id); urlParam(PARAM[kind], id); }, [kind]);
  useEffect(() => { queueMicrotask(() => setBundleId(new URL(window.location.href).searchParams.get(PARAM[kind]) ?? "")); }, [kind]);

  const load = useCallback(async (id = bundleId) => {
    if (!id) return;
    const stamp = ++generation.current;
    const bundle = await getBundle(businessId, id);
    const [decision, execution] = await Promise.all([bundle.approval_id ? getApproval(businessId, bundle.approval_id) : null, bundle.run_id ? getRun(businessId, bundle.run_id) : null]);
    const opId = execution?.operation_id || operationId;
    const op = opId ? await get<Operation>(`/businesses/${businessId}/operations/${opId}`).catch(() => null) : null;
    if (stamp !== generation.current) return;
    setView(bundle); setApproval(decision); setRun(execution); setOperation(op);
    if (execution && !ACTIVE_RUN.has(execution.status) && notified.current !== `${execution.id}:${execution.status}`) { notified.current = `${execution.id}:${execution.status}`; void onChangedRef.current(); }
  }, [businessId, bundleId, operationId]);

  const fail = useCallback(async (e: unknown) => {
    const described = describeError(e); setError(described.message);
    if (described.sessionExpired) return; // The shared handler (components/providers.tsx) resets state and redirects.
    if (described.refresh) await Promise.allSettled([load(), onChangedRef.current()]);
  }, [load]);

  useEffect(() => {
    if (!bundleId) return;
    queueMicrotask(() => { setLoading(true); load().catch(fail).finally(() => setLoading(false)); });
  }, [bundleId, load, fail]);

  const polling = !!bundleId && ((!!run && ACTIVE_RUN.has(run.status)) || (!!operation && !TERMINAL_OPERATION.has(operation.status)));
  useEffect(() => {
    if (!polling) return;
    const timer = setTimeout(() => { load().catch(e => setError(`Could not refresh execution progress. ${describeError(e).message}`)); }, 1500);
    return () => clearTimeout(timer);
  }, [polling, run, operation, load]);

  const command = useCallback(async (work: () => Promise<void>) => {
    setBusy(true); setError("");
    try { await work(); } catch (e) { await fail(e); } finally { setBusy(false); }
  }, [fail]);

  // A grant is single-use and short-lived: drop it from view the moment it expires so the password is asked again.
  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(() => setGrant(null), Math.max(0, Date.parse(grant.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [grant]);
  return {
    bundleId, view, approval, run, operation, grant, busy, loading, error, setError,
    stage: bundleStage(view, approval, run), polling, attach, reload: () => command(async () => { await load(); }),
    prepare: (create: () => Promise<BundleView>) => command(async () => { const created = await create(); attach(created.manifest.id); setOperationId(""); }),
    approve: (password: string) => command(async () => {
      if (!view) return;
      let granted = grant;
      if (!granted) {
        if (!password) { setError("Enter your password to approve."); return; }
        const result = await stepUp(buildStepUp(businessId, view, password));
        granted = { id: result.grant_id, expiresAt: result.expires_at }; setGrant(granted);
      }
      try { await decide(businessId, view.manifest.id, buildApproval(dealRef.current, view, "approved", granted.id)); setGrant(null); }
      catch (e) { if ((e as { code?: string }).code === "STEP_UP_INVALID") setGrant(null); throw e; }
      await load(); await onChangedRef.current();
    }),
    reject: () => command(async () => { if (!view) return; await decide(businessId, view.manifest.id, buildApproval(dealRef.current, view, "rejected", null)); await load(); }),
    revoke: (reason: string) => command(async () => { if (!approval) return; await revokeApproval(businessId, approval.id, buildRevoke(dealRef.current, reason)); await load(); await onChangedRef.current(); }),
    execute: () => command(async () => {
      const approvalId = approval?.id ?? run?.approval_id; if (!view || !approvalId) return;
      const accepted = await executeBundle(businessId, view.manifest.id, buildExecute(dealRef.current, approvalId, view.bundle_hash));
      setOperationId(accepted.operation_id); await load();
    }),
  };
}
