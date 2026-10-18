"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { getSession } from "@/lib/p7-api";

/** Read-only statement: the engine has no platform-level settings to edit, so this page offers no controls. */
export default function AdminEnginePage() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const sess = await getSession();
        if (sess.is_platform_admin !== true) router.replace("/deals");
      } catch {
        router.replace("/auth/signin");
      }
    }
    void checkAuth();
  }, [router]);

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
              <h1 className="text-base font-bold text-[#1E2021] font-display leading-tight">Deterministic engine</h1>
            </div>
            <ThemeToggle variant="icon" />
          </div>
        </header>
        <main className="p-4 sm:p-6 lg:p-8 max-w-[1560px] mx-auto w-full flex-1">
          <div className="max-w-2xl space-y-3 text-sm text-[#525252]">
            <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Not editable in this release</p>
            <p>
              Financial calculations are defined in code and verified against the reference fixtures; there are no
              platform-level engine settings to change from this console. Reserve floors and other limits are set per
              business under Risk constraints and are applied by the same engine.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
