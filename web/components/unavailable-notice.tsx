import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

/** Honest placeholder for screens that have no registered backend operation in this release. */
export function UnavailableNotice({ title, reason, href = "/deals/sources", linkLabel = "Open cash, payees and financing" }: { title: string; reason: string; href?: string; linkLabel?: string }) {
  return <main className="mx-auto max-w-2xl space-y-3 p-8">
    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Not available in this release</p>
    <h1 className="text-2xl font-semibold">{title}</h1>
    <p className="text-neutral-700">{reason}</p>
    <p><Link className="underline" href={href}>{linkLabel}</Link></p>
  </main>;
}

/** Authenticated route wrapper: session guard plus the notice. */
export function UnavailablePage(props: Parameters<typeof UnavailableNotice>[0]) {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f6f5] flex items-center justify-center p-8 text-neutral-400">
          <div className="flex items-center gap-2.5">
            <div className="size-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800" />
            <span className="text-xs font-medium tracking-wide">Loading…</span>
          </div>
        </main>
      }
    >
      <AuthShell><UnavailableNotice {...props} /></AuthShell>
    </Suspense>
  );
}
