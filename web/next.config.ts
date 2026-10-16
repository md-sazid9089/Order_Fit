import type { NextConfig } from "next";

// Server-side address of the FastAPI backend. The browser never calls it directly when the
// app runs behind the same-origin proxy below (the default, and the only mode used on Vercel).
const backendUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

if (process.env.VERCEL && !process.env.API_INTERNAL_URL) {
  // Without it the /api/v1 proxy would point at localhost and every signed-in request would fail.
  throw new Error("API_INTERNAL_URL must be set in the Vercel project (the public HTTPS URL of the OrderFit API).");
}

if (process.env.VERCEL && process.env.NEXT_PUBLIC_API_URL) {
  // NEXT_PUBLIC_API_URL is inlined into the browser bundle, so the browser would call the API cross-site and the
  // HttpOnly SameSite=Lax session cookie (no Domain) would not be sent. Use API_INTERNAL_URL with the same-origin proxy.
  throw new Error("NEXT_PUBLIC_API_URL must not be set on Vercel: it makes the browser call the API cross-site, which breaks the SameSite=Lax session cookie. Remove it and set API_INTERNAL_URL only.");
}

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (web/Dockerfile). Vercel builds with its own adapter.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Baseline response headers for every route. The CSP is deliberately limited to frame-ancestors: Next.js emits inline
  // bootstrap scripts, so a script-src policy would need per-request nonces (which also makes every page dynamic) and has
  // not been verified against this build. frame-ancestors plus X-Frame-Options (older browsers) blocks clickjacking.
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    }];
  },
  // Same-origin API proxy. The session cookie is HttpOnly + SameSite=Lax with no Domain, so the
  // browser only sends it to the origin that set it: the API must be reached through this app's
  // own origin. The backend still checks Origin and the CSRF token, so its ALLOWED_ORIGINS must
  // list this app's public origin (see docs/deployment/vercel.md).
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
