"use client";

import Link from "next/link";

// Route-level boundary (Next 16 passes `retry`, which re-fetches and re-renders the segment).
// Server errors arrive with a generic message and a digest; only the digest is shown, as a support reference.
export default function RouteError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div role="alert" className="w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">This page couldn&apos;t load</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Something went wrong while showing this page. Nothing was saved or sent because of it. Try again, and if it
            keeps happening, return to your orders.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground">
              Reference: <span className="font-mono">{error.digest}</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="inline-flex h-10 items-center rounded-lg bg-brand-pine-green px-4 text-sm font-semibold text-brand-eggshell transition-colors hover:bg-brand-forest-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-pine-green"
          >
            Try again
          </button>
          <Link
            href="/deals"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-pine-green"
          >
            Go to your orders
          </Link>
        </div>
      </div>
    </main>
  );
}
