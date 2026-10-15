import { NextResponse } from "next/server";

import { SERVER_API_URL } from "@/lib/api";

// Public liveness probe for the connection indicator. It reports only whether the backend
// answered; the backend address and error details stay server-side.
export async function GET() {
  try {
    const res = await fetch(`${SERVER_API_URL.replace(/\/$/, "")}/health`, {
      signal: AbortSignal.timeout(3000),
      cache: "no-store",
    });
    return NextResponse.json({ connected: res.ok, timestamp: new Date().toISOString() });
  } catch {
    return NextResponse.json({ connected: false, timestamp: new Date().toISOString() });
  }
}
