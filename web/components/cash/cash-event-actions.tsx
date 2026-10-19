"use client";

import { DuplicateReviewFields } from "./duplicate-review-fields";
import { get, mutate } from "@/lib/orderfit-api";
import type { CashEventDuplicates } from "@/lib/generated-api";
import { useEffect } from "react";
import { MoneyField } from "@/components/system/money-field";
import { useState, type FormEvent } from "react";
import { buildCashEventCorrection, buildRevocation, can, cashEventDraftErrors, cashEventDraftOf, reasonValid, type CashEventDraft } from "@/lib/p7-model";
import { correctCashEvent, voidCashEvent } from "@/lib/p7-api";
import type { CashEventView } from "@/lib/generated-api";
import { Alert, button, danger, field, primary, useCommand, useScoped } from "@/components/p7/common";

const KINDS = ["payroll", "rent", "tax", "ap_payment", "ar_collection", "loan_installment", "supplier_payment", "labour", "freight", "subcontract", "existing_inventory", "other"] as const;
type Mode = "closed" | "correct" | "void" | "duplicates";

/**
 * Correct or void one baseline cash event. A correction is a new revision with its own source attestation; a void keeps
 * the original row and records the reason. Both send the event's version and the business's current financial revision,
 * so a concurrent change is rejected with a 409 rather than overwritten. Risk officers and owners only; the API checks again.
 */
export function CashEventActions({ currency, event, financialRevision, onChanged }: { currency: string; event: CashEventView; financialRevision: number; onChanged: () => void }) {
  const { businessId, role } = useScoped();
  const [mode, setMode] = useState<Mode>("closed");
  if (!can(role, "manage_finance") || event.voided_at) return null;
  const close = () => setMode("closed");
  return <div className="w-full space-y-2">
    <div className="flex flex-wrap gap-2"><button type="button" className={button} aria-expanded={mode === "correct"} onClick={() => setMode(mode === "correct" ? "closed" : "correct")}>Correct</button><button type="button" className={danger} aria-expanded={mode === "void"} onClick={() => setMode(mode === "void" ? "closed" : "void")}>Void</button><button type="button" className={button} aria-expanded={mode === "duplicates"} onClick={() => setMode(mode === "duplicates" ? "closed" : "duplicates")}>Review matching events</button></div>
    {mode === "duplicates" && <SavedDuplicateReview businessId={businessId} eventId={event.id} currency={currency} onDone={() => { close(); onChanged(); }} />}
    {mode === "correct" && <CorrectForm currency={currency} key={`${event.id}:${event.version}`} businessId={businessId} event={event} financialRevision={financialRevision} onDone={() => { close(); onChanged(); }} onConflict={onChanged} />}
    {mode === "void" && <VoidForm key={`${event.id}:${event.version}:void`} businessId={businessId} event={event} financialRevision={financialRevision} onDone={() => { close(); onChanged(); }} onConflict={onChanged} />}
  </div>;
}

function CorrectForm({ currency, businessId, event, financialRevision, onDone, onConflict }: { currency: string; businessId: string; event: CashEventView; financialRevision: number; onDone: () => void; onConflict: () => void }) {
  const { busy, error, run } = useCommand({ onConflict });
  const [draft, setDraft] = useState<CashEventDraft>(cashEventDraftOf(event));
  const [touched, setTouched] = useState(false);
  const errors = cashEventDraftErrors(draft);
  const set = (patch: Partial<CashEventDraft>) => setDraft({ ...draft, ...patch });
  const kinds: readonly string[] = (KINDS as readonly string[]).includes(draft.kind) ? KINDS : [draft.kind, ...KINDS];
  const shown = (name: keyof CashEventDraft) => touched && errors[name] ? <span role="alert" className="block text-xs text-danger">{errors[name]}</span> : null;
  async function submit(e: FormEvent) {
    e.preventDefault(); setTouched(true);
    if (Object.keys(errors).length) return;
    const result = await run(() => correctCashEvent(businessId, event.id, buildCashEventCorrection(event, draft, financialRevision)));
    if (result.ok) onDone();
  }
  return <form onSubmit={submit} className="grid gap-2 rounded-lg border bg-muted p-3 text-sm sm:grid-cols-2" noValidate>
    <p className="sm:col-span-2 text-xs text-muted-foreground">Saving creates a corrected revision of this event with your attestation as its source, and makes existing evaluations require review.</p>
    <label>Event date<input type="date" className={field} value={draft.event_date} onChange={e => set({ event_date: e.target.value })} />{shown("event_date")}</label>
    <div><MoneyField label="Amount" currency={currency} allowZero={false} valueMinor={draft.amount_minor} onChangeMinor={amount_minor => set({ amount_minor })} />{shown("amount_minor")}</div>
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
  return <form onSubmit={submit} className="space-y-2 rounded-lg border border-red-200 bg-danger-soft p-3 text-sm">
    <p>Voiding removes this event from the baseline used by evaluations. The record and your reason stay in the audit trail, and existing evaluations will need review. It cannot be undone here.</p>
    <label className="block">Reason (10 to 2000 characters)<textarea className={field} value={reason} maxLength={2000} onChange={e => setReason(e.target.value)} /></label>
    {error && <Alert>{error}</Alert>}
    <button className={danger} disabled={busy || !reasonValid(reason)}>{busy ? "Voiding…" : "Void this event"}</button>
  </form>;
}

function SavedDuplicateReview({ businessId, eventId, currency, onDone }: { businessId: string; eventId: string; currency: string; onDone: () => void }) {
  const [matches, setMatches] = useState<CashEventDuplicates | null>(null);
  const [reason, setReason] = useState("");
  const { busy, error, run } = useCommand();
  useEffect(() => { void run(async () => setMatches(await get<CashEventDuplicates>(`/businesses/${businessId}/cash-events/${eventId}/duplicates`))); }, [businessId, eventId, run]);
  return <div className="space-y-3">{error && <Alert>{error}</Alert>}{matches ? matches.matching_events.length ? <><DuplicateReviewFields matches={[matches.event, ...matches.matching_events]} currency={currency} reason={reason} onReason={setReason} /><button type="button" className={primary} disabled={busy || reason.trim().length < 12} onClick={() => { void run(async () => { await mutate(`/businesses/${businessId}/cash-events/${eventId}/duplicate-review`, "POST", { expected_version: matches.version, expected_financial_revision: matches.financial_revision, duplicate_review: { matching_event_ids: matches.matching_events.map(match => match.id), reason: reason.trim() } }); onDone(); }); }}>Confirm distinct saved obligations</button></> : <p>No unresolved matching obligations for this event.</p> : <p role="status">Loading matching obligations…</p>}</div>;
}
