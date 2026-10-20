"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AdminData, emptyAdminState, type AdminSection } from "@/lib/admin-data";
import { formatMinor } from "@/lib/approval-model";
import { mutate } from "@/lib/orderfit-api";
import { registerSessionResetListener, resetSessionState } from "@/lib/session-reset";
import type { AdminUser, AdminTenant, AdminOrder } from "@/lib/generated-api";

const titles: Record<AdminSection, string> = { overview: "Platform overview", users: "Platform users", tenants: "Platform businesses", orders: "Platform orders", system: "System checks", logs: "Global audit logs", engine: "Engine information", security: "Security information" };
const button = "rounded-lg border px-4 py-2 text-sm disabled:opacity-50 hover:bg-neutral-100 dark:hover:bg-neutral-800";
const card = "rounded-xl border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-5 space-y-3";

export function PlatformScreen({ section }: { section: AdminSection }) {
  const [state, setState] = useState(emptyAdminState);
  const [data] = useState(() => new AdminData(setState));
  const [signoutError, setSignoutError] = useState("");
  const router = useRouter();
  const queryClient = useQueryClient();
  useEffect(() => {
    const unregister = registerSessionResetListener(() => data.clear());
    void data.load(section);
    const refresh = () => { void data.load(section); };
    window.addEventListener("focus", refresh);
    return () => { unregister(); window.removeEventListener("focus", refresh); data.clear(); };
  }, [data, section]);
  async function signout() {
    data.clear();
    resetSessionState(queryClient);
    try { await mutate("/auth/signout", "POST", {}); router.replace("/auth/signin"); router.refresh(); }
    catch { setSignoutError("Signout could not be confirmed. Retry signout."); }
  }
  const system = state.system;
  const overview = state.overview;
  const columns = section === "users" ? ["ID", "Name", "Email", "Platform administrator", "Version"] : section === "tenants" ? ["ID", "Business", "Currency", "Timezone", "Status", "Created"] : ["ID", "Business ID", "Status", "Recorded order value", "Created"];
  return <div className="min-h-screen flex bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <AppSidebar variant="admin" onSignOut={() => void signout()} />
    <main className="flex-1 min-w-0 p-4 pt-16 sm:p-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pl-12 lg:pl-0"><h1 className="text-2xl font-semibold">{titles[section]}</h1><div className="flex gap-3"><ThemeToggle variant="icon" /><button className={button} onClick={() => void data.load(section)} disabled={state.loading}>Restart / refresh</button></div></header>
      <p>Read-only platform oversight. Business detail access requires separate business authorization.</p>
      {signoutError && <p role="alert">{signoutError} <button className={button} onClick={() => void signout()}>Retry signout</button></p>}
      {state.loading && <p role="status">Loading administrative data…</p>}
      {state.message && <div className={card} role="alert"><p>{state.message}</p><button className={button} onClick={() => void data.load(section)}>Retry from first page</button></div>}
      {state.enabled && <>
        {state.overviewError && <p role="alert">Overview: {state.overviewError}</p>}
        {overview && <section className={card} aria-label="Global totals"><h2 className="text-xl font-semibold">Global totals</h2><p>As of {overview.as_of}</p><dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">{[["Users", overview.total_users], ["Businesses", overview.total_tenants], ["Active businesses", overview.active_tenants], ["Orders", overview.total_orders]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd className="text-2xl">{value}</dd></div>)}</dl><h3>Recorded order value</h3>{overview.order_value_by_currency.length ? overview.order_value_by_currency.map(total => <p key={total.currency} className="break-all">{formatMinor(total.amount_minor, total.currency)} · {total.orders_with_value} orders with value</p>) : <p>No recorded order values.</p>}<p>{overview.orders_without_value} orders without a recorded value.</p></section>}
        {state.systemError && <p role="alert">System: {state.systemError}</p>}
        {system && <section className={card} aria-label="System checks"><h2 className="text-xl font-semibold">System: {system.status}</h2><p>Checked at {system.checked_at}</p><dl>{Object.entries(system.checks).map(([name, value]) => <div key={name} className="flex gap-4"><dt>{name.replaceAll("_", " ")}</dt><dd>{value === null ? "Unknown" : value ? "Healthy" : "Failed"}</dd></div>)}</dl></section>}
        {["users", "tenants", "orders"].includes(section) && <section className={card}><p>{state.rows.length} loaded results. Continuation is bounded to 50 rows per request.</p>{!state.loading && !state.rows.length ? <p>No {section} found.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Loaded {section}</caption><thead><tr>{columns.map(label => <th className="p-3" key={label} scope="col">{label}</th>)}</tr></thead><tbody>{state.rows.map(row => {
          let cells: (string | number)[];
          if (section === "users") { const user = row as AdminUser; cells = [user.id, user.full_name, user.email, user.is_platform_admin ? "Yes" : "No", user.version]; }
          else if (section === "tenants") { const tenant = row as AdminTenant; cells = [tenant.id, tenant.name, tenant.currency, tenant.timezone, tenant.status, tenant.created_at]; }
          else { const order = row as AdminOrder; cells = [order.id, order.business_id, order.status, order.order_value_minor === null ? "Not recorded" : formatMinor(order.order_value_minor, order.currency), order.created_at]; }
          return <tr key={row.id}>{cells.map((cell, index) => <td key={index} className="p-3 border-t break-words">{cell}</td>)}</tr>;
        })}</tbody></table></div>}{state.next && <button className={button} disabled={state.loading} onClick={() => void data.load(section, true)}>Load more</button>}</section>}
      </>}
      {section === "logs" && <section className={card}><h2>Global logs unavailable</h2><p>No global audit stream is supported. Authorized business audit history is available in the business application.</p></section>}
      {section === "engine" && <section className={card}><h2>Informational reference</h2><p>The deterministic financial engine uses integer minor units and confirmed inputs. This page provides no live engine configuration or deployment verification.</p></section>}
      {section === "security" && <section className={card}><h2>Informational reference</h2><p>Platform administration does not grant business membership. Financial actions require current business authorization and human approval. This page is not a live security assessment or account configuration interface.</p></section>}
    </main>
  </div>;
}
