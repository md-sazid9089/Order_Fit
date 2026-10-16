import { registerSessionResetListener } from "./session-reset";
import { SESSION_EXPIRED_EVENT, ApiError, get, type Session } from "./orderfit-api";

let cachedSession: Session | null = null;
let inFlightSession: Promise<Session> | null = null;

export function getCachedSession(): Session | null {
  return cachedSession;
}

export function setCachedSession(session: Session | null) {
  cachedSession = session;
}

registerSessionResetListener(() => {
  cachedSession = null;
  inFlightSession = null;
});

if (typeof window !== "undefined") {
  window.addEventListener(SESSION_EXPIRED_EVENT, () => {
    cachedSession = null;
    inFlightSession = null;
  });
}

export async function fetchSession(): Promise<Session> {
  if (inFlightSession) return inFlightSession;
  inFlightSession = get<Session>("/auth/me")
    .then(s => {
      cachedSession = s;
      return s;
    })
    .catch(async e => {
      if (e instanceof ApiError && e.status === 403 && e.code === "CSRF_REJECTED") {
        await get("/auth/csrf");
        const s = await get<Session>("/auth/me");
        cachedSession = s;
        return s;
      }
      throw e;
    })
    .finally(() => {
      inFlightSession = null;
    });
  return inFlightSession;
}
