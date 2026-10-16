import { NextResponse } from "next/server";

import { SERVER_API_URL } from "@/lib/api";
import { probeFrom } from "@/lib/health-model";

// Public probe for the connection indicator. It reports liveness (/health: the process answers) and readiness
// (/ready: database, schema, storage and live worker capacity) separately, and only booleans: the backend address and error
// details stay server-side.
async function status(path: string): Promise<number | null> {
  try {
    const res = await fetch(`${SERVER_API_URL.replace(/\/$/, "")}${path}`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    return res.status;
  } catch {
    return null;
  }
}

export async function GET() {
  const [live, ready] = await Promise.all([status("/health"), status("/ready")]);
  return NextResponse.json({ ...probeFrom(live, ready), timestamp: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
}
