import Link from "next/link";

// Rendered inside the root layout for unmatched URLs and for notFound() calls (Next 16 file convention).
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md space-y-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          OrderFit
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-foreground">This page doesn&apos;t exist</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            The link may be mistyped, or the page has moved. Nothing in your workspace was changed.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/deals"
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Go to your orders
          </Link>
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            OrderFit home
          </Link>
        </div>
      </div>
    </main>
  );
}
