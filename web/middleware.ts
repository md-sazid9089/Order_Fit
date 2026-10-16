import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Early request guard for admin routes.
 * Blocks unauthenticated traffic before hitting page rendering or route handlers.
 * Server components (e.g. AdminLayout) and backend APIs provide deep authoritative RBAC.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const sessionCookie = request.cookies.get("orderfit_session");
    if (!sessionCookie?.value) {
      const loginUrl = new URL("/auth/signin", request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*"],
};
