export interface ServerAuthVerification {
  authenticated: boolean;
  isAdmin: boolean;
  email?: string;
  userId?: string;
}

const BACKEND_INTERNAL_URL =
  process.env.INTERNAL_API_URL ||
  process.env.NEXT_PUBLIC_API_URL ||
  "http://127.0.0.1:8000";

/**
 * Authoritatively verifies an admin session on the server side using the backend identity service.
 * Never trusts any client-supplied role or browser storage.
 */
export async function verifyAdminSessionServer(
  sessionToken?: string | null,
  csrfToken?: string | null
): Promise<ServerAuthVerification> {
  if (!sessionToken) {
    return { authenticated: false, isAdmin: false };
  }

  try {
    const cookieHeader = [
      `orderfit_session=${sessionToken}`,
      csrfToken ? `orderfit_csrf=${csrfToken}` : "",
    ]
      .filter(Boolean)
      .join("; ");

    const headers: Record<string, string> = {
      Accept: "application/json",
      Cookie: cookieHeader,
      Authorization: `Bearer ${sessionToken}`,
    };

    if (csrfToken) {
      headers["X-CSRF-Token"] = csrfToken;
    }

    const res = await fetch(`${BACKEND_INTERNAL_URL}/api/v1/auth/me`, {
      method: "GET",
      headers,
      cache: "no-store",
    });

    if (res.status === 401) {
      return { authenticated: false, isAdmin: false };
    }

    if (!res.ok) {
      return { authenticated: false, isAdmin: false };
    }

    const session = await res.json();
    const isAdmin = Boolean(session?.is_platform_admin === true);

    return {
      authenticated: true,
      isAdmin,
      email: session?.email,
      userId: session?.user_id,
    };
  } catch (error) {
    // Fail closed on network or backend unavailability
    console.error("[auth-server] Verification failure:", error);
    return { authenticated: false, isAdmin: false };
  }
}
