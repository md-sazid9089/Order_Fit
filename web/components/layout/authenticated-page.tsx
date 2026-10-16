import { Suspense, type ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";

/** Session guard for authenticated routes outside /deals (which has its own layout). Streams in behind a boundary. */
export function AuthenticatedPage({ children }: { children: ReactNode }) {
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
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}
