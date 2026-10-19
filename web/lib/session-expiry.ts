// Pure helpers for the shared session-expiry path. No browser or network access.

/** Pages that work without a session. A 401 here is expected and must never redirect (no sign-in loop). */
export function isPublicPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/auth" || pathname.startsWith("/auth/");
}

export const SESSION_EXPIRED_SIGNIN = "/auth/signin?reason=session-expired";

/** Where to send the user after a 401, or null when they are already on a public page. */
export function expiryRedirect(pathname: string): string | null {
  return isPublicPath(pathname) ? null : SESSION_EXPIRED_SIGNIN;
}

/** Post-sign-in destinations a `next` parameter may name. An allow-list, never an arbitrary URL (no open redirect). */
const SAFE_NEXT = new Set(["/auth/invitations/accept"]);
export function safeNext(next: string | null): string | null { return next !== null && SAFE_NEXT.has(next) ? next : null; }

/** Notice shown on the sign-in page for the reason query parameter, or "" for an unknown reason. */
export function signInNotice(reason: string | null): string {
  if (reason === "password-changed") return "Your password was changed and all sessions ended. Sign in with the new password.";
  if (reason === "session-expired") return "Your session expired, so you were signed out. Sign in again; nothing was changed by the request that failed. Review the page before repeating it.";
  return "";
}

/** Workspace areas a sign-in may return to. Anything else (other origins, auth pages, unknown paths) is dropped. */
const RETURN_PREFIXES = ["/overview", "/deals", "/cash-flow", "/financing", "/risk-constraints", "/payees", "/audit-log", "/settings", "/useraccess", "/users", "/admin"];

/**
 * A same-origin workspace path (with its query) to reopen after sign-in, or null. Rejects protocol-relative and
 * absolute URLs, backslashes, fragments and control characters, so it can never become an open redirect.
 */
export function safeReturnPath(value: string | null): string | null {
  if (!value || value.length > 512) return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("#") || /[\u0000-\u001f\u007f]/.test(value)) return null;
  const path = value.split("?")[0];
  if (path.includes(":") || path.includes("..")) return null;
  return RETURN_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) ? value : null;
}

/**
 * Where a 401 sends the user. "Session expired" is said only when this tab really had a session; a first visit gets a
 * plain sign-in. Either way the page they were on is kept so sign-in can reopen it.
 */
export function signInRedirect(pathname: string, search: string, hadSession: boolean): string | null {
  if (isPublicPath(pathname)) return null;
  const params = new URLSearchParams();
  if (hadSession) params.set("reason", "session-expired");
  const back = safeReturnPath(`${pathname}${search}`);
  if (back) params.set("return", back);
  const query = params.toString();
  return `/auth/signin${query ? `?${query}` : ""}`;
}
