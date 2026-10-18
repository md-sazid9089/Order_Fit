"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, mutate, type Deal, type Evaluation, type Operation, type Session } from "@/lib/orderfit-api";
import { ApprovalWorkflow } from "@/components/approval/approval-workflow";
import { BankChangeHold } from "@/components/p7/bank-hold";
import { messageForCode } from "@/lib/approval-model";
import { WHATIF_BOUNDS, validateWhatIfValue, type WhatIfKind } from "@/lib/p7-model";
import type { AdvisoryExplainRequest, ClauseAssessment, ClauseRequest, DraftPreparationRequest, DraftRevisionRequest, Explanation, ForkRequest, ForkView, ForkSummary, OptionCatalogue, PreparedMessage, PreparationState, ReplyView, PayeeView, Series } from "@/lib/generated-api";
import { Skeleton } from "@/components/ui/skeleton";
import { ProvenanceBadge } from "@/components/provenance-badge";
import { htmlLang, languageNote, stanceDisagreement, textDirection } from "@/lib/provenance-model";
type WhatIfChange = NonNullable<ForkRequest["changes"]>[number];

const input = "block w-full rounded border border-neutral-300 bg-white p-2 text-sm";
const button = "rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-40";
const panel = "space-y-3 rounded-xl border bg-white p-5";

/** A person-readable reason for a failed or blocked operation result (never a JSON dump). */
function describeResult(result: NonNullable<Operation["result"]>): string {
  if (result.kind === "failed") return result.error.message;
  if (result.kind === "blocked") return result.findings.map(f => f.message).join(" ");
  return "";
}

export function PreparationWorkspace({ dealId, businessId: requestedBusiness, operationId: initialOperation }: { dealId: string; businessId?: string; operationId?: string }) {
  const [businessId, setBusinessId] = useState(""); const [role, setRole] = useState("");
  const [deal, setDeal] = useState<Deal | null>(null); const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [state, setState] = useState<PreparationState | null>(null); const [catalogue, setCatalogue] = useState<OptionCatalogue | null>(null);
  const payeePages = useCollection<PayeeView>(`/businesses/${businessId}/payees`, !!businessId);
  const payees = payeePages.items; const [option, setOption] = useState(""); const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const [operationId, setOperationId] = useState(initialOperation ?? ""); const [operation, setOperation] = useState<Operation | null>(null);
  const [kind, setKind] = useState("deposit_pct"); const [value, setValue] = useState("30"); const [valueTouched, setValueTouched] = useState(false); const [instruction, setInstruction] = useState(""); const [typedChanges, setTypedChanges] = useState("");
  const [partyRole, setPartyRole] = useState<DraftPreparationRequest["party_role"]>("customer"); const [partyId, setPartyId] = useState(""); const [recipient, setRecipient] = useState(""); const [offset, setOffset] = useState(0);
  const generation = useRef(0); const canPrepare = ["owner", "risk_officer", "commercial_lead"].includes(role);
  const prefix = `/businesses/${businessId}`;
  const versions = () => ({ expected_version: deal!.version, expected_input_version: deal!.input_version, expected_financial_revision: deal!.financial_revision });

  useEffect(() => {
    let active = true;
    get<Session>("/auth/me").then(s => {
      const membership = s.memberships.find(m => m.business_id === requestedBusiness) ?? (!requestedBusiness ? s.memberships[0] : undefined);
      if (!membership) throw new Error("Select a business from your saved orders.");
      if (active) { setBusinessId(membership.business_id); setRole(membership.role); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [requestedBusiness, dealId]);
  const refresh = useCallback(async () => {
    if (!businessId) return;
    const stamp = ++generation.current;
    const [d, saved] = await Promise.all([get<Deal>(`${prefix}/deals/${dealId}`), get<PreparationState>(`${prefix}/deals/${dealId}/preparation?offset=${offset}`)]);
    const ev = d.live_evaluation_id ? await get<Evaluation>(`${prefix}/evaluations/${d.live_evaluation_id}`) : null;
    const cat = ev ? await get<OptionCatalogue>(`${prefix}/evaluations/${ev.id}/catalogue`) : null;
    if (stamp !== generation.current) return;
    setDeal(d); setState(saved); setEvaluation(ev); setCatalogue(cat);
    setOption(previous => cat?.options.some(o => o.option_key === previous) ? previous : ev?.recommended_option_key ?? ev?.as_is.option_key ?? "");
  }, [businessId, prefix, dealId, offset]);
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [refresh]);
  useEffect(() => {
    if (!evaluation || !option) return;
    let active = true;
    get<Explanation>(`${prefix}/evaluations/${evaluation.id}/explanation?option_key=${encodeURIComponent(option)}`).then(v => { if (active) setExplanation(v); }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [evaluation, option, prefix]);
  function saveOperation(id: string) {
    setOperationId(id); const url = new URL(window.location.href);
    if (id) url.searchParams.set("operationId", id); else url.searchParams.delete("operationId");
    window.history.replaceState(null, "", url);
  }
  useEffect(() => {
    if (!operationId || !businessId) return;
    let active = true; let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const op = await get<Operation>(`${prefix}/operations/${operationId}`); if (!active) return; setOperation(op);
        if (["queued", "running"].includes(op.status)) timer = setTimeout(poll, 800);
        else { await refresh(); saveOperation(""); setNotice(op.status === "failed" ? `Saved operation failed. ${op.result && op.result.kind !== "completed" ? describeResult(op.result) : ""}`.trim() : `Saved operation ${op.status}.`); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Polling failed. Reload to recover the same operation."); }
    };
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [businessId, operationId, prefix, refresh]);
  /** Resolves true only when the request was accepted, so a form clears its fields only after a confirmed save. */
  async function command(work: () => Promise<unknown>): Promise<boolean> {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await refresh(); return true; }
    catch (e) { setError(e instanceof ApiError ? messageForCode(e.code, e.message) : e instanceof Error ? e.message : "Request failed."); if (e instanceof ApiError && e.status === 409) await refresh().catch(() => undefined); return false; }
    finally { setBusy(false); }
  }
  const disabled = busy || !!operationId || !canPrepare;
  const valueCheck = validateWhatIfValue(kind, value);
  async function fork(language = false) {
    if (!evaluation) return;
    let changes: WhatIfChange[] = [];
    if (!language && typedChanges) changes = JSON.parse(typedChanges);
    else if (!language) {
      // Number("") is 0 and Number("2.5") is 2.5; neither is a valid change. Validate the text against the contract bounds first.
      const checked = validateWhatIfValue(kind, value);
      if (!checked.ok) { setValueTouched(true); return; }
      changes = [{ kind, value: checked.value }] as WhatIfChange[];
    }
    const body: ForkRequest = { ...versions(), source_snapshot_id: evaluation.snapshot_id, changes, instruction: language ? instruction : null };
    const op = await mutate<Operation>(`${prefix}/deals/${dealId}/whatifs`, "POST", body); saveOperation(op.operation_id);
  }
  async function askExplanation() {
    if (!evaluation || !option) return;
    const body: AdvisoryExplainRequest = { ...versions(), task: "explanation", evaluation_id: evaluation.id, option_key: option };
    const op = await mutate<Operation>(`${prefix}/deals/${dealId}/explanations`, "POST", body); saveOperation(op.operation_id);
  }
  async function askClause(clauseText: string) {
    if (!evaluation) return;
    const body: ClauseRequest = { ...versions(), task: "clause", evaluation_id: evaluation.id, clause_text: clauseText };
    const op = await mutate<Operation>(`${prefix}/deals/${dealId}/clause-assessments`, "POST", body); saveOperation(op.operation_id);
  }
  async function createDraft() {
    if (!evaluation) return;
    const body: DraftPreparationRequest = { ...versions(), evaluation_id: evaluation.id, option_key: option, party_id: partyRole === "customer" ? deal!.inputs.customer_id! : partyId, party_role: partyRole, recipient, channel: "email" };
    const op = await mutate<Operation>(`${prefix}/deals/${dealId}/drafts`, "POST", body); saveOperation(op.operation_id);
  }
  if (!deal) {
    if (error) {
      return (
        <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
          <div className="max-w-[1560px] mx-auto space-y-6 w-full">
            <Link href="/deals">Saved orders</Link>
            <p role="alert" className="mt-4 rounded bg-red-50 p-3 text-red-800">{error}</p>
          </div>
        </main>
      );
    }
    return (
      <main className="px-4 sm:px-6 lg:px-8 py-6 w-full" role="status" aria-busy="true">
        <div className="max-w-[1560px] mx-auto space-y-6 w-full">
          <span className="sr-only">Loading saved preparation…</span>
          <Skeleton className="h-4 w-52" />
          <Skeleton className="h-8 w-80" />
          <div className="space-y-3 rounded-xl border border-[#ECEAE4] bg-white p-5">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <div className="space-y-2 pt-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full">
        <Link className="underline" href={`/deals/${dealId}?businessId=${businessId}`}>Back to order review and evaluation</Link>
        <h1 className="text-2xl font-bold font-display text-[#1E2021]">Negotiation preparation · {deal.public_ref}</h1>
        <p>All work is saved to your business. Messages are prepared here; only an approved bundle can be executed, and execution is sandbox only: nothing leaves the system.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3">{error}</p>}{notice && <p role="status">{notice}</p>}
    {operation && <div className={panel}><p>Operation: {operation.status} · {operation.subphase}</p>{operation.result && operation.result.kind !== "completed" && <p role="alert" className="text-sm">{operation.result.kind === "failed" ? "The operation failed. This is a technical result, not a financial rejection." : "The operation needs your input before it can finish."} {describeResult(operation.result)}</p>}</div>}
    {!!state?.operations.length && <details className={panel}><summary>Saved operations and response recovery</summary>{state.operations.map(op => <article key={op.operation_id}><p>{op.kind} · {op.status} · {op.operation_id}</p>{["queued", "running"].includes(op.status) && <button className={button} disabled={!!operationId} onClick={() => saveOperation(op.operation_id)}>Resume saved operation polling</button>}{op.result && op.result.kind !== "completed" && <p className="text-xs">{describeResult(op.result)}</p>}</article>)}</details>}
    {deal.findings.filter(f => f.blocking).map(f => <p role="alert" key={f.code} className="rounded bg-red-50 p-3">{f.message}</p>)}
    <BankChangeHold businessId={businessId} deal={deal} replies={state?.replies ?? []} role={role} disabled={busy || !!operationId} onResolved={async () => { await refresh(); setNotice("Bank-change hold cleared with a verified account and written evidence."); }} />
    <button className={button} disabled={disabled} onClick={() => void command(async () => { await mutate(`${prefix}/deals/${dealId}/preparation-settings/reset`, "POST", versions()); setNotice("Applied what-if assumptions cleared. Review and confirm actual sources again."); })}>Clear applied what-if assumptions for review</button>
    {!evaluation || evaluation.is_stale ? <div className={panel}>Confirm and evaluate current inputs from the order review before preparing new proposals. Saved history remains below.</div> : <>
      <section className={panel}><h2 className="text-lg font-semibold">Compare evaluated options</h2><label>Evaluated option<select className={input} value={option} onChange={e => setOption(e.target.value)}>{catalogue?.options.map(o => <option key={o.option_key} value={o.option_key}>{o.option_key} · {o.hard_feasible ? "hard feasible" : "fails hard constraints"} · profit {o.base_incremental_profit_minor} minor units</option>)}</select></label><p>{catalogue?.options.length ?? 0} computed options · {deal.currency} minor units · calculator {evaluation.calculator_version}</p><ul className="list-disc pl-5">{(explanation?.evaluation_id === evaluation.id && explanation.option_key === option ? explanation.sentences : []).map(line => <li key={line}>{line}</li>)}</ul><p className="text-sm">Explanation provenance: {explanation ? <ProvenanceBadge kind={explanation.provenance} model={explanation.model} /> : "loading"}</p><p className="text-xs text-neutral-600">Figures always come from the stored engine result. A model may only word the text around named slots; a number, loan term or unsupported claim from it is discarded and this template stays.</p><button className={button} disabled={disabled || !option} onClick={() => void command(askExplanation)}>Ask AI to word this explanation</button>{option && <StoredSeries businessId={businessId} evaluationId={evaluation.id} option={option} />}</section>
      <section className={panel}><h2 className="text-lg font-semibold">Explore a separate what-if</h2><p>A fork changes no confirmed inputs. Apply explicitly, then review, confirm and evaluate again.</p>
        <label>Change<select className={input} value={kind} onChange={e => { setKind(e.target.value); setValueTouched(true); }}><option value="deposit_pct">Deposit percentage</option><option value="customer_delay_days">Downside customer delay days</option><option value="ar_delay_days">Downside receivables delay days</option><option value="cost_overrun_bps">Downside cost overrun basis points</option></select></label><label>Value ({WHATIF_BOUNDS[kind as WhatIfKind].unit}, whole number {WHATIF_BOUNDS[kind as WhatIfKind].min} to {WHATIF_BOUNDS[kind as WhatIfKind].max})<input className={input} type="number" inputMode="numeric" step="1" min={WHATIF_BOUNDS[kind as WhatIfKind].min} max={WHATIF_BOUNDS[kind as WhatIfKind].max} value={value} aria-invalid={valueTouched && !valueCheck.ok} aria-describedby="whatif-value-error" onChange={e => { setValue(e.target.value); setValueTouched(true); }} /></label>{valueTouched && !valueCheck.ok && !typedChanges && <p id="whatif-value-error" role="alert" className="text-sm text-red-700">{valueCheck.message}</p>}
        <details><summary>Advanced typed changes: supplier extension or financing</summary><p>Use existing eligible_cost_keys, extension days, offer UUID and valid draw grid. New offer terms are rejected.</p><textarea className={input} aria-label="Typed changes JSON" value={typedChanges} onChange={e => setTypedChanges(e.target.value)} placeholder={'[{"kind":"financing","offer_id":"…","amount_minor":"…"}]'} /></details>
        <button className={button} disabled={disabled || (!typedChanges && !valueCheck.ok)} onClick={() => void command(() => fork())}>Run typed fork</button><label>Ask a what-if<input className={input} placeholder="deposit 30% or customer delay 15 days" value={instruction} onChange={e => setInstruction(e.target.value)} /></label><button className={button} disabled={disabled || !instruction.trim()} onClick={() => void command(() => fork(true))}>Propose and run language fork</button>
      </section>
      <ClausePanel assessments={state?.clause_assessments ?? []} disabled={disabled} currency={deal.currency} ask={text => command(() => askClause(text))} />
      <section className={panel}><h2 className="text-lg font-semibold">Prepare an exact message</h2><p>Select the party and enter the recipient yourself. Unknown domains block review. These drafts remain unsent.</p><label>Party role<select className={input} value={partyRole} onChange={e => { setPartyRole(e.target.value as typeof partyRole); setPartyId(""); }}><option value="customer">Customer</option><option value="supplier">Supplier</option><option value="lender">Lender</option></select></label>{partyRole !== "customer" && <label>Party<select className={input} value={partyId} onChange={e => setPartyId(e.target.value)}><option value="">Choose a party in this option</option>{payees.filter(p => p.payee.kind === partyRole).map(p => <option key={p.id} value={p.id}>{p.payee.name}</option>)}</select></label>}<label>Exact recipient email<input type="email" className={input} value={recipient} onChange={e => setRecipient(e.target.value)} /></label><button className={button} disabled={disabled || !option || !recipient || !catalogue?.options.some(o => o.option_key === option && o.hard_feasible && o.parameters.kind === "accept") || (partyRole !== "customer" && !partyId)} onClick={() => void command(createDraft)}>Prepare draft</button></section>
    </>}
    <section className={panel}><h2 className="text-lg font-semibold">Saved what-if comparisons</h2>{!state?.forks.length && <p>No saved forks.</p>}{state?.forks.map(f => <ForkCard key={f.id} fork={f} businessId={businessId} disabled={disabled} apply={() => command(async () => { await mutate(`${prefix}/whatifs/${f.id}/apply`, "POST", versions()); setNotice("Fork applied for review. Confirm and evaluate from the order page."); })} />)}</section>
    <section className={panel}><h2 className="text-lg font-semibold">Message revisions and human review</h2>{!state?.messages.length && <p>No prepared messages.</p>}{state?.messages.map(m => <MessageCard key={m.identity.message_id} message={m} disabled={disabled} replies={state.replies}
      onEdit={data => command(async () => { await mutate(`${prefix}/messages/${m.identity.message_id}`, "PATCH", { ...versions(), ...data }); })}
      onReview={attestation => command(async () => { await mutate(`${prefix}/messages/${m.identity.message_id}/review`, "POST", { ...versions(), preparation_hash: m.preparation_hash, attestation }); })}
      onReply={body => command(async () => { const op = await mutate<Operation>(`${prefix}/deals/${dealId}/replies`, "POST", { ...versions(), ask_message_id: m.identity.message_id, party_id: m.identity.party_id, body }); saveOperation(op.operation_id); })}
      onAcceptance={(attestation, valid_until, reply_id) => command(async () => { await mutate(`${prefix}/deals/${dealId}/acceptances`, "POST", { ...versions(), message_id: m.identity.message_id, preparation_hash: m.preparation_hash, reply_id: reply_id || null, attestation, valid_until, supersedes_id: null }); })} />)}</section>
    <section className={panel}><h2 className="text-lg font-semibold">Incoming replies: review candidates</h2>{!state?.replies.length && <p>No incoming replies.</p>}{state?.replies.map(r => <ReplyCard key={r.id} reply={r} disabled={disabled} review={(candidate_ids, decision, reason) => command(async () => { await mutate(`${prefix}/deals/${dealId}/replies/${r.id}/review`, "POST", { ...versions(), candidate_ids, decision, reason }); setNotice(decision === "apply" ? "Reply applied for confirmation and reassessment." : "Reply rejected; original evidence retained."); })} />)}</section>
    <section className={panel}><h2 className="text-lg font-semibold">Party acceptance evidence</h2><p>Human attestations only; agreement does not establish receipt of cash or funding.</p>{!state?.acceptances.length && <p>No recorded acceptances.</p>}{state?.acceptances.map(a => <article key={a.id} className="border-t pt-3"><p>{a.party_role} · {a.is_stale ? "stale" : "current"} · expires {a.valid_until}</p><p>{a.attestation}</p><code className="break-all text-xs">Terms {a.terms_hash}</code></article>)}</section>
    <ApprovalWorkflow key={`${businessId}:${deal.id}`} businessId={businessId} deal={deal} evaluation={evaluation} option={catalogue?.options.find(o => o.option_key === option)} messages={state?.messages ?? []} canPrepare={canPrepare} onChanged={refresh} />
    <CollectionPages query={payeePages} noun="payees" /><div className="flex flex-wrap gap-3"><button className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous history</button><button className={button} disabled={!state?.has_more} onClick={() => setOffset(offset+50)}>More history</button><button className={button} onClick={() => void command(refresh)}>Refresh saved preparation</button></div>
      </div>
    </main>
  );
}

function ForkCard({ fork, businessId, disabled, apply }: { fork: ForkSummary; businessId: string; disabled: boolean; apply: () => Promise<boolean> }) {
  const [full, setFull] = useState<ForkView | null>(null); const [loadError, setLoadError] = useState("");
  return <article className="space-y-2 border-t pt-4"><p>Fork {fork.id} · {fork.is_stale ? "stale" : "current"} · <ProvenanceBadge kind={fork.provenance} /> {fork.language_code}</p>{fork.clarification && <p role="status" className="rounded bg-amber-50 p-2 text-sm">The assistant needs clarification and ran nothing: {fork.clarification}</p>}<pre className="overflow-auto text-xs">{JSON.stringify(fork.changes)}</pre>{"decision" in fork.outcome ? <><table className="w-full text-left text-sm"><thead><tr><th>Result</th><th>Source</th><th>Fork</th></tr></thead><tbody><tr><td>Decision</td><td>{fork.source_result.decision}</td><td>{fork.outcome.decision}</td></tr><tr><td>Recommendation</td><td>{fork.source_result.recommended_option_key ?? "none"}</td><td>{fork.outcome.recommended_option_key ?? "none"}</td></tr><tr><td>As offered profit, minor units</td><td>{fork.source_result.as_is.base_incremental_profit_minor}</td><td>{fork.outcome.as_is.base_incremental_profit_minor}</td></tr></tbody></table><details onToggle={event => { if (event.currentTarget.open && !full) get<ForkView>(`/businesses/${businessId}/whatifs/${fork.id}`).then(setFull).catch(e => setLoadError(e.message)); }}><summary>Full deterministic comparison and saved series</summary><pre className="max-h-80 overflow-auto text-xs">{full ? JSON.stringify({ outcome: full.outcome, series: full.series }, null, 2) : loadError || "Loading saved comparison…"}</pre></details></> : <pre>{JSON.stringify(fork.outcome)}</pre>}<button className={button} disabled={disabled || fork.is_stale || !("decision" in fork.outcome)} onClick={() => void apply()}>Apply fork for confirmation</button></article>;
}

function MessageCard({ message, disabled, onEdit, onReview, onReply, onAcceptance, replies }: { message: PreparedMessage; disabled: boolean; onEdit: (data: Omit<DraftRevisionRequest, "expected_version" | "expected_input_version" | "expected_financial_revision">) => Promise<boolean>; onReview: (s: string) => Promise<boolean>; onReply: (s: string) => Promise<boolean>; onAcceptance: (s: string, until: string, reply: string) => Promise<boolean>; replies: readonly ReplyView[] }) {
  const m = message.identity;
  const [body, setBody] = useState(m.body); const [subject, setSubject] = useState(m.subject); const [recipient, setRecipient] = useState(m.recipient);
  const [attestation, setAttestation] = useState(""); const [reply, setReply] = useState(""); const [acceptance, setAcceptance] = useState(""); const [expiry, setExpiry] = useState(""); const [evidenceReply, setEvidenceReply] = useState("");
  return <article className="space-y-3 border-t pt-4"><h3 className="font-semibold">{m.party_role} · revision {m.revision} · {message.is_stale ? "stale" : message.reviewed ? "reviewed" : "needs review"}</h3><p><ProvenanceBadge kind={message.provenance} /> prepared only; it reaches the sandbox solely through an approved bundle</p><p className="text-red-700">{message.blockers.join(", ")}</p><code className="block break-all text-xs">Preparation {message.preparation_hash}</code><details><summary>Inspect exact terms and source identity</summary><pre className="max-h-80 overflow-auto text-xs">{JSON.stringify(m, null, 2)}</pre></details>
    <label>Prepared subject<select className={input} value={subject} onChange={e => setSubject(e.target.value)}><option>Proposed order terms for review</option><option>Revised order terms for review</option></select></label><label>Prepared recipient<input className={input} value={recipient} onChange={e => setRecipient(e.target.value)} /></label><label>Exact prepared body<textarea className={`${input} min-h-60`} value={body} onChange={e => setBody(e.target.value)} /></label><p className="text-sm">Term lines must remain exact. Editable courtesy sentences: {message.edit_sentences.join(" · ")}</p>
    <button className={button} disabled={disabled || message.is_stale || (body === m.body && subject === m.subject && recipient === m.recipient)} onClick={() => void onEdit({ evaluation_id: m.evaluation_id, option_key: m.option.option_key, party_id: m.party_id, party_role: m.party_role, recipient, channel: m.channel, expected_preparation_hash: message.preparation_hash, subject, body })}>Save new message revision</button>
    <label>Review attestation<input className={input} value={attestation} onChange={e => setAttestation(e.target.value)} placeholder="I reviewed the exact content, recipient and terms." /></label><button className={button} disabled={disabled || message.reviewed || !!message.blockers.length || attestation.trim().length < 10 || body !== m.body || subject !== m.subject || recipient !== m.recipient} onClick={() => void onReview(attestation).then(ok => { if (ok) setAttestation(""); })}>Record exact preparation review</button>
    <details><summary>Record an incoming reply to this ask</summary><label>Original reply text<textarea className={input} value={reply} onChange={e => setReply(e.target.value)} /></label><button className={button} disabled={disabled || !reply.trim()} onClick={() => void onReply(reply).then(ok => { if (ok) setReply(""); })}>Save reply and propose candidates</button></details>
    <details><summary>Record exact-term party acceptance evidence</summary><label>Acceptance attestation<textarea className={input} value={acceptance} onChange={e => setAcceptance(e.target.value)} /></label><label>Valid until (your local time)<input type="datetime-local" className={input} value={expiry} onChange={e => setExpiry(e.target.value)} /></label><label>Supporting reply, if any<select className={input} value={evidenceReply} onChange={e => setEvidenceReply(e.target.value)}><option value="">Manual attestation</option>{replies.filter(r => r.ask_message_id === m.message_id).map(r => <option key={r.id} value={r.id}>{r.body.slice(0, 80)}</option>)}</select></label><button className={button} disabled={disabled || !message.reviewed || !!message.blockers.length || acceptance.trim().length < 10 || !expiry} onClick={() => void onAcceptance(acceptance, new Date(expiry).toISOString(), evidenceReply).then(ok => { if (ok) { setAcceptance(""); setExpiry(""); setEvidenceReply(""); } })}>Record party attestation</button></details>
  </article>;
}

function ReplyCard({ reply, disabled, review }: { reply: ReplyView; disabled: boolean; review: (ids: string[], decision: "apply" | "reject", reason: string) => Promise<boolean> }) {
  const [selected, setSelected] = useState<string[]>([]); const [reason, setReason] = useState("");
  return <article className="space-y-3 border-t pt-4"><p>{reply.reviewed ? "Reviewed" : "Unreviewed"} · <ProvenanceBadge kind={reply.provenance} model={reply.language_model} />{languageNote(reply.language_code, reply.language_script) ? ` · language: ${languageNote(reply.language_code, reply.language_script)!.text}` : ""}</p><blockquote dir={textDirection(reply.language_code)} lang={htmlLang(reply.language_code)} className="script-text whitespace-pre-wrap border-l-4 pl-3">{reply.body}</blockquote>{!!reply.conditions?.length && <div className="rounded bg-amber-50 p-2 text-sm"><p className="font-medium">Conditions found in the reply (the reply is not an unconditional agreement):</p><ul className="list-disc pl-5">{reply.conditions.map(q => <li key={q}><q dir="auto">{q}</q></li>)}</ul></div>}{!!reply.unsupported_clauses?.length && <div className="rounded bg-amber-50 p-2 text-sm"><p className="font-medium">Clauses the supported terms cannot express (review the original):</p><ul className="list-disc pl-5">{reply.unsupported_clauses.map(q => <li key={q}><q dir="auto">{q}</q></li>)}</ul></div>}{stanceDisagreement(reply.model_stance, reply.baseline_stance, reply.stance_disagreement) && <p role="status" className="rounded bg-amber-50 p-2 text-sm">{stanceDisagreement(reply.model_stance, reply.baseline_stance, reply.stance_disagreement)}</p>}{reply.bank_change && <p className="text-red-700">Bank-change blocker: separate verification required. Dispatch is blocked.</p>}{!reply.language_supported && <p className="text-red-700">Unsupported or mixed reply language: manual review hold required.</p>}{reply.injection_flagged && reply.language_supported && <p>Suspicious instructions found; manual source review required.</p>}{reply.candidates.map(c => <label className="block" key={c.id}><input type="checkbox" disabled={reply.reviewed} checked={selected.includes(c.id)} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} /> {c.field}: {c.value} · quote: <q dir="auto" lang={htmlLang(reply.language_code)} className="script-text">{c.quote}</q></label>)}{!reply.candidates.length && <p>No supported terms found. Use typed source review; the reply changed no inputs.</p>}<label>Review reason<input className={input} value={reason} onChange={e => setReason(e.target.value)} /></label><button className={button} disabled={disabled || reply.reviewed || reply.bank_change || reply.injection_flagged || !selected.length || reason.trim().length < 10} onClick={() => void review(selected, "apply", reason).then(ok => { if (ok) { setSelected([]); setReason(""); } })}>Apply reviewed candidates for confirmation</button>{" "}<button className={button} disabled={disabled || reply.reviewed || reason.trim().length < 10} onClick={() => void review([], "reject", reason).then(ok => { if (ok) { setSelected([]); setReason(""); } })}>Reject candidates and retain evidence</button></article>;
}

function StoredSeries({ businessId, evaluationId, option }: { businessId: string; evaluationId: string; option: string }) {
  const [scenario, setScenario] = useState("base"); const [series, setSeries] = useState("");
  useEffect(() => { let active = true; get<Series>(`/businesses/${businessId}/evaluations/${evaluationId}/series?scenario=${scenario}&option_key=${encodeURIComponent(option)}`).then(s => { if (active) setSeries(JSON.stringify(s, null, 2)); }).catch(e => { if (active) setSeries(e.message); }); return () => { active = false; }; }, [businessId, evaluationId, option, scenario]);
  return <details><summary>Inspect stored daily cash series</summary><label>Scenario<select className={input} value={scenario} onChange={e => setScenario(e.target.value)}>{["base", "downside", "severe"].map(s => <option key={s}>{s}</option>)}</select></label><pre className="max-h-72 overflow-auto text-xs">{series}</pre></details>;
}

function ClausePanel({ assessments, disabled, currency, ask }: { assessments: readonly ClauseAssessment[]; disabled: boolean; currency: string; ask: (text: string) => Promise<boolean> }) {
  const [text, setText] = useState("");
  return <section className={panel}><h2 className="text-lg font-semibold">Does an unclear payment clause matter?</h2>
    <p>Paste a payment clause whose start event or day count is unclear (for example “Net 45”). The assistant proposes alternative readings; the engine tests each on an isolated copy. Readings are hypotheses: they never change your confirmed inputs. You are asked only if the recommendation would change.</p>
    <label>Clause text<textarea dir="auto" className={`${input} script-text`} value={text} onChange={e => setText(e.target.value)} maxLength={2000} /></label>
    <button className={button} disabled={disabled || text.trim().length < 3} onClick={() => void ask(text.trim()).then(ok => { if (ok) setText(""); })}>Check the clause readings</button>
    {!assessments.length && <p className="text-sm">No clause checks yet.</p>}
    {assessments.map(a => <article key={a.id} className="space-y-2 border-t pt-3">
      <p>{a.is_stale ? "Stale: inputs changed since this check" : "Current"} · <ProvenanceBadge kind={a.provenance} model={a.model} />{a.code ? ` · ${a.code}` : ""} · hypotheses only</p>
      <blockquote dir="auto" className="script-text whitespace-pre-wrap border-l-4 pl-3">{a.clause_text}</blockquote>
      <table className="w-full text-left text-sm"><thead><tr><th>Reading</th><th>Decision</th><th>Recommended option</th><th>Profit ({currency} minor units)</th></tr></thead><tbody>
        <tr><td>As confirmed</td><td>{a.confirmed.decision ?? "not evaluable"}</td><td>{a.confirmed.recommended_option_key ?? "none"}</td><td>{a.confirmed.recommended_profit_minor ?? "n/a"}</td></tr>
        {a.readings.map(r => <tr key={r.reading?.label ?? "x"}><td>{r.reading?.label}<br /><q dir="auto" className="script-text text-xs">{r.reading?.quote}</q></td><td>{r.evaluable ? r.decision : `not evaluable (${r.code})`}</td><td>{r.recommended_option_key ?? "none"}</td><td>{r.recommended_profit_minor ?? "n/a"}</td></tr>)}
      </tbody></table>
      {a.decision_changes && a.question ? <p role="status" className="whitespace-pre-wrap rounded bg-amber-50 p-3 text-sm">{a.question}</p> : <p className="text-sm">{a.readings.length ? "The recommendation does not change under these readings, so no question is needed." : "No alternative readings were found."}</p>}
    </article>)}
  </section>;
}
