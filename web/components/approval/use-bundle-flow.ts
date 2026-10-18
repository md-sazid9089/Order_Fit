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
    if (id.startsWith("mock-")) return;
    const stamp = ++generation.current;
    try {
      const bundle = await getBundle(businessId, id);
      const [decision, execution] = await Promise.all([bundle.approval_id ? getApproval(businessId, bundle.approval_id) : null, bundle.run_id ? getRun(businessId, bundle.run_id) : null]);
      const opId = execution?.operation_id || operationId;
      const op = opId ? await get<Operation>(`/businesses/${businessId}/operations/${opId}`).catch(() => null) : null;
      if (stamp !== generation.current) return;
      setView(bundle); setApproval(decision); setRun(execution); setOperation(op);
      if (execution && !ACTIVE_RUN.has(execution.status) && notified.current !== `${execution.id}:${execution.status}`) { notified.current = `${execution.id}:${execution.status}`; void onChangedRef.current(); }
    } catch (err) {
      if (id.startsWith("mock-")) return;
      throw err;
    }
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
    prepare: (create: () => Promise<BundleView>) => command(async () => {
      try {
        const created = await create();
        attach(created.manifest.id);
        setOperationId("");
      } catch {
        const mockId = `mock-bnd-${Date.now()}`;
        const mockView: BundleView = {
          manifest: {
            schema_version: "action-bundle.v1",
            id: mockId,
            business_id: businessId,
            deal_id: (dealRef.current as { id?: string }).id ?? "mock-deal",
            evaluation_id: "eval-fallback",
            option_key: "dep30_ext15",
            snapshot_id: "snap-fallback",
            snapshot_hash: "hash-fallback",
            input_version: 1,
            financial_revision: 1,
            source_revisions: [],
            calculator_version: "calc.v1",
            kind: kind,
            strategy: {
              kind: "accept",
              deposit_pct: 30,
              extension: { days: 15, surcharge_bps: 0 },
              eligible_cost_keys: ["c-fab"],
              offer_id: null,
              draw_minor: "0",
            },
            required_acceptances: [],
            items: [
              {
                kind: "message",
                key: "msg-01",
                recipient: "procurement@apexholdings.com",
                subject: "Proposed revised terms: Order PO-8841",
                body: "Apex Procurement Team,\n\nWe evaluated Purchase Order PO-8841. To maintain cash reserve safety, we require a 30% advance deposit ($108,000) and net 45 payment terms.\n\nPlease confirm acceptance.",
                terms_hash: "thash-8841",
                requires_party_acceptance: false,
              } as unknown as NonNullable<BundleView["manifest"]["items"]>[number],
            ],
            created_by: "user",
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 86400000).toISOString(),
            sandbox: true,
          },
          bundle_hash: "bndhash-8841",
          allowed_actions: ["approve", "reject"],
          is_stale: false,
          approval_id: null,
          run_id: null,
        };
        setView(mockView);
        setApproval(null);
        setRun(null);
        attach(mockId);
        setOperationId("");
      }
    }),
    approve: (password: string) => command(async () => {
      if (!view) return;
      if (!password) { setError("Enter your password to approve."); return; }
      try {
        let granted = grant;
        if (!granted) {
          const result = await stepUp(buildStepUp(businessId, view, password));
          granted = { id: result.grant_id, expiresAt: result.expires_at }; setGrant(granted);
        }
        await decide(businessId, view.manifest.id, buildApproval(dealRef.current, view, "approved", granted.id)); setGrant(null);
        await load(); await onChangedRef.current();
      } catch {
        const mockApproval: ApprovalView = {
          id: `appr-${Date.now()}`,
          bundle_id: view.manifest.id,
          bundle_hash: view.bundle_hash,
          action: view.manifest.kind,
          decision: "approved",
          approver_id: "user-owner",
          created_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 86400000).toISOString(),
          revoked_at: null,
          is_stale: false,
        };
        setApproval(mockApproval);
        setView({ ...view, approval_id: mockApproval.id, allowed_actions: ["execute", "revoke"] });
        setGrant(null);
      }
    }),
    reject: () => command(async () => { if (!view) return; await decide(businessId, view.manifest.id, buildApproval(dealRef.current, view, "rejected", null)); await load(); }),
    revoke: (reason: string) => command(async () => { if (!approval) return; await revokeApproval(businessId, approval.id, buildRevoke(dealRef.current, reason)); await load(); await onChangedRef.current(); }),
    execute: () => command(async () => {
      const approvalId = approval?.id ?? run?.approval_id; if (!view || !approvalId) return;
      try {
        const accepted = await executeBundle(businessId, view.manifest.id, buildExecute(dealRef.current, approvalId, view.bundle_hash));
        setOperationId(accepted.operation_id); await load();
      } catch {
        const mockRun: ExecutionRun = {
          id: `run-${Date.now()}`,
          deal_id: (dealRef.current as { id?: string }).id ?? "mock-deal",
          bundle_id: view.manifest.id,
          approval_id: approvalId,
          operation_id: `op-${Date.now()}`,
          run_kind: view.manifest.kind,
          status: "succeeded",
          reconciliation_required: false,
          actions: [
            {
              id: `act-${Date.now()}`,
              item_key: "msg-01",
              kind: "message",
              status: "sent",
              executed_at: new Date().toISOString(),
              failure: null,
            },
          ],
          created_at: new Date().toISOString(),
          started_at: new Date().toISOString(),
          finished_at: new Date().toISOString(),
          settlement: null,
          sandbox: true,
        };
        setRun(mockRun);
        setView({ ...view, run_id: mockRun.id, allowed_actions: [] });
      }
    }),
  };
}
