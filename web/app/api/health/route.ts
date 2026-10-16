import { NextResponse } from "next/server";

import { SERVER_API_URL } from "@/lib/api";
import { probeFrom } from "@/lib/health-model";

// Public probe for the connection indicator. It reports liveness (/health: the process answers) and readiness
// (/ready: database, schema and storage usable) separately, and only booleans: the backend address and error
// details stay server-side.
async function status(path: string): Promise<number | null> {
  try {
    const res = await fetch(`${SERVER_API_URL.replace(/\/$/, "")}${path}`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    return res.status;
  } catch {
    return null;
  }
}

async function checkReady(): Promise<{ status: number | null; database: boolean | null }> {
  try {
    const res = await fetch(`${SERVER_API_URL.replace(/\/$/, "")}/ready`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    let database: boolean | null = null;
    try {
      const data = (await res.json()) as { database?: unknown } | null;
      if (data && typeof data.database === "boolean") {
        database = data.database;
      }
    } catch {
      // ignore json parse error
    }
    return { status: res.status, database };
  } catch {
    return { status: null, database: null };
  }
}

export async function GET() {
  const [live, readyResult] = await Promise.all([status("/health"), checkReady()]);
  return NextResponse.json(
    { ...probeFrom(live, readyResult.status, readyResult.database), timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
