"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getBusiness, listConstraints } from "@/lib/p7-api";
import { bpsText } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import { Loading, PageFrame, QueryError, panel, useScoped } from "@/components/p7/common";

/** The saved default risk policy, read-only. Each edit creates a new immutable version under Cash and financing. */
export function RiskScreen() {
  const { businessId, key } = useScoped();
  const policies = useQuery({ queryKey: key("constraints"), queryFn: () => listConstraints(businessId), retry: false });
  const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });
  const currency = business.data?.currency ?? "";
  const money = (minor: string | null) => (minor === null ? "no limit" : currency ? formatMinor(minor, currency) : `${minor} minor units`);
  const current = policies.data?.items.find(p => p.is_default) ?? policies.data?.items[0];
  return <PageFrame title="Risk and constraints" intro={<>The default policy used by new evaluations. Policies are immutable versions: changing one creates a new version and never rewrites an order that already uses an earlier one. Edit under <Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Cash and financing</Link>.</>}>
    {policies.isPending && <Loading what="the policy" />}
    {policies.isError && <QueryError error={policies.error} retry={() => void policies.refetch()} retrying={policies.isFetching} />}
    {policies.isSuccess && !current && <p className={panel}>No policy is saved for this business.</p>}
    {current && <section className={panel}>
      <h2 className="text-lg font-semibold">{current.is_default ? "Default policy" : "Latest policy"} (version {current.version})</h2>
      <dl className="grid gap-1 text-sm sm:grid-cols-[16rem_1fr]">
        <dt>Cash reserve</dt><dd className="font-mono">{money(current.reserve_minor)}</dd>
        <dt>Priorities, in order</dt><dd>{current.owner.priorities.map(p => p.replaceAll("_", " ")).join(", ") || "none"}</dd>
        <dt>Target scenario</dt><dd>{current.owner.target_scenario}</dd>
        <dt>Minimum order profit</dt><dd className="font-mono">{money(current.owner.min_order_profit_minor)}</dd>
        <dt>Maximum financing cost</dt><dd className="font-mono">{money(current.owner.max_financing_cost_minor)}</dd>
        <dt>Close-call margin</dt><dd>{bpsText(current.owner.close_call_bps)}</dd>
        <dt>Largest deposit concession</dt><dd>{current.owner.max_deposit_concession_bps === null ? "no limit" : bpsText(current.owner.max_deposit_concession_bps)}</dd>
        <dt>Longest supplier extension</dt><dd>{current.owner.max_supplier_extension_days === null ? "no limit" : `${current.owner.max_supplier_extension_days} days`}</dd>
        <dt>Negotiation rounds allowed</dt><dd>{current.owner.max_negotiation_rounds}</dd>
        <dt>Deposit choices considered</dt><dd>{current.strategy_space.deposit_pcts.map(p => `${p}%`).join(", ") || "none"}</dd>
        <dt>Financing offers eligible</dt><dd>{current.strategy_space.offer_ids.length}</dd>
        <dt>Downside stress</dt><dd>{current.scenarios.downside.order_receipt_delay_days} days late order receipt, {current.scenarios.downside.ar_delay_days} days late receivables, cost overrun {bpsText(current.scenarios.downside.cost_overrun_bps)}</dd>
        <dt>Severe stress</dt><dd>{current.scenarios.severe.order_receipt_delay_days} days late order receipt, {current.scenarios.severe.ar_delay_days} days late receivables, cost overrun {bpsText(current.scenarios.severe.cost_overrun_bps)}</dd>
      </dl>
      {policies.data && policies.data.items.length > 1 && <p className="text-xs text-neutral-600">{policies.data.items.length} versions are saved; the default is shown.</p>}
    </section>}
  </PageFrame>;
}
