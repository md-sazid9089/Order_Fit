import { Suspense } from "react";
import { AuthShell } from "@/components/layout/auth-shell";
import { AppShellSkeleton } from "@/components/ui/skeleton";

// Overview is protected by AuthShell to enforce business tenancy, authenticated session and role display.
export default function OverviewLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AuthShell>{children}</AuthShell>
    </Suspense>
  );
}
