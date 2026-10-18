"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";

import { useState, type FormEvent } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveCustomer, getCustomerHistory, importInvoices, listInvoices } from "@/lib/p7-api";
import { INVOICE_COLUMNS, can, historyDateValid, parseInvoiceCsv } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import type { CustomerView } from "@/lib/generated-api";
import { ArchiveAction } from "@/components/p7/archive-action";
import { Alert, Loading, PageFrame, QueryError, button, field, panel, primary, useBusinessRevision, useCommand, useScoped } from "@/components/p7/common";

/** Customers with as-of payment history and invoice import. History is context for a reviewer, never an automatic credit score. */
export function CustomersScreen() {
  const { businessId, businessName } = useScoped();
  const [selected, setSelected] = useState("");
  const customers = useCollection<CustomerView>(`/businesses/${businessId}/customers`);
  const chosen = customers.data?.items.find(c => c.id === selected);
  return <PageFrame title="Customers" intro={`${businessName}. Payment history is computed on the server from the invoices you import, as of the date you choose. It is context only: it does not score credit or change any evaluation.`}>
    {customers.isPending && <Loading what="customers" />}
    {customers.isError && <QueryError error={customers.error} retry={() => void customers.refetch()} retrying={customers.isFetching} />}
    {customers.isSuccess && !customers.data.items.length && <p className={panel}>No customers yet. A customer is created when you start an order.</p>}
    <CollectionPages query={customers} noun="customers" />
    {customers.isSuccess && !!customers.data.items.length && <section className={panel} aria-labelledby="pick-heading"><h2 id="pick-heading" className="text-lg font-semibold">Choose a customer</h2>
      <label className="block text-sm">Customer<select className={field} value={selected} onChange={e => setSelected(e.target.value)}><option value="">Select a customer</option>{customers.data.items.map(c => <option key={c.id} value={c.id}>{c.customer.name}{c.archived_at ? " (archived)" : ""}</option>)}</select></label></section>}
    {chosen && <CustomerDetail key={chosen.id} customer={chosen} />}
  </PageFrame>;
}

function CustomerDetail({ customer }: { customer: CustomerView }) {
  const { businessId } = useScoped();
  const queryClient = useQueryClient();
  const { revision } = useBusinessRevision();
  return <><section className={panel}><h2 className="text-lg font-semibold">{customer.customer.name}</h2>{customer.archived_at ? <p className="text-sm text-neutral-700">This customer is archived.</p> : null}<ArchiveAction noun="customer" permission="prepare" record={customer} financialRevision={revision} archive={body => archiveCustomer(businessId, customer.id, body)} onChanged={() => void queryClient.invalidateQueries()} consequence="An archived customer cannot be chosen for new orders or receive invoice imports." /></section><History customer={customer} /><Invoices customer={customer} /></>;
}

function History({ customer }: { customer: CustomerView }) {
  const { businessId, key } = useScoped();
  // The as-of date is required by the API and has no default: the reviewer decides which day to look at.
  const [draft, setDraft] = useState(""); const [asOf, setAsOf] = useState("");
  const history = useQuery({ queryKey: key("history", customer.id, asOf), queryFn: () => getCustomerHistory(businessId, customer.id, asOf), enabled: !!asOf, retry: false });
  const { currency } = useCurrency();
  return <section className={panel} aria-labelledby="history-heading">
    <h2 id="history-heading" className="text-lg font-semibold">Payment history as of a date</h2>
    <form className="flex flex-wrap items-end gap-3" onSubmit={(e: FormEvent) => { e.preventDefault(); if (historyDateValid(draft)) setAsOf(draft); }}>
      <label className="text-sm">As-of date<input required type="date" min="2000-01-01" max="2100-12-31" className={field} value={draft} onChange={e => setDraft(e.target.value)} /></label>
      <button className={primary} disabled={!historyDateValid(draft)}>Show history</button>
    </form>
    {!asOf && <p className="text-sm text-neutral-600">Choose a date to see the history.</p>}
    {history.isFetching && <Loading what="history" />}
    {history.isError && <QueryError error={history.error} retry={() => void history.refetch()} retrying={history.isFetching} />}
    {history.isSuccess && !history.isFetching && <dl className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr]">
      <dt>As of</dt><dd>{history.data.as_of}</dd><dt>Invoices paid in full</dt><dd>{history.data.paid_count}</dd><dt>Open overdue amount</dt><dd className="font-mono">{currency ? formatMinor(history.data.open_overdue_minor, currency) : `${history.data.open_overdue_minor} minor units`}</dd>
      <dt>Meaning</dt><dd>Counts only invoices dated on or before that day. {history.data.context_only ? "Context only: it is not a credit score." : ""}</dd></dl>}
  </section>;
}

/** The business currency, read once. Invoice amounts are in this currency's minor units. */
function useCurrency() {
  const { business } = useBusinessRevision();
  return { currency: business?.currency ?? "" };
}

function Invoices({ customer }: { customer: CustomerView }) {
  const { businessId, key, role } = useScoped();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const { revision } = useBusinessRevision();
  const invoicesKey = key("invoices", customer.id);
  const invoices = useInfiniteQuery({ queryKey: invoicesKey, queryFn: ({ pageParam }) => listInvoices(businessId, customer.id, pageParam), initialPageParam: null as string | null, getNextPageParam: last => last.next_cursor, retry: false });
  const items = invoices.data?.pages.flatMap(p => p.items) ?? [];
  const { busy, error, notice, run } = useCommand();
  const [csv, setCsv] = useState("");
  const parsed = csv.trim() ? parseInvoiceCsv(csv) : null;
  const canImport = can(role, "prepare") && !customer.archived_at;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed || parsed.errors.length || !parsed.invoices.length || revision === undefined) return;
    const result = await run(async () => importInvoices(businessId, customer.id, { expected_financial_revision: revision, invoices: parsed.invoices }), `Imported ${parsed.invoices.length} invoices.`);
    if (result.ok) { setCsv(""); void queryClient.invalidateQueries({ queryKey: invoicesKey }); void queryClient.invalidateQueries({ queryKey: key("business-profile") }); } // the import bumped the revision; reload it so a repeat attempt is judged on its content, not reported as a stale revision
  }
  return <section className={panel} aria-labelledby="invoices-heading">
    <h2 id="invoices-heading" className="text-lg font-semibold">Invoices</h2>
    {invoices.isPending && <Loading what="invoices" />}
    {invoices.isError && <QueryError error={invoices.error} retry={() => void invoices.refetch()} retrying={invoices.isFetching} />}
    {invoices.isSuccess && !items.length && <p className="text-sm text-neutral-600">No invoices imported for this customer.</p>}
    {!!items.length && <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Customer invoices</caption><thead><tr className="border-b"><th className="py-1 pr-3">Reference</th><th className="pr-3">Invoice date</th><th className="pr-3">Due</th><th className="pr-3">Amount</th><th className="pr-3">Paid</th><th>Paid on</th></tr></thead>
      <tbody>{items.map(i => <tr key={i.id} className="border-b"><td className="py-1 pr-3">{i.invoice.invoice_ref}</td><td className="pr-3">{i.invoice.invoice_date}</td><td className="pr-3">{i.invoice.due_date}</td><td className="pr-3 font-mono">{currency ? formatMinor(i.invoice.amount_minor, currency) : i.invoice.amount_minor}</td><td className="pr-3 font-mono">{currency ? formatMinor(i.invoice.paid_minor, currency) : i.invoice.paid_minor}</td><td>{i.invoice.paid_date ?? "unpaid"}</td></tr>)}</tbody></table></div>}
    {invoices.hasNextPage && <button type="button" className={button} disabled={invoices.isFetchingNextPage} onClick={() => void invoices.fetchNextPage()}>{invoices.isFetchingNextPage ? "Loading…" : "Load more"}</button>}
    {canImport ? <form onSubmit={submit} className="space-y-3 rounded-lg bg-neutral-50 p-3">
      <h3 className="font-semibold">Import invoices</h3>
      <p className="text-sm text-neutral-700">Paste CSV with this exact header line, then one invoice per line. Amounts are whole minor units (for example 12550 means 125.50). Use an empty paid_date for an unpaid invoice with paid_minor 0. The import is all or nothing and refuses references that already exist for this customer.</p>
      <code className="block overflow-x-auto text-xs">{INVOICE_COLUMNS.join(",")}</code>
      <label className="block text-sm">Invoices (CSV)<textarea className={`${field} min-h-32 font-mono text-xs`} value={csv} onChange={e => setCsv(e.target.value)} spellCheck={false} /></label>
      {parsed && parsed.errors.length > 0 && <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800"><p className="font-semibold">Fix these before importing:</p><ul className="list-disc pl-5">{parsed.errors.slice(0, 20).map(m => <li key={m}>{m}</li>)}</ul>{parsed.errors.length > 20 && <p>and {parsed.errors.length - 20} more.</p>}</div>}
      {parsed && !parsed.errors.length && <Alert tone="info">{parsed.invoices.length} invoices ready to import.</Alert>}
      {error && <Alert>{error}</Alert>}{notice && <Alert tone="ok">{notice}</Alert>}
      {(() => { const why = busy ? "" : revision === undefined ? "Waiting for the current business revision to load." : !parsed ? "Paste invoice CSV above to continue." : parsed.errors.length ? "Fix the errors listed above to continue." : !parsed.invoices.length ? "The CSV has a header but no invoice rows." : ""; return <>
        <button className={primary} disabled={busy || !!why} aria-describedby={why ? "import-invoices-why" : undefined}>{busy ? "Importing…" : "Import invoices"}</button>
        {why && <p id="import-invoices-why" className="text-xs text-neutral-600">{why}</p>}</>; })()}
    </form> : <p className="text-xs text-neutral-600">{customer.archived_at ? "This customer is archived, so invoices cannot be imported." : "Only a commercial lead, risk officer or owner can import invoices."}</p>}
  </section>;
}
