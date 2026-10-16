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
