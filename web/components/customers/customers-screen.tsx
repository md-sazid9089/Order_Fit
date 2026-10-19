"use client";

import { useCollection } from "@/components/collection-pages";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveCustomer, getCustomerHistory, importInvoices, listInvoices } from "@/lib/p7-api";
import { INVOICE_COLUMNS, can, historyDateValid, parseInvoiceCsv } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import type { CustomerView } from "@/lib/generated-api";
import { ArchiveAction } from "@/components/p7/archive-action";
import {
  Alert,
  Loading,
  QueryError,
  useBusinessRevision,
  useCommand,
  useScoped,
} from "@/components/p7/common";
import {
  Users,
  Search,
  Building2,
  Calendar,
  CreditCard,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  ArrowRight,
  RefreshCw,
  Plus,
  ShieldAlert,
  Archive,
  History as HistoryIcon,
  Globe,
  Tag,
  ChevronRight,
  Clock,
  DollarSign,
} from "lucide-react";

// Standard styling constants matching the warm-stone minimal theme
const cardClass =
  "rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-2xs transition-all";
const inputClass =
  "block w-full rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] px-3.5 py-2 text-sm text-[#1E2021] dark:text-neutral-100 placeholder:text-neutral-400 focus:border-[#1E2021] dark:focus:border-neutral-400 focus:outline-none transition-colors";
const buttonPrimary =
  "inline-flex items-center justify-center gap-2 rounded-xl bg-[#1E2021] dark:bg-white px-4 py-2 text-xs font-semibold text-white dark:text-[#1E2021] hover:bg-neutral-800 dark:hover:bg-neutral-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-xs";
const buttonSecondary =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] px-3.5 py-2 text-xs font-medium text-[#1E2021] dark:text-neutral-200 hover:bg-[#FAF9F7] dark:hover:bg-[#2A2C2D] transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs";

export function CustomersScreen() {
  const { businessId } = useScoped();
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const customers = useCollection<CustomerView>(`/businesses/${businessId}/customers`);

  const items = customers.data?.items ?? [];
  const filtered = items.filter(c =>
    c.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    c.customer.known_domains?.some(d => d.toLowerCase().includes(search.toLowerCase()))
  );

  // Auto-select first customer if none selected or if previously selected is invalid
  const chosen = items.find(c => c.id === selectedId) ?? (items.length > 0 ? items[0] : null);
  const activeSelectedId = chosen ? chosen.id : selectedId;

  return (
    <main className="px-4 sm:px-6 lg:px-8 py-6 w-full min-h-screen bg-[#FAF9F7] dark:bg-[#121314] text-[#1E2021] dark:text-neutral-100">
      <div className="max-w-[1560px] mx-auto space-y-6 w-full">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1] dark:border-[#2C302F]">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#1E2021] dark:bg-white text-white dark:text-[#1E2021] shadow-xs">
                <Users className="size-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold font-display tracking-tight text-[#1E2021] dark:text-white">
                  Customers & Ledger
                </h1>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Verified counterparty directory, historic invoice logs, and as-of payment tracking.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <Link
              href={`/deals/new?businessId=${businessId}`}
              className={buttonPrimary}
            >
              <Plus className="size-3.5" />
              <span>Create Order</span>
            </Link>
            <button
              type="button"
              onClick={() => void customers.refetch()}
              disabled={customers.isFetching}
              className={buttonSecondary}
              title="Refresh customer accounts"
            >
              <RefreshCw className={`size-3.5 ${customers.isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>

        {/* Global Loading / Error State */}
        {customers.isPending && (
          <div className="p-8 text-center bg-white dark:bg-[#1E2021] rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] shadow-2xs">
            <Loading what="customers" />
          </div>
        )}

        {customers.isError && (
          <QueryError
            error={customers.error}
            retry={() => void customers.refetch()}
            retrying={customers.isFetching}
          />
        )}

        {customers.isSuccess && items.length === 0 && (
          <div className="text-center py-16 px-6 rounded-2xl border border-dashed border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] space-y-3">
            <div className="inline-flex size-12 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
              <Building2 className="size-6" />
            </div>
            <h2 className="text-base font-semibold text-[#1E2021] dark:text-white">No customers registered yet</h2>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Customers are created automatically when initiating an order, or imported via order documents.
            </p>
            <div className="pt-2">
              <Link href={`/deals/new?businessId=${businessId}`} className={buttonPrimary}>
                <Plus className="size-3.5" />
                <span>Start Your First Order</span>
              </Link>
            </div>
          </div>
        )}

        {/* Main Master-Detail Split Grid */}
        {customers.isSuccess && items.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Customer Directory (4 cols) */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
                    Accounts ({items.length})
                  </span>
                  {customers.hasNextPage && (
                    <button
                      type="button"
                      disabled={customers.isFetchingNextPage}
                      onClick={() => void customers.fetchNextPage()}
                      className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline"
                    >
                      {customers.isFetchingNextPage ? "Loading..." : "Load more"}
                    </button>
                  )}
                </div>

                {/* Search Filter Input */}
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 size-4 text-neutral-400" />
                  <input
                    type="text"
                    placeholder="Filter by name or domain..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className={`${inputClass} pl-9 text-xs`}
                  />
                </div>

                {/* List of customer cards */}
                <div className="space-y-1.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
                  {filtered.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-6">No matching customers found.</p>
                  ) : (
                    filtered.map(c => {
                      const isSelected = c.id === activeSelectedId;
                      const isArchived = !!c.archived_at;
                      return (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSelectedId(c.id)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? "border-[#1E2021] dark:border-white bg-[#FAF9F7] dark:bg-[#252829] shadow-xs"
                              : "border-transparent hover:border-[#E8E6E1] dark:hover:border-[#2C302F] bg-white dark:bg-[#1E2021] hover:bg-[#F9F8F6] dark:hover:bg-[#222425]"
                          }`}
                        >
                          <div className="min-w-0 flex-1 space-y-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-sm text-[#1E2021] dark:text-white truncate">
                                {c.customer.name}
                              </span>
                              {isArchived && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
                                  Archived
                                </span>
                              )}
                            </div>
                            {c.customer.known_domains && c.customer.known_domains.length > 0 ? (
                              <p className="text-xs text-neutral-500 truncate flex items-center gap-1">
                                <Globe className="size-3 shrink-0 text-neutral-400" />
                                {c.customer.known_domains[0]}
                              </p>
                            ) : (
                              <p className="text-xs text-neutral-400">Standard terms account</p>
                            )}
                          </div>
                          <ChevronRight
                            className={`size-4 shrink-0 transition-transform ${
                              isSelected ? "text-[#1E2021] dark:text-white translate-x-0.5" : "text-neutral-300"
                            }`}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Right Column: Customer Details, As-Of History & Invoices (8 cols) */}
            <div className="lg:col-span-8 space-y-6">
              {chosen ? (
                <CustomerDetail key={chosen.id} customer={chosen} />
              ) : (
                <div className={`${cardClass} text-center py-12 text-neutral-400 text-sm`}>
                  Select a customer from the left to view payment history and invoice ledgers.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function CustomerDetail({ customer }: { customer: CustomerView }) {
  const { businessId } = useScoped();
  const queryClient = useQueryClient();
  const { revision } = useBusinessRevision();

  return (
    <div className="space-y-6">
      {/* Top Customer Header Card */}
      <section className={cardClass}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E8E6E1] dark:border-[#2C302F]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-[#1E2021] dark:text-white">
                {customer.customer.name}
              </h2>
              {customer.archived_at ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-50 text-red-700 border border-red-200">
                  Archived
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                  Active
                </span>
              )}
            </div>
            <p className="text-xs text-neutral-500">
              Account ID: <span className="font-mono text-neutral-600 dark:text-neutral-400">{customer.id}</span>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/deals/new?businessId=${businessId}`}
              className={buttonPrimary}
            >
              <Plus className="size-3.5" />
              <span>Draft Order for Customer</span>
            </Link>
          </div>
        </div>

        {/* Known Domains and Metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <Globe className="size-3.5 text-neutral-400" />
              Recognized Domains
            </span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {customer.customer.known_domains && customer.customer.known_domains.length > 0 ? (
                customer.customer.known_domains.map(d => (
                  <span
                    key={d}
                    className="px-2 py-0.5 rounded-md text-xs font-mono bg-neutral-50 dark:bg-[#181A1B] border border-[#E8E6E1] dark:border-[#2C302F] text-neutral-700 dark:text-neutral-300"
                  >
                    {d}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-400 italic">No domain restrictions recorded</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs font-medium text-neutral-500 flex items-center gap-1.5">
              <ShieldAlert className="size-3.5 text-neutral-400" />
              Operational Flags
            </span>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {customer.customer.red_flags && customer.customer.red_flags.length > 0 ? (
                customer.customer.red_flags.map((flag, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200"
                  >
                    {flag}
                  </span>
                ))
              ) : (
                <span className="text-xs text-neutral-600 dark:text-neutral-400">Standard risk profile</span>
              )}
            </div>
          </div>
        </div>

        {/* Archive Action Drawer */}
        <div className="pt-3 border-t border-[#E8E6E1] dark:border-[#2C302F]">
          <ArchiveAction
            noun="customer"
            permission="prepare"
            record={customer}
            financialRevision={revision}
            archive={body => archiveCustomer(businessId, customer.id, body)}
            onChanged={() => void queryClient.invalidateQueries()}
            consequence="An archived customer cannot be chosen for new orders or receive invoice imports."
          />
        </div>
      </section>

      {/* As-Of Payment History Calculator */}
      <History customer={customer} />

      {/* Historical Invoices Ledger & CSV Import */}
      <Invoices customer={customer} />
    </div>
  );
}

function History({ customer }: { customer: CustomerView }) {
  const { businessId, key } = useScoped();
  // Default to today's date for convenient auditing
  const today = new Date().toISOString().split("T")[0];
  const [draft, setDraft] = useState(today);
  const [asOf, setAsOf] = useState(today);

  const history = useQuery({
    queryKey: key("history", customer.id, asOf),
    queryFn: () => getCustomerHistory(businessId, customer.id, asOf),
    enabled: !!asOf,
    retry: false,
  });

  const { currency } = useCurrency();

  return (
    <section className={cardClass} aria-labelledby="history-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div>
          <h3 id="history-heading" className="text-base font-semibold text-[#1E2021] dark:text-white flex items-center gap-2">
            <HistoryIcon className="size-4 text-neutral-500" />
            <span>As-Of Payment History</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Calculated strictly from imported historical invoices as of the selected calendar date.
          </p>
        </div>

        {/* Date Selector Form */}
        <form
          className="flex items-center gap-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (historyDateValid(draft)) setAsOf(draft);
          }}
        >
          <div className="relative">
            <input
              required
              type="date"
              min="2000-01-01"
              max="2100-12-31"
              className={`${inputClass} text-xs py-1.5`}
              value={draft}
              onChange={e => setDraft(e.target.value)}
            />
          </div>
          <button
            type="submit"
            className={buttonSecondary}
            disabled={!historyDateValid(draft) || draft === asOf}
          >
            Compute
          </button>
        </form>
      </div>

      {history.isFetching && (
        <div className="py-6">
          <Loading what="history" />
        </div>
      )}

      {history.isError && (
        <QueryError
          error={history.error}
          retry={() => void history.refetch()}
          retrying={history.isFetching}
        />
      )}

      {history.isSuccess && !history.isFetching && (
        <div className="space-y-4 pt-1">
          {/* Key Metric Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-xs text-neutral-500 block">Audited As Of</span>
              <span className="text-base font-semibold text-[#1E2021] dark:text-white mt-1 block">
                {history.data.as_of}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-xs text-neutral-500 block">Invoices Paid in Full</span>
              <span className="text-base font-semibold text-[#1E2021] dark:text-white mt-1 block">
                {history.data.paid_count}
              </span>
            </div>

            <div className="p-3.5 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B]">
              <span className="text-xs text-neutral-500 block">Open Overdue Balance</span>
              <span className="text-base font-semibold text-[#1E2021] dark:text-white mt-1 block font-mono">
                {currency ? formatMinor(history.data.open_overdue_minor, currency) : `${history.data.open_overdue_minor} minor units`}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#181A1B] p-3 text-xs text-neutral-500 flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-neutral-400" />
            <span>
              This metric counts invoices dated on or before {history.data.as_of}. It serves as reviewer context and never modifies automated credit decisions.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

function useCurrency() {
  const { business } = useBusinessRevision();
  return { currency: business?.currency ?? "USD" };
}

function Invoices({ customer }: { customer: CustomerView }) {
  const { businessId, key, role } = useScoped();
  const queryClient = useQueryClient();
  const { currency } = useCurrency();
  const { revision } = useBusinessRevision();
  const invoicesKey = key("invoices", customer.id);

  const invoices = useInfiniteQuery({
    queryKey: invoicesKey,
    queryFn: ({ pageParam }) => listInvoices(businessId, customer.id, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: last => last.next_cursor,
    retry: false,
  });

  const items = invoices.data?.pages.flatMap(p => p.items) ?? [];
  const { busy, error, notice, run } = useCommand();
  const [csv, setCsv] = useState("");
  const [showImport, setShowImport] = useState(false);
  const parsed = csv.trim() ? parseInvoiceCsv(csv) : null;
  const canImport = can(role, "prepare") && !customer.archived_at;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!parsed || parsed.errors.length || !parsed.invoices.length || revision === undefined) return;
    const result = await run(
      async () =>
        importInvoices(businessId, customer.id, {
          expected_financial_revision: revision,
          invoices: parsed.invoices,
        }),
      `Successfully imported ${parsed.invoices.length} invoices.`
    );
    if (result.ok) {
      setCsv("");
      setShowImport(false);
      void queryClient.invalidateQueries({ queryKey: invoicesKey });
      void queryClient.invalidateQueries({ queryKey: key("business-profile") });
      void queryClient.invalidateQueries({ queryKey: key("history", customer.id) });
    }
  }

  // Sample CSV generator for quick demo/testing
  function loadSampleCsv() {
    const today = new Date();
    const d1 = new Date(today.getTime() - 40 * 86400000).toISOString().split("T")[0];
    const d2 = new Date(today.getTime() - 10 * 86400000).toISOString().split("T")[0];
    const d3 = new Date(today.getTime() + 20 * 86400000).toISOString().split("T")[0];

    const sample = `${INVOICE_COLUMNS.join(",")}\n` +
      `INV-2026-001,${d1},${d2},2500000,2500000,${d2}\n` +
      `INV-2026-002,${d2},${d3},1800000,0,`;
    setCsv(sample);
  }

  return (
    <section className={cardClass} aria-labelledby="invoices-heading">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div>
          <h3 id="invoices-heading" className="text-base font-semibold text-[#1E2021] dark:text-white flex items-center gap-2">
            <FileSpreadsheet className="size-4 text-neutral-500" />
            <span>Invoices Ledger</span>
            <span className="text-xs font-normal text-neutral-400">({items.length} recorded)</span>
          </h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Historical settlement records for timeline verification.
          </p>
        </div>

        {canImport && (
          <button
            type="button"
            onClick={() => setShowImport(!showImport)}
            className={buttonSecondary}
          >
            <Upload className="size-3.5" />
            <span>{showImport ? "Hide Import Tool" : "Import Invoices"}</span>
          </button>
        )}
      </div>

      {/* CSV Import Drawer */}
      {showImport && canImport && (
        <form onSubmit={submit} className="p-4 rounded-xl border border-[#E8E6E1] dark:border-[#2C302F] bg-[#FAF9F7] dark:bg-[#181A1B] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">
              Bulk CSV Invoice Import
            </span>
            <button
              type="button"
              onClick={loadSampleCsv}
              className="text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white underline"
            >
              Load Sample Format
            </button>
          </div>

          <p className="text-xs text-neutral-500 leading-relaxed">
            Paste CSV formatted rows matching the schema below. Amounts are whole minor units (e.g. 2500000 = $25,000.00). Unpaid invoices require 0 paid amount and an empty paid date.
          </p>

          <div className="bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] rounded-lg p-2 overflow-x-auto">
            <code className="text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
              {INVOICE_COLUMNS.join(",")}
            </code>
          </div>

          <textarea
            rows={5}
            placeholder={`invoice_ref,invoice_date,due_date,amount_minor,paid_minor,paid_date\nINV-001,2026-09-01,2026-10-01,1000000,1000000,2026-10-01`}
            className={`${inputClass} font-mono text-xs`}
            value={csv}
            onChange={e => setCsv(e.target.value)}
            spellCheck={false}
          />

          {parsed && parsed.errors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 space-y-1">
              <span className="font-semibold block">Please correct the following errors:</span>
              <ul className="list-disc pl-4 space-y-0.5">
                {parsed.errors.slice(0, 5).map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
              {parsed.errors.length > 5 && (
                <span className="italic block mt-1">...and {parsed.errors.length - 5} more issues.</span>
              )}
            </div>
          )}

          {parsed && parsed.errors.length === 0 && parsed.invoices.length > 0 && (
            <div className="rounded-xl border border-neutral-200 bg-white dark:bg-[#1E2021] p-3 text-xs text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600" />
              <span>{parsed.invoices.length} invoices validated and ready for financial revision commit.</span>
            </div>
          )}

          {error && <Alert tone="error">{error}</Alert>}
          {notice && <Alert tone="ok">{notice}</Alert>}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              className={buttonPrimary}
              disabled={busy || !parsed || parsed.errors.length > 0 || parsed.invoices.length === 0 || revision === undefined}
            >
              {busy ? "Importing Invoices..." : "Commit Import to Ledger"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCsv("");
                setShowImport(false);
              }}
              className={buttonSecondary}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {invoices.isPending && (
        <div className="py-6">
          <Loading what="invoices" />
        </div>
      )}

      {invoices.isError && (
        <QueryError
          error={invoices.error}
          retry={() => void invoices.refetch()}
          retrying={invoices.isFetching}
        />
      )}

      {invoices.isSuccess && items.length === 0 && (
        <div className="py-10 text-center rounded-xl border border-dashed border-[#E8E6E1] dark:border-[#2C302F] p-4 text-xs text-neutral-400">
          No past invoices recorded for this customer yet.
        </div>
      )}

      {/* Structured Clean Table */}
      {items.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-[#E8E6E1] dark:border-[#2C302F]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#FAF9F7] dark:bg-[#181A1B] text-neutral-500 border-b border-[#E8E6E1] dark:border-[#2C302F]">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Reference</th>
                <th className="py-2.5 px-3 font-semibold">Invoice Date</th>
                <th className="py-2.5 px-3 font-semibold">Due Date</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                <th className="py-2.5 px-3 font-semibold text-right">Paid</th>
                <th className="py-2.5 px-3 font-semibold text-center">Settlement Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E6E1] dark:divide-[#2C302F] bg-white dark:bg-[#1E2021]">
              {items.map(i => {
                const isPaid = !!i.invoice.paid_date;
                return (
                  <tr key={i.id} className="hover:bg-[#FAF9F7] dark:hover:bg-[#252829] transition-colors">
                    <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                      {i.invoice.invoice_ref}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      {i.invoice.invoice_date}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-400">
                      {i.invoice.due_date}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-neutral-900 dark:text-white">
                      {currency ? formatMinor(i.invoice.amount_minor, currency) : i.invoice.amount_minor}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-right text-neutral-900 dark:text-white">
                      {currency ? formatMinor(i.invoice.paid_minor, currency) : i.invoice.paid_minor}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      {isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300">
                          <CheckCircle2 className="size-3 text-emerald-600 shrink-0" />
                          <span>Paid {i.invoice.paid_date}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Clock className="size-3 text-amber-600 shrink-0" />
                          <span>Unpaid</span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {invoices.hasNextPage && (
        <div className="pt-2">
          <button
            type="button"
            className={buttonSecondary}
            disabled={invoices.isFetchingNextPage}
            onClick={() => void invoices.fetchNextPage()}
          >
            {invoices.isFetchingNextPage ? "Loading more..." : "Load older invoices"}
          </button>
        </div>
      )}
    </section>
  );
}
