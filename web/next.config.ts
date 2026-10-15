import type { NextConfig } from "next";

// Server-side address of the FastAPI backend. The browser never calls it directly when the
// app runs behind the same-origin proxy below (the default, and the only mode used on Vercel).
const backendUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/$/, "");

if (process.env.VERCEL && !process.env.API_INTERNAL_URL) {
  // Without it the /api/v1 proxy would point at localhost and every signed-in request would fail.
  throw new Error("API_INTERNAL_URL must be set in the Vercel project (the public HTTPS URL of the OrderFit API).");
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
  // Same-origin API proxy. The session cookie is HttpOnly + SameSite=Lax with no Domain, so the
  // browser only sends it to the origin that set it: the API must be reached through this app's
  // own origin. The backend still checks Origin and the CSRF token, so its ALLOWED_ORIGINS must
  // list this app's public origin (see docs/deployment/vercel.md).
  async rewrites() {
    return [{ source: "/api/v1/:path*", destination: `${backendUrl}/api/v1/:path*` }];
  },
};

export default nextConfig;
