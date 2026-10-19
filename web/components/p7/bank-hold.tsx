"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listAccounts, resolveFlag } from "@/lib/p7-api";
import { bankHold, BANK_EVIDENCE_MIN, bankEvidenceValid, buildBankResolution, describeP7Error, eligibleBankAccounts, maskedAccount } from "@/lib/p7-model";
import type { AccountView, DealView, ReplyView } from "@/lib/generated-api";

const input = "block w-full rounded border border-red-300 bg-white p-2 text-sm text-neutral-900";
const button = "rounded border border-red-500 bg-white px-3 py-2 text-sm font-medium disabled:opacity-40";

/**
 * Explains an unresolved bank-change hold. A hold is a blocking flag: it stops every outgoing action for the order and
 * cannot be bypassed. The API clears it only through `flag_resolve` (the flag id comes from the deal's findings) with the
 * exact bank-change reply, a verified account of that reply's party and written evidence, by a risk officer or owner.
 */
export function BankChangeHold({ businessId, deal, replies, role, disabled = false, onResolved }: { businessId: string; deal: DealView; replies: readonly ReplyView[]; role: string; disabled?: boolean; onResolved?: () => Promise<void> | void }) {
  const hold = bankHold(deal.findings, replies, role);
  const bankReplies = replies.filter(r => r.bank_change);
  const [replyId, setReplyId] = useState(""); const [accountId, setAccountId] = useState(""); const [written, setWritten] = useState("");
  const [accounts, setAccounts] = useState<AccountView[]>([]); const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const reply = bankReplies.find(r => r.id === replyId) ?? null;
  const partyId = reply?.party_id ?? "";

  useEffect(() => {
    if (!hold.canResolve || !partyId) return;
    let active = true;
    // Loading state is set by the select handler; this effect only fetches the reply party's accounts.
    listAccounts(businessId, partyId).then(page => { if (active) setAccounts([...page.items]); })
      .catch(e => { if (active) { setAccounts([]); setError(describeP7Error(e).message); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, partyId, hold.canResolve]);

  if (!hold.active) return null;
  const eligible = eligibleBankAccounts(accounts, reply);
  const body = buildBankResolution(deal, hold, { replyId, accountId, writtenEvidence: written });

  async function submit() {
    if (!body || !hold.flagId) return;
    setBusy(true); setError("");
    try { await resolveFlag(businessId, deal.id, hold.flagId, body); setWritten(""); setAccountId(""); await onResolved?.(); }
    catch (e) { setError(describeP7Error(e).message); }
    finally { setBusy(false); }
  }

  return <section role="alert" className="space-y-2 rounded-xl border-2 border-red-300 bg-red-50 p-5 text-sm text-red-900">
    <h2 className="text-lg font-semibold">Bank-change hold</h2>
    <p>A reply asked to change bank or beneficiary details. Nothing can be sent or committed for this order until the change is verified separately. The hold cannot be overridden.</p>
    {hold.replyIds.length > 0 && <p>{hold.replyIds.length > 1 ? "Replies" : "Reply"} that raised it: <span className="font-mono text-xs">{hold.replyIds.join(", ")}</span></p>}
    <p>{hold.canResolve ? "As a risk officer or owner you can clear it, but only with all of the following:" : "Only a risk officer or owner can clear it, and only with all of the following:"}</p>
    <ol className="list-decimal space-y-1 pl-5">
      <li>The exact reply above, which must contain the bank change.</li>
      <li>A verified account for that reply&apos;s party. Record the account and its verification under <Link className="underline" href={`/payees?businessId=${businessId}`}>Payees</Link>; a pending account does not count.</li>
      <li>Written evidence of at least {BANK_EVIDENCE_MIN} characters describing how you confirmed the change independently of the reply.</li>
    </ol>
    {!hold.flagId && <p>This hold has no identifier in the order response, so it cannot be cleared from this screen. Reload the order; the hold stays in force.</p>}
    {hold.canResolve && <form className="space-y-2 rounded border border-red-200 bg-white/60 p-3" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <label className="block">Bank-change reply
        <select className={input} value={replyId} onChange={e => { setReplyId(e.target.value); setAccountId(""); setAccounts([]); setError(""); setLoading(!!e.target.value); }}>
          <option value="">Choose the reply that raised the hold</option>
          {bankReplies.map(r => <option key={r.id} value={r.id}>{r.body.slice(0, 80)}</option>)}
        </select>
      </label>
      {reply && <label className="block">Verified account of that party
        <select className={input} value={accountId} onChange={e => setAccountId(e.target.value)} disabled={loading}>
          <option value="">{loading ? "Loading accounts…" : eligible.length ? "Choose a verified account" : "No verified account for this party"}</option>
          {eligible.map(a => <option key={a.id} value={a.id}>{a.bank_name} · {maskedAccount(a)}</option>)}
        </select>
      </label>}
      <label className="block">Written evidence
        <textarea className={`${input} min-h-24`} value={written} maxLength={2000} onChange={e => setWritten(e.target.value)} placeholder="How you confirmed the new account independently of the reply (for example a call-back to the number on file)." />
      </label>
      {written && !bankEvidenceValid(written) && <p>Write at least {BANK_EVIDENCE_MIN} characters.</p>}
      {error && <p className="font-medium">{error}</p>}
      <button type="submit" className={button} disabled={disabled || busy || !body}>{busy ? "Clearing…" : "Clear the bank-change hold"}</button>
    </form>}
  </section>;
}
