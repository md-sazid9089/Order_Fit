"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, get, mutate, type Deal, type Evaluation, type Operation, type Session } from "@/lib/orderfit-api";
import { ApprovalWorkflow } from "@/components/approval/approval-workflow";
import { BankChangeHold } from "@/components/p7/bank-hold";
import { messageForCode } from "@/lib/approval-model";
import { WHATIF_BOUNDS, validateWhatIfValue, type WhatIfKind } from "@/lib/p7-model";
import type { DraftPreparationRequest, DraftRevisionRequest, Explanation, ForkRequest, ForkView, ForkSummary, OptionCatalogue, PreparedMessage, PreparationState, ReplyView, PayeeView, Series } from "@/lib/generated-api";
type WhatIfChange = NonNullable<ForkRequest["changes"]>[number];

const input = "block w-full rounded border border-neutral-300 bg-white p-2 text-sm";
const button = "rounded border border-neutral-400 px-3 py-2 text-sm disabled:opacity-40";
const panel = "space-y-3 rounded-xl border bg-white p-5";

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
        else { await refresh(); saveOperation(""); setNotice(`Saved operation ${op.status}.`); }
      } catch (e) { if (active) setError(e instanceof Error ? e.message : "Polling failed. Reload to recover the same operation."); }
    };
    void poll(); return () => { active = false; clearTimeout(timer); };
  }, [businessId, operationId, prefix, refresh]);
  async function command(work: () => Promise<unknown>) {
    setBusy(true); setError(""); setNotice("");
    try { await work(); await refresh(); }
    catch (e) { setError(e instanceof ApiError ? messageForCode(e.code, e.message) : e instanceof Error ? e.message : "Request failed."); if (e instanceof ApiError && e.status === 409) await refresh().catch(() => undefined); }
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
  async function createDraft() {
    if (!evaluation) return;
    const body: DraftPreparationRequest = { ...versions(), evaluation_id: evaluation.id, option_key: option, party_id: partyRole === "customer" ? deal!.inputs.customer_id! : partyId, party_role: partyRole, recipient, channel: "email" };
    const op = await mutate<Operation>(`${prefix}/deals/${dealId}/drafts`, "POST", body); saveOperation(op.operation_id);
  }
  if (!deal) return <main className="p-8"><Link href="/deals">Saved orders</Link><p role={error ? "alert" : undefined}>{error || "Loading saved preparation…"}</p></main>;
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <Link className="underline" href={`/deals/${dealId}?businessId=${businessId}`}>Back to order review and evaluation</Link>
    <h1 className="text-2xl font-semibold">Negotiation preparation · {deal.public_ref}</h1><p>All work is saved to your business. Messages are prepared here; only an approved bundle can be executed, and execution is sandbox only: nothing leaves the system.</p>
    {error && <p role="alert" className="rounded bg-red-50 p-3">{error}</p>}{notice && <p role="status">{notice}</p>}
    {operation && <div className={panel}><p>Operation: {operation.status} · {operation.subphase}</p>{operation.result && operation.result.kind !== "completed" && <pre className="whitespace-pre-wrap text-sm">{JSON.stringify(operation.result, null, 2)}</pre>}</div>}
    {!!state?.operations.length && <details className={panel}><summary>Saved operations and response recovery</summary>{state.operations.map(op => <article key={op.operation_id}><p>{op.kind} · {op.status} · {op.operation_id}</p>{["queued", "running"].includes(op.status) && <button className={button} disabled={!!operationId} onClick={() => saveOperation(op.operation_id)}>Resume saved operation polling</button>}{op.result && op.result.kind !== "completed" && <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(op.result, null, 2)}</pre>}</article>)}</details>}
    {deal.findings.filter(f => f.blocking).map(f => <p role="alert" key={f.code} className="rounded bg-red-50 p-3">{f.code}: {f.message}</p>)}
    <BankChangeHold businessId={businessId} deal={deal} replies={state?.replies ?? []} role={role} disabled={busy || !!operationId} onResolved={async () => { await refresh(); setNotice("Bank-change hold cleared with a verified account and written evidence."); }} />
    <button className={button} disabled={disabled} onClick={() => void command(async () => { await mutate(`${prefix}/deals/${dealId}/preparation-settings/reset`, "POST", versions()); setNotice("Applied what-if assumptions cleared. Review and confirm actual sources again."); })}>Clear applied what-if assumptions for review</button>
    {!evaluation || evaluation.is_stale ? <div className={panel}>Confirm and evaluate current inputs from the order review before preparing new proposals. Saved history remains below.</div> : <>
      <section className={panel}><h2 className="text-lg font-semibold">Compare evaluated options</h2><label>Evaluated option<select className={input} value={option} onChange={e => setOption(e.target.value)}>{catalogue?.options.map(o => <option key={o.option_key} value={o.option_key}>{o.option_key} · {o.hard_feasible ? "hard feasible" : "fails hard constraints"} · profit {o.base_incremental_profit_minor} minor units</option>)}</select></label><p>{catalogue?.options.length ?? 0} computed options · {deal.currency} minor units · calculator {evaluation.calculator_version}</p><ul className="list-disc pl-5">{(explanation?.evaluation_id === evaluation.id && explanation.option_key === option ? explanation.sentences : []).map(line => <li key={line}>{line}</li>)}</ul><p className="text-sm">Explanation provenance: {explanation?.provenance ?? "loading"}</p>{option && <StoredSeries businessId={businessId} evaluationId={evaluation.id} option={option} />}</section>
      <section className={panel}><h2 className="text-lg font-semibold">Explore a separate what-if</h2><p>A fork changes no confirmed inputs. Apply explicitly, then review, confirm and evaluate again.</p>
        <label>Change<select className={input} value={kind} onChange={e => { setKind(e.target.value); setValueTouched(true); }}><option value="deposit_pct">Deposit percentage</option><option value="customer_delay_days">Downside customer delay days</option><option value="ar_delay_days">Downside receivables delay days</option><option value="cost_overrun_bps">Downside cost overrun basis points</option></select></label><label>Value ({WHATIF_BOUNDS[kind as WhatIfKind].unit}, whole number {WHATIF_BOUNDS[kind as WhatIfKind].min} to {WHATIF_BOUNDS[kind as WhatIfKind].max})<input className={input} type="number" inputMode="numeric" step="1" min={WHATIF_BOUNDS[kind as WhatIfKind].min} max={WHATIF_BOUNDS[kind as WhatIfKind].max} value={value} aria-invalid={valueTouched && !valueCheck.ok} aria-describedby="whatif-value-error" onChange={e => { setValue(e.target.value); setValueTouched(true); }} /></label>{valueTouched && !valueCheck.ok && !typedChanges && <p id="whatif-value-error" role="alert" className="text-sm text-red-700">{valueCheck.message}</p>}
        <details><summary>Advanced typed changes: supplier extension or financing</summary><p>Use existing eligible_cost_keys, extension days, offer UUID and valid draw grid. New offer terms are rejected.</p><textarea className={input} aria-label="Typed changes JSON" value={typedChanges} onChange={e => setTypedChanges(e.target.value)} placeholder={'[{"kind":"financing","offer_id":"…","amount_minor":"…"}]'} /></details>
        <button className={button} disabled={disabled || (!typedChanges && !valueCheck.ok)} onClick={() => void command(() => fork())}>Run typed fork</button><label>Ask a what-if<input className={input} placeholder="deposit 30% or customer delay 15 days" value={instruction} onChange={e => setInstruction(e.target.value)} /></label><button className={button} disabled={disabled || !instruction.trim()} onClick={() => void command(() => fork(true))}>Propose and run language fork</button>
      </section>
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
    <CollectionPages query={payeePages} noun="payees" /><div className="flex gap-3"><button className={button} disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous history</button><button className={button} disabled={!state?.has_more} onClick={() => setOffset(offset+50)}>More history</button><button className={button} onClick={() => void command(refresh)}>Refresh saved preparation</button></div>
  </main>;
}

function ForkCard({ fork, businessId, disabled, apply }: { fork: ForkSummary; businessId: string; disabled: boolean; apply: () => Promise<void> }) {
  const [full, setFull] = useState<ForkView | null>(null); const [loadError, setLoadError] = useState("");
  return <article className="space-y-2 border-t pt-4"><p>Fork {fork.id} · {fork.is_stale ? "stale" : "current"} · {fork.provenance} {fork.language_code}</p><pre className="overflow-auto text-xs">{JSON.stringify(fork.changes)}</pre>{"decision" in fork.outcome ? <><table className="w-full text-left text-sm"><thead><tr><th>Result</th><th>Source</th><th>Fork</th></tr></thead><tbody><tr><td>Decision</td><td>{fork.source_result.decision}</td><td>{fork.outcome.decision}</td></tr><tr><td>Recommendation</td><td>{fork.source_result.recommended_option_key ?? "none"}</td><td>{fork.outcome.recommended_option_key ?? "none"}</td></tr><tr><td>As offered profit, minor units</td><td>{fork.source_result.as_is.base_incremental_profit_minor}</td><td>{fork.outcome.as_is.base_incremental_profit_minor}</td></tr></tbody></table><details onToggle={event => { if (event.currentTarget.open && !full) get<ForkView>(`/businesses/${businessId}/whatifs/${fork.id}`).then(setFull).catch(e => setLoadError(e.message)); }}><summary>Full deterministic comparison and saved series</summary><pre className="max-h-80 overflow-auto text-xs">{full ? JSON.stringify({ outcome: full.outcome, series: full.series }, null, 2) : loadError || "Loading saved comparison…"}</pre></details></> : <pre>{JSON.stringify(fork.outcome)}</pre>}<button className={button} disabled={disabled || fork.is_stale || !("decision" in fork.outcome)} onClick={() => void apply()}>Apply fork for confirmation</button></article>;
}

function MessageCard({ message, disabled, onEdit, onReview, onReply, onAcceptance, replies }: { message: PreparedMessage; disabled: boolean; onEdit: (data: Omit<DraftRevisionRequest, "expected_version" | "expected_input_version" | "expected_financial_revision">) => Promise<void>; onReview: (s: string) => Promise<void>; onReply: (s: string) => Promise<void>; onAcceptance: (s: string, until: string, reply: string) => Promise<void>; replies: readonly ReplyView[] }) {
  const m = message.identity;
  const [body, setBody] = useState(m.body); const [subject, setSubject] = useState(m.subject); const [recipient, setRecipient] = useState(m.recipient);
  const [attestation, setAttestation] = useState(""); const [reply, setReply] = useState(""); const [acceptance, setAcceptance] = useState(""); const [expiry, setExpiry] = useState(""); const [evidenceReply, setEvidenceReply] = useState("");
  return <article className="space-y-3 border-t pt-4"><h3 className="font-semibold">{m.party_role} · revision {m.revision} · {message.is_stale ? "stale" : message.reviewed ? "reviewed" : "needs review"}</h3><p>{message.provenance} · prepared only; it reaches the sandbox solely through an approved bundle</p><p className="text-red-700">{message.blockers.join(", ")}</p><code className="block break-all text-xs">Preparation {message.preparation_hash}</code><details><summary>Inspect exact terms and source identity</summary><pre className="max-h-80 overflow-auto text-xs">{JSON.stringify(m, null, 2)}</pre></details>
    <label>Prepared subject<select className={input} value={subject} onChange={e => setSubject(e.target.value)}><option>Proposed order terms for review</option><option>Revised order terms for review</option></select></label><label>Prepared recipient<input className={input} value={recipient} onChange={e => setRecipient(e.target.value)} /></label><label>Exact prepared body<textarea className={`${input} min-h-60`} value={body} onChange={e => setBody(e.target.value)} /></label><p className="text-sm">Term lines must remain exact. Editable courtesy sentences: {message.edit_sentences.join(" · ")}</p>
    <button className={button} disabled={disabled || message.is_stale || (body === m.body && subject === m.subject && recipient === m.recipient)} onClick={() => void onEdit({ evaluation_id: m.evaluation_id, option_key: m.option.option_key, party_id: m.party_id, party_role: m.party_role, recipient, channel: m.channel, expected_preparation_hash: message.preparation_hash, subject, body })}>Save new message revision</button>
    <label>Review attestation<input className={input} value={attestation} onChange={e => setAttestation(e.target.value)} placeholder="I reviewed the exact content, recipient and terms." /></label><button className={button} disabled={disabled || message.reviewed || !!message.blockers.length || attestation.trim().length < 10 || body !== m.body || subject !== m.subject || recipient !== m.recipient} onClick={() => void onReview(attestation)}>Record exact preparation review</button>
    <details><summary>Record an incoming reply to this ask</summary><label>Original reply text<textarea className={input} value={reply} onChange={e => setReply(e.target.value)} /></label><button className={button} disabled={disabled || !reply.trim()} onClick={() => void onReply(reply)}>Save reply and propose candidates</button></details>
    <details><summary>Record exact-term party acceptance evidence</summary><label>Acceptance attestation<textarea className={input} value={acceptance} onChange={e => setAcceptance(e.target.value)} /></label><label>Valid until (your local time)<input type="datetime-local" className={input} value={expiry} onChange={e => setExpiry(e.target.value)} /></label><label>Supporting reply, if any<select className={input} value={evidenceReply} onChange={e => setEvidenceReply(e.target.value)}><option value="">Manual attestation</option>{replies.filter(r => r.ask_message_id === m.message_id).map(r => <option key={r.id} value={r.id}>{r.body.slice(0, 80)}</option>)}</select></label><button className={button} disabled={disabled || !message.reviewed || !!message.blockers.length || acceptance.trim().length < 10 || !expiry} onClick={() => void onAcceptance(acceptance, new Date(expiry).toISOString(), evidenceReply)}>Record party attestation</button></details>
  </article>;
}

function ReplyCard({ reply, disabled, review }: { reply: ReplyView; disabled: boolean; review: (ids: string[], decision: "apply" | "reject", reason: string) => Promise<void> }) {
  const [selected, setSelected] = useState<string[]>([]); const [reason, setReason] = useState("");
  return <article className="space-y-3 border-t pt-4"><p>{reply.reviewed ? "Reviewed" : "Unreviewed"} · {reply.provenance}</p><blockquote className="whitespace-pre-wrap border-l-4 pl-3">{reply.body}</blockquote>{reply.bank_change && <p className="text-red-700">Bank-change blocker: separate verification required. Dispatch is blocked.</p>}{reply.injection_flagged && <p>Suspicious instructions found; manual source review required.</p>}{reply.candidates.map(c => <label className="block" key={c.id}><input type="checkbox" disabled={reply.reviewed} checked={selected.includes(c.id)} onChange={e => setSelected(e.target.checked ? [...selected, c.id] : selected.filter(id => id !== c.id))} /> {c.field}: {c.value} · quote: “{c.quote}”</label>)}{!reply.candidates.length && <p>No supported terms found. Use typed source review; the reply changed no inputs.</p>}<label>Review reason<input className={input} value={reason} onChange={e => setReason(e.target.value)} /></label><button className={button} disabled={disabled || reply.reviewed || reply.bank_change || reply.injection_flagged || !selected.length || reason.trim().length < 10} onClick={() => void review(selected, "apply", reason)}>Apply reviewed candidates for confirmation</button>{" "}<button className={button} disabled={disabled || reply.reviewed || reason.trim().length < 10} onClick={() => void review([], "reject", reason)}>Reject candidates and retain evidence</button></article>;
}

function StoredSeries({ businessId, evaluationId, option }: { businessId: string; evaluationId: string; option: string }) {
  const [scenario, setScenario] = useState("base"); const [series, setSeries] = useState("");
  useEffect(() => { let active = true; get<Series>(`/businesses/${businessId}/evaluations/${evaluationId}/series?scenario=${scenario}&option_key=${encodeURIComponent(option)}`).then(s => { if (active) setSeries(JSON.stringify(s, null, 2)); }).catch(e => { if (active) setSeries(e.message); }); return () => { active = false; }; }, [businessId, evaluationId, option, scenario]);
  return <details><summary>Inspect stored daily cash series</summary><label>Scenario<select className={input} value={scenario} onChange={e => setScenario(e.target.value)}>{["base", "downside", "severe"].map(s => <option key={s}>{s}</option>)}</select></label><pre className="max-h-72 overflow-auto text-xs">{series}</pre></details>;
}
