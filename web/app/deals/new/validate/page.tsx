"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ValidateRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/deals/new"); }, [router]);
  return <main className="p-8">The saved-order flow has changed. Opening the manual order form…</main>;
}
