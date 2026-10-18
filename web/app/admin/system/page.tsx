"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";
import { HEALTH_TEXT, healthState, parseProbe, type Probe } from "@/lib/health-model";

/** Shows only what the same-origin /api/health probe reports: API liveness, readiness and database. No fabricated metrics or controls. */
export default function AdminSystemPage() {
  const router = useRouter();
  const [probe, setProbe] = useState<Probe | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const check = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      setProbe(parseProbe(res.status, await res.json().catch(() => null)));
    } catch {
      setProbe({ connected: false, ready: false, database: false });
    } finally {
      setCheckedAt(new Date().toLocaleTimeString());
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    async function checkAuth() {
      try {
        const sess = await getSession();
        if (sess.is_platform_admin !== true) {
          router.replace("/deals");
          return;
        }
        void check();
      } catch {
        router.replace("/auth/signin");
      }
    }
    void checkAuth();
  }, [router, check]);

  const state = HEALTH_TEXT[healthState(probe)];
  const flag = (value: boolean | null | undefined) => (value === true ? "Yes" : value === false ? "No" : "Unknown");

  return (
    <div className="min-h-screen bg-[#F7F6F5] text-[#1A1A1A] font-sans flex flex-row selection:bg-neutral-300 selection:text-neutral-900">
      <AppSidebar variant="admin" />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/95 backdrop-blur-md border-b border-[#E8E6E1] px-4 sm:px-6 lg:px-8">
          <div className="max-w-[1560px] mx-auto h-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <Link
                href="/admin"
                className="p-1.5 rounded-xl bg-[#FAF9F7] hover:bg-[#F4F2ED] border border-[#E8E6E1] text-[#525252] hover:text-[#1E2021] transition-colors shrink-0"
                title="Return to Platform Overview"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">System status</h1>
            </div>
            <div className="flex items-center gap-2.5">
              <ThemeToggle variant="icon" />
              <button
                type="button"
                onClick={() => void check()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#FAF9F7] text-[#525252] hover:text-[#1E2021] border border-[#E8E6E1] transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
                <span>{busy ? "Checking..." : "Re-check"}</span>
              </button>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full flex-1">
          <div className="max-w-2xl space-y-4">
            <div className="bg-white border border-[#E8E6E1] rounded-2xl p-5 shadow-xs">
              <div className="text-sm font-bold text-[#1E2021]">{state.label}</div>
              <p className="text-xs text-[#525252] mt-1">{state.detail}</p>
              <dl className="grid grid-cols-3 gap-4 mt-4 text-xs">
                <div><dt className="text-[#737373] uppercase tracking-wider text-[11px]">API reachable</dt><dd className="font-semibold">{flag(probe?.connected)}</dd></div>
                <div><dt className="text-[#737373] uppercase tracking-wider text-[11px]">Ready</dt><dd className="font-semibold">{flag(probe?.ready)}</dd></div>
                <div><dt className="text-[#737373] uppercase tracking-wider text-[11px]">Database</dt><dd className="font-semibold">{flag(probe?.database)}</dd></div>
              </dl>
              {checkedAt && <p className="text-[11px] text-[#737373] mt-4">Last checked {checkedAt}</p>}
            </div>
            <p className="text-xs text-[#525252]">
              Readiness covers the database login, current schema, private storage and worker heartbeat. Per-node
              metrics, maintenance mode and schema verification are not provided by this release.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
