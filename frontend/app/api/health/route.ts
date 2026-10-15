import { NextResponse } from "next/server";

import { SERVER_API_URL } from "@/lib/api";

export async function GET() {
  const backendUrl = SERVER_API_URL;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(`${backendUrl}/health`, {
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json({
        connected: true,
        backendUrl,
        mode: "live",
        details: data,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      connected: false,
      backendUrl,
      mode: "offline",
      status: res.status,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    return NextResponse.json({
      connected: false,
      backendUrl,
      mode: "offline",
      error: err instanceof Error ? err.message : "Failed to reach backend",
      timestamp: new Date().toISOString(),
    });
  }
}
