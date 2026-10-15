import { NextResponse } from "next/server";

export async function GET() {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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
  } catch (err: any) {
    return NextResponse.json({
      connected: false,
      backendUrl,
      mode: "offline",
      error: err?.message || "Failed to reach backend",
      timestamp: new Date().toISOString(),
    });
  }
}
