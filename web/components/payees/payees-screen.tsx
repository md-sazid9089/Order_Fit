"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { archivePayee, createAccount, getBusiness, listAccounts, revokeAccount, verifyAccount } from "@/lib/p7-api";
import { accountActions, accountNumberValid, accountStatusText, buildAccountCreate, buildAccountVerification, buildRevocation, can, maskedAccount, reasonValid } from "@/lib/p7-model";
import type { AccountView, PayeeView } from "@/lib/generated-api";
import { ArchiveAction } from "@/components/p7/archive-action";
import { Alert, Loading, PageFrame, QueryError, button, danger, field, panel, primary, RevisionNotice, useBusinessRevision, useCommand, useScoped, when } from "@/components/p7/common";

const STATUS_STYLE = { pending: "bg-amber-100 text-amber-900", verified: "bg-green-100 text-green-900", revoked: "bg-neutral-200 text-neutral-700" } as const;

/** Payee bank accounts. Only the last four characters are ever returned; verification is a human-recorded attestation. */
export function PayeesScreen() {
  const { businessId, key, businessName } = useScoped();
  const payees = useCollection<PayeeView>(`/businesses/${businessId}/payees`);
  const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });
  return <PageFrame title="Payees and bank accounts" intro={<>{businessName}. Account numbers are never shown in full: only the last four characters are kept for display. A verified account means a person recorded evidence, not that a bank confirmed it. Nothing here moves money. Lenders are added under <Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Cash and financing</Link>.</>}>
    {payees.isPending && <Loading what="payees" />}
    {payees.isError && <QueryError error={payees.error} retry={() => void payees.refetch()} retrying={payees.isFetching} />}
    {payees.isSuccess && !payees.data.items.length && <p className={panel}>No payees are recorded for this business yet.</p>}
    <CollectionPages query={payees} noun="payees" />
    {payees.isSuccess && payees.data.items.map(p => <PayeeCard key={p.id} payee={p} financialRevision={business.data?.financial_revision} />)}
  </PageFrame>;
}

function PayeeCard({ payee, financialRevision }: { payee: PayeeView; financialRevision: number | undefined }) {
  const { businessId } = useScoped();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const archived = !!payee.archived_at;
  return <section className={panel}>
    <div className="flex flex-wrap items-center gap-3"><h2 className="min-w-0 flex-1 text-lg font-semibold">{payee.payee.name}</h2><span className="text-sm text-neutral-600">{payee.payee.kind} · {payee.payee.category.replaceAll("_", " ")}{archived ? " · archived" : ""}</span>
      <button type="button" className={button} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? "Hide accounts" : "Accounts"}</button></div>
    {open && <Accounts payee={payee} />}
    <ArchiveAction noun="payee" permission="manage_finance" record={payee} financialRevision={financialRevision} archive={body => archivePayee(businessId, payee.id, body)} onChanged={() => void queryClient.invalidateQueries()} consequence="An archived payee can no longer receive new accounts and is not offered for new orders." />
  </section>;
}

function Accounts({ payee }: { payee: PayeeView }) {
  const { businessId, key, role } = useScoped();
  const queryClient = useQueryClient();
  const accountsKey = key("accounts", payee.id);
  const accounts = useInfiniteQuery({ queryKey: accountsKey, queryFn: ({ pageParam }) => listAccounts(businessId, payee.id, pageParam), initialPageParam: null as string | null, getNextPageParam: last => last.next_cursor, retry: false });
  const reload = () => void queryClient.invalidateQueries({ queryKey: accountsKey });
  const items = accounts.data?.pages.flatMap(p => p.items) ?? [];
  const manage = can(role, "manage_finance");
  return <div className="space-y-3">
    {accounts.isPending && <Loading what="accounts" />}
    {accounts.isError && <QueryError error={accounts.error} retry={() => void accounts.refetch()} retrying={accounts.isFetching} />}
    {accounts.isSuccess && !items.length && <p className="text-sm text-neutral-600">No accounts recorded for this payee.</p>}
    <ul className="divide-y">{items.map(a => <AccountRow key={a.id} account={a} payeeId={payee.id} manage={manage} onChanged={reload} />)}</ul>
    {accounts.hasNextPage && <button type="button" className={button} disabled={accounts.isFetchingNextPage} onClick={() => void accounts.fetchNextPage()}>{accounts.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
    {manage && !payee.archived_at ? <AddAccount payeeId={payee.id} onAdded={reload} /> : <p className="text-xs text-neutral-600">{payee.archived_at ? "This payee is archived, so accounts cannot be added." : "Only a risk officer or owner can add, verify or revoke accounts."}</p>}
  </div>;
}

function AddAccount({ payeeId, onAdded }: { payeeId: string; onAdded: () => void }) {
  const { businessId } = useScoped();
  const { revision, error: revisionError } = useBusinessRevision();
  const { busy, error, notice, run } = useCommand();
  const [bank, setBank] = useState(""); const [number, setNumber] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (revision === undefined) return;
    const result = await run(async () => createAccount(businessId, payeeId, buildAccountCreate(bank, number, revision)), "Account recorded as pending. It is not verified yet.");
    // The account number is cleared as soon as the request settles; it is never kept or shown again.
    if (result.ok) { setBank(""); setNumber(""); onAdded(); }
  }
  return <form onSubmit={submit} className="space-y-3 rounded-lg bg-neutral-50 p-3">
    <h3 className="font-semibold">Add an account</h3>
    <label className="block text-sm">Bank name<input required className={field} value={bank} maxLength={2000} onChange={e => setBank(e.target.value)} /></label>
    <label className="block text-sm">Account number<input required className={field} value={number} autoComplete="off" spellCheck={false} onChange={e => setNumber(e.target.value)} aria-describedby="account-help" /></label>
    <p id="account-help" className="text-xs text-neutral-600">4 to 64 letters or digits. Only the last four characters will ever be displayed. Adding an account changes the business record, so existing evaluations may need re-evaluation.</p>
    <RevisionNotice revision={revision} error={revisionError} />
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
    <button className={primary} disabled={busy || revision === undefined || !bank.trim() || !accountNumberValid(number)}>Add account</button>
  </form>;
}

function AccountRow({ account, payeeId, manage, onChanged }: { account: AccountView; payeeId: string; manage: boolean; onChanged: () => void }) {
  const { businessId } = useScoped();
  const { revision } = useBusinessRevision();
  const { busy, error, notice, run } = useCommand({ onConflict: onChanged });
  const [mode, setMode] = useState<"" | "verify" | "revoke">("");
  const [text, setText] = useState("");
  const actions = accountActions(account);
  const done = () => { setMode(""); setText(""); onChanged(); };
  return <li className="space-y-2 py-3 text-sm">
    <div className="flex flex-wrap items-center gap-3"><span className="min-w-0 flex-1"><strong>{account.bank_name}</strong> · {maskedAccount(account)}</span><span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${STATUS_STYLE[account.status]}`}>{account.status}</span></div>
    <p className="text-neutral-700">{accountStatusText(account)}{account.verified_by ? ` Recorded by member ${account.verified_by.slice(0, 8)}${account.verified_at ? ` at ${when(account.verified_at)}` : ""}.` : ""}</p>
    {manage && (actions.verify || actions.revoke) && <div className="flex gap-3">
      {actions.verify && <button type="button" className={button} disabled={busy} onClick={() => { setMode(mode === "verify" ? "" : "verify"); setText(""); }}>{mode === "verify" ? "Cancel" : "Record verification"}</button>}
      {actions.revoke && <button type="button" className={danger} disabled={busy} onClick={() => { setMode(mode === "revoke" ? "" : "revoke"); setText(""); }}>{mode === "revoke" ? "Cancel" : "Revoke"}</button>}
    </div>}
    {mode === "verify" && <form className="space-y-2 rounded-lg bg-neutral-50 p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (revision === undefined) return; void run(async () => { await verifyAccount(businessId, payeeId, account.id, buildAccountVerification(account, text, revision)); done(); }, "Verification recorded."); }}>
      <label className="block">Evidence you checked (for example, a signed letter or a call back to a known number). At least 10 characters.<textarea className={field} value={text} maxLength={2000} onChange={e => setText(e.target.value)} /></label>
      <p className="text-xs text-neutral-600">This records your attestation in the audit log. It is not a bank confirmation.</p>
      <button className={primary} disabled={busy || revision === undefined || !reasonValid(text)}>Record verification</button></form>}
    {mode === "revoke" && <form className="space-y-2 rounded-lg bg-neutral-50 p-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (revision === undefined) return; void run(async () => { await revokeAccount(businessId, payeeId, account.id, buildRevocation(account, text, revision)); done(); }, "Account revoked."); }}>
      <label className="block">Reason (at least 10 characters)<textarea className={field} value={text} maxLength={2000} onChange={e => setText(e.target.value)} /></label>
      <button className={danger} disabled={busy || revision === undefined || !reasonValid(text)}>Revoke account</button></form>}
    {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
  </li>;
}
