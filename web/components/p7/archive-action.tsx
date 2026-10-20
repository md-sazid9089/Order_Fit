"use client";

import { useState, type FormEvent } from "react";
import { buildRevocation, can, reasonValid, type Permission } from "@/lib/p7-model";
import type { RevisionReason } from "@/lib/generated-api";
import { Alert, danger, field, useCommand, useScoped } from "@/components/p7/common";

/**
 * Archive one record with a reason. The record's own version and the business's financial revision (both as last
 * loaded) are sent, so a concurrent change is a 409 and the list is reloaded rather than overwritten. The control is
 * hidden for roles the API would refuse; the API still authorizes the request itself.
 */
export function ArchiveAction({ noun, permission, record, financialRevision, archive, onChanged, consequence }: {
  noun: string; permission: Permission; record: { version: number; archived_at: string | null }; financialRevision: number | undefined;
  archive: (body: RevisionReason) => Promise<unknown>; onChanged: () => void; consequence: string;
}) {
  const { role } = useScoped();
  const { busy, error, run } = useCommand({ onConflict: onChanged });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (record.archived_at || !can(role, permission) || financialRevision === undefined) return null;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reasonValid(reason) || financialRevision === undefined) return;
    const result = await run(
      () => archive(buildRevocation(record, reason, financialRevision)),
      `${noun.charAt(0).toUpperCase() + noun.slice(1)} archived successfully.`
    );
    if (result.ok) { setOpen(false); setReason(""); onChanged(); }
  }
  return <div className="w-full space-y-2">
    <button type="button" className={danger} aria-expanded={open} onClick={() => setOpen(!open)}>Archive {noun}</button>
    {open && <form onSubmit={submit} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
      <p>{consequence} Records that already use it keep their history. Archiving cannot be undone from this screen.</p>
      <label className="block">Reason (10 to 2000 characters)<textarea className={field} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /></label>
      {error && <Alert>{error}</Alert>}
      <button className={danger} disabled={busy || !reasonValid(reason)}>{busy ? "Archiving…" : `Archive this ${noun}`}</button>
    </form>}
  </div>;
}
