/** Per-response script authority. Never derive a nonce or allowlist from request headers. */
export function contentSecurityPolicy(nonce: string, development: boolean, https: boolean, apiUrl = "") {
  if (!/^[A-Za-z0-9+/]{43}=$/.test(nonce)) throw new Error("A fresh 256-bit nonce is required");
  let apiOrigin = "";
  if (apiUrl) {
    const parsed = new URL(apiUrl);
    if (parsed.username || parsed.password || !["https:", "http:"].includes(parsed.protocol)
      || (parsed.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsed.hostname))) {
      throw new Error("Public API origin must use HTTPS or loopback HTTP");
    }
    apiOrigin = ` ${parsed.origin}`;
  }
  return [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    // Motion/UI components use inline styles. This allowance never applies to scripts.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src 'self'${apiOrigin}${development ? " ws://localhost:* ws://127.0.0.1:*" : ""}`,
    "worker-src 'self' blob:",
    "object-src 'none'", "base-uri 'none'", "form-action 'self'", "frame-ancestors 'none'", "frame-src 'none'",
    ...(https && !development ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
