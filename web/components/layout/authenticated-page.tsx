import { Suspense, type ReactNode } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppShellSkeleton } from "@/components/ui/skeleton";

/** Session guard for authenticated routes outside /deals (which has its own layout). Streams in behind a boundary. */
export function AuthenticatedPage({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}
