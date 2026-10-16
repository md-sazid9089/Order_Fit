// API base URLs.
// API_URL (browser): empty by default, so requests go to this app's own origin and the
// /api/v1 rewrite in next.config.ts proxies them to the backend. That keeps the HttpOnly
// SameSite=Lax session cookie first-party. Set NEXT_PUBLIC_API_URL only when the API is
// served from the same site as the app (e.g. local http://localhost:8000).
// SERVER_API_URL (server-side code such as /api/health): the backend address itself.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
export const SERVER_API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
