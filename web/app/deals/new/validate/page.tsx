"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ValidateRedirect() {
  const router = useRouter();
  useEffect(() => { const businessId = new URLSearchParams(window.location.search).get("businessId"); router.replace(`/deals/new${businessId ? `?businessId=${encodeURIComponent(businessId)}` : ""}`); }, [router]);
  return <main className="p-8">The saved-order flow has changed. Opening the manual order form…</main>;
}
