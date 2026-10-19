import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppShellSkeleton } from "@/components/ui/skeleton";

/** Honest full-page notice: what is not possible here, why, and the real next step. */
export function UnavailableNotice({ title, reason, href = "/deals/sources", linkLabel = "Open cash, payees and financing" }: { title: string; reason: string; href?: string; linkLabel?: string }) {
  return (
    <main className="flex w-full flex-1 items-start justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground text-balance">{title}</h1>
        <p className="text-sm leading-6 text-muted-foreground">{reason}</p>
        <Link
          href={href}
          className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {linkLabel}
        </Link>
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
