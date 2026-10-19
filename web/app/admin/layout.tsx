import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSessionServer } from "@/lib/auth-server";
import { UnavailableNotice } from "@/components/unavailable-notice";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";

/**
 * Server-side security boundary for all /admin and nested /admin/* pages.
 * Enforces authoritative authentication and verified platform admin role
 * BEFORE any child page component, markup, or payload is ever generated or served.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("orderfit_session")?.value;
  const csrfToken = cookieStore.get("orderfit_csrf")?.value;

  // 1. Unauthenticated visitors are bounced to the sign-in page
  if (!sessionToken) {
    redirect("/auth/signin?return=%2Fadmin");
  }

  // 2. Validate session and retrieve authoritative role from backend
  const auth = await verifyAdminSessionServer(sessionToken, csrfToken);

  if (auth.unavailable) {
    return (
      <UnavailableNotice
        title="Session verification unavailable"
        reason="The server could not verify your session. No administrator content has been loaded. Retry when the API is available; this is not a rejected password."
        href="/admin"
        linkLabel="Retry verification"
      />
    );
  }

  if (!auth.authenticated) {
    redirect("/auth/signin?return=%2Fadmin");
  }

  // 3. Authenticated non-admin users are denied with an explanation (not a silent bounce).
  if (!auth.isAdmin) {
    return (
      <UnavailableNotice
        title="You don't have platform administrator access"
        reason="This area is for operators of the OrderFit service. Your account can still use every business you belong to."
        href="/deals"
        linkLabel="Go to your orders"
      />
    );
  }

  // 4. Verified platform administrator: one shared admin shell for every page.
  return <AdminShell email={auth.email}>{children}</AdminShell>;
}
