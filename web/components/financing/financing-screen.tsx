"use client";

import { useCollection, CollectionPages } from "@/components/collection-pages";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { archiveOffer, getBusiness } from "@/lib/p7-api";
import { bpsText } from "@/lib/p7-model";
import { formatMinor } from "@/lib/approval-model";
import { ArchiveAction } from "@/components/p7/archive-action";
import { Loading, PageFrame, QueryError, panel, useScoped } from "@/components/p7/common";

/** Saved financing offers, read-only. Only fixed-term loans can be selected for evaluation; other kinds are informational. */
export function FinancingScreen() {
  const { businessId, key } = useScoped();
  const offers = useCollection<OfferView>(`/businesses/${businessId}/financing-offers`);
  const business = useQuery({ queryKey: key("business-profile"), queryFn: () => getBusiness(businessId), retry: false });
  const queryClient = useQueryClient();
  const currency = business.data?.currency ?? "";
  const money = (minor: string) => (currency ? formatMinor(minor, currency) : `${minor} minor units`);
  return <PageFrame title="Financing" intro={<>Offers recorded for this business. An offer here is a recorded proposal used in evaluations: availability and approval are never assumed, and no lender is contacted. Add or change offers under <Link className="underline" href={`/deals/sources?businessId=${businessId}`}>Cash and financing</Link>.</>}>
    {offers.isPending && <Loading what="financing offers" />}
    {offers.isError && <QueryError error={offers.error} retry={() => void offers.refetch()} retrying={offers.isFetching} />}
    {offers.isSuccess && !offers.data.items.length && <p className={panel}>No financing offers are saved.</p>}
    <CollectionPages query={offers} noun="offers" />
    {offers.isSuccess && offers.data.items.map(o => <section key={o.id} className={panel}>
      <div className="flex flex-wrap items-center gap-3"><h2 className="min-w-0 flex-1 text-lg font-semibold">{o.name}</h2><span className="text-sm text-neutral-600">{o.kind.replaceAll("_", " ")} · {o.status.replaceAll("_", " ")}{o.archived_at ? " · archived" : ""}</span></div>
      {o.supported && !o.archived_at ? <p className="text-sm text-green-800">Supported: can be selected for evaluation under your policy.</p> : <p className="text-sm text-amber-800">Not selectable{o.archived_at ? ": archived" : o.unavailable_reason ? `: ${o.unavailable_reason}` : ": this kind of financing is not supported yet"}.</p>}
      {o.terms && <dl className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr]">
        <dt>Principal range</dt><dd className="font-mono">{money(o.terms.min_minor)} to {money(o.terms.max_minor)} in steps of {money(o.terms.step_minor)}</dd>
        <dt>Term</dt><dd>{o.terms.term_days} days, flat-term interest {bpsText(o.terms.interest_bps)}</dd>
        <dt>Fees</dt><dd>{bpsText(o.terms.fee_bps)} plus {money(o.terms.fee_flat_minor)}, charged at {o.terms.fee_at}</dd>
        <dt>Funding lead time</dt><dd>{o.terms.lead_days} days</dd>
        <dt>Valid</dt><dd>{o.terms.available_from} to {o.terms.valid_until}</dd>
        <dt>Evidence</dt><dd>{o.terms.evidence.length} recorded source{o.terms.evidence.length === 1 ? "" : "s"}</dd></dl>}
      <ArchiveAction noun="offer" permission="manage_finance" record={o} financialRevision={business.data?.financial_revision} archive={body => archiveOffer(businessId, o.id, body)} onChanged={() => void queryClient.invalidateQueries()} consequence="An archived offer is closed and can no longer be selected for evaluation." />
    </section>)}
  </PageFrame>;
}

import type { OfferView } from "@/lib/generated-api";
