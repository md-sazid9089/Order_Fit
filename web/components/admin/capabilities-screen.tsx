"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getCapabilities } from "@/lib/p7-api";
import { groupCapabilities, llmModeText } from "@/lib/p7-model";
import { Loading, PageFrame, QueryError, panel, useScoped } from "@/components/p7/common";

const TITLES = { implemented: "Implemented", planned: "Planned (not available yet)", disabled: "Disabled", unavailable: "Unavailable" } as const;

/** Tenant-safe runtime evidence: what this API reports it can do. There is no cross-tenant administration in this release. */
export function CapabilitiesScreen() {
  const { businessId, key } = useScoped();
  const caps = useQuery({ queryKey: key("capabilities"), queryFn: () => getCapabilities(businessId), retry: false });
  const groups = caps.data ? groupCapabilities(caps.data.capabilities) : null;
  return <PageFrame title="Capabilities and runtime status" intro={<>What this API reports for the business you have selected. Cross-tenant administration is not available in this release, and no other tenant&apos;s users or orders are shown anywhere. For connection health see the status indicator at the bottom right.</>}>
    {caps.isPending && <Loading what="capabilities" />}
    {caps.isError && <QueryError error={caps.error} retry={() => void caps.refetch()} retrying={caps.isFetching} />}
    {caps.isSuccess && groups && <>
      <section className={panel}><h2 className="text-lg font-semibold">Runtime</h2><dl className="grid gap-1 text-sm sm:grid-cols-[14rem_1fr]">
        <dt>Contract version</dt><dd>{caps.data.contract_version}</dd>
        <dt>Execution</dt><dd>{caps.data.sandbox_only ? "Sandbox only: no email, bank, payment or lender is contacted." : "Not sandbox-only"}</dd>
        <dt>Language model</dt><dd>{llmModeText(caps.data.llm_mode)}</dd></dl></section>
      {(Object.keys(TITLES) as (keyof typeof TITLES)[]).map(status => groups[status].length > 0 && <section key={status} className={panel}><h2 className="text-lg font-semibold">{TITLES[status]} ({groups[status].length})</h2>
        <ul className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">{groups[status].map(c => <li key={c.name}><span className="font-mono text-xs">{c.name}</span> <span className="text-neutral-500">{c.phase}</span>{c.reason ? <span className="block text-xs text-neutral-600">{c.reason}</span> : null}</li>)}</ul></section>)}
      <p className="text-sm"><Link className="underline" href={`/deals?businessId=${businessId}`}>Back to orders</Link></p>
    </>}
  </PageFrame>;
}
