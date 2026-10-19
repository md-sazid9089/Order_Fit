"use client";

import { useState, type FormEvent } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { getAuditExport, listAudit, saveBlob } from "@/lib/p7-api";
import { AUDIT_EXPORT_LIMITS, auditExportFileName, auditRange, can, auditActorLabel, humanAction, parseAuditRow } from "@/lib/p7-model";
import type { AuditExport } from "@/lib/generated-api";
import { Alert, Loading, NotPermitted, PageFrame, QueryError, button, field, panel, primary, useCommand, useScoped, when } from "@/components/p7/common";

/** The business's tamper-evident operation log (newest first) and its canonical export. Auditors, risk officers and owners only. */
export function AuditScreen() {
  const { role } = useScoped();
  return <PageFrame title="Operation audit log" intro="Every recorded action in this business, newest first, with the server's hash chain. Entries are append-only.">
    {can(role, "audit") ? <><Log /><Export /></> : <NotPermitted what="read the audit log" needs="Auditors, risk officers and owners can." />}
  </PageFrame>;
}

function Log() {
  const { businessId, key, session } = useScoped();
  const log = useInfiniteQuery({ queryKey: key("audit"), queryFn: ({ pageParam }) => listAudit(businessId, pageParam), initialPageParam: null as string | null, getNextPageParam: last => last.next_cursor, retry: false });
  const rows = (log.data?.pages.flatMap(p => p.items) ?? []).map(parseAuditRow);
  return <section className={panel} aria-labelledby="log-heading">
    <h2 id="log-heading" className="text-lg font-semibold">Operation log</h2>
    {log.isPending && <Loading what="the audit log" />}
    {log.isError && <QueryError error={log.error} retry={() => void log.refetch()} retrying={log.isFetching} />}
    {log.isSuccess && !rows.length && <p className="text-sm text-muted-foreground">No entries recorded yet.</p>}
    <ul className="divide-y">{rows.map(r => <li key={r.sequence} className="space-y-1 py-2 text-sm">
      <div className="flex flex-wrap items-baseline gap-x-3"><span className="font-mono text-xs text-muted-foreground">#{r.sequence}</span><strong>{humanAction(r.action)}</strong><span className={r.outcome === "success" || r.outcome === "ok" ? "text-muted-foreground" : "font-semibold text-warning"}>{r.outcome}</span><span className="text-muted-foreground">by {auditActorLabel(r, session.user_id)}</span><span className="ml-auto text-xs text-muted-foreground">{r.at ? when(r.at) : ""}</span></div>
      <details><summary className="cursor-pointer text-xs text-muted-foreground">Details and hashes</summary>
        <dl className="mt-2 grid gap-1 text-xs sm:grid-cols-[8rem_1fr]">
          {r.entity && <><dt>Entity</dt><dd>{r.entity}</dd></>}{r.dealId && <><dt>Order id</dt><dd className="break-all font-mono">{r.dealId}</dd></>}
          <dt>Row hash</dt><dd className="break-all font-mono">{r.hash}</dd><dt>Previous hash</dt><dd className="break-all font-mono">{r.previousHash ?? "none (first entry)"}</dd>
          <dt>Payload</dt><dd><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all">{r.parsed ? JSON.stringify(r.payload, null, 2) : r.raw}</pre></dd>
        </dl></details>
    </li>)}</ul>
    {log.hasNextPage && <button type="button" className={button} disabled={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>{log.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
  </section>;
}

function Export() {
  const { businessId } = useScoped();
  const { busy, error, notice, run } = useCommand();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [last, setLast] = useState<AuditExport | null>(null);
  const [rangeError, setRangeError] = useState("");
  async function download(e: FormEvent) {
    e.preventDefault();
    const range = auditRange(from, to);
    if (!range.ok) { setRangeError(range.message); return; }
    setRangeError("");
    const result = await run(() => getAuditExport(businessId, range.from, range.to), "Audit export downloaded.");
    if (!result.ok) return;
    setLast(result.value);
    saveBlob(new Blob([JSON.stringify(result.value, null, 2)], { type: "application/json" }), auditExportFileName(businessId, new Date().toISOString().slice(0, 10)));
  }
  return <section className={panel} aria-labelledby="export-heading">
    <h2 id="export-heading" className="text-lg font-semibold">Export the hash chain</h2>
    <p className="text-sm text-muted-foreground">Downloads a JSON file of canonical rows with their hashes so the chain links can be checked by a verifier that has the file. That check has limits (below): it does not by itself prove the history is complete. Leave the range empty to export everything. Per-order decision records are exported from each order&apos;s page.</p>
    <div className="space-y-1 rounded-lg bg-warning-soft p-3 text-sm text-warning"><p className="font-semibold">Limits of the verification</p><ul className="list-disc pl-5">{AUDIT_EXPORT_LIMITS.map(l => <li key={l}>{l}</li>)}</ul></div>
    <form onSubmit={download} className="flex flex-wrap items-end gap-3">
      <label className="text-sm">From sequence (optional)<input className={field} inputMode="numeric" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-sm">To sequence (optional)<input className={field} inputMode="numeric" value={to} onChange={e => setTo(e.target.value)} /></label>
      <button className={primary} disabled={busy}>{busy ? "Preparing…" : "Download audit export"}</button>
    </form>
    {rangeError && <Alert>{rangeError}</Alert>}{error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    {last && <div className="space-y-1 text-sm"><p>Exported {last.rows.length} rows{last.head_hash ? `; chain head #${last.head_sequence} ${last.head_hash.slice(0, 16)}…` : ""}.</p>
      <p className="font-semibold">Limits of this evidence</p><ul className="list-disc pl-5">{last.limitations.map(l => <li key={l}>{l}</li>)}{last.external_anchor === null && <li>The chain head is not anchored to any external system, so someone with full database control could rewrite history and recompute every hash.</li>}</ul></div>}
  </section>;
}
