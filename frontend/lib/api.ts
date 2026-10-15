// API base URLs. The browser uses API_URL; server-side code uses SERVER_API_URL, which
// can point at an internal address (the compose service name) the browser can't reach.
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
export const SERVER_API_URL = process.env.API_INTERNAL_URL || API_URL;
