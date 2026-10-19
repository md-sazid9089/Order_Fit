"use client";

import React, { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCollection, CollectionPages } from "@/components/collection-pages";
import { ApiError, get, mutate, manualEvidence, type Business, type BaselineView, type ConstraintsView, type Customer, type Deal, type DraftInputs } from "@/lib/orderfit-api";
import { useScope } from "@/components/layout/auth-shell";
import { resolveBusinessId } from "@/lib/business-scope";
import { ManualOrderInputs, fieldClass as field } from "@/components/manual-order-inputs";
import { SkeletonForm } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/system/page-header";
import { Panel } from "@/components/system/panel";
import { InlineAlert } from "@/components/system/inline-alert";
import { MoneyField } from "@/components/system/money-field";
import { OrderJourney } from "@/components/system/order-journey";
import { formatMinor } from "@/lib/approval-model";

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

  const pipelineHref = businessId ? `/deals?businessId=${businessId}` : "/deals";
  const labelClass = "block text-sm font-medium text-foreground";

  return (
    <main className="mx-auto w-full max-w-3xl min-w-0 space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        back={{ href: pipelineHref, label: "Pipeline" }}
        title="New order"
        description="Enter the order as it appears on the purchase order. After you save it, you review the inputs and run the evaluation. Nothing is sent to a customer, supplier or bank."
      />
      <OrderJourney businessId={businessId} />

      <InlineAlert tone="info">
        Documents are attached after the order is saved, on its Documents page. Extracted values wait for your review before they are used.
      </InlineAlert>

      {error && (
        <InlineAlert
          tone="danger"
          title="The order wasn&apos;t saved"
          action={createdId ? <Link className="font-semibold text-primary underline" href={`/deals/${createdId}?businessId=${businessId}`}>Open the saved draft</Link> : undefined}
        >
          {error}
        </InlineAlert>
      )}

      {loading && (
        <div role="status" aria-busy="true" className="space-y-4">
          <span className="sr-only">Loading your business…</span>
          <SkeletonForm fields={4} />
        </div>
      )}

      {!loading && business && !baseline && (
        <form onSubmit={saveBaseline}>
          <Panel
            title="Set the business cash baseline first"
            description="Every evaluation starts from the cash you hold on a known date. Record it once; you can edit it later under Cash & Financing."
            bodyClassName="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Opening date
                <input required type="date" className={field} value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
              </label>
              <MoneyField label="Opening cash" currency={business.currency} required allowNegative valueMinor={openingCash} onChangeMinor={setOpeningCash} hint="The balance on the opening date. Enter a negative amount for an overdraft." />
              <label className={labelClass}>
                Coverage through
                <input required type="date" min={openingDate} className={field} value={coverage} onChange={(e) => setCoverage(e.target.value)} />
              </label>
              <label className={labelClass}>
                Source attestation
                <input required className={field} placeholder="e.g. Bank statement, 19 October" value={attestation} onChange={(e) => setAttestation(e.target.value)} />
              </label>
            </div>
            <Button type="submit" disabled={busy || !openingCash}>{busy ? "Saving…" : "Save baseline"}</Button>
          </Panel>
        </form>
      )}

      {baseline && business && (
        <form onSubmit={submit} className="space-y-6">
          <Panel
            title="Order details"
            description={
              <>
                Opening cash <span className="tabular font-medium text-foreground">{formatMinor(baseline.balance.opening_cash_minor, business.currency)}</span> on {baseline.balance.opening_date}, covered through {baseline.balance.coverage_through}.{" "}
                <Link className="font-medium text-primary underline" href={`/deals/sources?businessId=${businessId}`}>Edit cash and financing</Link>
              </>
            }
            bodyClassName="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <label className={labelClass}>
                Order reference
                <input required maxLength={64} disabled={!!createdId} className={field} placeholder="As on the purchase order" value={reference} onChange={(e) => setReference(e.target.value)} />
              </label>
              <label className={labelClass}>
                As-of/start date
                <input required disabled={!!createdId} type="date" className={field} min={baseline.balance.opening_date} max={baseline.balance.opening_date} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </label>
              <label className={labelClass}>
                Customer
                <select className={field} value={inputs.customer_id ?? ""} onChange={(e) => setInputs({ ...inputs, customer_id: e.target.value || null })}>
                  <option value="">New customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.customer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={labelClass}>
                Policy and financing configuration
                <select
                  required
                  className={field}
                  value={inputs.constraints_id}
                  onChange={(e) => {
                    const selected = constraints.find((c) => c.id === e.target.value);
                    if (selected) setInputs({ ...inputs, constraints_id: selected.id, reserve_minor: selected.reserve_minor });
                  }}
                >
                  {!constraints.some((c) => c.id === inputs.constraints_id) && inputs.constraints_id && <option value={inputs.constraints_id}>Default policy</option>}
                  {constraints.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.is_default ? "Default policy" : `Saved policy, version ${c.version}`} · {c.strategy_space.offer_ids.length === 1 ? "1 financing offer" : `${c.strategy_space.offer_ids.length} financing offers`}
                    </option>
                  ))}
                </select>
              </label>
              {!inputs.customer_id && (
                <label className={labelClass}>
                  New customer name
                  <input required className={field} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                </label>
              )}
              {!inputs.customer_id && (
                <label className={labelClass}>
                  Known customer email domains (comma separated)
                  <input className={field} value={customerDomains} onChange={(e) => setCustomerDomains(e.target.value)} placeholder="buyer.example" />
                </label>
              )}
            </div>
            <CollectionPages query={customerPages} noun="customers" />
            <CollectionPages query={policyPages} noun="policies" />
          </Panel>

          <Panel title="Terms and costs" description="Amounts are in the business currency and are stored exactly. The evaluation, not this form, works out what they mean for your cash.">
            <ManualOrderInputs value={inputs} onChange={setInputs} currency={business.currency} />
          </Panel>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={busy || !inputs.constraints_id}>{busy ? "Saving…" : "Save and review"}</Button>
            <Link href={pipelineHref} className="text-sm font-medium text-muted-foreground hover:text-foreground">Cancel</Link>
          </div>
        </form>
      )}
    </main>
  );
}
