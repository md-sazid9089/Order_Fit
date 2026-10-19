"use client";

import { useState, type FormEvent } from "react";
import { buildCashEventCorrection, buildRevocation, can, cashEventDraftErrors, cashEventDraftOf, reasonValid, type CashEventDraft } from "@/lib/p7-model";
import { correctCashEvent, voidCashEvent } from "@/lib/p7-api";
import type { CashEventView } from "@/lib/generated-api";
import { Alert, button, danger, field, primary, useCommand, useScoped } from "@/components/p7/common";

const KINDS = ["payroll", "rent", "tax", "ap_payment", "ar_collection", "loan_installment", "supplier_payment", "labour", "freight", "subcontract", "existing_inventory", "other"] as const;
type Mode = "closed" | "correct" | "void";

/**
 * Correct or void one baseline cash event. A correction is a new revision with its own source attestation; a void keeps
 * the original row and records the reason. Both send the event's version and the business's current financial revision,
 * so a concurrent change is rejected with a 409 rather than overwritten. Risk officers and owners only; the API checks again.
 */
export function CashEventActions({ event, financialRevision, onChanged }: { event: CashEventView; financialRevision: number; onChanged: () => void }) {
  const { businessId, role } = useScoped();
  const [mode, setMode] = useState<Mode>("closed");
  if (!can(role, "manage_finance") || event.voided_at) return null;
  const close = () => setMode("closed");
  return <div className="w-full space-y-2">
    <div className="flex gap-2"><button type="button" className={button} aria-expanded={mode === "correct"} onClick={() => setMode(mode === "correct" ? "closed" : "correct")}>Correct</button><button type="button" className={danger} aria-expanded={mode === "void"} onClick={() => setMode(mode === "void" ? "closed" : "void")}>Void</button></div>
    {mode === "correct" && <CorrectForm key={`${event.id}:${event.version}`} businessId={businessId} event={event} financialRevision={financialRevision} onDone={() => { close(); onChanged(); }} onConflict={onChanged} />}
    {mode === "void" && <VoidForm key={`${event.id}:${event.version}:void`} businessId={businessId} event={event} financialRevision={financialRevision} onDone={() => { close(); onChanged(); }} onConflict={onChanged} />}
  </div>;
}

function CorrectForm({ businessId, event, financialRevision, onDone, onConflict }: { businessId: string; event: CashEventView; financialRevision: number; onDone: () => void; onConflict: () => void }) {
  const { busy, error, run } = useCommand({ onConflict });
  const [draft, setDraft] = useState<CashEventDraft>(cashEventDraftOf(event));
  const [touched, setTouched] = useState(false);
  const errors = cashEventDraftErrors(draft);
  const set = (patch: Partial<CashEventDraft>) => setDraft({ ...draft, ...patch });
  const kinds: readonly string[] = (KINDS as readonly string[]).includes(draft.kind) ? KINDS : [draft.kind, ...KINDS];
  const shown = (name: keyof CashEventDraft) => touched && errors[name] ? <span role="alert" className="block text-xs text-red-700">{errors[name]}</span> : null;
  async function submit(e: FormEvent) {
    e.preventDefault(); setTouched(true);
    if (Object.keys(errors).length) return;
    const result = await run(() => correctCashEvent(businessId, event.id, buildCashEventCorrection(event, draft, financialRevision)));
    if (result.ok) onDone();
  }
  return <form onSubmit={submit} className="grid gap-2 rounded-lg border bg-neutral-50 p-3 text-sm sm:grid-cols-2" noValidate>
    <p className="sm:col-span-2 text-xs text-neutral-600">Saving creates a corrected revision of this event with your attestation as its source, and makes existing evaluations require review.</p>
    <label>Event date<input type="date" className={field} value={draft.event_date} onChange={e => set({ event_date: e.target.value })} />{shown("event_date")}</label>
    <label>Amount (positive whole minor units)<input inputMode="numeric" className={field} value={draft.amount_minor} onChange={e => set({ amount_minor: e.target.value })} />{shown("amount_minor")}</label>
    <label>Kind<select className={field} value={draft.kind} onChange={e => set({ kind: e.target.value as CashEventDraft["kind"] })}>{kinds.map(k => <option key={k} value={k}>{k.replaceAll("_", " ")}</option>)}</select></label>
    <label>Direction<select className={field} value={draft.direction} onChange={e => set({ direction: e.target.value as CashEventDraft["direction"] })}><option value="out">Payment out</option><option value="in">Receipt in</option></select>{shown("direction")}</label>
    <label>Certainty<select className={field} value={draft.certainty} onChange={e => set({ certainty: e.target.value as CashEventDraft["certainty"] })}><option value="confirmed">Confirmed</option><option value="expected">Expected</option><option value="assumed">Assumed</option></select></label>
    <label>Description<input className={field} maxLength={500} value={draft.description} onChange={e => set({ description: e.target.value })} />{shown("description")}</label>
    <label className="sm:col-span-2">Source of this correction<input className={field} value={draft.attestation} onChange={e => set({ attestation: e.target.value })} placeholder="For example: bank statement of 3 March, line 14" />{shown("attestation")}</label>
    {error && <div className="sm:col-span-2"><Alert>{error}</Alert></div>}
    <div className="sm:col-span-2"><button className={primary} disabled={busy}>{busy ? "Saving…" : "Save correction"}</button></div>
  </form>;
}

function VoidForm({ businessId, event, financialRevision, onDone, onConflict }: { businessId: string; event: CashEventView; financialRevision: number; onDone: () => void; onConflict: () => void }) {
  const { busy, error, run } = useCommand({ onConflict });
  const [reason, setReason] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reasonValid(reason)) return;
    const result = await run(() => voidCashEvent(businessId, event.id, buildRevocation(event, reason, financialRevision)));
    if (result.ok) onDone();
  }
  return <form onSubmit={submit} className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm">
    <p>Voiding removes this event from the baseline used by evaluations. The record and your reason stay in the audit trail, and existing evaluations will need review. It cannot be undone here.</p>
    <label className="block">Reason (10 to 2000 characters)<textarea className={field} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /></label>
    {error && <Alert>{error}</Alert>}
    <button className={danger} disabled={busy || !reasonValid(reason)}>{busy ? "Voiding…" : "Void this event"}</button>
  </form>;
}
