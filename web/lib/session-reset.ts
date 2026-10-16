import { clearPendingCommands, clearStoredToken } from "./orderfit-api";

const sessionResetListeners = new Set<() => void>();

export function registerSessionResetListener(fn: () => void): () => void {
  sessionResetListeners.add(fn);
  return () => { sessionResetListeners.delete(fn); };
}

/**
 * The one place that forgets everything tied to a signed-in session: pending idempotent commands and every cached
 * query. Sign-in, sign-out, session expiry and a password change all call this, so no path can clear one but not the other.
 */
export function resetSessionState(queryClient: { clear: () => void }) {
  if (typeof clearStoredToken === "function") clearStoredToken();
  clearPendingCommands();
  queryClient.clear();
  sessionResetListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

/**
 * Switching business: the cached data belongs to the previous business, so the query cache goes. Pending idempotent
 * commands are kept: each key is derived from the command's own path (which carries the business id) and body, so a
 * lost-response retry after a switch still replays the same key, and no other business can pick it up.
 */
export function resetBusinessState(queryClient: { clear: () => void }) {
  queryClient.clear();
}
