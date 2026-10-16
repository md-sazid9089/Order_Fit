import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSessionServer } from "@/lib/auth-server";
import { UnavailableNotice } from "@/components/unavailable-notice";
import { platformAdminEnabled } from "@/lib/platform-admin";

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
    redirect("/auth/signin");
  }

  // 2. Validate session and retrieve authoritative role from backend
  const auth = await verifyAdminSessionServer(sessionToken, csrfToken);

  if (auth.unavailable) {
    return <UnavailableNotice title="Session verification unavailable" reason="The server could not verify your session. No administrator content has been loaded. Retry when the API is available; this is not a rejected password." href="/admin" linkLabel="Retry verification" />;
  }

  if (!auth.authenticated) {
    redirect("/auth/signin");
  }

  // 3. Authenticated non-admin users are strictly denied and redirected to /deals
  if (!auth.isAdmin) {
    redirect("/deals");
  }

  if (!platformAdminEnabled()) {
    return <UnavailableNotice title="Platform administration" reason="This console is not enabled in this release. Its cross-tenant reporting and operational controls need a verified backend contract; a platform-admin flag alone does not enable them." href="/deals" linkLabel="Open saved orders" />;
  }

  // 4. Verified platform administrator: allow rendering of protected admin pages
  return <>{children}</>;
}
