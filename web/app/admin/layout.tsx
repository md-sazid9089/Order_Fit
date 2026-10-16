import React from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyAdminSessionServer } from "@/lib/auth-server";

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

  if (!auth.authenticated) {
    redirect("/auth/signin");
  }

  // 3. Authenticated non-admin users are strictly denied and redirected to /deals
  if (!auth.isAdmin) {
    redirect("/deals");
  }

  // 4. Verified platform administrator: allow rendering of protected admin pages
  return <>{children}</>;
}
