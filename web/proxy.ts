import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy } from "./lib/security-policy";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("orderfit_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/auth/signin", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  const nonce = randomBytes(32).toString("base64");
  const policy = contentSecurityPolicy(nonce, process.env.NODE_ENV === "development",
    request.nextUrl.protocol === "https:", process.env.NEXT_PUBLIC_API_URL);
  const headers = new Headers(request.headers);
  // Overwrite any client-supplied nonce/CSP; Next reads this policy to nonce its scripts.
  headers.set("Content-Security-Policy", policy);
  headers.set("x-nonce", nonce);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  // Include HTML navigations and RSC/prefetch responses: nonce-bearing output must not
  // be shared across requests. API/download policies are supplied by the backend.
  matcher: ["/((?!api(?:/|$)|_next/static|_next/image|favicon.ico|icon.png|OrderFit.png).*)"],
};
