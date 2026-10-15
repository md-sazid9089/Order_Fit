import { Suspense } from "react";
import { DealNegotiateClient } from "@/components/deals/deal-negotiate-client";

interface DealNegotiatePageProps {
  params: Promise<{ id: string }>;
}

async function NegotiateContent({ params }: DealNegotiatePageProps) {
  const { id } = await params;
  return <DealNegotiateClient id={id} />;
}

export default function DealNegotiatePage({ params }: DealNegotiatePageProps) {
  return (
    <Suspense fallback={<div className="p-8 font-mono text-xs">Loading negotiation plan...</div>}>
      <NegotiateContent params={params} />
    </Suspense>
  );
}
