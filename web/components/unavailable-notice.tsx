import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppShellSkeleton } from "@/components/ui/skeleton";

/** Honest placeholder for screens that have no registered backend operation in this release. */
export function UnavailableNotice({ title, reason, href = "/deals/sources", linkLabel = "Open cash, payees and financing" }: { title: string; reason: string; href?: string; linkLabel?: string }) {
  return (
    <main className="px-3.5 sm:px-6 lg:px-8 py-5 sm:py-6 w-full min-w-0">
      <div className="max-w-[1560px] mx-auto space-y-4 w-full min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Not available in this release</p>
        <h1 className="text-xl sm:text-2xl font-bold font-display text-[#1E2021] dark:text-white break-words">{title}</h1>
        <p className="text-neutral-700 dark:text-neutral-300 break-words">{reason}</p>
        <p><Link className="underline break-all" href={href}>{linkLabel}</Link></p>
      </div>
    </main>
  );
}

/** Authenticated route wrapper: session guard plus the notice. */
export function UnavailablePage(props: Parameters<typeof UnavailableNotice>[0]) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthShell><UnavailableNotice {...props} /></AuthShell>
    </Suspense>
  );
}
