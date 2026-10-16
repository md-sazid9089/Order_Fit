import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppShellSkeleton } from "@/components/ui/skeleton";

// The shell reads runtime-only data (path, session), so it streams in behind a boundary.
export default function DealsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}
