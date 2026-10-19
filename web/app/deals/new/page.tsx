"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useCollection, CollectionPages } from "@/components/collection-pages";
import { ApiError, get, mutate, manualEvidence, type Business, type BaselineView, type ConstraintsView, type Customer, type Deal, type DraftInputs } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { resolveBusinessId } from "@/lib/business-scope";
import { ManualOrderInputs, fieldClass as field } from "@/components/manual-order-inputs";
import { SkeletonForm } from "@/components/ui/skeleton";

export default function NewDealPage() {
  const router = useRouter();
  const { session, businessId: scoped } = useScope();

  // ==========================================
  // 2. MANUAL ORDER CREATION BACKEND STATE
  // ==========================================
  const [businessId, setBusinessId] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [baseline, setBaseline] = useState<BaselineView | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [openingDate, setOpeningDate] = useState("");
  const [openingCash, setOpeningCash] = useState("");
  const [coverage, setCoverage] = useState("");
  const [attestation, setAttestation] = useState("");
  const [customerDomains, setCustomerDomains] = useState("");
  const [reference, setReference] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [createdDraft, setCreatedDraft] = useState<Deal | null>(null);
  const createdId = createdDraft?.id ?? null;
  const [draftInputs, setInputs] = useState<DraftInputs>({
    opening_cash_minor: null,
    reserve_minor: null,
    order_value_minor: null,
    order_date: null,
    invoice_date: null,
    delivery_date: null,
    payment_basis: "delivery",
    payment_days: null,
    customer_id: null,
    constraints_id: "",
    costs: [],
  });

  const customerPages = useCollection<Customer>(`/businesses/${businessId}/customers`, !!businessId);
  const policyPages = useCollection<ConstraintsView>(`/businesses/${businessId}/constraints`, !!businessId);
  const customers = customerPages.items.filter((c) => !c.archived_at);
  const constraints = policyPages.items;
  const defaultPolicy = constraints.find((p) => p.is_default);
  const inputs = {
    ...draftInputs,
    constraints_id: draftInputs.constraints_id || defaultPolicy?.id || "",
    reserve_minor: draftInputs.reserve_minor ?? defaultPolicy?.reserve_minor ?? null,
  };

  async function load(id: string) {
    const b = await get<Business>(`/businesses/${id}/profile`);
    setBusiness(b);
    const defaults = await get<{ items: ConstraintsView[] }>(`/businesses/${id}/constraints?default_only=true`);
    const chosen = defaults.items[0];
    if (chosen) {
      setInputs((value) =>
        value.constraints_id
          ? value
          : {
              ...value,
              constraints_id: chosen.id,
              reserve_minor: value.reserve_minor ?? chosen.reserve_minor,
            },
      );
    }
    try {
      const balance = await get<BaselineView>(`/businesses/${id}/baseline`);
      setBaseline(balance);
      setInputs((value) => ({ ...value, opening_cash_minor: null }));
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== "BASELINE_NOT_CONFIGURED") throw e;
    }
  }

  useEffect(() => {
    let active = true;
    const id = resolveBusinessId(session.memberships, new URLSearchParams(window.location.search).get("businessId"), scoped);
    void Promise.resolve()
      .then(async () => {
        if (!id) throw new Error("No authorized business membership is available for this link.");
        if (active) {
          setBusinessId(id);
          await load(id);
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : "Could not load your business.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveBaseline(e: FormEvent) {
    e.preventDefault();
    if (!business) return;
    setBusy(true);
    setError("");
    try {
      await mutate(`/businesses/${businessId}/baseline`, "PATCH", {
        expected_version: business.version,
        expected_financial_revision: business.financial_revision,
        balance: {
          opening_date: openingDate,
          opening_cash_minor: openingCash,
          coverage_through: coverage,
          evidence: manualEvidence("baseline", attestation),
        },
      });
      await load(businessId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save baseline.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!baseline || !business) return;
    setBusy(true);
    setError("");
    try {
      let customerId = inputs.customer_id;
      if (!customerId) {
        if (!customerName.trim()) throw new Error("Select or enter a customer.");
        const customer = await mutate<Customer>(`/businesses/${businessId}/customers`, "POST", {
          expected_financial_revision: business.financial_revision,
          customer: {
            name: customerName.trim(),
            known_domains: customerDomains
              .split(",")
              .map((d) => d.trim().toLowerCase())
              .filter(Boolean),
            red_flags: [],
          },
        });
        customerId = customer.id;
        setInputs((value) => ({ ...value, customer_id: customerId }));
      }
      const created =
        createdDraft ??
        (await mutate<Deal>(`/businesses/${businessId}/deals`, "POST", {
          public_ref: reference.trim(),
          start_date: startDate,
          constraints_id: inputs.constraints_id,
          customer_id: customerId,
        }));
      setCreatedDraft(created);
      await mutate(`/businesses/${businessId}/deals/${created.id}`, "PATCH", {
        expected_version: created.version,
        expected_input_version: created.input_version,
        expected_financial_revision: created.financial_revision,
        inputs: { ...inputs, customer_id: customerId },
      });
      router.push(`/deals/${created.id}?businessId=${businessId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1560px] mx-auto w-full min-w-0">
      {/* Top Header & Navigation Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#E8E6E1] dark:border-[#2C302F]">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={businessId ? `/deals?businessId=${businessId}` : "/deals"}
            className="p-2 rounded-xl bg-white dark:bg-[#1E2021] hover:bg-[#FAF9F7] dark:hover:bg-[#2C302F] border border-[#E8E6E1] dark:border-[#2C302F] text-[#525252] dark:text-neutral-300 hover:text-[#1E2021] transition-colors shrink-0"
            title="Return to Deals Pipeline"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs text-[#737373] dark:text-neutral-400 mb-0.5">
              <Link href={businessId ? `/deals?businessId=${businessId}` : "/deals"} className="hover:text-[#1E2021] dark:hover:text-white transition-colors">
                Deals Pipeline
              </Link>
              <span className="text-[#A3A3A3]">/</span>
              <span className="font-semibold text-[#1E2021] dark:text-white">Evaluate New Order</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-[#1E2021] dark:text-white font-display leading-tight">
              Evaluate New Order
            </h1>
          </div>
        </div>

        {/* Stepper Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white dark:bg-[#1E2021] border border-[#E8E6E1] dark:border-[#2C302F] text-[11px] font-medium text-[#737373] dark:text-neutral-400">
          <span className="font-bold text-[#1E2021] dark:text-white flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-[#1E2021] dark:bg-white" />
            1. Ingest
          </span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#737373] dark:text-neutral-400">2. Validate</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">3. Confirm</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">4. Compute</span>
          <ChevronRight className="size-3 text-[#A3A3A3]" />
          <span className="text-[#A3A3A3]">5. Approve</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-4 text-xs text-[#525252] dark:text-neutral-300 shadow-xs">
        Enter the order values below. Supporting documents are attached after the order is saved, on the order&apos;s Documents page, where you can request value extraction when it is available and
        review every value before it is used.
      </div>

      <div className="space-y-5">
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-4 text-xs text-red-800 dark:text-red-200">
            {error}{" "}
            {createdId && (
              <Link className="underline font-semibold" href={`/deals/${createdId}?businessId=${businessId}`}>
                Open the saved draft
              </Link>
            )}
          </p>
        )}

        {loading && (
          <div role="status" aria-busy="true" className="space-y-4">
            <span className="sr-only">Loading your business…</span>
            <SkeletonForm fields={4} />
          </div>
        )}

        {!loading && business && !baseline && (
          <form onSubmit={saveBaseline} className="space-y-3 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-xs">
            <h2 className="font-semibold text-sm text-[#1E2021] dark:text-white">Set the business cash baseline first</h2>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Opening date
              <input required type="date" className={field} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
            </label>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Opening cash (integer minor units)
              <input required inputMode="numeric" pattern="-?(0|[1-9][0-9]*)" className={field} value={openingCash} onChange={(e) => setOpeningCash(e.target.value)} />
            </label>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Coverage through
              <input required type="date" min={openingDate} className={field} value={coverage} onChange={(e) => setCoverage(e.target.value)} />
            </label>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Source attestation
              <input required className={field} value={attestation} onChange={(e) => setAttestation(e.target.value)} />
            </label>
            <button disabled={busy} className="rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] px-4 py-2 text-xs font-semibold cursor-pointer disabled:opacity-50">
              {busy ? "Saving…" : "Save baseline"}
            </button>
          </form>
        )}

        {baseline && (
          <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[#E8E6E1] dark:border-[#2C302F] bg-white dark:bg-[#1E2021] p-5 shadow-xs">
            <h2 className="font-semibold text-sm text-[#1E2021] dark:text-white">Order details</h2>
            <p className="text-xs text-[#525252] dark:text-neutral-400">
              Opening cash: {baseline.balance.opening_cash_minor} minor units, as of {baseline.balance.opening_date}; coverage through {baseline.balance.coverage_through}.{" "}
              <Link className="underline font-semibold" href={`/deals/sources?businessId=${businessId}`}>
                Edit cash events, baseline and financing
              </Link>
            </p>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Order reference
              <input required maxLength={64} disabled={!!createdId} className={field} value={reference} onChange={(e) => setReference(e.target.value)} />
            </label>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              As-of/start date
              <input
                required
                disabled={!!createdId}
                type="date"
                className={field}
                min={baseline.balance.opening_date}
                max={baseline.balance.opening_date}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </label>
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Customer
              <select className={field} value={inputs.customer_id ?? ""} onChange={(e) => setInputs({ ...inputs, customer_id: e.target.value || null })}>
                <option value="">Add a customer below</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.customer.name}
                  </option>
                ))}
              </select>
            </label>
            {!inputs.customer_id && (
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                New customer name
                <input required className={field} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
            )}
            {!inputs.customer_id && (
              <label className="block text-xs text-[#737373] dark:text-neutral-400">
                Known customer email domains (comma separated)
                <input className={field} value={customerDomains} onChange={(e) => setCustomerDomains(e.target.value)} placeholder="buyer.example" />
              </label>
            )}
            <label className="block text-xs text-[#737373] dark:text-neutral-400">
              Policy and financing configuration
              <select
                required
                className={field}
                value={inputs.constraints_id}
                onChange={(e) => {
                  const selected = constraints.find((c) => c.id === e.target.value);
                  if (selected) {
                    setInputs({
                      ...inputs,
                      constraints_id: selected.id,
                      reserve_minor: selected.reserve_minor,
                    });
                  }
                }}
              >
                {!constraints.some((c) => c.id === inputs.constraints_id) && inputs.constraints_id && <option value={inputs.constraints_id}>Selected default policy</option>}
                {constraints.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.is_default ? "Default policy" : "Saved policy"} · {c.strategy_space.offer_ids.length} financing offers · {c.id.slice(0, 8)}
                  </option>
                ))}
              </select>
            </label>

            <CollectionPages query={customerPages} noun="customers" />
            <CollectionPages query={policyPages} noun="policies" />
            <ManualOrderInputs value={inputs} onChange={setInputs} />

            <button
              disabled={busy || !inputs.constraints_id}
              className="rounded-xl bg-[#1E2021] hover:bg-black text-white dark:bg-white dark:text-[#1E2021] px-5 py-2.5 text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save and review"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
