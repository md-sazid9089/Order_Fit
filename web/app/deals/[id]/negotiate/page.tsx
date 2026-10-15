import { Suspense } from "react";
import Link from "next/link";
import { DealNegotiateClient } from "@/components/deals/deal-negotiate-client";

interface DealNegotiatePageProps {
  params: Promise<{ id: string }>;
}

async function NegotiateContent({ params }: DealNegotiatePageProps) {
  const { id } = await params;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return <main className="space-y-3 p-8"><h1 className="text-xl font-semibold">Negotiation preparation is unavailable</h1><p>This workflow requires P5. Saved manual order reviews and financial results are available from your orders.</p><Link className="underline" href="/deals">Saved orders</Link></main>;
  return <DealNegotiateClient id={id} />;
}

export default function DealNegotiatePage({ params }: DealNegotiatePageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading negotiation plan...</div>}>
      <NegotiateContent params={params} />
    </Suspense>
  );
}
